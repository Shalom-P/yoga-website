import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteAccountCascade } from "@/lib/account/deleteAccount";

// Node runtime: uses the service role + Supabase Admin API.
export const runtime = "nodejs";

/**
 * POST /api/account/delete — permanently delete the signed-in customer's account.
 *
 * Required by App Store Guideline 5.1.1(v) for any app with account creation.
 * The cascade itself (future-session cancellation, bank-transfer settlement,
 * auth delete, PHI purge, and the ordering between them) lives in
 * `lib/account/deleteAccount.ts`, shared with the admin delete path.
 */
export async function POST(): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await deleteAccountCascade(user.id, {
    cancellationReason: "account_deleted",
    logPrefix: "[account/delete]",
  });

  if (!result.ok) {
    if (result.reason === "role_managed_account") {
      return NextResponse.json(
        {
          error: "role_managed_account",
          message:
            "Teacher and admin accounts can't self-delete. Contact hello@myyogaclasses.fit and we'll take care of it.",
        },
        { status: 403 },
      );
    }
    if (result.reason === "role_check_failed") {
      return NextResponse.json({ error: "role_check_failed" }, { status: 500 });
    }
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
