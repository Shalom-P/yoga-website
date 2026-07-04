"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isValidEmail } from "@/lib/validation/email";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Please add your name.");
    if (!isValidEmail(email)) return toast.error("Please enter a valid email address.");
    if (!message.trim()) return toast.error("Please add a message.");

    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, message, company }),
      });
      if (!res.ok) throw new Error("send");
      setSent(true);
      setName("");
      setEmail("");
      setMessage("");
      toast.success("Thanks, we'll reply within 1 business day.");
    } catch {
      toast.error("Couldn't send your message just now. Please email us directly.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-primary/30 bg-primary/5 px-6 py-8 text-center"
      >
        <p className="font-medium">Message sent.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We typically reply within 1 business day (your local time).
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-left">
      <div>
        <Label htmlFor="contact-name">Your name</Label>
        <Input
          id="contact-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          disabled={loading}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="contact-email">Email</Label>
        <Input
          id="contact-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={loading}
          className="mt-1.5"
        />
      </div>
      {/* Honeypot: visually hidden, ignored by humans, filled by bots. */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor="contact-company">Company</label>
        <input
          id="contact-company"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={loading} className="h-11 w-full rounded-full">
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Send message"}
      </Button>
    </form>
  );
}
