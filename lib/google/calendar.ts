// Google Calendar API: create events with Meet links.
// Keyless auth: Vercel OIDC -> GCP Workload Identity Federation (STS) -> IAM
// Credentials signJwt (domain-wide delegation) -> jwt-bearer. No downloadable
// service-account key (the org enforces iam.disableServiceAccountKeyCreation).
// Server-only AND Node-runtime only (@vercel/oidc is not Edge-safe) — keep
// `export const runtime = "nodejs"` on every route that reaches this.

import "server-only";

type CreateMeetArgs = {
  summary: string;
  description?: string;
  startUtc: string; // ISO
  endUtc: string;   // ISO
  attendeeEmails?: string[];
  calendarId?: string; // defaults to GOOGLE_SYSTEM_CALENDAR_ID
  sessionId?: string;  // tags the event for idempotent recovery (see findMeetEventBySession)
};

type GoogleEvent = {
  id: string;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] };
};

// The Meet join URL lives in either hangoutLink or a "video" conference entry point.
function extractMeetLink(event: GoogleEvent): string {
  return (
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
    ""
  );
}

// --- Keyless Google auth chain --------------------------------------------
// There is no downloadable SA key. Instead we federate Vercel's per-request
// OIDC identity into GCP, use it to ask IAM Credentials to sign a JWT *as* the
// target service account, and that JWT carries sub=<impersonated Workspace
// mailbox> (domain-wide delegation) so the resulting access token acts as that
// mailbox. Only the final Calendar access token is cached in-module; every
// upstream credential (OIDC token, STS token, signed JWT) is short-lived and
// re-minted on each cache miss (~hourly).
//
// CACHE INVARIANT: cachedToken is a single SERVICE token impersonating ONE fixed
// subject (GOOGLE_IMPERSONATE_SUBJECT, a process-wide constant). It is NOT a
// per-end-user token, so a module-level single slot shared across all requests
// is safe. If the impersonated subject is ever made per-request, this cache MUST
// be re-keyed by subject or it will serve one subject's token to another.

let cachedToken: { token: string; expires_at: number } | null = null;

const STS_TOKEN_URL = "https://sts.googleapis.com/v1/token";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const IAM_CREDENTIALS_HOST = "https://iamcredentials.googleapis.com";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
// Scope the federated token needs in order to call IAM Credentials signJwt.
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const STS_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:token-exchange";
const STS_REQUESTED_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";
const STS_SUBJECT_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:jwt";
const JWT_BEARER_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer";

// Read the Vercel OIDC token. getVercelOidcToken() resolves it from per-request
// context (the x-vercel-oidc-token header, exposed via the globalThis
// '@vercel/request-context' symbol in deployed Functions/cron) or, in
// builds/local dev, the VERCEL_OIDC_TOKEN env var pulled by `vercel env pull`.
// It MUST be called fresh on every cache miss (it is, from getAccessToken) and
// never hoisted to module scope — the OIDC token is an input, never cached.
async function getVercelOidcSubjectToken(): Promise<string> {
  const { getVercelOidcToken } = await import("@vercel/oidc");
  try {
    const token = await getVercelOidcToken();
    if (!token) {
      throw new Error(
        "Vercel OIDC token unavailable — enable OIDC for the project and, for " +
          "local dev, run `vercel env pull` then `vercel dev` (not `next dev`).",
      );
    }
    return token;
  } catch (err) {
    // Only translate the "no token here" case to the friendly hint. Anything
    // else (network failure reaching the dev refresh endpoint, malformed token)
    // is rethrown unchanged so the real cause is not masked.
    if (err instanceof Error && err.name === "AccessTokenMissingError") {
      throw new Error(
        "Vercel OIDC token unavailable — enable OIDC for the project and, for " +
          "local dev, run `vercel env pull` then `vercel dev` (not `next dev`).",
        { cause: err },
      );
    }
    throw err;
  }
}

