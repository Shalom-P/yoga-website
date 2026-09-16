import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { RazorpayLookupResponse, RecordPaymentResponse } from "@/lib/admin/contracts";
import { writeAuditLog } from "@/lib/admin/audit";
import { requireAdminApi } from "@/lib/auth/apiGuards";
import { SUPPORTED_CURRENCIES } from "@/lib/geo/region";
import { getRazorpayClient, isRazorpayConfigured } from "@/lib/razorpay/client";
import { fulfillRazorpayPayment } from "@/lib/razorpay/fulfillment";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { PaymentMethod } from "@/lib/supabase/types";

// Razorpay SDK + service-role client.
export const runtime = "nodejs";
// The lookup reads live Razorpay state, so it must never be cached.
export const dynamic = "force-dynamic";

/**
 * /api/admin/payments — the hand-entry rail for money that arrived without the
 * site noticing: a Razorpay capture whose webhook never landed (the webhook
 * secret is still unset in production), a UAE wire against no open transfer,
 * cash or UPI settled offline.
 *
 * GET looks a Razorpay payment up and writes nothing, so the admin sees the real
 * amount, currency and payer before attributing anything. POST records it.
 *
 * The one rule that matters more than the rest: POST INSERTs. It never upserts
 * on razorpay_payment_id. That unique index has been TOTAL since 0033, so an
 * upsert would silently UPDATE a genuine automatically-written row in place and
 * replace its customer, amount, currency, status and paid_at with whatever was
 * typed into the form. The mirror-image case (the webhook arriving after a hand
 * entry) is guarded inside lib/razorpay/fulfillment.ts.
 */

const lookupSchema = z.object({
  razorpayPaymentId: z.string().trim().regex(/^pay_[A-Za-z0-9]{6,32}$/),
});

/** Razorpay SDK errors are plain objects with a string-or-number statusCode. */
function razorpayStatus(err: unknown): number | null {
  if (!err || typeof err !== "object" || !("statusCode" in err)) return null;
  const raw = (err as { statusCode: unknown }).statusCode;
  const code = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(code) ? code : null;
}

export async function GET(req: Request): Promise<Response> {
  const gate = await requireAdminApi();
  if (gate instanceof NextResponse) return gate;

  const parsed = lookupSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { razorpayPaymentId } = parsed.data;

  // getRazorpayClient() throws at construction when the keys are missing and
  // nothing in the repo catches it, so check before touching it.
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: "razorpay_not_configured" }, { status: 503 });
  }

  const svc = createSupabaseServiceClient();

  // Our own table first. An admin about to double-enter a payment should find
  // that out before the API round trip, not after filling in the form.
  const { data: existing } = await svc
    .from("payments")
    .select("id, status, entry_source, customer_id")
    .eq("razorpay_payment_id", razorpayPaymentId)
    .maybeSingle();

  const rzp = getRazorpayClient();
  let payment;
  try {
    payment = await rzp.payments.fetch(razorpayPaymentId);
  } catch (err) {
    const status = razorpayStatus(err);
    // "Razorpay has never heard of that id" is a legitimate ANSWER to a lookup,
    // not a transport failure, so it comes back 200 with found: false.
    if (status === 400 || status === 404) {
      return NextResponse.json({
        ok: true,
        found: false,
        reason: "not_found_at_razorpay",
      } satisfies RazorpayLookupResponse);
    }
    if (status === 401) {
      return NextResponse.json({ error: "razorpay_unauthorized" }, { status: 502 });
    }
    Sentry.captureException(err, { tags: { route: "admin/payments", op: "lookup" } });
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }

  // The order's notes are what fulfilment attributes on. When they are present
  // this payment came from our own Checkout and the normal path applies, so the
  // UI can say "this will be fulfilled, not hand-written".
  let notesCustomerId: string | null = null;
  let notesPlanId: string | null = null;
  if (payment.order_id) {
    try {
      const order = await rzp.orders.fetch(payment.order_id);
      const notes = (order.notes ?? {}) as Record<string, string | number>;
      notesCustomerId = typeof notes.customerId === "string" ? notes.customerId : null;
      notesPlanId = typeof notes.planId === "string" ? notes.planId : null;
    } catch {
      // Best effort. A readable payment with an unreadable order is still worth
      // showing; it just cannot claim to be fulfillable.
    }
  }

  return NextResponse.json({
    ok: true,
    found: true,
    payment: {
      id: payment.id,
      orderId: payment.order_id ?? null,
      status: payment.status,
      captured: Boolean(payment.captured),
      amountCents: Number(payment.amount),
      currency: payment.currency,
      method: payment.method ?? null,
      // Shown once so the admin can confirm identity before attributing. Never
      // written to audit_log by the POST, and card details, tokens and raw SDK
      // errors are never echoed at all.
      email: payment.email || null,
      contact: payment.contact != null ? String(payment.contact) : null,
      // Razorpay reports unix SECONDS.
      paidAt: new Date(Number(payment.created_at) * 1000).toISOString(),
      amountRefundedCents: Number(payment.amount_refunded ?? 0),
    },
    fulfillable: Boolean(notesCustomerId && notesPlanId),
    notesCustomerId,
    notesPlanId,
    existing: existing
      ? {
          id: existing.id,
          status: existing.status,
          entrySource: existing.entry_source,
          customerId: existing.customer_id,
        }
      : null,
  } satisfies RazorpayLookupResponse);
}

