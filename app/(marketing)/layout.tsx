import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { getCurrentUser } from "@/lib/auth/guards";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Determine auth state server-side so the nav can swap "Log in" → "Dashboard"
  // for signed-in users. Otherwise jumping from /dashboard to a marketing page
  // looks like you got logged out.
  const user = await getCurrentUser();
  return (
    <div className="myc-theme">
      <MarketingNav isAuthenticated={!!user} />
      <main className="flex-1 pt-16">{children}</main>
      <Footer />
    </div>
  );
}
