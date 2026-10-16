import { NextResponse } from "next/server";
import { z } from "zod";
import { sendContactMessage } from "@/lib/email";
import { clientIp, rateLimit, RATE_LIMITS, tooManyRequests } from "@/lib/security/rateLimit";

// Resend SDK (lib/email) is server-only; keep this on the Node runtime.
export const runtime = "nodejs";

const schema = z.object({
  // No line breaks: the name goes into the email subject.
  name: z.string().trim().min(1).max(120).regex(/^[^\r\n]*$/),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(1).max(4000),
  // Honeypot — real users leave it empty; bots fill every field.
  company: z.string().max(0).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  // Honeypot tripped — pretend success so bots don't learn anything.
  if (parsed.data.company) {
    return NextResponse.json({ ok: true });
  }
  // Each accepted POST sends a Resend email; cap it per IP so a script can't
  // flood the inbox or burn the quota that booking emails share.
  if (!(await rateLimit(RATE_LIMITS.contactPerIp, clientIp(req)))) return tooManyRequests();

  const result = await sendContactMessage({
    name: parsed.data.name,
    email: parsed.data.email,
    message: parsed.data.message,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, skipped: result.skipped ?? false });
}
