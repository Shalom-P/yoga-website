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

export function SignOutButton({ variant = "ghost", size = "sm", className }: Props) {
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function signOut() {
    setLoading(true);
    // Remove this device's push token BEFORE signOut(): the DELETE endpoint
    // authenticates with the session cookie signOut() destroys. Without it the
    // device keeps receiving the previous user's session reminders. No-op on web.
    await unregisterPushNotifications().catch(() => {});
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <Button onClick={signOut} disabled={loading} variant={variant} size={size} className={className}>
      <LogOut className="size-4 mr-1" />
      {loading ? "Signing out…" : "Sign out"}
    </Button>
  );
}
