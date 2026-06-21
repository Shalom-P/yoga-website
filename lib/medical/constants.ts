// Shared constants for the secure medical-document feature. Importable from BOTH
// client and server (no `server-only` here) — the browser upload tile needs the
// bucket id + accept filter, the API routes reuse the same limits.
//
// The PRIVATE bucket + its mime/size limits are provisioned in
// supabase/migrations/0027_medical_documents.sql. Keep these in sync with that.

export const MEDICAL_DOCS_BUCKET = "medical-documents";

/** Max upload size, in bytes (25 MB). Mirrors the bucket file_size_limit in 0027. */
export const MEDICAL_DOC_MAX_BYTES = 26214400;

/** Allowed mime types. Mirrors the bucket allowed_mime_types in 0027. */
export const MEDICAL_DOC_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type MedicalDocMime = (typeof MEDICAL_DOC_MIME_TYPES)[number];

/** `accept` attribute for the file picker. */
export const MEDICAL_DOC_ACCEPT = MEDICAL_DOC_MIME_TYPES.join(",");

/** True when a string is one of the allow-listed medical mime types. */
export function isAllowedMedicalMime(mime: string | null | undefined): mime is MedicalDocMime {
  return !!mime && (MEDICAL_DOC_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * Sanitize a user-supplied file name before it's stored and later echoed into a
 * signed-URL Content-Disposition / rendered in the UI. Drops the directory part
 * and any ASCII control character (incl. CR/LF, which could otherwise smuggle
 * header content) plus double quotes, collapses whitespace, and caps length.
 * Always returns a non-empty name.
 */
export function sanitizeFileName(name: string): string {
  const lastSegment = name.split(/[\\/]/).pop() ?? "";
  let out = "";
  for (const ch of lastSegment) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 32 || code === 127 || ch === '"') continue; // control chars + quote
    out += ch;
  }
  out = out.replace(/\s+/g, " ").trim().slice(0, 200);
  return out || "document";
}

/** Map a mime type to a short, human label for the UI. */
export function mimeLabel(mime: string | null): string {
  if (!mime) return "File";
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return "Image";
  return "File";
}

/** Format a byte count for display. */
export function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
