import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { MEDICAL_DOCS_BUCKET } from "@/lib/medical/constants";

// Mints a SHORT-LIVED signed URL for one medical document, after authorizing the
// caller and writing an append-only access-log row. This is the ONLY path by
// which a teacher reaches the bytes (they have no direct Storage access), and it
// is also used for the owner's own downloads so every access is uniformly logged.
//
// Authorization: caller must be the document owner OR a teacher with an active,
// un-revoked share for it. Admins are intentionally NOT permitted (PHI
// minimisation). Node runtime: createSupabaseServiceClient is server-only.
export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().uuid() });

// 60s is enough to start the download/preview but not to be usefully shared.
const SIGNED_URL_TTL_SECONDS = 60;

export async function POST(
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

  const service = createSupabaseServiceClient();
  const { data: doc } = await service
    .from("medical_documents")
    .select("id, customer_id, storage_path, file_name, deleted_at")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc || doc.deleted_at) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Authorize. Owner is the customer; otherwise require an active share for the
  // teacher record linked to this user. Resolved in two explicit steps so the
  // authz is unambiguous (no reliance on embedded-filter semantics).
  const isOwner = doc.customer_id === user.id;
  let isSharedTeacher = false;
  if (!isOwner) {
    const { data: teacher } = await service
      .from("teachers")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (teacher) {
      const { data: share } = await service
        .from("medical_document_shares")
        .select("id")
        .eq("document_id", documentId)
        .eq("teacher_id", teacher.id)
        .is("revoked_at", null)
        .maybeSingle();
      isSharedTeacher = !!share;
    }
  }
  if (!isOwner && !isSharedTeacher) {
    // Don't reveal existence to an unauthorized caller.
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Mint the signed URL FIRST so a signing failure never produces a phantom
  // "download" audit row.
  const { data: signed, error: signErr } = await service.storage
    .from(MEDICAL_DOCS_BUCKET)
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS, { download: doc.file_name });
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: "sign_failed" }, { status: 500 });
  }

  // Append-only audit entry (service-role; clients cannot write this table). Fail
  // CLOSED: the access log is the transparency/compliance control we promise the
  // customer ("every time a teacher opens a file, it's recorded"), so if the write
  // fails we do NOT hand back a working URL — no PHI access without a trail.
  const { error: logErr } = await service.from("medical_document_access_log").insert({
    document_id: documentId,
    accessed_by: user.id,
    accessor_role: isOwner ? "customer" : "teacher",
    action: "download",
  });
  if (logErr) {
    console.error("[medical-documents/download] audit log write failed:", logErr.message);
    return NextResponse.json({ error: "audit_failed" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl, fileName: doc.file_name });
}
