// High-level transactional email senders. Server-only (re-exported from templates + client).
// Import from "@/lib/email" — do not import templates or client directly from call sites.

import "server-only";

import { sendEmail, type SendEmailResult } from "@/lib/email/client";
import {
  bookingConfirmationEmail,
  bookingReminderEmail,
  subscriptionActivatedEmail,
} from "@/lib/email/templates";

// ---------------------------------------------------------------------------
// Booking confirmation
// ---------------------------------------------------------------------------

export interface SendBookingConfirmationArgs {
  to: string;
  teacherName: string;
  startUtc: string;
  customerTz: string;
  meetLink?: string | null;
}

export async function sendBookingConfirmation(
  args: SendBookingConfirmationArgs
): Promise<SendEmailResult> {
  const { subject, html } = await bookingConfirmationEmail({
    teacherName: args.teacherName,
    startUtc: args.startUtc,
    customerTz: args.customerTz,
    meetLink: args.meetLink,
  });
  return sendEmail({ to: args.to, subject, html });
}

// ---------------------------------------------------------------------------
// Booking reminder
// ---------------------------------------------------------------------------

export interface SendBookingReminderArgs {
  to: string;
  teacherName: string;
  startUtc: string;
  customerTz: string;
  meetLink?: string | null;
  when: "24 hours" | "1 hour";
}

export async function sendBookingReminder(
  args: SendBookingReminderArgs
): Promise<SendEmailResult> {
  const { subject, html } = await bookingReminderEmail({
    teacherName: args.teacherName,
    startUtc: args.startUtc,
    customerTz: args.customerTz,
    meetLink: args.meetLink,
    when: args.when,
  });
  return sendEmail({ to: args.to, subject, html });
}

// ---------------------------------------------------------------------------
// Subscription activated
// ---------------------------------------------------------------------------

export interface SendSubscriptionActivatedArgs {
  to: string;
  planName: string;
}

export async function sendSubscriptionActivated(
  args: SendSubscriptionActivatedArgs
): Promise<SendEmailResult> {
  const { subject, html } = await subscriptionActivatedEmail({
    planName: args.planName,
  });
  return sendEmail({ to: args.to, subject, html });
}
