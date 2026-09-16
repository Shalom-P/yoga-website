import { describe, it, expect } from "vitest";
import {
  friendlyAdminError,
  friendlyAuthError,
  friendlyFormError,
  type AdminErrorCode,
} from "@/lib/ui/errors";

describe("friendlyAuthError", () => {
  it("special-cases rate limits", () => {
    expect(friendlyAuthError("email rate limit exceeded")).toMatch(/too many attempts/i);
  });
  it("maps invalid/expired OTP codes", () => {
    expect(friendlyAuthError("Token has expired or is invalid")).toMatch(/invalid|expired/i);
  });
  it("distinguishes a mailer failure from the generic fallback", () => {
    // The exact GoTrue body behind the App Store 2.1 rejection (Aug 2026).
    const raw = "Error sending confirmation email";
    expect(friendlyAuthError(raw)).not.toMatch(/something went wrong/i);
    expect(friendlyAuthError(raw)).toMatch(/couldn't send that code/i);
  });
  it("falls back to a generic message and never echoes raw text", () => {
    const raw = "new row violates row-level security policy for table profiles";
    expect(friendlyAuthError(raw)).not.toContain("row-level security");
    expect(friendlyAuthError(null)).toMatch(/something went wrong/i);
  });
});

describe("friendlyFormError", () => {
  it("special-cases rate limits", () => {
    expect(friendlyFormError("Too Many Requests")).toMatch(/too many attempts/i);
  });
  it("uses a save-oriented generic fallback and hides raw text", () => {
    const raw = "duplicate key value violates unique constraint";
    expect(friendlyFormError(raw)).not.toContain("unique constraint");
    expect(friendlyFormError(raw)).toMatch(/couldn't save/i);
  });
});

// Exhaustive by construction: this is a Record keyed on the union, so adding a
// code to AdminErrorCode without adding it here is a typecheck failure, and the
// loop below then asserts it has real copy.
const ADMIN_CODES: Record<AdminErrorCode, true> = {
  unauthenticated: true,
  forbidden: true,
  "bad request": true,
  admin_only: true,
  session_not_found: true,
  session_cancelled: true,
  session_not_open: true,
  session_not_reschedulable: true,
  session_full: true,
  capacity_below_enrolled: true,
  slot_taken: true,
  teacher_not_found: true,
  category_not_found: true,
  customer_not_found: true,
  customer_not_eligible: true,
  already_enrolled: true,
  trial_already_claimed: true,
  insufficient_credits: true,
  booking_not_found: true,
  booking_cancelled: true,
  already_cancelled: true,
  not_cancellable: true,
  status_changed: true,
  same_session: true,
  target_not_found: true,
  target_not_open: true,
  not_found: true,
  already_completed: true,
  not_pending: true,
  bad_time_range: true,
  start_in_past: true,
  no_changes: true,
  razorpay_not_configured: true,
  razorpay_payment_not_found: true,
  razorpay_unauthorized: true,
  upstream_error: true,
  not_captured: true,
  order_mismatch: true,
  refunded_payment: true,
  not_completed: true,
  already_recorded: true,
  reference_taken: true,
  reserved_reference: true,
  pending_transfer_exists: true,
  amount_mismatch: true,
  currency_mismatch: true,
  amount_required: true,
  currency_required: true,
  razorpay_id_required: true,
  plan_not_found: true,
  missing_plan: true,
  no_credits_for_plan: true,
  no_razorpay_id: true,
  payment_detached: true,
  not_admin_verifiable: true,
  grant_failed: true,
  record_failed: true,
  update_failed: true,
  db_error: true,
  enrol_failed: true,
  create_failed: true,
};

const GENERIC = "That did not work. Please try again.";

describe("friendlyAdminError", () => {
  it.each(Object.keys(ADMIN_CODES) as AdminErrorCode[])("has copy for %s", (code) => {
    const copy = friendlyAdminError(code);
    expect(copy.length).toBeGreaterThan(0);
    expect(copy.trim()).toBe(copy);
    // db_error is the one code whose copy IS the generic line; every other code
    // has to say something more specific or it is not worth having.
    if (code !== "db_error") expect(copy).not.toBe(GENERIC);
  });

  it("names the consequence for the codes an operator sees most", () => {
    expect(friendlyAdminError("session_full")).toMatch(/full/i);
    expect(friendlyAdminError("insufficient_credits")).toMatch(/no prepaid sessions left/i);
    expect(friendlyAdminError("already_recorded")).toMatch(/already recorded/i);
    expect(friendlyAdminError("slot_taken")).toMatch(/already has a class/i);
  });

  it("tells a second operator what the row is now, not just that the click failed", () => {
    // Two admins on one pending transfer is the ordinary case, not an edge one.
    // "already verified" has to reach the loser of that race or they retry
    // forever without learning the sessions were already released.
    expect(friendlyAdminError("already_completed")).toMatch(/already verified/i);
    expect(friendlyAdminError("not_pending")).toMatch(/no longer awaiting verification/i);
    expect(friendlyAdminError("not_found")).toMatch(/no longer exists/i);
  });

  it("falls through to the generic line for an unknown or missing code", () => {
    // A raw Postgres string must never be echoed back, even if a route slips one
    // into `error` by accident.
    const raw = 'new row violates check constraint "payments_method_check"';
    expect(friendlyAdminError(raw)).toBe(GENERIC);
    expect(friendlyAdminError(raw)).not.toContain("check constraint");
    expect(friendlyAdminError(undefined)).toBe(GENERIC);
    expect(friendlyAdminError(null)).toBe(GENERIC);
  });

  it("uses no em-dashes anywhere, per the standing copy rule", () => {
    for (const code of Object.keys(ADMIN_CODES) as AdminErrorCode[]) {
      expect(friendlyAdminError(code)).not.toContain("\u2014");
    }
  });
});
