import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { deleteAccountCascade } from "@/lib/account/deleteAccount";

// Service role + Supabase Admin API; Node runtime.
export const runtime = "nodejs";

const paramsSchema = z.string().uuid();

/**
 * DELETE /api/admin/customers/[id] — permanently delete a customer account.
 *
 * Middleware does not run on /api/*, so this authes itself and re-checks the
 * admin role inline. The deletion cascade is the SAME code path the customer's
 * own 5.1.1(v) self-delete uses (`lib/account/deleteAccount.ts`), so an admin
 * removing someone can't produce a different, less-cleaned-up end state.
 *
 * Two refusals on top of the shared ones:
 *   * self-delete — an admin removing their own account would strand the shell
 *     (and the shared cascade would refuse the admin role anyway, but failing
 *     early gives an honest message instead of "demote them first");
 *   * teacher/admin targets — the shared cascade refuses these because deleting
 *     a teacher login unlinks the live `teachers` record and fires the 0028
 *     trigger revoking every student's medical-document share. Demote first,
 *     then delete.
 *
 * Success writes an `audit_log` row from the snapshot taken before the delete —
 * the profile is gone by then, so this is the only remaining record of who was
 * removed and by whom.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const parsed = paramsSchema.safeParse(id);
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const targetId = parsed.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (targetId === user.id) {
    return NextResponse.json(
      {
        error: "cannot_delete_self",
        message: "You can't delete your own admin account.",
      },
      { status: 400 },
    );
  }

  const svc = createSupabaseServiceClient();
  const { data: exists } = await svc
    .from("profiles")
    .select("id")
    .eq("id", targetId)
    .maybeSingle();
  if (!exists) return NextResponse.json({ error: "customer_not_found" }, { status: 404 });

  const result = await deleteAccountCascade(targetId, {
    cancellationReason: "account_deleted_by_admin",
    logPrefix: "[admin/customers/delete]",
  });

  if (!result.ok) {
    if (result.reason === "role_managed_account") {
      return NextResponse.json(
        {
          error: "role_managed_account",
          message:
            "Demote this account to customer first. Deleting a teacher or admin directly would unlink their live records.",
        },
        { status: 409 },
      );
    }
    if (result.reason === "role_check_failed") {
      return NextResponse.json({ error: "role_check_failed" }, { status: 500 });
    }
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  // Audit AFTER success, from the pre-delete snapshot: the profile row no longer
  // exists, so nothing else records who this was. Best-effort — a logging
  // failure must not report the (already completed, irreversible) delete as an
  // error to the caller.
  try {
    await svc.from("audit_log").insert({
      actor_id: user.id,
      action: "admin_delete_user",
      entity_type: "profile",
      entity_id: targetId,
      payload: {
        email: result.deleted.email,
        full_name: result.deleted.full_name,
        role: result.deleted.role,
      },
    });
  } catch (err) {
    console.error("[admin/customers/delete] audit_log insert failed:", err);
  }

  return NextResponse.json({ ok: true, deleted: result.deleted });
}