// Leg 1 (STS): exchange the Vercel OIDC token for a short-lived GCP federated
// access token, scoped to cloud-platform so it can call IAM Credentials signJwt.
async function exchangeOidcForFederatedToken(oidcToken: string): Promise<string> {
  const audience = process.env.GOOGLE_WORKLOAD_IDENTITY_PROVIDER;
  if (!audience) throw new Error("GOOGLE_WORKLOAD_IDENTITY_PROVIDER not set");

  const body = new URLSearchParams({
    grant_type: STS_GRANT_TYPE,
    // Full WIF provider resource (uses the project NUMBER, not the project id):
    // //iam.googleapis.com/projects/<NUMBER>/locations/global/workloadIdentityPools/<POOL>/providers/<PROVIDER>
    audience,
    scope: CLOUD_PLATFORM_SCOPE,
    requested_token_type: STS_REQUESTED_TOKEN_TYPE,
    subject_token: oidcToken,
    subject_token_type: STS_SUBJECT_TOKEN_TYPE,
  });

  const res = await fetch(STS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    // A 4xx here is almost always config: the WIF provider's allowed-audiences /
    // issuer-uri / attribute-condition disagree with the Vercel token's aud/sub.
    throw new Error(`Google STS token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google STS token exchange returned no access_token");
  return data.access_token;
}

// Leg 2 (IAM signJwt): ask IAM Credentials to sign a JWT AS the target SA, with
// sub=<impersonated Workspace mailbox> — this `sub` is what makes it DWD.
async function signDwdJwt(federatedToken: string): Promise<string> {
  const saEmail = process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT;
  if (!saEmail) throw new Error("GOOGLE_IMPERSONATE_SERVICE_ACCOUNT not set");
  const subject = process.env.GOOGLE_IMPERSONATE_SUBJECT;
  if (!subject) throw new Error("GOOGLE_IMPERSONATE_SUBJECT not set");

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    // iss MUST equal the SA that signJwt signs as (saEmail). Sourcing both the
    // signJwt target and iss from the SAME env var prevents an iss/signer split,
    // which would otherwise 401 invalid_grant at the final exchange.
    iss: saEmail,
    sub: subject, // DWD: act as this Workspace mailbox (e.g. hello@myyogaclasses.fit)
    scope: CALENDAR_SCOPE,
    aud: OAUTH_TOKEN_URL,
    iat: now,
    // Consumed within seconds by the immediate oauth2 exchange below; kept short
    // to minimise blast radius if the signed assertion ever leaked. (signJwt
    // permits exp up to 12h — 300s is well inside that cap.)
    exp: now + 300,
  };

  const url =
    `${IAM_CREDENTIALS_HOST}/v1/projects/-/serviceAccounts/` +
    `${encodeURIComponent(saEmail)}:signJwt`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${federatedToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload: JSON.stringify(claims) }),
  });
  if (!res.ok) {
    // 403 here => the federated principal lacks roles/iam.serviceAccountTokenCreator
    // on saEmail (workloadIdentityUser alone is NOT enough for signJwt).
    throw new Error(`Google IAM signJwt failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { signedJwt?: string };
  if (!data.signedJwt) throw new Error("Google IAM signJwt returned no signedJwt");
  return data.signedJwt;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at > Date.now() + 60_000) return cachedToken.token;

  // Re-mint the full chain on a cache miss. Each upstream credential is fetched
  // fresh; nothing but the final Calendar token below is cached.
  const oidcToken = await getVercelOidcSubjectToken();
  const federatedToken = await exchangeOidcForFederatedToken(oidcToken);
  const signedJwt = await signDwdJwt(federatedToken);

  // Leg 3 (jwt-bearer): exchange the DWD-signed JWT for an access token that
  // impersonates the Workspace mailbox (same grant the old key-based code used).
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: JWT_BEARER_GRANT_TYPE,
      assertion: signedJwt,
    }).toString(),
  });
  if (!res.ok) {
    // 4xx here (typically invalid_grant) => DWD not authorized in Workspace, or
    // the scope/subject doesn't match the DWD grant for this SA's client id.
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expires_at: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export async function createMeetEvent(args: CreateMeetArgs): Promise<{ meetLink: string; eventId: string }> {
  const token = await getAccessToken();
  const calendarId = args.calendarId ?? process.env.GOOGLE_SYSTEM_CALENDAR_ID ?? "primary";
  // Deterministic requestId per session so a retry reuses the same conference
  // instead of minting a new one; random fallback for ad-hoc calls.
  const requestId = args.sessionId ? `meet-${args.sessionId}` : crypto.randomUUID();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: args.summary,
        description: args.description,
        start: { dateTime: args.startUtc, timeZone: "UTC" },
        end:   { dateTime: args.endUtc,   timeZone: "UTC" },
        attendees: args.attendeeEmails?.map((email) => ({ email })) ?? [],
        // Tag with the session id so a partial failure (event created at Google
        // but DB write failed) can be recovered via findMeetEventBySession
        // instead of creating a duplicate event.
        extendedProperties: args.sessionId
          ? { private: { sessionId: args.sessionId } }
          : undefined,
        conferenceData: {
          createRequest: { requestId, conferenceSolutionKey: { type: "hangoutsMeet" } },
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Calendar event create failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as GoogleEvent;
  const meetLink = extractMeetLink(data);
  if (!meetLink) throw new Error("No Meet link returned from Calendar API");
  return { meetLink, eventId: data.id };
}

/**
 * Find a Meet event previously created for this session, tagged via
 * extendedProperties.private.sessionId. Returns null if none exists (or no link
 * yet). Lets provisioning be idempotent: adopt an orphaned event rather than
 * minting a duplicate. Searches the given calendar (the one the event lives on).
 */
export async function findMeetEventBySession(
  sessionId: string,
  calendarId?: string,
): Promise<{ meetLink: string; eventId: string } | null> {
  const token = await getAccessToken();
  const id = calendarId ?? process.env.GOOGLE_SYSTEM_CALENDAR_ID ?? "primary";
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events` +
    `?privateExtendedProperty=${encodeURIComponent(`sessionId=${sessionId}`)}` +
    `&showDeleted=false&singleEvents=true&maxResults=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Calendar event lookup failed: ${res.status}`);
  const data = (await res.json()) as { items?: GoogleEvent[] };
  const event = data.items?.[0];
  if (!event) return null;
  const meetLink = extractMeetLink(event);
  if (!meetLink) return null;
  return { meetLink, eventId: event.id };
}

export async function deleteMeetEvent(eventId: string, calendarId?: string) {
  const token = await getAccessToken();
  const id = calendarId ?? process.env.GOOGLE_SYSTEM_CALENDAR_ID ?? "primary";
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events/${eventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
}
