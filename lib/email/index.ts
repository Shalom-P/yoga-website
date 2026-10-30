// High-level transactional email senders. Server-only (re-exported from templates + client).
// Import from "@/lib/email", do not import templates or client directly from call sites.

import "server-only";

import { sendEmail, type SendEmailResult } from "@/lib/email/client";
import { SIGNUP_ALERT_TO } from "@/lib/admin/signupAlert";
import { formatTeacherTime } from "@/lib/timezone";
import {
  bookingConfirmationEmail,
  bookingReminderEmail,
  firstBookingNudgeEmail,
  reviewRequestEmail,
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
  /** When true, the 24h reminder appends an "upload your health documents" nudge. */
  needsHealthDocs?: boolean;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";

export async function sendBookingReminder(
  args: SendBookingReminderArgs
): Promise<SendEmailResult> {
  const { subject, html } = await bookingReminderEmail({
    teacherName: args.teacherName,
    startUtc: args.startUtc,
    customerTz: args.customerTz,
    meetLink: args.meetLink,
    when: args.when,
    needsHealthDocs: args.needsHealthDocs,
    documentsUrl: `${SITE_URL}/dashboard/documents`,
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
// New sign-up alert (to the owner)
// ---------------------------------------------------------------------------

export interface SendSignupAlertArgs {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  timezone: string | null;
  experienceLevel: string | null;
  createdAt: string;
  onboarded: boolean;
}

/**
 * Tells the owner someone signed up. Sent by the reminders cron, once per
 * profile (0049), reply-to the customer so a reply reaches them directly.
 */
export async function sendSignupAlert(args: SendSignupAlertArgs): Promise<SendEmailResult> {
  const name = args.fullName?.trim() || args.email || "Someone";
  const rows: Array<[string, string]> = [
    ["Name", args.fullName?.trim() || "Not given yet"],
    ["Email", args.email ?? "Not given"],
    ["Phone", args.phone ?? "Not given yet"],
    ["Time zone", args.timezone ?? "Unknown"],
    ["Experience", args.experienceLevel ?? "Not given yet"],
    ["Signed up", formatTeacherTime(args.createdAt)],
    ["Onboarding", args.onboarded ? "Finished" : "Not finished yet"],
  ];
  const html = `
    <p>${escapeHtml(name)} has signed up on My Yoga Classes.</p>
    ${rows.map(([k, v]) => `<p><strong>${k}:</strong> ${escapeHtml(v)}</p>`).join("\n    ")}
    <p><a href="${SITE_URL}/admin/customers">Open customers in admin</a></p>
  `;
  return sendEmail({
    to: SIGNUP_ALERT_TO,
    replyTo: args.email ?? undefined,
    subject: `New sign-up: ${name}`,
    html,
    text: `${name} has signed up on My Yoga Classes.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}`,
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

// ---------------------------------------------------------------------------
// Review request
// ---------------------------------------------------------------------------

export interface SendReviewRequestArgs {
  to: string;
  teacherName: string;
  bookingId: string;
}

/** Asks for a review of one finished booking. Sent by the no-show sweep, once. */
export async function sendReviewRequest(
  args: SendReviewRequestArgs
): Promise<SendEmailResult> {
  const { subject, html } = await reviewRequestEmail({
    teacherName: args.teacherName,
    reviewUrl: `${SITE_URL}/dashboard/review?booking=${encodeURIComponent(args.bookingId)}`,
  });
  return sendEmail({ to: args.to, subject, html });
}

// ---------------------------------------------------------------------------
// First-booking nudge
// ---------------------------------------------------------------------------

export interface SendFirstBookingNudgeArgs {
  to: string;
  fullName: string | null;
  stage: "1h" | "24h";
}

/**
 * Asks a customer who finished onboarding but never booked to pick a first
 * session. Sent by the reminders cron, at most once per stage (0048).
 */
export async function sendFirstBookingNudge(
  args: SendFirstBookingNudgeArgs
): Promise<SendEmailResult> {
  const { subject, html } = await firstBookingNudgeEmail({
    fullName: args.fullName,
    stage: args.stage,
    bookUrl: `${SITE_URL}/dashboard/book`,
  });
  return sendEmail({ to: args.to, subject, html });
}
