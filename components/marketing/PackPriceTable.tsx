import Link from "next/link";
import { formatMoney } from "@/lib/i18n/money";
import type { PlanWithFeatures } from "@/lib/data/landing";

/**
 * Server-rendered price table: every pack in every currency an admin has
 * priced in `plan_prices`.
 *
 * The interactive grid above it resolves the visitor's currency in the browser,
 * so the cached HTML only ever shows the default (INR). The Product JSON-LD on
 * /pricing, though, emits an Offer per priced currency, and Google's merchant
 * guidelines require any marked-up price to be visible on the page. This table
 * is that visibility. It is also the only place a visitor outside India can see
 * their price before signing in, and the buyer-side cost guide links to it.
 *
 * Nothing here falls back to `plans.price_base_cents`: that figure is INR and
 * must never be shown under another symbol.
 */
const CURRENCY_ORDER = ["INR", "AED", "USD", "GBP", "EUR"];

const CURRENCY_LABEL: Record<string, string> = {
  INR: "Indian rupees",
  AED: "UAE dirhams",
  USD: "US dollars",
  GBP: "British pounds",
  EUR: "Euros",
};

export function pricedCurrencies(plans: PlanWithFeatures[]): string[] {
  const seen = new Set<string>();
  for (const p of plans) for (const pr of p.prices ?? []) seen.add(pr.currency);
  return CURRENCY_ORDER.filter((c) => seen.has(c));
}

export function PackPriceTable({
  plans,
  showGuideLink = true,
}: {
  plans: PlanWithFeatures[];
  showGuideLink?: boolean;
}) {
  const currencies = pricedCurrencies(plans);
  const packs = plans.filter((p) => p.is_active && (p.prices?.length ?? 0) > 0);
  if (currencies.length === 0 || packs.length === 0) return null;

  return (
    <section className="px-6 pb-20" aria-labelledby="pack-price-table-heading">
      <div className="mx-auto max-w-[900px]">
        <h2
          id="pack-price-table-heading"
          className="text-2xl font-medium tracking-[-0.015em] md:text-3xl"
        >
          Every pack, in every currency we price.
        </h2>
        <p className="mt-3 max-w-[44rem] text-sm text-muted-foreground text-pretty">
          You are charged in the currency for where you are, resolved at checkout. One
          session is 60 minutes, live, one-to-one, and prepaid sessions never expire.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <th scope="col" className="py-3 pr-4 font-medium">
                  Pack
                </th>
                {currencies.map((c) => (
                  <th key={c} scope="col" className="py-3 pr-4 font-medium">
                    <abbr title={CURRENCY_LABEL[c] ?? c} className="no-underline">
                      {c}
                    </abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {packs.map((p) => (
                <tr key={p.id} className="border-b border-border/60">
                  <th scope="row" className="py-3 pr-4 text-left font-medium text-foreground">
                    {p.name}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {p.session_credits} {p.session_credits === 1 ? "session" : "sessions"}
                    </span>
                  </th>
                  {currencies.map((c) => {
                    const price = p.prices.find((pr) => pr.currency === c);
                    if (!price) {
                      return (
                        <td key={c} className="py-3 pr-4 text-muted-foreground">
                          Not priced
                        </td>
                      );
                    }
                    const perSession = Math.round(price.amount_cents / p.session_credits);
                    return (
                      <td key={c} className="py-3 pr-4 tabular-nums">
                        <span className="text-foreground">{formatMoney(price.amount_cents, c)}</span>
                        {p.session_credits > 1 && (
                          <span className="block text-xs text-muted-foreground">
                            {formatMoney(perSession, c)} per session
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {showGuideLink && (
          <p className="mt-5 text-sm text-muted-foreground">
            Wondering how this compares?{" "}
            <Link
              href="/guides/what-private-online-yoga-costs"
              className="text-accent underline underline-offset-4 hover:text-[var(--accent-bright)]"
            >
              Read what private online yoga costs
            </Link>
            , with the published prices we found elsewhere.
          </p>
        )}
      </div>
    </section>
  );
}
