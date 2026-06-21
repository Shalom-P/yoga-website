"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, Loader2, FileText, Download, Trash2, Share2, ShieldCheck, History, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  MEDICAL_DOCS_BUCKET, MEDICAL_DOC_ACCEPT, MEDICAL_DOC_MAX_BYTES,
} from "@/lib/medical/constants";
import { toast } from "sonner";

type ShareView = { teacher_id: string; teacher_name: string };
type DocView = {
  id: string;
  file_name: string;
  type_label: string;
  size_label: string;
  created_label: string;
  note: string | null;
  shares: ShareView[];
};
type TeacherOpt = { id: string; display_name: string };
type LogView = { file_name: string; accessor_label: string; when: string };

// Resolve a usable, allow-listed content type. Phone HEIC files often arrive with
// an empty file.type, so fall back to the extension.
const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};
function resolveMime(file: File): string | null {
  if (file.type && EXT_BY_MIME[file.type]) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? null;
}

export function MedicalDocuments({
  userId,
  documents,
  bookedTeachers,
  accessLog,
}: {
  userId: string;
  documents: DocView[];
  bookedTeachers: TeacherOpt[];
  accessLog: LogView[];
}) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Track the share target by id (not a snapshot) so the dialog reflects the
  // latest shares after router.refresh() re-fetches them.
  const [shareTargetId, setShareTargetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocView | null>(null);
  const shareTarget = documents.find((d) => d.id === shareTargetId) ?? null;

  async function handleFile(file: File) {
    const mime = resolveMime(file);
    if (!mime) {
      toast.error("Unsupported file. Upload a PDF, JPG, PNG, WEBP, or HEIC.");
      return;
    }
    if (file.size > MEDICAL_DOC_MAX_BYTES) {
      toast.error(
        `That file is ${(file.size / 1024 / 1024).toFixed(0)} MB — the limit is ${(
          MEDICAL_DOC_MAX_BYTES /
          1024 /
          1024
        ).toFixed(0)} MB.`,
      );
      return;
    }
    setUploading(true);
    try {
      const ext = EXT_BY_MIME[mime] ?? "bin";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from(MEDICAL_DOCS_BUCKET)
        .upload(path, file, { upsert: false, contentType: mime });
      if (uploadErr) {
        const msg = uploadErr.message ?? "";
        const isRlsOrMissing = /row-level security|bucket not found|Bucket not found/i.test(msg);
        toast.error(
          isRlsOrMissing
            ? `Upload blocked: the "${MEDICAL_DOCS_BUCKET}" vault isn't set up yet. Apply supabase/migrations/0027_medical_documents.sql.`
            : `Upload failed: ${msg}`,
        );
        return;
      }
      // Register metadata server-side (validates path + records true size).
      const res = await fetch("/api/medical-documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path, fileName: file.name, mimeType: mime }),
      });
      if (!res.ok) {
        // Roll back the orphaned object so the vault stays consistent.
        await supabase.storage.from(MEDICAL_DOCS_BUCKET).remove([path]).catch(() => {});
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(`Couldn't save: ${body.error ?? "unknown"}`);
        return;
      }
      toast.success("Document uploaded.");
      router.refresh();
    } catch {
      toast.error("Network error during upload.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function download(doc: DocView) {
    setBusyId(doc.id);
    try {
      const res = await fetch(`/api/medical-documents/${doc.id}/download`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        toast.error(`Couldn't open: ${body.error ?? "unknown"}`);
        return;
      }
      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      const res = await fetch(`/api/medical-documents/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(`Couldn't delete: ${body.error ?? "unknown"}`);
        return;
      }
      toast.success("Document deleted.");
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {/* Upload tile */}
      <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            ref={inputRef}
            type="file"
            accept={MEDICAL_DOC_ACCEPT}
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
            className="max-w-xs"
          />
          {uploading ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Uploading…
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Upload className="size-3.5" /> PDF or image, up to 25 MB
            </span>
          )}
        </div>
      </div>

      {/* Documents */}
      {documents.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <FileText className="mx-auto mb-3 size-9 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No documents yet. Upload a report above to get started.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.type_label}
                      {doc.size_label ? ` · ${doc.size_label}` : ""} · {doc.created_label}
                    </p>
                    {doc.shares.length > 0 ? (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <ShieldCheck className="size-3.5 text-primary" />
                        <span className="text-xs text-muted-foreground">Shared with</span>
                        {doc.shares.map((s) => (
                          <span
                            key={s.teacher_id}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                          >
                            {s.teacher_name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">Private — not shared</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => setShareTargetId(doc.id)}
                  >
                    <Share2 className="size-3.5" /> Share
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => void download(doc)}
                    disabled={busyId === doc.id}
                    aria-label={`Download ${doc.file_name}`}
                  >
                    {busyId === doc.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-full px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(doc)}
                    aria-label="Delete document"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Access log */}
      {accessLog.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <History className="size-4 text-muted-foreground" /> Access history
          </h2>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card text-sm">
            {accessLog.map((l, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="text-foreground">
                  <strong className="font-medium">{l.accessor_label}</strong> opened{" "}
                  <span className="text-muted-foreground">{l.file_name}</span>
                </span>
                <span className="text-xs text-muted-foreground">{l.when}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ShareDialog
        doc={shareTarget}
        bookedTeachers={bookedTeachers}
        onClose={() => setShareTargetId(null)}
        onChanged={() => router.refresh()}
      />

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.file_name} will be permanently removed and any teacher
              you shared it with will lose access. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={!!busyId}>
              Keep
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={!!busyId}>
              {busyId === deleteTarget?.id ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ShareDialog({
  doc,
  bookedTeachers,
  onClose,
  onChanged,
}: {
  doc: DocView | null;
  bookedTeachers: TeacherOpt[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const supabase = createSupabaseBrowserClient();
  const [pending, setPending] = useState<string | null>(null);
  const sharedIds = new Set((doc?.shares ?? []).map((s) => s.teacher_id));
  // Active shares whose teacher is no longer in the bookable list (e.g. the
  // teacher was deactivated). Without a dedicated revoke row here, the customer
  // would have no way to un-share — breaking the "revoke any time" promise.
  const bookedIds = new Set(bookedTeachers.map((t) => t.id));
  const orphanShares = (doc?.shares ?? []).filter((s) => !bookedIds.has(s.teacher_id));
  const hasAny = bookedTeachers.length > 0 || orphanShares.length > 0;

  async function toggle(teacherId: string, currentlyShared: boolean) {
    if (!doc) return;
    setPending(teacherId);
    try {
      const { error } = currentlyShared
        ? await supabase.rpc("revoke_medical_document_share", {
            p_document_id: doc.id,
            p_teacher_id: teacherId,
          })
        : await supabase.rpc("share_medical_document", {
            p_document_id: doc.id,
            p_teacher_id: teacherId,
          });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(currentlyShared ? "Access revoked." : "Document shared.");
      onChanged();
    } catch {
      toast.error("Network error.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open={doc !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
          <DialogDescription>
            {doc?.file_name} — choose which of your teachers can open this file. You
            can revoke access at any time.
          </DialogDescription>
        </DialogHeader>

        {!hasAny ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            You can share with a teacher once you&apos;ve booked a session with them.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {bookedTeachers.map((t) => {
              const shared = sharedIds.has(t.id);
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
                >
                  <span className="text-sm text-foreground">{t.display_name}</span>
                  <Button
                    size="sm"
                    variant={shared ? "secondary" : "outline"}
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => void toggle(t.id, shared)}
                    disabled={pending === t.id}
                  >
                    {pending === t.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : shared ? (
                      <>
                        <Check className="size-3.5" /> Shared
                      </>
                    ) : (
                      "Share"
                    )}
                  </Button>
                </li>
              );
            })}
            {orphanShares.map((s) => (
              <li
                key={s.teacher_id}
                className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
              >
                <span className="text-sm text-foreground">
                  {s.teacher_name}
                  <span className="ml-1 text-xs text-muted-foreground">(no longer active)</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => void toggle(s.teacher_id, true)}
                  disabled={pending === s.teacher_id}
                >
                  {pending === s.teacher_id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    "Revoke"
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
