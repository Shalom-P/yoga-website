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
          backgroundColor: "#1E3A2F",
          padding: "80px",
          gap: "24px",
        }}
      >
        {/* Decorative top accent */}
        <div
          style={{
            width: "64px",
            height: "4px",
            backgroundColor: "#A8C5A0",
            borderRadius: "2px",
            marginBottom: "8px",
          }}
        />

        {/* Studio name */}
        <div
          style={{
            fontSize: "72px",
            fontWeight: 700,
            color: "#F5F0E8",
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
            color: "#A8C5A0",
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
            color: "#7BA694",
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
            backgroundColor: "#A8C5A0",
            borderRadius: "2px",
            marginTop: "16px",
          }}
        />
      </div>
    ),
    size
  );
}
