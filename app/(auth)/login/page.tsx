import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/shared/LoginForm";
import { BrandMark } from "@/components/shared/BrandMark";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5 text-sm">
          <BrandMark className="size-9 [&_svg]:size-5" />
          <span className="font-[family-name:var(--font-cormorant)] text-xl font-semibold">
            My Yoga Classes
          </span>
        </Link>
      </header>
      <main className="flex-1 grid place-items-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="myc-eyebrow mb-4 justify-center">
            <span className="myc-dot" aria-hidden="true" />
            Free 1:1 · No card needed
          </div>
          <h1 className="text-4xl font-[family-name:var(--font-cormorant)] tracking-tight text-center">
            Continue with <span className="text-accent italic">My Yoga Classes</span>
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
