import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "My Yoga Classes: Live 1:1 online yoga";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0F5C4E",
          padding: "80px",
          gap: "24px",
        }}
      >
        {/* Brand mark */}
        <svg
          width="120"
          height="120"
          viewBox="0 0 96 96"
          fill="none"
          stroke="#FBF7EF"
          strokeWidth="4.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="48" cy="13.5" r="11.3" />
          <path d="M17.5 71 C 22 58 32 42 44.5 30 C 49 33 54 36.5 55 40.5 C 56 44.5 52.5 49.8 48 52.8 C 43.5 55.8 28 63.7 17.5 71 Z" />
          <path d="M78.5 71 C 74 58 64 42 51.5 30 C 47 33 42 36.5 41 40.5 C 40 44.5 43.5 49.8 48 52.8 C 52.5 55.8 68 63.7 78.5 71 Z" />
          <path d="M48 84 C 42 81.8 34 74.5 26 74.5 C 18 74.5 6 77.8 6 84 C 6 90.2 18 93.5 26 93.5 C 34 93.5 42 86.2 48 84 C 54 81.8 62 74.5 70 74.5 C 78 74.5 90 77.8 90 84 C 90 90.2 78 93.5 70 93.5 C 62 93.5 54 86.2 48 84 Z" />
        </svg>

        {/* Studio name */}
        <div
          style={{
            fontSize: "72px",
            fontWeight: 700,
            color: "#FBF7EF",
            letterSpacing: "-1px",
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          My Yoga Classes
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "32px",
            fontWeight: 400,
            color: "#DCEAE0",
            textAlign: "center",
            lineHeight: 1.4,
            maxWidth: "800px",
          }}
        >
          Live 1:1 online yoga · In your local time
        </div>

        {/* Sub-tagline */}
        <div
          style={{
            fontSize: "22px",
            fontWeight: 400,
            color: "#9FC4B8",
            textAlign: "center",
            marginTop: "8px",
          }}
        >
          Expert teachers from India · Live online
        </div>

        {/* Decorative bottom accent */}
        <div
          style={{
            width: "64px",
            height: "4px",
            backgroundColor: "#DCEAE0",
            borderRadius: "2px",
            marginTop: "16px",
          }}
        />
      </div>
    ),
    size
  );
}
