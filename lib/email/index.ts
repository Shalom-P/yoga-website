// High-level transactional email senders. Server-only (re-exported from templates + client).
// Import from "@/lib/email", do not import templates or client directly from call sites.

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
// Contact form
// ---------------------------------------------------------------------------

const SUPPORT_EMAIL = "hello@myyogaclasses.fit";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface SendContactMessageArgs {
  name: string;
  email: string;
  message: string;
}

/** Forwards a contact-form submission to the support inbox, reply-to the sender. */
export async function sendContactMessage(
  args: SendContactMessageArgs
): Promise<SendEmailResult> {
  const html = `
    <p><strong>Name:</strong> ${escapeHtml(args.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(args.email)}</p>
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(args.message)}</p>
  `;
  return sendEmail({
    to: SUPPORT_EMAIL,
    replyTo: args.email,
    subject: `Contact form: ${args.name}`,
    html,
    text: `Name: ${args.name}\nEmail: ${args.email}\n\n${args.message}`,
  });
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
