"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type Props = {
  /** Storage bucket id, e.g. "teacher-media". */
  bucket: string;
  /** Subfolder inside the bucket (used to namespace by teacher, kind, etc). */
  folder: string;
  /** Accept attribute — controls the OS file picker filter. */
  accept: "image" | "video";
  /** Current value (a public URL) or null if nothing uploaded yet. */
  value: string | null;
  /** Callback fired with the new public URL after a successful upload, or null on clear. */
  onChange: (url: string | null) => void;
  /** Disabled while a parent save is in flight, etc. */
  disabled?: boolean;
  /**
   * Optional client-side size cap in MB. Files larger than this are rejected
   * with a friendly message *before* hitting the network, instead of failing
   * server-side with an opaque 413. Should match the bucket's file_size_limit
   * (see supabase/migrations/0009_storage_limits.sql).
   */
  maxSizeMb?: number;
};

/**
 * Generic single-file Storage upload tile. Renders a preview thumbnail when a
 * value is set, otherwise a "Choose file" picker. Used by TeacherFormDialog
 * for avatar / cover / intro_video.
 */
export function MediaUploadField({
  bucket,
  folder,
  accept,
  value,
  onChange,
  disabled,
  maxSizeMb,
}: Props) {
  const supabase = createSupabaseBrowserClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    // Reject oversize files up front so the admin gets an actionable message
    // instead of an opaque server 413 mid-upload.
    if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
      toast.error(
        `That ${accept} is ${(file.size / 1024 / 1024).toFixed(0)} MB — the limit is ${maxSizeMb} MB. Compress or trim it and try again.`,
      );
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
    setUploading(false);

    if (uploadErr) {
      const msg = uploadErr.message ?? "";
      const isRlsOrMissing =
        /row-level security|bucket not found|Bucket not found/i.test(msg);
      const isTooLarge =
        /maximum allowed size|payload too large|exceeded the maximum|413/i.test(msg);
      toast.error(
        isTooLarge
          ? `Upload too large: this ${accept} exceeds the storage limit. Raise the bucket limit (supabase/migrations/0009_storage_limits.sql) and the project-wide cap in Supabase → Project Settings → Storage.`
          : isRlsOrMissing
            ? `Upload blocked: the "${bucket}" bucket isn't set up yet. Apply supabase/migrations/0008_storage_buckets.sql in the Supabase SQL editor.`
            : `Upload failed: ${msg}`,
      );
      return;
    }
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(pub.publicUrl);
  }

  function clear() {
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  // Try to derive the storage path so the file can be removed on clear. Best
  // effort — if the URL doesn't match our pattern, we just clear the value.
  function bucketPathFromUrl(url: string): string | null {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length));
  }

  async function remove() {
    if (value) {
      const path = bucketPathFromUrl(value);
      if (path) {
        await supabase.storage.from(bucket).remove([path]).catch(() => {});
      }
    }
    clear();
  }

  return (
    <div className="mt-1.5 space-y-2">
      {value ? (
        <div className="relative inline-block">
          {accept === "video" ? (
            <video
              src={value}
              className="size-32 rounded-lg border border-border object-cover"
              muted
              playsInline
            />
          ) : (
            // Public Storage URL — Next/Image would require remotePatterns config.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Uploaded preview"
              className="size-32 rounded-lg border border-border object-cover"
            />
          )}
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className="absolute -top-2 -right-2 size-6 rounded-full shadow"
            onClick={remove}
            disabled={disabled || uploading}
            aria-label="Remove file"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            type="file"
            accept={accept === "image" ? "image/*" : "video/*"}
            disabled={disabled || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
            className="max-w-xs"
          />
          {uploading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
      )}
      {!value && !uploading && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Upload className="size-3" />
          Uploaded to <code className="rounded bg-muted px-1">{bucket}/{folder}</code>
        </p>
      )}
    </div>
  );
}
