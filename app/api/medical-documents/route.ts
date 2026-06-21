import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  MEDICAL_DOCS_BUCKET,
  MEDICAL_DOC_MAX_BYTES,
  MEDICAL_DOC_MIME_TYPES,
  isAllowedMedicalMime,
  sanitizeFileName,
} from "@/lib/medical/constants";

// Records the metadata row AFTER the browser has uploaded the bytes straight to
// the private bucket (so PHI never transits our server). The security boundary:
// the storage_path MUST start with the caller's own uid folder, and the row is
// inserted on the caller's RLS-bound client so the 0027 owner_insert policy
// re-validates ownership + the path prefix. The object is stat'd with the
// service client only to confirm it exists and to capture its true size.
// Node runtime: createSupabaseServiceClient is server-only.
export const runtime = "nodejs";

const schema = z.object({
  path: z.string().min(3).max(512),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(MEDICAL_DOC_MIME_TYPES),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { path, fileName, mimeType: claimedMime } = parsed.data;

  // The path must live DIRECTLY under THIS user's folder: exactly `{uid}/<file>`,
  // no deeper nesting. Without the prefix check a forged path could register
  // someone else's object (the RLS check below is the second gate); enforcing a
  // flat single segment also keeps the storage layout the orphan-sweep cron walks.
  const prefix = `${user.id}/`;
  const fileNameInBucket = path.slice(prefix.length);
  if (
    !path.startsWith(prefix) ||
    path.includes("..") ||
    fileNameInBucket.length === 0 ||
    fileNameInBucket.includes("/")
  ) {
    return NextResponse.json({ error: "forbidden_path" }, { status: 403 });
  }

  // Confirm the object exists and read its size from Storage metadata. NB: this
  // is best-effort defense-in-depth — the bucket's own file_size_limit (set in
  // 0027) is the authoritative cap and already rejects oversize uploads at PUT.
  const service = createSupabaseServiceClient();
  const { data: listed } = await service.storage
    .from(MEDICAL_DOCS_BUCKET)
    .list(user.id, { search: fileNameInBucket });
  const object = listed?.find((o) => o.name === fileNameInBucket);
  if (!object) {
    return NextResponse.json({ error: "object_not_found" }, { status: 404 });
  }
  const sizeBytes: number | null = object.metadata?.size ?? null;
  if (sizeBytes != null && sizeBytes > MEDICAL_DOC_MAX_BYTES) {
    // Orphan oversize upload — drop it and reject.
    await service.storage.from(MEDICAL_DOCS_BUCKET).remove([path]).catch(() => {});
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  // Trust the content-type the bucket actually stored (the bucket's
  // allowed_mime_types already gated the upload) over the client's claim. Fall
  // back to the client hint only if Storage didn't report one, and reject if the
  // result still isn't allow-listed.
  const storedMime: string | undefined = object.metadata?.mimetype;
  const mimeType = isAllowedMedicalMime(storedMime) ? storedMime : claimedMime;

  // Insert on the caller's client so owner_insert RLS re-checks customer_id +
  // the storage_path prefix. file_name is sanitized: it's later echoed into a
  // signed-URL Content-Disposition.
  const { data: inserted, error } = await supabase
    .from("medical_documents")
    .insert({
      customer_id: user.id,
      storage_path: path,
      file_name: sanitizeFileName(fileName),
      mime_type: mimeType,
      size_bytes: sizeBytes,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    // Clean up the orphaned object so we don't leave un-tracked bytes behind.
    await service.storage.from(MEDICAL_DOCS_BUCKET).remove([path]).catch(() => {});
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id });
}
