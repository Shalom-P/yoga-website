import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The marketing pages that render teacher avatars / cover images / intro videos
// (`/`, `/teachers`, `/teachers/[slug]`) are ISR-cached with `revalidate = 300`.
// Teacher edits happen as a client-side Supabase write from TeacherFormDialog,
// which can only `router.refresh()` the admin route — it has no way to bust the
// marketing cache. So freshly-uploaded media wouldn't appear on the public site
// for up to 5 minutes. This endpoint lets the admin client invalidate those
// paths on demand right after a save.
//
// Middleware does not run on /api/, so this handler authenticates itself and
// re-checks the admin role inline (same pattern as /api/admin/sessions).

const schema = z.object({
  // Optional teacher slug so we can target the specific detail page too.
  slug: z.string().min(1).max(200).optional(),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  const slug = parsed.success ? parsed.data.slug : undefined;

  revalidatePath("/"); // landing page TeacherCarousel
  revalidatePath("/teachers"); // teachers listing
  if (slug) revalidatePath(`/teachers/${slug}`); // teacher detail page

  return NextResponse.json({ ok: true, revalidated: true });
}
