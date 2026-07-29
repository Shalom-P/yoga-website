"use client";

import { useEffect, useLayoutEffect } from "react";
import { pausePhiCapture, resumePhiCapture } from "@/lib/analytics/events";

// useLayoutEffect on the client, useEffect during SSR (silences the SSR warning;
// the guard only does anything in a browser anyway).
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Pauses PostHog session replay while a health-data (PHI) screen is mounted, and
 * resumes it on unmount. Drop this into any route that renders medical documents
 * so health information is never captured in a recording.
 *
 * A LAYOUT effect on purpose: it runs synchronously in the same task as React's
 * DOM commit, BEFORE rrweb's MutationObserver microtask records the newly
 * committed subtree — a passive useEffect runs a task later, after the PHI
 * frame is already in the replay buffer. This is still only defense in depth;
 * the PHI containers themselves carry data-phi so anything captured around the
 * pause window is masked at serialization time (see maskTextSelector in
 * lib/analytics/events.ts).
 */
export function PhiReplayGuard() {
  useIsomorphicLayoutEffect(() => {
    pausePhiCapture();
    return () => resumePhiCapture();
  }, []);
  return null;
}
