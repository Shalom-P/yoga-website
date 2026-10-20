import { describe, expect, it } from "vitest";
import { faqAnswerText, faqPageJsonLd, offersJsonLd } from "./structuredData";
import { homeFaqs, type Faq } from "@/lib/data/faqs";
import type { Plan, PlanPrice } from "@/lib/supabase/types";

type PlanInput = Plan & { prices?: PlanPrice[] };

function plan(
  slug: string,
  credits: number,
  prices: Array<[string, number]>,
  active = true,
): PlanInput {
  return {
    slug,
    name: `${credits}-Session Pack`,
    session_credits: credits,
    is_active: active,
    price_base_cents: 999900,
    prices: prices.map(([currency, amount_cents]) => ({ currency, amount_cents })) as PlanPrice[],
  } as unknown as PlanInput;
}

const URL = "https://www.myyogaclasses.fit/pricing";

describe("offersJsonLd", () => {
  it("emits one Product per active pack, each carrying the plan slug as sku", () => {
    const products = offersJsonLd(
      [
        plan("pack-1", 1, [["INR", 149900], ["AED", 5900]]),
        plan("pack-10", 10, [["INR", 999900]]),
      ],
      URL,
    );
    expect(products?.map((p) => p.sku)).toEqual(["pack-1", "pack-10"]);
    expect(products?.every((p) => p["@type"] === "Product")).toBe(true);
  });

  it("never publishes the INR base price as an offer under another currency", () => {
    const products = offersJsonLd([plan("pack-5", 5, [["AED", 26900]])], URL);
    expect(JSON.stringify(products)).not.toContain("9999");
    expect(JSON.stringify(products)).toContain('"priceCurrency":"AED"');
  });

  it("drops inactive packs and packs with no priced currency, and returns null when nothing is left", () => {
    expect(offersJsonLd([plan("pack-5", 5, [], true), plan("pack-1", 1, [["INR", 1]], false)], URL)).toBeNull();
  });

  it("uses a single Offer when one currency is priced and an AggregateOffer otherwise", () => {
    const [single, multi] = offersJsonLd(
      [plan("pack-1", 1, [["INR", 149900]]), plan("pack-5", 5, [["INR", 699900], ["USD", 7900]])],
      URL,
    )!;
    expect((single.offers as { "@type": string })["@type"]).toBe("Offer");
    const agg = multi.offers as { "@type": string; offerCount: number; priceCurrency?: string };
    expect(agg["@type"]).toBe("AggregateOffer");
    expect(agg.offerCount).toBe(2);
    expect(agg.priceCurrency).toBeUndefined();
  });
});

describe("faqPageJsonLd", () => {
  const withLinks: Faq = {
    q: "Who teaches?",
    a: "Graduates in yoga and naturopathy.",
    links: [
      { href: "/teachers", label: "Meet the teachers" },
      { href: "/doctor-led-yoga-therapy", label: "what their degrees mean" },
    ],
  };

  it("puts the link labels into the answer text as the one closing sentence the page shows", () => {
    expect(faqAnswerText(withLinks)).toBe(
      "Graduates in yoga and naturopathy. Meet the teachers and what their degrees mean.",
    );
    expect(faqAnswerText({ q: "Q", a: "Plain answer." })).toBe("Plain answer.");
    expect(faqAnswerText({ q: "Q", a: "Plain answer.", links: [] })).toBe("Plain answer.");
  });

  it("emits one Question per entry, in order, with that same text", () => {
    const ld = faqPageJsonLd([withLinks, { q: "Cost?", a: "No subscription." }]);
    expect(ld["@type"]).toBe("FAQPage");
    const entities = ld.mainEntity as unknown as Array<{ name: string; acceptedAnswer: { text: string } }>;
    expect(entities.map((e) => e.name)).toEqual(["Who teaches?", "Cost?"]);
    expect(entities[0].acceptedAnswer.text).toBe(faqAnswerText(withLinks));
    expect(entities[1].acceptedAnswer.text).toBe("No subscription.");
  });
});

describe("homeFaqs", () => {
  it("quotes the INR per-session price only when one is priced", () => {
    const priced = JSON.stringify(homeFaqs({ priceFrom: "₹1,000" }));
    expect(priced).toContain("from ₹1,000 a session in India");
    expect(JSON.stringify(homeFaqs({ priceFrom: null }))).not.toContain("a session in India");
  });

  it("links every answer to a deeper page and never duplicates the pricing FAQ", () => {
    const faqs = homeFaqs({ priceFrom: null });
    expect(faqs.length).toBeGreaterThanOrEqual(6);
    expect(faqs.length).toBeLessThanOrEqual(8);
    for (const f of faqs) expect(f.links?.length ?? 0).toBeGreaterThan(0);
    const hrefs = faqs.flatMap((f) => f.links!.map((l) => l.href));
    for (const h of [
      "/private-online-yoga-classes",
      "/online-yoga-classes-india",
      "/guides/private-vs-group-online-yoga",
      "/guides/what-private-online-yoga-costs",
      "/doctor-led-yoga-therapy",
      "/teachers",
    ])
      expect(hrefs).toContain(h);
    // Not a fact the site can stand behind yet (GEO audit TODO 3).
    expect(JSON.stringify(faqs)).not.toMatch(/Yoga Alliance|200-?hr/i);
  });
});
