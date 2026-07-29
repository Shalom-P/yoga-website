// Client-side push registration. Requests notification permission, registers
// with APNs, and posts the device token to the server. No-op on the web and a
// safe no-op server-side (the token is only used once APNs is configured — see
// lib/push/apns.ts).

import { isNativeApp } from "@/lib/native/capacitor";

// Retained so sign-out can unregister JUST this device. localStorage (not only
// module state) because sign-out may happen in a later JS context than the one
// that registered.
const TOKEN_STORAGE_KEY = "apns_push_token";

function rememberToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    /* storage unavailable — DELETE falls back to wiping all rows */
  }
}

function recallToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function registerPushNotifications(): Promise<void> {
  if (!isNativeApp()) return;

  const { PushNotifications } = await import("@capacitor/push-notifications");

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return;

  await PushNotifications.addListener("registration", (token) => {
    rememberToken(token.value);
    void fetch("/api/push/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: token.value, platform: "ios" }),
    }).catch(() => {
      /* token re-registers on next launch */
    });
  });

  await PushNotifications.addListener("registrationError", () => {
    /* surfaced via server logs only */
  });

  await PushNotifications.register();
}

/**
 * Remove this device's push registration on sign-out. Call BEFORE
 * supabase.auth.signOut() — the DELETE endpoint authenticates with the session
 * cookie that signOut destroys. Without this, the device keeps receiving the
 * previous user's session reminders after logout.
 */
export async function unregisterPushNotifications(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    // Server first (needs the still-valid session), then the local APNs side.
    // Scope the removal to THIS device's token; a body-less DELETE wipes every
    // device's registration, silently killing push on the user's other devices.
    const token = recallToken();
    await fetch("/api/push/register", {
      method: "DELETE",
      ...(token
        ? {
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token }),
          }
        : {}),
    });
    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  } catch {
    /* token also self-heals server-side via APNs 410 pruning */
  }
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.unregister();
  } catch {
    /* plugin unavailable */
  }
}
