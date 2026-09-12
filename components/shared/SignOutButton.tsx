"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { unregisterPushNotifications } from "@/lib/native/push";

type Props = {
  variant?: "ghost" | "outline";
  size?: "sm" | "default";
  className?: string;
};

/**
 * The sign-out sequence, shared with surfaces that render their own control
 * instead of this button (the member sidebar's plain text link and its mobile
 * account menu). The push-token step has to come FIRST, so keep callers on this
 * function rather than re-implementing the order.
 */
export async function performSignOut() {
  // Remove this device's push token BEFORE signOut(): the DELETE endpoint
  // authenticates with the session cookie signOut() destroys. Without it the
  // device keeps receiving the previous user's session reminders. No-op on web.
  await unregisterPushNotifications().catch(() => {});
  await createSupabaseBrowserClient().auth.signOut();
  window.location.href = "/";
}

export function SignOutButton({ variant = "ghost", size = "sm", className }: Props) {
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    await performSignOut();
  }

  return (
    <Button onClick={signOut} disabled={loading} variant={variant} size={size} className={className}>
      <LogOut className="size-4 mr-1" />
      {loading ? "Signing out…" : "Sign out"}
    </Button>
  );
}
