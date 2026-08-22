// Native (Capacitor / iOS) bridge helpers.
//
// This app ships to iOS as a Capacitor shell that loads the hosted Next.js site
// in a WKWebView (see capacitor.config.ts + IOS-CONVERSION-PLAN.md). The web JS
// served to that WebView can call native plugins through the injected
// `window.Capacitor` bridge. On the plain web (no bridge) every helper here is a
// no-op or falls back to standard browser behaviour, so these are safe to import
// and call unconditionally.
//
// Capacitor plugins are imported dynamically inside functions so they stay out
// of the server/SSR bundle and never touch `window` during render.

import { Capacitor } from "@capacitor/core";
import type { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/redirects";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type OAuthProvider = "google" | "apple";

/** True when running inside the native iOS/Android shell. SSR-safe (false). */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Start an OAuth sign-in (Google / Sign in with Apple) from the native app.
 *
 * Google blocks OAuth inside embedded WebViews ("disallowed_useragent"), so the
 * provider page must open in the system browser (ASWebAuthenticationSession via
 * @capacitor/browser). Supabase redirects back to the custom `myyoga://` scheme,
 * which the deep-link listener in `setupNativeApp` turns into a navigation to the
 * existing `/auth/callback` route — reusing the web cookie-exchange + onboarding
 * routing verbatim.
 */
// True only between "user tapped Continue with Google/Apple" and the deep link
// (or sheet dismissal) that ends that attempt. The deep-link handler ignores
// myyoga:// URLs outside this window, so another app on the phone can't steer
// the WebView to /auth/callback (or the login error banner) at will.
let oauthInProgress = false;

export async function nativeOAuthSignIn(
  supabase: BrowserClient,
  provider: OAuthProvider,
  next: string,
  onFinished?: () => void,
): Promise<void> {
  // ⚠️ Operational prerequisite: `myyoga://auth/callback` must be in Supabase
  // Auth → URL Configuration → Redirect URLs. GoTrue silently 302s a
  // non-allow-listed redirect_to to the Site URL instead, which strands the
  // sign-in in the browser sheet with no deep link ever firing.
  const redirectTo = `myyoga://auth/callback?next=${encodeURIComponent(next)}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Could not start sign-in. Please try again.");

  const { Browser } = await import("@capacitor/browser");
  oauthInProgress = true;
  // Fires when the system browser sheet is dismissed (success-close or cancel):
  // clear the loading state and close the deep-link acceptance window. On the
  // success path the deep link arrives while the sheet is still up, so the
  // window is already consumed by then.
  const sub = await Browser.addListener("browserFinished", () => {
    void sub.remove();
    oauthInProgress = false;
    onFinished?.();
  });
  await Browser.open({ url: data.url, presentationStyle: "popover" });
}

/** Open an external URL in the in-app system browser (native) or a new tab (web). */
export async function openExternal(url: string): Promise<void> {
  if (isNativeApp()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Capture a photo (camera or photo library) and return it as a File suitable for
 * the existing medical-document upload path. Native only.
 */
export async function capturePhotoAsFile(): Promise<File | null> {
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  // Base64, NOT Uri: this shell loads the HOSTED site, so the document origin is
  // https://www.myyogaclasses.fit while photo.webPath is a capacitor://-scheme
  // local URL — fetch(webPath) is cross-origin there and is blocked. Base64
  // hands the bytes over the bridge directly, origin-independent.
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.Base64,
    source: CameraSource.Prompt, // let the user pick camera vs. library
    quality: 85,
    correctOrientation: true,
    presentationStyle: "fullscreen",
  });
  if (!photo.base64String) return null;
  const binary = atob(photo.base64String);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const format = (photo.format || "jpeg").toLowerCase();
  const ext = format === "jpg" ? "jpeg" : format;
  const mime = `image/${ext}`;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new File([bytes], `health-photo-${stamp}.${ext}`, { type: mime });
}

/** Forward a `myyoga://auth/callback?code=…` deep link into the web callback route. */
async function handleAuthDeepLink(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }
  // Any app on the device can open a myyoga:// URL once the scheme is
  // registered, so treat the whole thing as untrusted: only the exact
  // auth-callback shape is acted on. (`myyoga://auth/callback` parses as
  // host "auth", pathname "/callback".)
  if (url.protocol !== "myyoga:") return;
  if (url.host !== "auth" || url.pathname !== "/callback") return;

  // Only act while a sign-in this app started is actually in flight. Consume
  // the window immediately so a burst of malicious deep links can fire at most
  // one navigation, and only during a real attempt.
  if (!oauthInProgress) return;
  oauthInProgress = false;

  // Close the OAuth browser sheet, if open.
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close();
  } catch {
    /* sheet may already be closed */
  }

  const code = url.searchParams.get("code");
  const hadError =
    url.searchParams.has("error_description") || url.searchParams.has("error");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    // Reuse the server callback: it exchanges the PKCE code (verifier cookie is
    // already set on this origin), sets the session cookie, and applies the same
    // onboarding/teacher routing as the web flow. (An attacker-injected code is
    // harmless: it fails the PKCE verifier-cookie exchange.)
    window.location.href = `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`;
  } else if (hadError) {
    // Still FIXED messages. error_description is attacker-writable from any
    // other app on the phone, and LoginForm renders the error param in a trusted
    // role=alert banner, so it is never forwarded verbatim. It is only
    // pattern-matched to choose between two strings we control, mirroring the
    // same branch in app/(auth)/auth/callback/route.ts.
    //
    // The email case is a phone-number-only Apple ID (common in IN/CN). It has
    // no address for us to create an account with, so "try again" would be a
    // lie: the only way forward is a different sign-in method.
    const description = url.searchParams.get("error_description") ?? "";
    const message = /email/i.test(description)
      ? "That Apple ID has no email address attached, so we can't finish signing you in. Please continue with Google or email instead."
      : "Sign-in didn't finish. Please try again, or continue with Google or email.";
    window.location.href = `/login?error=${encodeURIComponent(message)}`;
  }
}

let didSetup = false;

/**
 * One-time native setup: status-bar styling, the OAuth deep-link listener, and
 * push registration. Safe to call on every mount — it self-guards and no-ops on
 * the web.
 */
export async function setupNativeApp(): Promise<void> {
  if (didSetup || !isNativeApp()) return;
  didSetup = true;

  if (typeof document !== "undefined") {
    document.documentElement.classList.add("capacitor-native", "capacitor-ios");
  }

  // The shell keeps the splash up (launchShowDuration 3s as a ceiling); hiding
  // it here, on hydration, is what actually ends the launch screen early.
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* splash plugin unavailable; the shell's auto-hide ceiling covers it */
  }

  // Dark status-bar text for the light cream background.
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light });
  } catch {
    /* status-bar plugin unavailable */
  }

  // OAuth callback deep links.
  try {
    const { App } = await import("@capacitor/app");
    await App.addListener("appUrlOpen", (event) => {
      void handleAuthDeepLink(event.url);
    });
  } catch {
    /* app plugin unavailable */
  }

  // Push notifications (no-op until APNs is configured server-side).
  try {
    const { registerPushNotifications } = await import("@/lib/native/push");
    await registerPushNotifications();
  } catch {
    /* push unavailable / declined */
  }
}
