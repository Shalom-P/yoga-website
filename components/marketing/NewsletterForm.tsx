"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { track } from "@/lib/analytics/events";
import { isValidEmail } from "@/lib/validation/email";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: "footer" }),
      });
      if (!res.ok) throw new Error("network");
      track("newsletter_signup", { source: "footer" });
      toast.success("You're on the list. Welcome.");
      setEmail("");
    } catch {
      toast.error("Couldn't sign you up just now, please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <Input
        type="email"
        aria-label="Email address for the newsletter"
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
        // The footer sits on a dark surface, so the inherited text colour is
        // light, and on the cream `bg-background` field that makes typed text
        // invisible. Pin the foreground (and match the button height).
        className="h-11 bg-background text-foreground"
      />
      <Button
        type="submit"
        disabled={loading}
        variant="outline"
        className="h-11 shrink-0 text-foreground"
      >
        {loading ? "…" : "Subscribe"}
      </Button>
    </form>
  );
}
