// Map raw Supabase/Postgres error strings to human-friendly UI copy so backend
// phrasing (auth rate limits, RLS policy text, PG error codes) never reaches a
// toast. Pattern-match the few cases worth special-casing; everything else gets a
// safe generic message.

function isRateLimit(m: string): boolean {
  return m.includes("rate limit") || m.includes("too many") || m.includes("429");
}

/** For the login / email-OTP flow. */
export function friendlyAuthError(message?: string | null): string {
  const m = (message ?? "").toLowerCase();
  if (isRateLimit(m)) return "Too many attempts. Please wait a minute and try again.";
  // GoTrue answers 500 `unexpected_failure` / "Error sending confirmation email"
  // when the mailer itself fails: custom SMTP unset, so the built-in sender is
  // in play and refuses any address outside the Supabase org. Distinct copy
  // because the user has done nothing wrong and retrying will not help them.
  if (m.includes("error sending")) {
    return "We couldn't send that code. Please try another sign-in option, or contact hello@myyogaclasses.fit.";
  }
  if (m.includes("expired") || m.includes("invalid") || m.includes("token")) {
    return "That code looks invalid or has expired. Please request a new one.";
  }
  return "Something went wrong. Please try again.";
}

/** For authenticated DB writes (onboarding, profile). */
export function friendlyFormError(message?: string | null): string {
  const m = (message ?? "").toLowerCase();
  if (isRateLimit(m)) return "Too many attempts. Please wait a minute and try again.";
  return "Couldn't save your details just now. Please try again.";
}

// --- Admin override surface (migration 0039) ------------------------------
// The admin routes never return a Postgres string. Each one answers with a
// snake_case code from this union in `error`, and every admin client renders it
// through friendlyAdminError. The two halves are a closed set on purpose: a new
// code added to the union without copy is a compile error, which is what keeps
// an RLS policy string or a unique-constraint message from ever reaching a toast.

export type AdminErrorCode =
  | "unauthenticated" | "forbidden" | "bad request"
  | "admin_only" | "session_not_found" | "session_cancelled" | "session_not_open"
  | "session_not_reschedulable" | "session_full" | "capacity_below_enrolled"
  | "slot_taken" | "teacher_not_found" | "category_not_found"
  | "customer_not_found" | "customer_not_eligible" | "already_enrolled"
  | "trial_already_claimed" | "insufficient_credits" | "booking_not_found"
  | "booking_cancelled" | "already_cancelled" | "not_cancellable"
  | "status_changed" | "same_session" | "target_not_found" | "target_not_open"
  | "not_found" | "already_completed" | "not_pending"
  | "bad_time_range" | "start_in_past" | "no_changes"
  | "razorpay_not_configured" | "razorpay_payment_not_found" | "razorpay_unauthorized"
  | "upstream_error" | "not_captured" | "order_mismatch" | "refunded_payment"
  | "not_completed"
  | "already_recorded" | "reference_taken" | "reserved_reference"
  | "pending_transfer_exists" | "amount_mismatch" | "currency_mismatch"
  | "amount_required" | "currency_required" | "razorpay_id_required"
  | "plan_not_found" | "missing_plan" | "no_credits_for_plan"
  | "no_razorpay_id" | "payment_detached" | "not_admin_verifiable"
  | "grant_failed" | "record_failed" | "update_failed" | "db_error" | "enrol_failed"
  | "create_failed";

