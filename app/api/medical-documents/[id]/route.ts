import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { MEDICAL_DOCS_BUCKET } from "@/lib/medical/constants";

// Delete a customer's own medical document. Soft-deletes the metadata row (so the
// access-log history is preserved), revokes any active shares so teachers lose
// access immediately, and removes the bytes from the private bucket. Owner-only.
// Node runtime: createSupabaseServiceClient is server-only.
export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const documentId = parsed.data.id;

  // Load on the caller's RLS client so only the owner can see (and thus delete) it.
  const { data: doc } = await supabase
    .from("medical_documents")
    .select("id, storage_path, deleted_at")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc || doc.deleted_at) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const service = createSupabaseServiceClient();

  // Revoke active shares first → teachers lose access even if the steps below fail.
  await service
    .from("medical_document_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("document_id", documentId)
    .is("revoked_at", null);

  // Soft-delete the row (keeps it for FK integrity with the access log).
  const { error: updErr } = await service
    .from("medical_documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", documentId);
  if (updErr) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // Remove the bytes. Best-effort: the row is already tombstoned + unshared.
  await service.storage.from(MEDICAL_DOCS_BUCKET).remove([doc.storage_path]).catch(() => {});

  return NextResponse.json({ ok: true });
}
