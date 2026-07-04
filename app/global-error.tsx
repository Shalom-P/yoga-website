"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Catches errors thrown by the root layout itself, which app/error.tsx (nested
// inside that layout) cannot. Renders without the layout, so no globals.css,
// fonts, or providers are available here: inline styles only.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "4rem 1.5rem",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          color: "#3f3a36",
          background: "#faf7f2",
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: 600 }}>
          Something went out of balance.
        </h1>
        <p style={{ marginTop: "1rem", maxWidth: "28rem", color: "#6b645e" }}>
          An unexpected error occurred. Try again. If it keeps happening, we&apos;d
          love to hear about it.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "2rem",
            height: "3rem",
            padding: "0 1.75rem",
            borderRadius: "9999px",
            border: "none",
            background: "#C66B4E",
            color: "#fff",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
