"use client";

import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useIsNative } from "@/lib/native/useIsNative";

/**
 * Permanent account deletion (App Store Guideline 5.1.1(v)). Deletes the user and
 * all their data server-side, then signs out and returns to the home page.
 *
 * Rendered ONLY inside the native iOS shell: 5.1.1(v) requires deletion in the
 * app, and the owner wants the website unchanged, so the web profile page keeps
 * its existing support-email deletion path. (The API route works either way.)
 */
export function DeleteAccountSection() {
  const supabase = createSupabaseBrowserClient();
  const native = useIsNative();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    setBusy(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(`Couldn't delete your account: ${body.error ?? "unknown error"}`);
        setBusy(false);
        return;
      }
      await supabase.auth.signOut().catch(() => {});
      // Hard navigation so all client state + the WebView session are cleared.
      window.location.href = "/";
    } catch {
      toast.error("Network error. Please try again.");
      setBusy(false);
    }
  }

  if (!native) return null;

  return (
    <section className="mt-10 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
      <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <AlertTriangle className="size-4 text-destructive" />
        Delete account
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Permanently delete your account and all associated data, including any
        health documents you&apos;ve uploaded. This can&apos;t be undone.
      </p>
      <Button
        variant="destructive"
        className="mt-4 rounded-full"
        onClick={() => setOpen(true)}
      >
        Delete my account
      </Button>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently removes your profile, bookings, session credits, and
              all uploaded health documents. We can&apos;t recover them afterwards.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Keep my account
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
