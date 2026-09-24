import { NextResponse } from "next/server";

import { metaContextFromRequest, queueMetaEvent } from "@/lib/meta/capi";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// node:crypto (hashing in lib/meta/capi) needs the Node runtime.
export const runtime = "nodejs";

/**
 * POST /api/meta/complete-registration
 *
 * Onboarding saves the profile client-side, so the form pings this afterwards
 * to report Meta "CompleteRegistration" from the server. Only a signed-in user
 * who has actually finished onboarding counts, and the event id is their user
 * id, so repeat calls collapse into one event at Meta. Nothing from the form
 * (goals are health-adjacent) is sent.
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, experience_level")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.experience_level) {
    return NextResponse.json({ error: "not_onboarded" }, { status: 409 });
  }

  queueMetaEvent({
    name: "CompleteRegistration",
    eventId: `registration_${user.id}`,
    context: metaContextFromRequest(req, "/onboarding"),
    user: { email: user.email ?? profile.email, externalId: user.id },
  });
  return NextResponse.json({ ok: true });
}
