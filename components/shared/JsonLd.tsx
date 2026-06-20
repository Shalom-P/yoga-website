// Renders a JSON-LD <script> for structured data. Server-safe (no "use client").
// Pass a schema-dts WithContext<...> object built via lib/seo/structuredData.
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
