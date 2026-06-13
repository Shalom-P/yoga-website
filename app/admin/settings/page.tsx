import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth/guards";
import { AdminSettingsForm } from "@/components/admin/AdminSettingsForm";

export default async function AdminSettingsPage() {
  await requireAdmin();

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-[family-name:var(--font-heading)] tracking-tight mb-6">
        Settings
      </h1>
      <Tabs defaultValue="landing" className="w-full">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="landing">Landing copy</TabsTrigger>
          <TabsTrigger value="brand">Brand</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="legal">Legal</TabsTrigger>
        </TabsList>
        <TabsContent value="landing" className="mt-6">
          <AdminSettingsForm
            section="landing"
            fields={[
              { key: "landing.hero_headline", label: "Hero headline", type: "text" },
              { key: "landing.hero_subhead",  label: "Hero subhead", type: "textarea" },
              { key: "landing.trust_count",   label: "Trust count (e.g. '1,200+ reviews')", type: "text" },
              { key: "landing.trust_rating",  label: "Trust rating (e.g. '4.9')", type: "text" },
              { key: "landing.final_headline", label: "Final CTA headline", type: "text" },
            ]}
          />
        </TabsContent>
        <TabsContent value="brand" className="mt-6">
          <AdminSettingsForm
            section="brand"
            fields={[
              { key: "brand.name", label: "Brand name", type: "text" },
              { key: "brand.tagline", label: "Brand tagline", type: "text" },
              { key: "brand.primary_color", label: "Primary colour (hex)", type: "text" },
              { key: "brand.accent_color", label: "Accent colour (hex)", type: "text" },
            ]}
          />
        </TabsContent>
        <TabsContent value="email" className="mt-6">
          <AdminSettingsForm
            section="email"
            fields={[
              { key: "support.email", label: "Support email address", type: "text" },
              { key: "email.from_name", label: "From name", type: "text" },
            ]}
          />
        </TabsContent>
        <TabsContent value="legal" className="mt-6">
          <p className="text-sm text-muted-foreground">
            Edit your legal pages directly in <code>app/(marketing)/legal/</code>.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
