// Only same-origin relative paths are accepted as redirect targets.
// `new URL(arg, base)` ignores the base when arg is absolute, so an unvalidated
// `?next=https://evil.com` would otherwise become an open redirect. `//` and
// `/\` are protocol-relative escapes browsers also follow.
export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  return raw;
}
