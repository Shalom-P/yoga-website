import "server-only";

import crypto from "node:crypto";
import http2 from "node:http2";

// Apple Push Notification service (APNs) sender, token-based (.p8 key) auth.
//
// Fully inert until configured: every entry point checks `apnsConfigured()` and
// returns a no-op result if the APNS_* env vars are absent — matching the app's
// "silent no-op when unconfigured" convention (PostHog, analytics). This lets the
// reminders cron call it unconditionally without breaking when push isn't set up.
//
// Required env (all set together):
//   APNS_KEY_ID    — the 10-char Key ID of the APNs Auth Key (.p8)
//   APNS_TEAM_ID   — your 10-char Apple Developer Team ID
//   APNS_KEY       — the .p8 private key, PEM contents OR base64-encoded PEM
//   APNS_BUNDLE_ID — defaults to fit.myyogaclasses.app
//   APNS_HOST      — defaults to https://api.push.apple.com (prod; TestFlight too)

export type PushNotification = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

type ApnsConfig = {
  keyId: string;
  teamId: string;
  bundleId: string;
  pem: string;
  host: string;
};

function getConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const rawKey = process.env.APNS_KEY;
  if (!keyId || !teamId || !rawKey) return null;
  // The key may be supplied as raw PEM or base64-encoded PEM (env-var friendly).
  const pem = rawKey.includes("BEGIN")
    ? rawKey.replace(/\\n/g, "\n")
    : Buffer.from(rawKey, "base64").toString("utf8");
  return {
    keyId,
    teamId,
    bundleId: process.env.APNS_BUNDLE_ID ?? "fit.myyogaclasses.app",
    pem,
    host: process.env.APNS_HOST ?? "https://api.push.apple.com",
  };
}

export function apnsConfigured(): boolean {
  return getConfig() !== null;
}

let cachedJwt: { value: string; issuedAt: number } | null = null;

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function getProviderToken(cfg: ApnsConfig): string {
  const nowSec = Math.floor(Date.now() / 1000);
  // APNs accepts a provider token for up to 60 min; refresh comfortably before.
  if (cachedJwt && nowSec - cachedJwt.issuedAt < 50 * 60) return cachedJwt.value;

  const header = base64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId }));
  const payload = base64url(JSON.stringify({ iss: cfg.teamId, iat: nowSec }));
  const signingInput = `${header}.${payload}`;
  // ES256 = ECDSA P-256 + SHA-256 with the JOSE raw (r||s) signature encoding.
  const signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key: cfg.pem,
    dsaEncoding: "ieee-p1363",
  });
  const value = `${signingInput}.${base64url(signature)}`;
  cachedJwt = { value, issuedAt: nowSec };
  return value;
}

export type ApnsResult = { sent: number; failed: number; invalidTokens: string[] };

/**
 * Send one notification to a set of device tokens over a single HTTP/2 session.
 * Returns counts plus any tokens APNs reported as gone (410) or bad (400), so the
 * caller can prune them.
 */
export async function sendApnsPush(
  tokens: string[],
  notification: PushNotification,
): Promise<ApnsResult> {
  const cfg = getConfig();
  if (!cfg || tokens.length === 0) {
    return { sent: 0, failed: 0, invalidTokens: [] };
  }

  const jwt = getProviderToken(cfg);
  const payload = JSON.stringify({
    aps: {
      alert: { title: notification.title, body: notification.body },
      sound: "default",
    },
    ...(notification.data ?? {}),
  });

  // Timeouts are load-bearing: the reminders cron awaits this inline, so a
  // single APNs stream that never completes would otherwise block reminder
  // EMAILS for every later booking in the run until the function is killed.
  const REQUEST_TIMEOUT_MS = 10_000;
  const BATCH_DEADLINE_MS = 30_000;

  const client = http2.connect(cfg.host);
  const invalidTokens: string[] = [];
  let sent = 0;
  let failed = 0;

  // Session-level failure: destroying the session errors every open stream,
  // which resolves each per-token promise through its 'error'/'close' handler.
  client.on("error", () => {
    /* handled per-stream */
  });
  client.setTimeout(BATCH_DEADLINE_MS, () => {
    client.destroy();
  });

  try {
    await Promise.all(
      tokens.map(
        (token) =>
          new Promise<void>((resolve) => {
            let settled = false;
            const finish = (ok: boolean) => {
              if (settled) return;
              settled = true;
              if (ok) sent++;
              else failed++;
              resolve();
            };

            let req: import("node:http2").ClientHttp2Stream;
            try {
              req = client.request({
                ":method": "POST",
                ":path": `/3/device/${token}`,
                authorization: `bearer ${jwt}`,
                "apns-topic": cfg.bundleId,
                "apns-push-type": "alert",
                "content-type": "application/json",
              });
            } catch {
              // Session already destroyed (batch deadline / connect failure).
              finish(false);
              return;
            }

            let status = 0;
            let data = "";
            req.setEncoding("utf8");
            req.setTimeout(REQUEST_TIMEOUT_MS, () => {
              req.close();
              finish(false);
            });
            req.on("response", (headers) => {
              status = Number(headers[":status"]) || 0;
            });
            req.on("data", (chunk) => {
              data += chunk;
            });
            req.on("end", () => {
              if (status === 200) {
                finish(true);
              } else {
                if (status === 410 || (status === 400 && /BadDeviceToken/.test(data))) {
                  invalidTokens.push(token);
                }
                finish(false);
              }
            });
            req.on("error", () => finish(false));
            // Belt-and-braces: 'close' always fires last, so even paths that
            // skip 'end'/'error' (e.g. server-initiated RST) settle the promise.
            req.on("close", () => finish(status === 200));
            req.end(payload);
          }),
      ),
    );
  } finally {
    client.destroy();
  }

  return { sent, failed, invalidTokens };
}
