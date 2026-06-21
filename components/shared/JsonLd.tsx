// Renders a JSON-LD <script> for structured data. Server-safe (no "use client").
// Pass a schema-dts WithContext<...> object built via lib/seo/structuredData.

// JSON.stringify does NOT escape `<`, `>`, `&`, or the JS line terminators
// U+2028/U+2029, so a teacher-/customer-editable field (display_name, headline,
// specialties, …) containing `</script>` would break out of this inline <script>
// and execute. `<` is the character that enables the breakout; re-encoding it (plus
// the others, for completeness) to \uXXXX keeps the JSON valid but inert in HTML.
// The matcher is built from an ASCII-escaped string so this source stays ASCII.
const HTML_UNSAFE = new RegExp("[<>&\\u2028\\u2029]", "g");

function safeJsonLd(data: object): string {
  return JSON.stringify(data).replace(
    HTML_UNSAFE,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")
  );
}

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}
