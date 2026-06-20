// Thin Resend wrapper. Server-only — never import from a client component.

import "server-only";

import { Resend } from "resend";

const DEFAULT_FROM = "My Yoga Classes <hello@myyogaclasses.fit>";

let _client: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_client) _client = new Resend(key);
  return _client;
}

function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM;
}

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  skipped?: boolean;
}

/**
 * Send a transactional email via Resend.
 *
 * - Returns `{ ok: true, skipped: true }` when `RESEND_API_KEY` is not set
 *   (silent no-op in dev / preview — mirrors the analytics pattern).
 * - Returns `{ ok: false }` on network / API errors — never throws, so email
 *   failures never break the booking flow.
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const client = getClient();

  if (!client) {
    console.info("[email] RESEND_API_KEY not set — skipping email send (dev/preview)");
    return { ok: true, skipped: true };
  }

  try {
    const { error } = await client.emails.send({
      from: fromAddress(),
      to: args.to,
      subject: args.subject,
      html: args.html,
      ...(args.text ? { text: args.text } : {}),
      ...(args.replyTo ? { replyTo: args.replyTo } : {}),
    });

    if (error) {
      console.error("[email] Resend API error:", error.message, error.name);
      return { ok: false };
    }

    return { ok: true };
  } catch (err) {
    console.error("[email] Unexpected error sending email:", err);
    return { ok: false };
  }
}
