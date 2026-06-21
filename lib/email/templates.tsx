// Branded React Email templates for My Yoga Classes. Server-only.

import "server-only";

import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";
import { formatCustomerTime } from "@/lib/timezone";

// ---------------------------------------------------------------------------
// Brand tokens
// ---------------------------------------------------------------------------

const brand = {
  primary: "#3B82F6",   // blue-500
  accent: "#8B5CF6",    // violet-500
  bg: "#F9FAFB",        // gray-50
  card: "#FFFFFF",
  text: "#111827",      // gray-900
  muted: "#6B7280",     // gray-500
  border: "#E5E7EB",    // gray-200
  name: "My Yoga Classes",
};

// ---------------------------------------------------------------------------
// Shared layout primitives
// ---------------------------------------------------------------------------

function EmailWrapper({ preview, children }: { preview: string; children: React.ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: brand.bg,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            maxWidth: "560px",
            margin: "40px auto",
            backgroundColor: brand.card,
            borderRadius: "12px",
            border: `1px solid ${brand.border}`,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <Section
            style={{
              background: `linear-gradient(135deg, ${brand.primary} 0%, ${brand.accent} 100%)`,
              padding: "28px 40px",
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: "20px",
                fontWeight: "700",
                margin: 0,
                letterSpacing: "-0.3px",
              }}
            >
              {brand.name}
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ padding: "32px 40px" }}>{children}</Section>

          {/* Footer */}
          <Hr style={{ borderColor: brand.border, margin: 0 }} />
          <Section style={{ padding: "20px 40px" }}>
            <Text style={{ color: brand.muted, fontSize: "12px", margin: 0, textAlign: "center" }}>
              {brand.name} · Yoga for every body, wherever you are
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function BodyText({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <Text
      style={{
        color: brand.text,
        fontSize: "16px",
        lineHeight: "1.6",
        margin: "0 0 16px",
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

function MutedText({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: brand.muted, fontSize: "14px", lineHeight: "1.5", margin: "0 0 8px" }}>
      {children}
    </Text>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <Section
      style={{
        backgroundColor: "#EFF6FF",
        borderLeft: `4px solid ${brand.primary}`,
        borderRadius: "6px",
        padding: "16px 20px",
        margin: "20px 0",
      }}
    >
      {children}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Template: Booking Confirmation
// ---------------------------------------------------------------------------

export interface BookingConfirmationArgs {
  teacherName: string;
  startUtc: string;
  customerTz: string;
  meetLink?: string | null;
}

function BookingConfirmationTemplate({
  teacherName,
  startUtc,
  customerTz,
  meetLink,
}: BookingConfirmationArgs) {
  const sessionTime = formatCustomerTime(startUtc, customerTz);
  const hasMeetLink = Boolean(meetLink);

  return (
    <EmailWrapper preview={`Your yoga session with ${teacherName} is confirmed`}>
      <Heading
        style={{
          color: brand.text,
          fontSize: "24px",
          fontWeight: "700",
          margin: "0 0 8px",
        }}
      >
        You&apos;re booked in!
      </Heading>
      <BodyText>
        Great news — your 1:1 yoga session has been confirmed. See you on the mat!
      </BodyText>

      <InfoBox>
        <MutedText>
          <strong>Teacher</strong>
        </MutedText>
        <BodyText style={{ margin: "0 0 12px" }}>{teacherName}</BodyText>
        <MutedText>
          <strong>Session time</strong>
        </MutedText>
        <BodyText style={{ margin: 0 }}>{sessionTime}</BodyText>
      </InfoBox>

      {hasMeetLink ? (
        <>
          <BodyText>Join your session at the time above using the link below:</BodyText>
          <Button
            href={meetLink!}
            style={{
              backgroundColor: brand.primary,
              borderRadius: "8px",
              color: "#FFFFFF",
              display: "inline-block",
              fontSize: "16px",
              fontWeight: "600",
              padding: "14px 28px",
              textDecoration: "none",
            }}
          >
            Join Google Meet
          </Button>
          <BodyText style={{ marginTop: "16px" }}>
            Or copy this link:{" "}
            <Link href={meetLink!} style={{ color: brand.primary }}>
              {meetLink}
            </Link>
          </BodyText>
        </>
      ) : (
        <BodyText>
          Your Google Meet link is being created and will be sent to you shortly. Check your inbox
          in a few minutes, or log in to your dashboard to find it there.
        </BodyText>
      )}

      <Hr style={{ borderColor: brand.border, margin: "24px 0" }} />
      <MutedText>
        Need to reschedule? Log in to your dashboard to manage your bookings.
      </MutedText>
    </EmailWrapper>
  );
}

export async function bookingConfirmationEmail(
  args: BookingConfirmationArgs
): Promise<{ subject: string; html: string }> {
  const subject = `Your yoga session with ${args.teacherName} is confirmed`;
  const html = await render(<BookingConfirmationTemplate {...args} />);
  return { subject, html };
}

// ---------------------------------------------------------------------------
// Template: Booking Reminder
// ---------------------------------------------------------------------------

export interface BookingReminderArgs {
  teacherName: string;
  startUtc: string;
  customerTz: string;
  meetLink?: string | null;
  when: "24 hours" | "1 hour";
}

function BookingReminderTemplate({
  teacherName,
  startUtc,
  customerTz,
  meetLink,
  when,
}: BookingReminderArgs) {
  const sessionTime = formatCustomerTime(startUtc, customerTz);
  const hasMeetLink = Boolean(meetLink);
  const isImminient = when === "1 hour";

  return (
    <EmailWrapper
      preview={`Reminder: your yoga session with ${teacherName} starts in ${when}`}
    >
      <Heading
        style={{
          color: brand.text,
          fontSize: "24px",
          fontWeight: "700",
          margin: "0 0 8px",
        }}
      >
        {isImminient ? "Your session starts in 1 hour" : "See you tomorrow!"}
      </Heading>
      <BodyText>
        {isImminient
          ? `Just a quick nudge — your 1:1 session with ${teacherName} is about to begin.`
          : `Your yoga session with ${teacherName} is coming up tomorrow. We can't wait to see you on the mat!`}
      </BodyText>

      <InfoBox>
        <MutedText>
          <strong>Teacher</strong>
        </MutedText>
        <BodyText style={{ margin: "0 0 12px" }}>{teacherName}</BodyText>
        <MutedText>
          <strong>Session time</strong>
        </MutedText>
        <BodyText style={{ margin: 0 }}>{sessionTime}</BodyText>
      </InfoBox>

      {hasMeetLink ? (
        <>
          <BodyText>
            {isImminient ? "Ready to join? Click below:" : "Your join link is ready:"}
          </BodyText>
          <Button
            href={meetLink!}
            style={{
              backgroundColor: isImminient ? brand.accent : brand.primary,
              borderRadius: "8px",
              color: "#FFFFFF",
              display: "inline-block",
              fontSize: "16px",
              fontWeight: "600",
              padding: "14px 28px",
              textDecoration: "none",
            }}
          >
            Join Google Meet
          </Button>
          <BodyText style={{ marginTop: "16px" }}>
            Or copy:{" "}
            <Link href={meetLink!} style={{ color: brand.primary }}>
              {meetLink}
            </Link>
          </BodyText>
        </>
      ) : (
        <BodyText>
          Your Google Meet link will be available in your dashboard before the session starts. If
          you don&apos;t see it, please contact us via WhatsApp.
        </BodyText>
      )}

      <Hr style={{ borderColor: brand.border, margin: "24px 0" }} />
      <MutedText>
        You&apos;re receiving this because you booked a session on {brand.name}.
      </MutedText>
    </EmailWrapper>
  );
}

export async function bookingReminderEmail(
  args: BookingReminderArgs
): Promise<{ subject: string; html: string }> {
  const subject = `Reminder: your yoga session with ${args.teacherName} starts in ${args.when}`;
  const html = await render(<BookingReminderTemplate {...args} />);
  return { subject, html };
}

// ---------------------------------------------------------------------------
// Template: Subscription Activated
// ---------------------------------------------------------------------------

export interface SubscriptionActivatedArgs {
  planName: string;
}

function SubscriptionActivatedTemplate({ planName }: SubscriptionActivatedArgs) {
  return (
    <EmailWrapper preview={`Your ${planName} subscription is now active`}>
      <Heading
        style={{
          color: brand.text,
          fontSize: "24px",
          fontWeight: "700",
          margin: "0 0 8px",
        }}
      >
        Welcome to {planName}!
      </Heading>
      <BodyText>
        Your subscription is now active. You&apos;re all set to book your regular yoga sessions and begin
        your practice.
      </BodyText>

      <InfoBox>
        <MutedText>
          <strong>Plan</strong>
        </MutedText>
        <BodyText style={{ margin: 0 }}>{planName}</BodyText>
      </InfoBox>

      <BodyText>
        Head to your dashboard to book your first session and choose a time that works for you.
      </BodyText>

      <Hr style={{ borderColor: brand.border, margin: "24px 0" }} />
      <MutedText>
        You can manage your subscription at any time from your dashboard.
      </MutedText>
    </EmailWrapper>
  );
}

export async function subscriptionActivatedEmail(
  args: SubscriptionActivatedArgs
): Promise<{ subject: string; html: string }> {
  const subject = `Your ${args.planName} subscription is now active`;
  const html = await render(<SubscriptionActivatedTemplate {...args} />);
  return { subject, html };
}