const recordSchema = z
  .discriminatedUnion("source", [
    z.object({
      source: z.literal("razorpay"),
      // amount / currency / paidAt are NEVER taken from the client: they come
      // back from payments.fetch(). The admin only attributes the payment.
      razorpayPaymentId: z.string().trim().regex(/^pay_[A-Za-z0-9]{6,32}$/),
      customerId: z.string().uuid(),
      planId: z.string().uuid().nullable().default(null),
      grantCredits: z.boolean().default(true),
      note: z.string().trim().min(3).max(1000),
    }),
    z.object({
      source: z.literal("manual"),
      // Cash, UPI, an offline receipt. No Razorpay id exists, so the reference
      // is the only dedupe key this row will ever have.
      reference: z.string().trim().min(3).max(64),
      customerId: z.string().uuid(),
      planId: z.string().uuid().nullable().default(null),
      amountCents: z.number().int().min(1).max(100_000_000),
      currency: z.enum(SUPPORTED_CURRENCIES as unknown as [string, ...string[]]),
      paidAt: z.string().datetime({ offset: true }),
      grantCredits: z.boolean().default(true),
      note: z.string().trim().min(3).max(1000),
    }),
    z.object({
      source: z.literal("bank_transfer"),
      reference: z.string().trim().min(3).max(64),
      customerId: z.string().uuid(),
      planId: z.string().uuid().nullable().default(null),
      amountCents: z.number().int().min(1).max(100_000_000),
      currency: z.enum(SUPPORTED_CURRENCIES as unknown as [string, ...string[]]),
      paidAt: z.string().datetime({ offset: true }),
      grantCredits: z.boolean().default(true),
      note: z.string().trim().min(3).max(1000),
    }),
  ])
  .refine((v) => !v.grantCredits || v.planId !== null, { message: "missing_plan" });

