"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics/events";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  return (
    <div className="mt-8">
      <Tabs defaultValue="google" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="google">Google</TabsTrigger>
          <TabsTrigger value="phone">Phone</TabsTrigger>
        </TabsList>
        <TabsContent value="google" className="mt-6">
          <GoogleLogin next={next} />
        </TabsContent>
        <TabsContent value="phone" className="mt-6">
          <PhoneLogin next={next} />
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
      toast.error(error.message);
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

const COUNTRIES = [
  { cc: "61", label: "Australia", flag: "🇦🇺", example: "412 345 678" },
  { cc: "91", label: "India", flag: "🇮🇳", example: "98765 43210" },
] as const;

// Build an E.164 number from a calling code + the national part the user typed.
// Strips spaces/punctuation and a leading trunk "0" (common in AU input), so a
// "+61" selection with "0412 345 678" becomes "+61412345678". A malformed number
// is the usual reason an OTP is "accepted" but no SMS ever lands.
function toE164(cc: string, national: string): string {
  const digits = national.replace(/\D/g, "").replace(/^0+/, "");
  return `+${cc}${digits}`;
}

function PhoneLogin({ next }: { next: string }) {
  const [phase, setPhase] = useState<"phone" | "otp">("phone");
  const [cc, setCc] = useState<string>("61");
  const [national, setNational] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  const nationalDigits = national.replace(/\D/g, "").replace(/^0+/, "");
  const e164 = toE164(cc, national);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (nationalDigits.length < 6 || nationalDigits.length > 12) {
      toast.error("Enter a valid mobile number (digits only, without the country code).");
      return;
    }
    setLoading(true);
    track("signup_started", { method_intent: "phone", next_path: next });
    const { error } = await supabase.auth.signInWithOtp({
      phone: e164,
      options: { channel: "sms" },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Code sent. Check your phone.");
    setPhase("otp");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: e164,
      token: otp.replace(/\D/g, ""),
      type: "sms",
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    window.location.href = next;
  }

  if (phase === "otp") {
    return (
      <form onSubmit={verifyOtp} className="space-y-4">
        <div>
          <Label htmlFor="otp">6-digit code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            maxLength={6}
            className="mt-1.5 text-center tracking-[0.4em] text-lg"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">Sent to {e164}.</p>
        </div>
        <Button type="submit" disabled={loading} className="w-full h-11 rounded-full">
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Verify & continue"}
        </Button>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground mx-auto block"
          onClick={() => setPhase("phone")}
        >
          ← Change number
        </button>
      </form>
    );
  }

  const activeCountry = COUNTRIES.find((c) => c.cc === cc) ?? COUNTRIES[0];

  return (
    <form onSubmit={sendOtp} className="space-y-4">
      <div>
        <Label htmlFor="phone">Phone number</Label>
        <div className="mt-1.5 flex gap-2">
          <Select value={cc} onValueChange={(v) => v && setCc(v)}>
            <SelectTrigger className="h-10 w-[7.5rem] shrink-0" aria-label="Country code">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.cc} value={c.cc}>
                  {c.flag} +{c.cc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={national}
            onChange={(e) => setNational(e.target.value)}
            placeholder={activeCountry.example}
            className="flex-1"
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {activeCountry.label} (+{cc}). We&apos;ll text a 6-digit code to{" "}
          <span className="tabular-nums">{e164}</span>.
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
