// document-url: mint a short-lived signed URL for one medical document.
//
// Exists so the iOS client can open a health document without a WebView. This
// is the ONLY path to the bytes for a teacher (teachers have no direct Storage
// access at all), and the owner goes through it too so that every single access
// is logged uniformly.
//
// The PHI rules here are not incidental and must not be "simplified":
//
//   * Authorization is owner OR a teacher holding an active, un-revoked share.
//     ADMINS ARE DELIBERATELY EXCLUDED. There is no admin read path to PHI.
//   * An unauthorized caller gets 404, not 403, so the endpoint never confirms
//     that a document exists.
//   * The URL is signed BEFORE the audit row is written, so a signing failure
//     cannot leave a phantom "download" in the log.
//   * The audit write FAILS CLOSED. We promise the customer that every open is
//     recorded, so if the log write fails there is no working URL. No PHI
//     access without a trail.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUCKET = "medical-documents";
/** Long enough to start a download, too short to be usefully forwarded. */
const TTL_SECONDS = 60;

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("BOOKING_ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return json({ error: "unauthenticated" }, 401);

  const body = (await req.json().catch(() => null)) as { documentId?: unknown } | null;
  const documentId = body?.documentId;
  if (typeof documentId !== "string" || !UUID.test(documentId)) {
    return json({ error: "bad request" }, 400);
  }

  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: doc } = await svc
    .from("medical_documents")
    .select("id, customer_id, storage_path, file_name, deleted_at")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc || doc.deleted_at) return json({ error: "not_found" }, 404);

  // Two explicit steps so the authorization is unambiguous, rather than relying
  // on embedded-filter semantics.
  const isOwner = doc.customer_id === user.id;
  let isSharedTeacher = false;
  if (!isOwner) {
    const { data: teacher } = await svc
      .from("teachers")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (teacher) {
      const { data: share } = await svc
        .from("medical_document_shares")
        .select("id")
        .eq("document_id", documentId)
        .eq("teacher_id", teacher.id)
        .is("revoked_at", null)
        .maybeSingle();
      isSharedTeacher = !!share;
    }
  }
  // 404, not 403: do not confirm existence to an unauthorized caller.
  if (!isOwner && !isSharedTeacher) return json({ error: "not_found" }, 404);

  const { data: signed, error: signErr } = await svc.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, TTL_SECONDS, { download: doc.file_name });
  if (signErr || !signed?.signedUrl) return json({ error: "sign_failed" }, 500);

  const { error: logErr } = await svc.from("medical_document_access_log").insert({
    document_id: documentId,
    accessed_by: user.id,
    accessor_role: isOwner ? "customer" : "teacher",
    action: "download",
  });
  if (logErr) {
    console.error("[document-url] audit log write failed:", logErr.message);
    return json({ error: "audit_failed" }, 500);
  }

  return json({ url: signed.signedUrl, fileName: doc.file_name, expiresIn: TTL_SECONDS }, 200);
});
