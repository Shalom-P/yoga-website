"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { postAuthTarget, safeNext } from "@/lib/auth/redirects";
import { isValidEmail } from "@/lib/validation/email";
import { friendlyAuthError } from "@/lib/ui/errors";
import { track } from "@/lib/analytics/events";

export function LoginForm() {
  const params = useSearchParams();
  // Sanitize at the source: the email-OTP path assigns this to
  // window.location.href, which would otherwise be an open redirect.
  const next = safeNext(params.get("next"));
  const errorParam = params.get("error");

  // Surface OAuth callback errors passed as ?error=
  useEffect(() => {
    if (errorParam) {
      toast.error(errorParam);
    }
  }, [errorParam]);

  return (
    <div className="mt-8">
      {errorParam && (
        <div role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorParam}
        </div>
      )}
      <Tabs defaultValue="google" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="google">Google</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
        </TabsList>
        <TabsContent value="google" className="mt-6">
          <GoogleLogin next={next} />
        </TabsContent>
        <TabsContent value="email" className="mt-6">
          <EmailLogin next={next} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GoogleLogin({ next }: { next: string }) {
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function signInWithGoogle() {
    setLoading(true);
    track("signup_started", { method_intent: "google", next_path: next });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      toast.error(friendlyAuthError(error.message));
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={signInWithGoogle}
      disabled={loading}
      size="lg"
      variant="outline"
      className="w-full h-12 rounded-full"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <>
          <GoogleIcon />
          Continue with Google
        </>
      )}
    </Button>
  );
}

const RESEND_COOLDOWN_SECONDS = 30;
// Supabase's email OTP length is configurable in the dashboard (Auth → Email OTP
// length, range 6–10). Don't hardcode 6 here or the input truncates a longer
// code; accept up to Supabase's max and let verifyOtp do the real validation.
const OTP_MAX_LENGTH = 10;

function EmailLogin({ next }: { next: string }) {
  const [phase, setPhase] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  // resend cooldown state
  const [resendCooldown, setResendCooldown] = useState(0);
  const supabase = createSupabaseBrowserClient();

  // countdown timer effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  async function doSendOtp() {
    // Validate before spending a send: a malformed address is silently "accepted"
    // by signInWithOtp but no code ever lands.
    if (!isValidEmail(email)) {
      toast.error("Enter a valid email address.");
      return false;
    }
    setLoading(true);
    // shouldCreateUser:true keeps the OTP flow self-service for new sign-ups.
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) { toast.error(friendlyAuthError(error.message)); return false; }
    return true;
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    track("signup_started", { method_intent: "email", next_path: next });
    const ok = await doSendOtp();
    if (!ok) return;
    toast.success("Code sent. Check your email.");
    setPhase("otp");
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  }

  // resend handler
  async function resendOtp() {
    const ok = await doSendOtp();
    if (!ok) return;
    toast.success("New code sent. Check your email.");
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    // Guard incomplete input client-side rather than round-tripping an empty/short
    // code to Supabase and surfacing its raw "Token has expired or is invalid".
    const code = otp.replace(/\D/g, "");
    if (code.length < 6) {
      return toast.error("Enter the full code from your email.");
    }
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: "email",
    });
    if (error) {
      setLoading(false);
      return toast.error(friendlyAuthError(error.message));
    }
    // Route through onboarding if it isn't complete yet (email-OTP users skip
    // the OAuth callback, so the check has to happen here too).
    let onboarded = true;
    const userId = data.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("experience_level")
        .eq("id", userId)
        .maybeSingle();
      onboarded = Boolean(profile?.experience_level);
    }
    window.location.href = postAuthTarget(next, onboarded);
  }

  if (phase === "otp") {
    return (
      <form onSubmit={verifyOtp} className="space-y-4">
        <div>
          <Label htmlFor="otp">Verification code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter the code from your email"
            maxLength={OTP_MAX_LENGTH}
            className="mt-1.5 text-center tracking-[0.4em] text-lg"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">Sent to {email}.</p>
        </div>
        <Button type="submit" disabled={loading} className="w-full h-11 rounded-full">
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Verify & continue"}
        </Button>
        {/* Resend code button with cooldown */}
        <button
          type="button"
          disabled={loading || resendCooldown > 0}
          className="text-xs text-muted-foreground hover:text-foreground mx-auto block disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={resendOtp}
        >
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
        </button>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground mx-auto block"
          onClick={() => setPhase("email")}
        >
          ← Change email
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={sendOtp} className="space-y-4">
      <div>
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1.5"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          We&apos;ll email a verification code to{" "}
          {email ? <span>{email}</span> : "your inbox"}.
        </p>
      </div>
      <Button type="submit" disabled={loading} className="h-11 w-full rounded-full">
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Send code"}
      </Button>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 mr-2">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
