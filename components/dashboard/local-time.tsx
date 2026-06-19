"use client";

import { useSyncExternalStore } from "react";
import { formatInTz, tzShort, detectBrowserTimezone } from "@/lib/timezone";

// The timezone never changes during a session, so the store has no updates.
const subscribe = () => () => {};

/**
 * Times should display in the timezone where the customer actually opens the
 * site — Australia spans several zones, so a single stored/default zone is
 * wrong for many people. useSyncExternalStore renders the server-provided
 * `fallback` during SSR/hydration, then resolves to the real browser timezone
 * on the client — without a hydration-mismatch warning.
 */
export function useBrowserTz(fallback: string): string {
  return useSyncExternalStore(
    subscribe,
    () => detectBrowserTimezone(),
    () => fallback,
  );
}

/**
 * False during SSR and the first client (hydration) render, true afterwards.
 * Lets a component wait for the *real* browser timezone before deciding
 * location-dependent UI — without a hydration mismatch.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/** A UTC timestamp formatted in the viewer's local (browser) timezone. */
export function LocalTime({
  iso,
  pattern = "EEE d MMM, h:mm a",
  fallbackTz,
}: {
  iso: string;
  pattern?: string;
  fallbackTz: string;
}) {
  const tz = useBrowserTz(fallbackTz);
  return <>{formatInTz(iso, tz, pattern)}</>;
}

/** Short label for the viewer's local timezone, e.g. "GMT+11" / "AWST". */
export function LocalTzLabel({ fallbackTz }: { fallbackTz: string }) {
  const tz = useBrowserTz(fallbackTz);
  return <>{tzShort(tz)}</>;
}

/** The viewer's local timezone name, e.g. "Australia/Perth". */
export function LocalTzName({ fallbackTz }: { fallbackTz: string }) {
  const tz = useBrowserTz(fallbackTz);
  return <>{tz}</>;
}
