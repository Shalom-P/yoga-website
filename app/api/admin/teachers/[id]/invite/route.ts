import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Provisions (or links) a teacher LOGIN for an existing teacher data record.
// Handles both paths off a single email:
//   * email already has an account → just promote_to_teacher (link + role flip)
//   * email is new                 → inviteUserByEmail (creates the auth user via
//                                     handle_new_user), then promote_to_teacher
// The role flip ALWAYS goes through the promote_to_teacher RPC, which self-gates
// on is_admin() — there is no second elevation path. Uses the service-role client
// (so it can create the auth user), and re-checks admin inline because middleware
// does not run on /api/. Node runtime: createSupabaseServiceClient is server-only.
export const runtime = "nodejs";

const schema = z.object({ email: z.string().email().max(320) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (actor?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const { id: teacherId } = await params;

  const service = createSupabaseServiceClient();

  // The teacher record must exist and not already be linked to another account.
  const { data: teacher } = await service
    .from("teachers")
    .select("id, profile_id")
    .eq("id", teacherId)
    .maybeSingle();
  if (!teacher) {
    return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
  }
  if (teacher.profile_id) {
    return NextResponse.json(
      { error: "This teacher already has a linked login. Revoke it first to re-assign." },
      { status: 409 }
    );
  }

  // profiles.email is populated by handle_new_user / the 0013 backfill, so a
  // profile lookup reliably tells us whether an account already exists.
  const { data: existing } = await service
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .maybeSingle();

  let targetUserId: string;
  let invited = false;

  if (existing) {
    if (existing.role === "admin") {
      return NextResponse.json(
        { error: "That email belongs to an admin. Demote them before making them a teacher." },
        { status: 409 }
      );
    }
    targetUserId = existing.id;
  } else {
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
    const { data: inv, error: inviteError } = await service.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: `${origin}/auth/callback?next=/teacher` }
    );
    if (inviteError || !inv?.user) {
      return NextResponse.json(
        {
          error:
            inviteError?.message ??
            "Couldn't send the invite. If a login already exists for this email, ask them to sign in once, then try again.",
        },
        { status: 400 }
      );
    }
    targetUserId = inv.user.id;
    invited = true;
  }

  const { error: rpcError } = await service.rpc("promote_to_teacher", {
    target_user_id: targetUserId,
    target_teacher_id: teacherId,
    acting_admin_id: user.id,
  });
  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, invited, email });
}
