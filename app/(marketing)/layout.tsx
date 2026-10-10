import { MotionConfig } from "motion/react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { LenisProvider } from "@/components/shared/LenisProvider";
import { WhatsAppButton } from "@/components/shared/WhatsAppButton";
import { StickyMobileCTA } from "@/components/marketing/StickyMobileCTA";

// The browser-chrome tint (viewport themeColor) comes from the root layout, which
// every route group shares now that they all wear the same dark skin.

// No auth read here on purpose: awaiting cookies() (via getCurrentUser) would
// opt the whole (marketing) group into dynamic rendering and disable every
// page's ISR window. MarketingNav resolves auth state client-side instead.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LenisProvider>
      {/* Honour prefers-reduced-motion across all Motion animations (the JS
          whileInView/opacity reveals aren't covered by the CSS media query). */}
      <MotionConfig reducedMotion="user">
        {/* myc-dark carries the dark skin. It is deliberately NOT on .myc-theme:
            that class also wraps (auth), error.tsx and not-found.tsx. */}
        <div className="myc-theme myc-dark">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            Skip to content
          </a>
          <MarketingNav />
          <main id="main-content" className="flex-1 pt-16">
            {children}
          </main>
          <Footer />
          <WhatsAppButton />
          {/* Mounted here, not per page: 75% of traffic is mobile and the bar
              used to exist only on the homepage, so every condition, teacher
              and pricing page had no persistent CTA. It stays hidden until
              the visitor scrolls past the first screen. */}
          <StickyMobileCTA />
        </div>
      </MotionConfig>
    </LenisProvider>
  );
}
