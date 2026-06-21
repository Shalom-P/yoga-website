import "server-only";

import { assertCron } from "@/lib/cron/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { MEDICAL_DOCS_BUCKET } from "@/lib/medical/constants";

// Node runtime: createSupabaseServiceClient is server-only.
export const runtime = "nodejs";

/**
 * POST /api/cron/medical-orphan-sweep
 *
 * Backstop cleanup for the private `medical-documents` bucket. Removes stored
 * objects that have NO live `medical_documents` row pointing at them — i.e.:
 *   (a) a browser uploaded bytes but the metadata POST never landed (the client
 *       already self-rolls-back, so this only catches a crash mid-flight), and
 *   (b) bytes left behind when the DELETE route soft-deleted a row but the
 *       best-effort Storage removal failed.
 *
 * Safety:
 *   * Only objects older than GRACE_MS are eligible, so an upload that's between
 *     its PUT and its metadata POST is never swept.
 *   * "Known" = storage_path of a NON-soft-deleted row. A soft-deleted row's
 *     bytes SHOULD be gone, so leftovers from a failed removal are swept too.
 *   * Everything is bounded; if a cap is hit it's reported in the response (no
 *     silent truncation) so a backlog is visible and the next run continues it.
 *
 * Gated by assertCron (Bearer CRON_SECRET). Schedule daily.
 */
const GRACE_MS = 60 * 60 * 1000; // 1 hour
const MAX_FOLDERS = 1000; // user folders scanned per run
const PAGE = 100; // Storage list page size
const MAX_FILES_PER_FOLDER = 1000;
const MAX_CANDIDATES = 2000; // aged objects collected before the DB diff
const MAX_DELETE = 500; // objects removed per run

export async function POST(req: Request): Promise<Response> {
  const authError = assertCron(req);
  if (authError) return authError;

  const svc = createSupabaseServiceClient();
  const cutoffMs = Date.now() - GRACE_MS;

  // 1. Enumerate top-level entries — one "folder" per owner uid.
  const folders: string[] = [];
  let truncatedFolders = false;
  for (let offset = 0; offset < MAX_FOLDERS; offset += PAGE) {
    const { data, error } = await svc.storage
      .from(MEDICAL_DOCS_BUCKET)
      .list("", { limit: PAGE, offset });
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) break;
    // Folders come back as entries with a null id (no own metadata).
    for (const entry of data) {
      if (entry.id === null) folders.push(entry.name);
    }
    if (data.length < PAGE) break;
    if (offset + PAGE >= MAX_FOLDERS) truncatedFolders = true;
  }

  // 2. Within each folder, collect aged objects as orphan candidates.
  const candidates: string[] = []; // full storage paths
  let truncatedCandidates = false;
  outer: for (const folder of folders) {
    for (let offset = 0; offset < MAX_FILES_PER_FOLDER; offset += PAGE) {
      const { data, error } = await svc.storage
        .from(MEDICAL_DOCS_BUCKET)
        .list(folder, { limit: PAGE, offset });
      if (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      for (const obj of data) {
        // Skip sub-folders. Storage layout is flat ({uid}/<file>, enforced by the
        // metadata route), so nested entries aren't tracked docs; never recurse.
        if (obj.id === null) continue;
        // Fail SAFE on unknown age: an object whose created_at we can't establish
        // is NOT eligible for deletion. Treating unknown age as "old" could nuke a
        // freshly-PUT file whose metadata POST hasn't landed yet — irrecoverable PHI.
        if (!obj.created_at) continue;
        const created = new Date(obj.created_at).getTime();
        if (!Number.isFinite(created) || created > cutoffMs) continue; // too new / unparseable
        candidates.push(`${folder}/${obj.name}`);
        if (candidates.length >= MAX_CANDIDATES) {
          truncatedCandidates = true;
          break outer;
        }
      }
      if (data.length < PAGE) break;
    }
  }

  if (candidates.length === 0) {
    return Response.json({ ok: true, scanned: folders.length, removed: 0 });
  }

  // 3. Diff against live (non-soft-deleted) rows. Chunk the IN() list.
  const known = new Set<string>();
  for (let i = 0; i < candidates.length; i += 200) {
    const chunk = candidates.slice(i, i + 200);
    const { data, error } = await svc
      .from("medical_documents")
      .select("storage_path")
      .is("deleted_at", null)
      .in("storage_path", chunk);
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    for (const row of data ?? []) known.add(row.storage_path);
  }

  const orphans = candidates.filter((p) => !known.has(p));
  const toRemove = orphans.slice(0, MAX_DELETE);
  let removed = 0;
  if (toRemove.length > 0) {
    const { data, error } = await svc.storage.from(MEDICAL_DOCS_BUCKET).remove(toRemove);
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    removed = data?.length ?? toRemove.length;
  }

  return Response.json({
    ok: true,
    scanned: folders.length,
    candidates: candidates.length,
    orphans: orphans.length,
    removed,
    // Surfaced so a backlog or capped run is visible, never silently dropped.
    truncated: {
      folders: truncatedFolders,
      candidates: truncatedCandidates,
      deletions: orphans.length > toRemove.length,
    },
  });
}
