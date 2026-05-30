// Wrap the auth funnel (login + onboarding) in the marketing theme so the
// jump from the cream/teal/coral marketing CTA into login doesn't look like a
// different product. These pages sit outside the (marketing) layout, so they'd
// otherwise fall back to the base theme + fonts.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="myc-theme">{children}</div>;
}
