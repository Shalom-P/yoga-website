import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { AnalyticsProvider } from "@/components/shared/AnalyticsProvider";
import { LenisProvider } from "@/components/shared/LenisProvider";
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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBFAF4" },
    { media: "(prefers-color-scheme: dark)", color: "#1E2622" },
  ],
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sahajayoga.com.au";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Sahaja Yoga — Free 1:1 yoga teacher · Online · No credit card",
    template: "%s · Sahaja Yoga",
  },
  description:
    "Live online yoga with expert teachers from India. Book a free 60-minute private session — no credit card required. Times in your local AEST/AEDT.",
  applicationName: "Sahaja Yoga",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Sahaja Yoga",
    locale: "en_AU",
    title: "Sahaja Yoga — Free 1:1 yoga teacher · Online",
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
      className={`${inter.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <LenisProvider>
            <AnalyticsProvider>{children}</AnalyticsProvider>
          </LenisProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
