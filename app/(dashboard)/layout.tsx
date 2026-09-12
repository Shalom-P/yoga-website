import { requireUser } from "@/lib/auth/guards";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { WhatsAppButton } from "@/components/shared/WhatsAppButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, supabase } = await requireUser("/dashboard");
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();
  const name = profile?.full_name || user.email || "Member";
  // Drives the Admin link in the sidebar only. The real gate is the middleware
  // role routing plus requireAdmin() inside /admin, so a stale or spoofed value
  // here would surface a dead link, never actual access.
  const isAdmin = profile?.role === "admin";

  return (
    <div className="myc-app myc-dark myc-sharp min-h-dvh flex flex-col lg:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-foreground"
      >
        Skip to content
      </a>
      <DashboardSidebar userName={name} userEmail={user.email ?? ""} isAdmin={isAdmin} />
      {/* `overflow-clip` contains the atmosphere blob below without creating a
          scroll container, which would break the sticky confirm bar in the slot
          picker and the sticky sidebar's scroll sync. */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-clip">
        {/* Soft teal bloom. A radial gradient that fades to transparent, NOT a
            blurred orb: blur() here is a full-size filter pass repaid on every
            navigation, for a look the gradient already gives free (see 45dff3e). */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-[15%] -top-[25%] size-[640px]"
          style={{
            background:
              "radial-gradient(closest-side, var(--myc-glow-1), transparent 70%)",
          }}
        />
        <main
          id="main-content"
          className="relative mx-auto w-full max-w-[1040px] flex-1 px-5 pb-32 pt-8 sm:px-8 sm:pt-11 lg:px-9"
        >
          {children}
        </main>
      </div>
      <WhatsAppButton />
    </div>
  );
}
