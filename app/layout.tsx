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
import { NativeBridge } from "@/components/shared/NativeBridge";
import type { Organization, WithContext } from "schema-dts";
import { INSTAGRAM_URL, ORG_ID } from "@/lib/seo/structuredData";
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

// Every surface wears the dark .myc-dark skin ((marketing), (auth), (dashboard),
// admin, (teacher), error.tsx, not-found.tsx), so the browser-chrome tint is
// its --background and is set once here for all of them. A single value, not a
// light/dark media pair: the page is dark under either OS setting. No route
// group overrides it. global-error.tsx replaces this layout and loses this
// export, so it carries its own <meta name="theme-color">; keep the two equal.
export const viewport: Viewport = {
  themeColor: "#0a2b26",
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
  // Next.js does not merge `openGraph` field by field: a page that sets its own
  // openGraph replaces this whole object, and a page that sets none inherits it
  // verbatim. A literal title/description here therefore stamped the homepage's
  // social copy onto all 23 URLs. Leaving them out lets each page's own
  // title/description flow into og:title/og:description instead.
  openGraph: {
    type: "website",
    siteName: "My Yoga Classes",
    // Open Graph wants language_TERRITORY; a bare "en" is dropped.
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Required for a large thumbnail in mobile results and for Google
      // Discover eligibility. Without it Google caps previews at a barren
      // default, which for a visual category like yoga is a real cost.
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

// Site-wide Organization structured data (uses the schema-dts types that were
// installed but previously unused). Rendered as JSON-LD in the document body.
const orgJsonLd: WithContext<Organization> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  // Stable id so the Course and Person nodes on other pages resolve to THIS
  // organisation instead of each declaring an anonymous one. See ORG_ID.
  "@id": ORG_ID,
  name: "My Yoga Classes",
  url: siteUrl,
  logo: `${siteUrl}/icon.svg`,
  sameAs: [INSTAGRAM_URL],
  description:
    "Live online 1:1 yoga with expert teachers from India, for students anywhere in the world. Book a personalised session in your local time.",
  // The studio takes customers worldwide. Naming specific countries here tells
  // search engines the service area stops at their borders.
  areaServed: "Worldwide",
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
      // globals.css sets `scroll-behavior: smooth` on <html>. Without this
      // attribute Next.js ANIMATES the scroll-to-top on every route change, so
      // each navigation takes hundreds of ms of visible scrolling before the new
      // page settles — it reads as lag. Lenis masks this on the marketing pages
      // (it forces scroll-behavior: auto while mounted) but nothing does on
      // dashboard, admin, teacher or auth, which is exactly where navigation
      // felt slow. This opts route transitions back into an instant jump while
      // leaving in-page anchor scrolling smooth.
      data-scroll-behavior="smooth"
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
          <NativeBridge />
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
