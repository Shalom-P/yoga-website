// Best-effort audit trail for admin actions taken outside an RPC.
//
// The 0039 RPCs write their own audit_log row inside the transaction, which is
// the right place for anything that moves credits: the log and the effect commit
// together or not at all. This helper is for the actions that have no RPC
// (recording a payment, editing a customer), so route handlers do not each grow
// their own copy of the same try/catch.
//
// Exactly one row per logical action. Do not call this after an RPC that already
// logged, or the activity feed double-counts.

import "server-only";

import type { createSupabaseServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

/**
 * The closed set of admin actions. A new action string is a compile error until
 * it is added here, which is what keeps the admin activity feed's label map
 * exhaustive.
 */
export type AdminAuditAction =
  | "admin_enrol_booking"
  | "admin_cancel_booking"
  | "admin_move_booking"
  | "admin_set_attendance"
  | "admin_update_session"
  | "admin_cancel_session"
  | "admin_record_payment"
  | "admin_verify_payment"
  | "admin_reject_payment"
  | "admin_resync_payment"
  | "admin_record_refund"
  | "admin_grant_credits"
  | "admin_update_customer"
  | "manual_payment_attribution_conflict";

export type AdminAuditEntityType =
  | "booking"
  | "session"
  | "payment"
  | "profile"
  | "teacher";

/**
 * Write one audit_log row. Never throws and never fails the request, mirroring
 * the delete path in app/api/admin/customers/[id]/route.ts: a logging failure
 * must not report an action that already happened as an error.
 *
 * Takes the SERVICE client because audit_log has an admin SELECT policy and no
 * INSERT policy at all (0005), so inserts come from the service role only.
 * entity_id is TEXT in the database; callers pass a uuid string.
 */
export async function writeAuditLog(
  svc: ServiceClient,
  entry: {
    actorId: string | null;
    action: AdminAuditAction;
    entityType: AdminAuditEntityType;
    entityId: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await svc.from("audit_log").insert({
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      payload: entry.payload ?? {},
    });
  } catch (err) {
    console.error(`[admin/audit] ${entry.action} log insert failed:`, err);
  }
}
