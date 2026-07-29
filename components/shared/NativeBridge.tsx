"use client";

import { useEffect } from "react";
import { setupNativeApp } from "@/lib/native/capacitor";

/**
 * Mounts once at the app root and wires up native-shell behaviour (status bar,
 * OAuth deep links, push registration). Renders nothing and no-ops on the web.
 */
export function NativeBridge() {
  useEffect(() => {
    void setupNativeApp();
  }, []);
  return null;
}
