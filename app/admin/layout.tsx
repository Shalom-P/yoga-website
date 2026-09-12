import { requireAdmin } from "@/lib/auth/guards";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="myc-app myc-dark myc-sharp min-h-dvh flex flex-col lg:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-foreground"
      >
        Skip to content
      </a>
      <AdminSidebar />
      {/* `overflow-clip` contains the bloom without creating a scroll container,
          which would break sticky table headers and the sticky sidebar. */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-clip">
        {/* Radial gradient, not a blurred orb: blur() here is a full-size filter
            pass repaid on every navigation (see 45dff3e). */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-[15%] -top-[25%] size-[640px]"
          style={{
            background: "radial-gradient(closest-side, var(--myc-glow-1), transparent 70%)",
          }}
        />
        <main
          id="main-content"
          className="relative mx-auto w-full max-w-[1180px] flex-1 px-5 pb-32 pt-8 sm:px-8 sm:pt-10 lg:px-9"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
