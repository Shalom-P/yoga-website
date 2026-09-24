"use client";

import { useSyncExternalStore } from "react";
import { formatInTz, tzShort, tzOffsetLabel, detectBrowserTimezone } from "@/lib/timezone";

// The timezone never changes during a session, so the store has no updates.
const subscribe = () => () => {};

/**
 * Times should display in the timezone where the customer actually opens the
 * site — customers span several zones (UAE, India, and travellers), so a single
 * stored/default zone is wrong for many people. useSyncExternalStore renders the server-provided
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

/**
 * Short label for the viewer's local timezone, e.g. "GST" / "GMT+5:30".
 *
 * The Intl name (tzShort) follows the runtime's locale: the en-US server says
 * "GMT+4" for Asia/Dubai where an en-GB or en-AE browser says "GST". Rendering
 * it in the hydration pass fails React's text check and throws the page away,
 * so the server and hydration renders show the plain GMT offset, and the Intl
 * name takes over once mounted.
 */
export function LocalTzLabel({ fallbackTz }: { fallbackTz: string }) {
  const tz = useBrowserTz(fallbackTz);
  const mounted = useHasMounted();
  return <>{mounted ? tzShort(tz) : tzOffsetLabel(tz)}</>;
}

/** The viewer's local timezone name, e.g. "Asia/Dubai". */
export function LocalTzName({ fallbackTz }: { fallbackTz: string }) {
  const tz = useBrowserTz(fallbackTz);
  return <>{tz}</>;
}
