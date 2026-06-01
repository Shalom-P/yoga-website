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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBFAF4" },
    { media: "(prefers-color-scheme: dark)", color: "#1E2622" },
  ],
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://myyogaclasses.com.au";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "My Yoga Classes — Free 1:1 yoga teacher · Online · No credit card",
    template: "%s · My Yoga Classes",
  },
  description:
    "Live online yoga with expert teachers from India. Book a free 60-minute private session — no credit card required. Times in your local AEST/AEDT.",
  applicationName: "My Yoga Classes",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "My Yoga Classes",
    locale: "en_AU",
    title: "My Yoga Classes — Free 1:1 yoga teacher · Online",
    description:
      "Find your free 1:1 yoga teacher. 60-minute private session. Pick your teacher. Pick your time. Meets on Google Meet.",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-AU"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${geistMono.variable} ${cormorant.variable} ${hanken.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {/* Lenis smooth-scroll is scoped to the marketing layout — the app,
              admin and auth surfaces use native scrolling (see (marketing)/layout). */}
          <AnalyticsProvider>{children}</AnalyticsProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
