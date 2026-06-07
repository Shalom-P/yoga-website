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
 * Downscale + re-encode an image to JPEG entirely in the browser before upload.
 * This is what makes real phone photos work: a 12-megapixel JPEG/HEIC is often
 * 10-30 MB, which the fixed size cap used to reject outright — leaving every
 * teacher's avatar_url null. Re-encoding also flattens Apple HEIC (which only
 * Safari can render) into a universally-viewable JPEG. Throws if the browser
 * can't decode the file, so the caller can fall back to the original bytes.
 */
async function downscaleImage(file: File, maxEdge = 1600, quality = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) throw new Error("zero dimensions");
    const scale = Math.min(1, maxEdge / Math.max(nw, nh));
    const w = Math.max(1, Math.round(nw * scale));
    const h = Math.max(1, Math.round(nh * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    // White matte so transparent PNGs don't flatten to black under JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new Error("encode failed");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

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
    setUploading(true);
    try {
      // Images get downscaled + re-encoded to JPEG in the browser first, so a
      // large phone photo or HEIC turns into a small, viewable upload. If the
      // browser can't decode it (e.g. HEIC outside Safari), fall back to the
      // original bytes and let the size guard below decide.
      let blob: Blob = file;
      let ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      if (accept === "image") {
        try {
          blob = await downscaleImage(file);
          ext = "jpg";
        } catch {
          blob = file;
        }
      }

      // Size guard runs on the *final* bytes, so a compressed photo sails
      // through and only a giant, un-compressible original is rejected — with
      // an actionable message instead of an opaque server 413 mid-upload.
      if (maxSizeMb && blob.size > maxSizeMb * 1024 * 1024) {
        toast.error(
          `That ${accept} is ${(blob.size / 1024 / 1024).toFixed(0)} MB — the limit is ${maxSizeMb} MB. Compress or trim it and try again.`,
        );
        return;
      }

      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, blob, {
        cacheControl: "3600",
        upsert: false,
        contentType: blob.type || file.type || undefined,
      });

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
    } finally {
      setUploading(false);
      // Reset the picker so re-selecting the same file (after an error) re-fires onChange.
      if (inputRef.current) inputRef.current.value = "";
    }
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
