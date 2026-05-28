// Google Calendar API: create events with Meet links.
// Service account auth. Server-only.

import "server-only";

type CreateMeetArgs = {
  summary: string;
  description?: string;
  startUtc: string; // ISO
  endUtc: string;   // ISO
  attendeeEmails?: string[];
  calendarId?: string; // defaults to GOOGLE_SYSTEM_CALENDAR_ID
};

type GoogleEvent = {
  id: string;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] };
};

let cachedToken: { token: string; expires_at: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at > Date.now() + 60_000) return cachedToken.token;
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  const key = JSON.parse(json) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(claim)).toString("base64url");
  const { default: crypto } = await import("node:crypto");
  const sigInput = `${header}.${body}`;
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(sigInput), key.private_key)
    .toString("base64url");
  const jwt = `${sigInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expires_at: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export async function createMeetEvent(args: CreateMeetArgs): Promise<{ meetLink: string; eventId: string }> {
  const token = await getAccessToken();
  const calendarId = args.calendarId ?? process.env.GOOGLE_SYSTEM_CALENDAR_ID ?? "primary";
  const requestId = crypto.randomUUID();
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
        conferenceData: {
          createRequest: { requestId, conferenceSolutionKey: { type: "hangoutsMeet" } },
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Calendar event create failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as GoogleEvent;
  const meetLink =
    data.hangoutLink ??
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
    "";
  if (!meetLink) throw new Error("No Meet link returned from Calendar API");
  return { meetLink, eventId: data.id };
}

export async function deleteMeetEvent(eventId: string, calendarId?: string) {
  const token = await getAccessToken();
  const id = calendarId ?? process.env.GOOGLE_SYSTEM_CALENDAR_ID ?? "primary";
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events/${eventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
}
