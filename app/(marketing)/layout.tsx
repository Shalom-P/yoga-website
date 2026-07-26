import { MotionConfig } from "motion/react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { LenisProvider } from "@/components/shared/LenisProvider";
import { WhatsAppButton } from "@/components/shared/WhatsAppButton";

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
        <div className="myc-theme">
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
        </div>
      </MotionConfig>
    </LenisProvider>
  );
}
