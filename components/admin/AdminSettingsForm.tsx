"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type Field = { key: string; label: string; type: "text" | "textarea" };

export function AdminSettingsForm({ section, fields }: { section: string; fields: Field[] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("admin_settings")
        .select("key, value")
        .in("key", fields.map((f) => f.key));
      const seed: Record<string, string> = {};
      (data ?? []).forEach((row) => {
        seed[row.key] = typeof row.value === "string" ? row.value : JSON.stringify(row.value);
      });
      setValues(seed);
      setLoading(false);
    })();
  }, [section, supabase, fields]);

  async function save() {
    setSaving(true);
    const upserts = fields.map((f) => ({
      key: f.key,
      value: JSON.parse(JSON.stringify(values[f.key] ?? "")),
    }));
    const { error } = await supabase.from("admin_settings").upsert(upserts);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved. Changes go live within ~60 seconds.");
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-5">
      {fields.map((f) => (
        <div key={f.key}>
          <Label htmlFor={f.key}>{f.label}</Label>
          {f.type === "textarea" ? (
            <Textarea
              id={f.key}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="mt-1.5"
              rows={3}
              disabled={saving}
            />
          ) : (
            <Input
              id={f.key}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="mt-1.5"
              disabled={saving}
            />
          )}
        </div>
      ))}
      <Button onClick={save} disabled={saving} className="rounded-full">
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
