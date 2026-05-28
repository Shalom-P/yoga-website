import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/shared/LoginForm";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5">
        <Link href="/" className="flex items-center gap-2 text-sm">
          <span className="size-7 rounded-full bg-primary inline-flex items-center justify-center">
            <span className="size-2.5 rounded-full bg-background" />
          </span>
          <span className="font-[family-name:var(--font-heading)]">Sahaja Yoga</span>
        </Link>
      </header>
      <main className="flex-1 grid place-items-center px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-[family-name:var(--font-heading)] tracking-tight text-center">
            Continue with Sahaja Yoga
          </h1>
          <p className="mt-2 text-center text-muted-foreground">
            Your free 1:1 session is one click away.
          </p>
          <Suspense fallback={<div className="mt-8 h-32 rounded-2xl bg-muted/40 animate-pulse" />}>
            <LoginForm />
          </Suspense>
          <p className="mt-6 text-xs text-center text-muted-foreground">
            By continuing you agree to our{" "}
            <Link href="/legal/terms" className="underline">Terms</Link> and{" "}
            <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
