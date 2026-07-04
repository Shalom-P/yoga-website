import type { Metadata, Viewport } from "next";
import {
  Fraunces,
  Inter,
  Geist_Mono,
  Cormorant_Garamond,
  Hanken_Grotesk,
} from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { AnalyticsProvider } from "@/components/shared/AnalyticsProvider";
import type { Organization, WithContext } from "schema-dts";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

// Marketing-surface fonts (My Yoga Classes design handoff): elegant display
// serif + clean grotesk body. Scoped to .myc-theme in globals.css.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});

// The site is intentionally light-only (warm cream brand skin). Advertise a
// single light theme-colour so the browser chrome matches the forced-light UI;
// a dark variant here would clash with the light page under OS dark mode.
export const viewport: Viewport = {
  themeColor: "#fbf7ef",
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "My Yoga Classes: Live 1:1 online yoga teacher",
    template: "%s · My Yoga Classes",
  },
  description:
    "Live online yoga with expert teachers from India. Book a 60-minute personalised 1:1 session, shown in your local time.",
  applicationName: "My Yoga Classes",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "My Yoga Classes",
    locale: "en",
    title: "My Yoga Classes: Live 1:1 online yoga teacher",
    description:
      "Find your 1:1 yoga teacher. 60-minute personalised session. Pick your teacher. Pick your time. Meets live online.",
  },
  twitter: { card: "summary_large_image" },
};

// Site-wide Organization structured data (uses the schema-dts types that were
// installed but previously unused). Rendered as JSON-LD in the document body.
const orgJsonLd: WithContext<Organization> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "My Yoga Classes",
  url: siteUrl,
  logo: `${siteUrl}/icon.svg`,
  description:
    "Live online 1:1 yoga with expert teachers from India for students across the UAE and India. Book a personalised session in your local time.",
  areaServed: [
    { "@type": "Country", name: "United Arab Emirates" },
    { "@type": "Country", name: "India" },
  ],
  knowsLanguage: ["en"],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "hello@myyogaclasses.fit",
    availableLanguage: ["English"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${geistMono.variable} ${cormorant.variable} ${hanken.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        {/* Force light: the brand skin is light-only (no .dark token set in
            globals.css), so enabling system dark would force-light the page
            tokens while shadcn's dark: variants still fired on form controls,
            a broken half-dark state. Re-enable system/toggle only once a real
            `.dark .myc-theme` / `.dark .myc-app` skin exists. */}
        <ThemeProvider attribute="class" forcedTheme="light">
          {/* Lenis smooth-scroll is scoped to the marketing layout; the app,
              admin and auth surfaces use native scrolling (see (marketing)/layout). */}
          <AnalyticsProvider>{children}</AnalyticsProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
