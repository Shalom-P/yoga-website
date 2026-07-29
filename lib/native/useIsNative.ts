"use client";

import { useSyncExternalStore } from "react";
import { isNativeApp } from "@/lib/native/capacitor";

// The native flag never changes after launch, so there's nothing to subscribe to.
const noopSubscribe = () => () => {};

/**
 * Returns true when running inside the native iOS shell. Uses the server snapshot
 * (`false`) for SSR and the first hydration pass — so there's no hydration
 * mismatch — then reports the real client value.
 */
export function useIsNative(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => isNativeApp(),
    () => false,
  );
}
