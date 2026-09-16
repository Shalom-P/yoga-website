// Shared request/response shapes for the admin override surface (migration
// 0039). Imported by route handlers AND by client components, so it must stay
// dependency-free: no `server-only`, no zod, no runtime imports at all. Types
// only, so it erases entirely at build time.
//
// The error strings that travel in `error` are the AdminErrorCode union in
// lib/ui/errors.ts, which is also where they are turned into sentences. Nothing
// here should ever be rendered raw.

/** Every admin route's failure body. `error` is an AdminErrorCode. */
export type AdminErrorBody = { error: string; message?: string; [k: string]: unknown };

/**
 * Non-blocking observations the server made while doing what it was asked.
 * An admin override is allowed to sit outside a teacher's posted hours; the
 * point is that the operator is told, not stopped.
 */
export type AdminWarning =
  | "outside_availability"
  | "blocked_date"
  | "teacher_has_no_calendar"
  | "attendee_not_invited"
  | "teacher_inactive";

export type EnrolResultRow = {
  customerId: string;
  bookingId: string | null;
  charged: boolean;
  comped: boolean;
  /** An AdminErrorCode when bookingId is null, otherwise null. */
  error: string | null;
};

export type AdminEnrolResponse = {
  ok: true;
  results: EnrolResultRow[];
  enrolled: number;
  failed: number;
  /** customerId -> new credit balance, for the roster's "N sessions left" line. */
  balances: Record<string, number>;
  meetLink: string | null;
  warnings: AdminWarning[];
};

export type BookingActionResponse =
  | { ok: true; action: "attendance"; bookingId: string; status: "attended" | "no_show" | "confirmed" }
  | { ok: true; action: "cancel"; bookingId: string; refunded: boolean; balance: number | null; meetReleased: boolean }
  | { ok: true; action: "move"; bookingId: string; fromSessionId: string; toSessionId: string; meetReleased: boolean };

export type SessionPatchResponse = {
  ok: true;
  sessionId: string;
  meetAction: "none" | "reprovision";
  meetReissued: boolean;
  /** Live shares that would be orphaned by a teacher change. Drives the dry run. */
  phiSharesAffected: number;
  phiSharesRevoked: number;
  remindersReset: number;
  enrolled: number;
  warnings: AdminWarning[];
};

export type SessionCancelResponse = {
  ok: true;
  sessionId: string;
  cancelledBookings: number;
  refundedBookings: number;
  meetReleased: boolean;
};

export type AdminCustomerRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  timezone: string;
  credits: number;
  /** A live (non-cancelled) free-trial booking already exists for this person. */
  hasLiveFreeTrial: boolean;
};

export type AdminCustomerSearchResponse = { ok: true; customers: AdminCustomerRow[] };

/**
 * What GET /api/admin/payments answers when an admin pastes a Razorpay payment
 * id. Every figure comes from Razorpay, never from the form, so the amount and
 * currency the studio files can never disagree with what was actually taken.
 */
export type RazorpayLookupResponse =
  | {
      ok: true;
      found: true;
      payment: {
        id: string;
        orderId: string | null;
        status: "created" | "authorized" | "captured" | "refunded" | "failed";
        captured: boolean;
        amountCents: number;
        currency: string;
        method: string | null;
        email: string | null;
        contact: string | null;
        /** ISO, from Razorpay's unix-seconds created_at. */
        paidAt: string;
        amountRefundedCents: number;
      };
      /**
       * True when the Razorpay ORDER carries this app's own notes, i.e. the
       * normal fulfilment path applies and nothing needs to be hand-written.
       */
      fulfillable: boolean;
      notesCustomerId: string | null;
      notesPlanId: string | null;
      /** Non-null when this payment is already on file. Blocks double entry. */
      existing: { id: string; status: string; entrySource: string; customerId: string | null } | null;
    }
  | { ok: true; found: false; reason: "not_found_at_razorpay" };

export type RecordPaymentResponse =
  /** The order was one of ours, so normal fulfilment ran and credited the buyer. */
  | { ok: true; mode: "fulfilled"; customerId: string; balance: number }
  /** Hand-entered row. `credited` is 0 when the admin chose not to release yet. */
  | { ok: true; mode: "recorded"; paymentId: string; verified: boolean; credited: number; balance: number | null };

export type PaymentActionResponse =
  | { ok: true; status: "completed"; balance: number }
  | { ok: true; status: "failed" }
  | { ok: true; action: "resync"; razorpayStatus: string; outcome: "none" | "completed" | "reversed"; clawedBack?: number; balance?: number }
  | { ok: true; action: "record_refund"; clawedBack: number; balance: number };