export async function POST(req: Request): Promise<Response> {
  const gate = await requireAdminApi();
  if (gate instanceof NextResponse) return gate;

  const parsed = recordSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    const missingPlan = parsed.error.issues.some((issue) => issue.message === "missing_plan");
    return NextResponse.json(
      { error: missingPlan ? "missing_plan" : "bad request" },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const svc = createSupabaseServiceClient();

  const { data: customer } = await svc
    .from("profiles")
    .select("id, role")
    .eq("id", body.customerId)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: "customer_not_found" }, { status: 404 });
  if (customer.role !== "customer") {
    return NextResponse.json({ error: "customer_not_eligible" }, { status: 409 });
  }

  // How many sessions this releases. Deliberately NOT filtered on is_active:
  // someone who paid for a since-hidden pack must still be credited, which is
  // why resolvePackById has no such filter either.
  let credits = 0;
  if (body.grantCredits) {
    const planId = body.planId;
    if (!planId) return NextResponse.json({ error: "missing_plan" }, { status: 400 });
    const { data: plan } = await svc
      .from("plans")
      .select("session_credits")
      .eq("id", planId)
      .maybeSingle();
    if (!plan) return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
    credits = plan.session_credits ?? 0;
    // grant_session_credits returns silently on p_delta <= 0 (0011), so without
    // this the route would record money, release nothing, and report success.
    if (credits <= 0) {
      return NextResponse.json({ error: "no_credits_for_plan" }, { status: 400 });
    }
  }

  let method: PaymentMethod;
  let amountCents: number;
  let currency: string;
  let paidAtIso: string;
  let reference: string | null = null;
  let razorpayPaymentId: string | null = null;
  let razorpayOrderId: string | null = null;

  if (body.source === "razorpay") {
    if (!isRazorpayConfigured()) {
      return NextResponse.json({ error: "razorpay_not_configured" }, { status: 503 });
    }
    const rzp = getRazorpayClient();

    let payment;
    try {
      payment = await rzp.payments.fetch(body.razorpayPaymentId);
    } catch (err) {
      const status = razorpayStatus(err);
      if (status === 400 || status === 404) {
        return NextResponse.json({ error: "razorpay_payment_not_found" }, { status: 404 });
      }
      if (status === 401) {
        return NextResponse.json({ error: "razorpay_unauthorized" }, { status: 502 });
      }
      Sentry.captureException(err, { tags: { route: "admin/payments", op: "record" } });
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }

    // Does this payment belong to an order WE created? If so the webhook simply
    // missed it, and the right answer is to run the one fulfilment point rather
    // than hand-write a second-class copy of the row it would have produced.
    let notesCustomerId: string | null = null;
    let notesPlanId: string | null = null;
    if (payment.order_id) {
      try {
        const order = await rzp.orders.fetch(payment.order_id);
        const notes = (order.notes ?? {}) as Record<string, string | number>;
        notesCustomerId = typeof notes.customerId === "string" ? notes.customerId : null;
        notesPlanId = typeof notes.planId === "string" ? notes.planId : null;
      } catch {
        // Unreadable order: fall through to the out-of-band path below.
      }
    }

    if (payment.order_id && notesCustomerId && notesPlanId) {
      // Delegating also captures an authorized hold, cross-checks amount and
      // currency against the order, grants purchase-once and commits any promo
      // redemption. Because the resulting row is byte-identical to the webhook's,
      // a later webhook for it cannot clobber anything. Note that the plan and
      // the release decision come from the ORDER, not from the form: this order
      // already promised the buyer a specific pack.
      const result = await fulfillRazorpayPayment(payment.order_id, body.razorpayPaymentId, {
        expectedCustomerId: body.customerId,
      });
      if (!result.ok) {
        if (result.reason === "customer_mismatch") {
          return NextResponse.json(
            {
              error: "bad request",
              message: `That order was created for a different customer (${notesCustomerId}). Pick that customer, or record it as an offline payment.`,
            },
            { status: 409 },
          );
        }
        if (result.reason.startsWith("not_paid")) {
          return NextResponse.json(
            { error: "not_captured", razorpayStatus: payment.status },
            { status: 409 },
          );
        }
        if (result.reason === "plan_not_found") {
          return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
        }
        if (result.reason === "order_mismatch") {
          return NextResponse.json({ error: "order_mismatch" }, { status: 409 });
        }
        if (result.reason === "amount_mismatch" || result.reason === "currency_mismatch") {
          return NextResponse.json({ error: result.reason }, { status: 409 });
        }
        if (result.reason === "manual_entry_conflict") {
          // Another admin already filed this payment against a different person
          // or pack. fulfillment.ts has raised it to Sentry and the audit log.
          return NextResponse.json({ error: "already_recorded" }, { status: 409 });
        }
        if (result.reason === "grant_failed") {
          return NextResponse.json({ error: "grant_failed" }, { status: 500 });
        }
        return NextResponse.json({ error: "record_failed" }, { status: 500 });
      }

      // Fulfilment owns the row, so re-read its id purely to anchor the audit.
      const { data: fulfilledRow } = await svc
        .from("payments")
        .select("id")
        .eq("razorpay_payment_id", body.razorpayPaymentId)
        .maybeSingle();
      if (fulfilledRow) {
        await writeAuditLog(svc, {
          actorId: gate.userId,
          action: "admin_record_payment",
          entityType: "payment",
          entityId: fulfilledRow.id,
          payload: {
            source: body.source,
            mode: "fulfilled",
            razorpay_payment_id: body.razorpayPaymentId,
            razorpay_order_id: payment.order_id,
            customer_id: result.customerId,
            plan_id: notesPlanId,
            note: body.note,
          },
        });
      }

      return NextResponse.json({
        ok: true,
        mode: "fulfilled",
        customerId: result.customerId,
        balance: result.credits,
      } satisfies RecordPaymentResponse);
    }

    // Genuinely out of band: no order, or an order with no usable notes. Every
    // figure still comes from Razorpay, never from the form.
    if (payment.status !== "captured") {
      return NextResponse.json(
        { error: "not_captured", razorpayStatus: payment.status },
        { status: 409 },
      );
    }
    if (Number(payment.amount_refunded ?? 0) > 0) {
      return NextResponse.json({ error: "refunded_payment" }, { status: 409 });
    }
    method = "razorpay";
    amountCents = Number(payment.amount);
    currency = payment.currency;
    paidAtIso = new Date(Number(payment.created_at) * 1000).toISOString();
    razorpayPaymentId = body.razorpayPaymentId;
    razorpayOrderId = payment.order_id ?? null;
  } else {
    // MYC-XXXXXX is the namespace POST /api/payments/intent generates, and it
    // shares the unique payments_reference_key (0030). Letting an admin type one
    // in would collide with a real customer transfer, or shadow one.
    if (/^MYC-/i.test(body.reference)) {
      return NextResponse.json({ error: "reserved_reference" }, { status: 400 });
    }
    method = body.source === "manual" ? "manual" : "bank_transfer";
    amountCents = body.amountCents;
    currency = body.currency;
    paidAtIso = new Date(body.paidAt).toISOString();
    reference = body.reference;

    if (method === "bank_transfer" && body.planId) {
      // An open transfer for this customer and pack already exists. Verifying
      // THAT row is the right move: it is the one the customer was told to wire
      // against, and it carries any promo they reserved at checkout.
      const { data: open } = await svc
        .from("payments")
        .select("id")
        .eq("customer_id", body.customerId)
        .eq("plan_id", body.planId)
        .eq("method", "bank_transfer")
        .eq("status", "pending")
        .maybeSingle();
      if (open) {
        return NextResponse.json(
          { error: "pending_transfer_exists", paymentId: open.id },
          { status: 409 },
        );
      }
    }
  }

  const nowIso = new Date().toISOString();

  // EVERY hand-entered row starts 'pending' and is flipped only after the grant
  // lands, so a grant failure leaves it retryable rather than stranded
  // 'completed' with no sessions released. Same ordering, same reason, as the
  // customer-facing bank-transfer rail and as verify.
  //
  // method='bank_transfer' used to be written straight to 'completed', because
  // payments_one_pending_bank_transfer (0030) treats a PENDING bank-transfer row
  // as an open instruction to wire and POST /api/payments/intent reuses exactly
  // that row. That cure was worse than the disease: a grant failure left a
  // 'completed' row with no sessions released, and Verify is offered only on
  // pending rows, so the only way back was psql. The pending window is now one
  // request wide, the pre-insert check above (and the index itself) still stops
  // a hand entry landing on top of a real open transfer, and a row stranded in
  // that window is recovered with Verify, which re-runs the purchase-once (so
  // idempotent) grant. That is exactly what the grant_failed copy tells the
  // admin to do.

  const { data: inserted, error: insErr } = await svc
    .from("payments")
    .insert({
      customer_id: body.customerId,
      plan_id: body.planId,
      method,
      entry_source: "admin_manual",
      status: "pending",
      amount_cents: amountCents,
      // NOT NULL with no default since 0022, and formatMoney feeds it straight
      // into Intl.NumberFormat, which THROWS on a bad ISO 4217 code and would
      // take out the whole admin table rather than one cell. Hence the zod enum.
      currency,
      reference,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_order_id: razorpayOrderId,
      admin_note: body.note,
      // The REAL capture time, not now(). admin_kpis buckets revenue on paid_at.
      paid_at: paidAtIso,
      recorded_by: gate.userId,
      // Stamped by the conditional flip below, once the grant has landed.
      verified_by: null,
      verified_at: null,
    })
    .select("id")
    .single();

  let paymentRowId = inserted?.id ?? null;

  if (insErr) {
    const message = insErr.message ?? "";
    if (
      insErr.code === "23505" &&
      message.includes("payments_razorpay_payment_id_key") &&
      razorpayPaymentId
    ) {
      const { data: clash } = await svc
        .from("payments")
        .select("id, status, customer_id, plan_id")
        .eq("razorpay_payment_id", razorpayPaymentId)
        .maybeSingle();
      // A row we left 'pending' is almost always this same admin retrying after
      // a grant_failed, so adopt it and finish the job instead of dead-ending.
      //
      // Only when the attribution is IDENTICAL, though. The grant below is keyed
      // on the adopted row id, so adopting a row that names a different customer
      // or a different pack would credit the person on the form against somebody
      // else's money: credit_ledger_purchase_once (unique on payment_id where
      // reason='purchase') then burns that payment's one grant for good, and a
      // later refund would aim the clawback at the wrong balance, because
      // reverseRazorpayPayment sizes it from the ledger but debits
      // payments.customer_id. Anything else is already on file against someone
      // else and belongs to the existing row, which the dialog links straight to.
      if (
        clash &&
        clash.status === "pending" &&
        clash.customer_id === body.customerId &&
        clash.plan_id === body.planId
      ) {
        paymentRowId = clash.id;
      } else {
        return NextResponse.json(
          { error: "already_recorded", paymentId: clash?.id ?? null },
          { status: 409 },
        );
      }
    } else if (insErr.code === "23505" && message.includes("payments_one_pending_bank_transfer")) {
      return NextResponse.json({ error: "pending_transfer_exists" }, { status: 409 });
    } else if (insErr.code === "23505" && message.includes("payments_reference_key")) {
      return NextResponse.json({ error: "reference_taken" }, { status: 409 });
    } else if (insErr.code === "23505") {
      // Some other unique key. Report it as a duplicate rather than a server
      // fault, but log the constraint so it can be mapped properly next time.
      Sentry.captureMessage(`admin record payment hit an unmapped unique: ${message}`, "warning");
      return NextResponse.json({ error: "already_recorded" }, { status: 409 });
    } else if (insErr.code === "23514") {
      // A CHECK constraint the zod schema should already have caught.
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    } else {
      Sentry.captureMessage(`admin record payment insert failed: ${message}`, "warning");
      return NextResponse.json({ error: "record_failed" }, { status: 500 });
    }
  }

  if (!paymentRowId) return NextResponse.json({ error: "record_failed" }, { status: 500 });

  // Grant FIRST. p_reason 'purchase' with the real p_payment_id is the only pair
  // credit_ledger_purchase_once protects, and the only ledger shape
  // reverseRazorpayPayment can find when it sizes a clawback. 'admin_adjust'
  // here would forfeit replay protection AND make a future refund claw back
  // nothing while still flipping the row to 'refunded'.
  if (body.grantCredits) {
    const { error: grantErr } = await svc.rpc("grant_session_credits", {
      p_customer: body.customerId,
      p_delta: credits,
      p_reason: "purchase",
      p_payment_id: paymentRowId,
    });
    if (grantErr) return NextResponse.json({ error: "grant_failed" }, { status: 500 });
  }

  // Conditioned on 'pending', so it is a harmless no-op for a row a concurrent
  // verify already flipped, and it only ever runs AFTER the grant above.
  const { error: updErr } = await svc
    .from("payments")
    .update({ status: "completed", verified_by: gate.userId, verified_at: nowIso })
    .eq("id", paymentRowId)
    .eq("status", "pending");
  if (updErr) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  await writeAuditLog(svc, {
    actorId: gate.userId,
    action: "admin_record_payment",
    entityType: "payment",
    entityId: paymentRowId,
    // The payer email and contact Razorpay returned are deliberately excluded.
    payload: {
      source: body.source,
      method,
      amount_cents: amountCents,
      currency,
      plan_id: body.planId,
      customer_id: body.customerId,
      credits: body.grantCredits ? credits : 0,
      razorpay_payment_id: razorpayPaymentId,
      reference,
      grant_requested: body.grantCredits,
      note: body.note,
    },
  });

  const { data: bal } = await svc
    .from("customer_credits")
    .select("balance")
    .eq("customer_id", body.customerId)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    mode: "recorded",
    paymentId: paymentRowId,
    verified: body.source === "razorpay",
    credited: body.grantCredits ? credits : 0,
    balance: bal?.balance ?? null,
  } satisfies RecordPaymentResponse);
}
