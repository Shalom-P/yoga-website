import "server-only";

import crypto from "node:crypto";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { resolvePackBySlug } from "@/lib/razorpay/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { normalizePromoCode, promoErrorMessage, reserveDiscount } from "@/lib/billing/promo";
import {
  canTransactFromRequest,
  countryFromHeaders,
  resolveRegion,
  OUTSIDE_SERVICE_AREA,
} from "@/lib/geo/region";

// resolvePackBySlug uses the service-role client; Node runtime required.
export const runtime = "nodejs";

/**
 * POST /api/payments/intent
 *
 * The single entry point the "buy a pack" UI calls. It decides the payment rail
 * server-side from the GeoIP-first region signal (the client cannot read GeoIP),
 * so a UAE customer always lands on the manual bank-transfer rail even if their
 * device timezone disagrees:
 *
 *   - India (INR)  → { method: "razorpay" }. No side effects; the client runs
 *                    the existing Razorpay Checkout flow (create-order → verify).
 *   - UAE (AED)    → records (or reuses) a `pending` bank-transfer payment so it
 *                    appears in the admin verification queue, and returns the
 *                    amount + a reference for the SWIFT instructions dialog.
 *
 * AED-via-Razorpay is intentionally NOT offered here — Razorpay International is
 * not enabled, so UAE purchases go through the manual rail until it is.
 */

const bodySchema = z.object({
  planSlug: z.string().trim().min(1).max(64),
  // The visitor's live browser timezone (IANA id) — service-area gate + currency
  // fallback when GeoIP is absent (local/off-platform). Never a price input.
  clientTimezone: z.string().trim().min(1).max(64),
  // Optional promo code (applied server-side; never a price input).
  promoCode: z.string().trim().max(64).optional(),
});

/** Short, ambiguity-free transfer reference, e.g. "MYC-7K2QF9". */
function makeReference(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // no 0/O/1/I/L
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (let i = 0; i < bytes.length; i++) code += alphabet[bytes[i] % alphabet.length];
  return `MYC-${code}`;
}

