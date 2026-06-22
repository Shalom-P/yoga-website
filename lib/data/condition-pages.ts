// Rich, per-condition content for the /classes/[slug] detail pages — the
// "Yoga for X, shaped around you" landing layout (hero → empathy → why-it-works
// levers → grouped pose library → how-we-work → session/who-for → testimonial →
// FAQ → safety → final CTA). Source of truth is landing-pages/*.html; the JSON
// in ./condition-pages/ is extracted verbatim from those (medically-reviewed copy
// — do not paraphrase here). Rendered by components/marketing/condition/ConditionLanding.tsx.
//
// Keyed by the class_categories.slug values (note: kids is "kids-yoga").

import diabetes from "./condition-pages/diabetes.json";
import hypertension from "./condition-pages/hypertension.json";
import prenatal from "./condition-pages/prenatal.json";
import hormonalHealth from "./condition-pages/hormonal-health.json";
import painRelief from "./condition-pages/pain-relief.json";
import mentalHealth from "./condition-pages/mental-health.json";
import weightLoss from "./condition-pages/weight-loss.json";
import geriatric from "./condition-pages/geriatric.json";
import kidsYoga from "./condition-pages/kids-yoga.json";

export type Pose = { sa: string; en: string; desc: string };
export type PoseGroup = { tag: string; why: string; poses: Pose[]; note?: string };
export type Titled = { title: string; body: string };
export type Faq = { q: string; a: string };

export type ConditionPage = {
  slug: string;
  /** Hero kicker, e.g. "Gentle intensity · for diabetes". */
  eyebrow: string;
  /** Hero <h1> split around the coral-italic <em> flourish. */
  h1Before: string;
  h1Em: string;
  h1After: string;
  heroLead: string;
  empathyLabel: string;
  empathyText: string;
  helpsH2: string;
  helpsSubhead: string;
  levers: Titled[];
  posesH2: string;
  posesSubhead: string;
  poseGroups: PoseGroup[];
  selectionNote: string;
  howH2: string;
  howSubhead: string;
  steps: Titled[];
  sessionTitle: string;
  sessionChecklist: string[];
  whoForTitle: string;
  whoForText: string;
  propsTitle: string;
  props: string[];
  testimonialQuote: string;
  /** May contain a leading "<strong>…</strong>" — rendered bold by the component. */
  testimonialWho: string;
  faqH2: string;
  faqs: Faq[];
  safetyTitle: string;
  safetyText: string;
  metaDescription: string;
};

const PAGES = [
  diabetes,
  hypertension,
  prenatal,
  hormonalHealth,
  painRelief,
  mentalHealth,
  weightLoss,
  geriatric,
  kidsYoga,
] as unknown as ConditionPage[];

const BY_SLUG: Record<string, ConditionPage> = Object.fromEntries(
  PAGES.map((p) => [p.slug, p]),
);

/** Returns the rich landing content for a class-category slug, or null if none. */
export function getConditionPage(slug: string): ConditionPage | null {
  return BY_SLUG[slug] ?? null;
}