const ADMIN_ERROR_COPY: Record<AdminErrorCode, string> = {
  unauthenticated: "Your session expired. Please sign in again.",
  forbidden: "You do not have permission to do that.",
  "bad request": "Some details are missing or invalid. Please check the form.",
  admin_only: "You do not have permission to do that.",
  session_not_found: "That class no longer exists.",
  session_cancelled: "That class is cancelled, so nobody can be added to it.",
  session_not_open: "That class is finished or cancelled.",
  session_not_reschedulable: "That class is live or finished, so its time cannot be moved.",
  session_full: "That class is full. Raise the capacity to fit another student.",
  capacity_below_enrolled: "Capacity cannot go below the students already booked.",
  slot_taken: "That teacher already has a class at this time.",
  teacher_not_found: "That teacher could not be found.",
  category_not_found: "That class type could not be found.",
  customer_not_found: "That customer could not be found.",
  customer_not_eligible: "Only customer accounts can be added to a class.",
  already_enrolled: "That student is already in this class.",
  trial_already_claimed: "That student has already used their introductory 1:1.",
  insufficient_credits:
    "That student has no prepaid sessions left. Record a payment, add sessions, or add them without charging one.",
  booking_not_found: "That booking could not be found.",
  booking_cancelled: "That booking is cancelled. Add the student again instead.",
  already_cancelled: "That booking was already cancelled.",
  not_cancellable: "That booking is not in a state that can be cancelled.",
  status_changed: "This booking changed while you were looking at it. Refresh and try again.",
  same_session: "That student is already in that class.",
  target_not_found: "The class you picked no longer exists.",
  target_not_open: "The class you picked is finished or cancelled.",
  // The three "somebody got there first" answers. Each one has to say what the
  // row is now, not just that the click failed: two admins on the same pending
  // transfer is the ordinary case, and a second operator told only "that did not
  // work" retries forever without learning the money was already released.
  not_found: "That record no longer exists. Refresh the page to see what is there now.",
  already_completed:
    "That payment was already verified, so the prepaid sessions are released. Refresh to see the current row.",
  not_pending: "That payment is no longer awaiting verification. Refresh to see its current state.",
  bad_time_range: "The class must end after it starts.",
  start_in_past: "Pick a start time that is not in the past.",
  no_changes: "Nothing was changed.",
  razorpay_not_configured: "Razorpay is not connected on this environment.",
  razorpay_payment_not_found: "Razorpay has no payment with that id.",
  razorpay_unauthorized: "Razorpay rejected our keys. Check the environment settings.",
  upstream_error: "Razorpay did not respond. Please try again in a moment.",
  not_captured: "Razorpay has not captured that payment yet, so there is nothing to record.",
  order_mismatch: "That payment belongs to a different Razorpay order.",
  refunded_payment: "That payment has already been refunded.",
  not_completed:
    "That payment is not completed, so there are no prepaid sessions to take back.",
  already_recorded: "That payment is already recorded.",
  reference_taken: "That reference is already used by another payment.",
  reserved_reference:
    "References starting with MYC are generated by the site. Use your own receipt number.",
  pending_transfer_exists:
    "This customer already has an open transfer for that pack. Verify that one instead.",
  amount_mismatch:
    "The amount does not match what Razorpay has for that payment. Look it up again.",
  currency_mismatch: "The currency does not match what Razorpay has for that payment.",
  amount_required: "Enter the amount that was received.",
  currency_required: "Pick the currency that was received.",
  razorpay_id_required: "A Razorpay payment needs its payment id.",
  plan_not_found: "That pack could not be found.",
  missing_plan: "Pick a pack before releasing sessions.",
  no_credits_for_plan: "That pack has no sessions attached, so there is nothing to release.",
  no_razorpay_id: "There is no Razorpay id on this payment to check against.",
  payment_detached: "This payment belongs to a deleted account, so credits cannot be adjusted.",
  not_admin_verifiable: "This payment is handled automatically and cannot be verified by hand.",
  grant_failed:
    "The payment was recorded but the sessions were not released. Open the row and try Verify.",
  record_failed: "That payment could not be saved. Please try again.",
  update_failed: "That change could not be saved. Please try again.",
  db_error: "That did not work. Please try again.",
  enrol_failed: "That student could not be added. Please try again.",
  create_failed: "That class could not be created. Please try again.",
};

/**
 * Turn an admin route's error code into a sentence. Anything unrecognised (an
 * older deploy, a code from a route this build does not know about) falls
 * through to the generic line rather than echoing whatever came back.
 */
export function friendlyAdminError(code?: string | null): string {
  const copy = ADMIN_ERROR_COPY[code as AdminErrorCode];
  return copy ?? "That did not work. Please try again.";
}