export async function POST(req: Request): Promise<Response> {
  // Authenticate first — fail fast before touching the body.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sign in to start checkout." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  // Service-area gate (same as create-order): non-admins must be in UAE/India.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .maybeSingle();
  const country = countryFromHeaders(req.headers);
  if (
    !canTransactFromRequest({
      isAdmin: profile?.role === "admin",
      country,
      timezone: parsed.data.clientTimezone,
    })
  ) {
    return Response.json(
      {
        error: OUTSIDE_SERVICE_AREA,
        message: "Session packs can only be purchased from within the UAE or India.",
      },
      { status: 403 },
    );
  }

  const { currency } = resolveRegion({ country, timezone: parsed.data.clientTimezone });

  // India (INR) and anything that isn't UAE → Razorpay. No record is created
  // here; the client proceeds with the untouched create-order → Checkout flow.
  if (currency !== "AED") {
    return Response.json({ method: "razorpay", currency });
  }

  // UAE (AED) → manual SWIFT transfer (temporary rail). Resolve the pack for its
  // plan id + credit count.
  const pack = await resolvePackBySlug(parsed.data.planSlug, "AED");
  if (!pack) {
    return Response.json({ error: "Unknown plan" }, { status: 400 });
  }

  const svc = createSupabaseServiceClient();

  // Require an explicit AED price. resolvePackBySlug would otherwise fall back to
  // plans.price_base_cents (INR-denominated), so a plan missing its AED row would
  // record an INR figure labelled AED — and that figure is exactly the amount the
  // customer is told to wire. Fail loud rather than instruct a wrong transfer.
  const { data: aedPrice } = await svc
    .from("plan_prices")
    .select("amount_cents")
    .eq("plan_id", pack.planId)
    .eq("currency", "AED")
    .maybeSingle();
  if (!aedPrice) {
    Sentry.captureMessage(`bank-transfer intent: no AED price for plan ${pack.planId}`, "warning");
    return Response.json({ error: "AED price not configured for this plan." }, { status: 400 });
  }
  const originalAmount = aedPrice.amount_cents;

  // Reuse an open transfer for this customer + plan so repeated clicks don't pile
  // up duplicate rows in the verification queue. A partial unique index (0030)
  // backs this against races; on a 23505 we re-read the row that won the race.
  const selectOpen = () =>
    svc
      .from("payments")
      .select("id, reference, amount_cents")
      .eq("customer_id", user.id)
      .eq("plan_id", pack.planId)
      .eq("method", "bank_transfer")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  let payment = (await selectOpen()).data;

  // Promo codes apply only when CREATING a fresh transfer — never re-priced onto
  // an in-flight one the customer may already be wiring. Reserve the discount +
  // discounted amount server-side before the insert; link it to the payment after.
  const promoCode = payment ? null : normalizePromoCode(parsed.data.promoCode);
  let amountCents = originalAmount;
  let reservation: Extract<Awaited<ReturnType<typeof reserveDiscount>>, { ok: true }> | null = null;
  if (promoCode) {
    const email = user.email ?? profile?.email ?? null;
    if (!email) {
      return Response.json(
        { error: "promo_email_required", message: promoErrorMessage("email_required") },
        { status: 400 },
      );
    }
    const result = await reserveDiscount(svc, {
      code: promoCode,
      planId: pack.planId,
      customerId: user.id,
      email,
      currency: "AED",
      originalAmountCents: originalAmount,
    });
    if (!result.ok) {
      return Response.json(
        { error: "promo_invalid", reason: result.error, message: promoErrorMessage(result.error) },
        { status: 400 },
      );
    }
    reservation = result;
    amountCents = result.finalAmountCents;
  }

  let inserted = false;
  for (let attempt = 0; attempt < 2 && !payment; attempt++) {
    const { data, error } = await svc
      .from("payments")
      .insert({
        customer_id: user.id,
        plan_id: pack.planId,
        method: "bank_transfer",
        status: "pending",
        amount_cents: amountCents,
        currency: "AED",
        reference: makeReference(),
        discount_code_id: reservation?.discountCodeId ?? null,
        discount_amount_cents: reservation?.discountAmountCents ?? null,
      })
      .select("id, reference, amount_cents")
      .single();
    if (!error && data) {
      payment = data;
      inserted = true;
      break;
    }
    if (error?.code === "23505") {
      // Lost a race — either a concurrent pending row (the one-pending index) or
      // the ~0 reference collision. Prefer the existing pending row; if there
      // isn't one it was a reference clash, so loop and retry with a new code.
      payment = (await selectOpen()).data;
      continue;
    }
    Sentry.captureMessage(
      `bank-transfer intent insert failed: ${error?.message ?? "unknown"}`,
      "warning",
    );
    if (reservation) {
      await svc.rpc("release_discount_reservation", { p_redemption_id: reservation.redemptionId });
    }
    return Response.json({ error: "Could not start bank transfer." }, { status: 500 });
  }
  if (!payment) {
    if (reservation) {
      await svc.rpc("release_discount_reservation", { p_redemption_id: reservation.redemptionId });
    }
    return Response.json({ error: "Could not start bank transfer." }, { status: 500 });
  }

  // Link the reservation to the payment it discounted (commit happens at admin
  // verify). If we lost the insert race and reused an existing transfer instead,
  // the reservation is orphaned — free it back to the pool.
  if (reservation) {
    if (inserted) {
      await svc
        .from("discount_redemptions")
        .update({ payment_id: payment.id })
        .eq("id", reservation.redemptionId);
    } else {
      await svc.rpc("release_discount_reservation", { p_redemption_id: reservation.redemptionId });
      reservation = null;
    }
  }

  return Response.json({
    method: "bank_transfer",
    currency: "AED",
    payment: {
      id: payment.id,
      reference: payment.reference,
      amountCents: payment.amount_cents,
    },
    plan: { name: pack.name, sessionCredits: pack.sessionCredits },
    discount: reservation
      ? {
          code: reservation.code,
          amountCents: reservation.discountAmountCents,
          finalAmountCents: reservation.finalAmountCents,
          originalAmountCents: originalAmount,
        }
      : null,
    // A promo was typed but couldn't apply because an in-flight transfer was
    // reused — the client surfaces a notice so it doesn't look like the code failed.
    promoIgnored: normalizePromoCode(parsed.data.promoCode) !== null && !reservation,
  });
}
