/**
 * Hand-curated internal-link graph for the condition pages and teacher profiles.
 *
 * Curated, not derived. `teachers.specialties` is free text written for the
 * admin UI ("Cardiovascular Health", "Musculoskeletal Disorders") and matches
 * none of the nine slugs, so token-matching on it produces nonsense links, for
 * instance tying a prenatal specialist to kids yoga because both strings
 * contain "yoga". These maps are checked by a unit test instead.
 *
 * Before this existed, every condition page and every teacher page emitted only
 * nav, footer and CTA links: nine leaves and three leaves, with no edges
 * between them and nothing passing relevance to anything.
 */

/** Clinically adjacent conditions, 2 to 3 per page. Every slug appears as a
 *  value at least twice, so no page is left without inbound links. */
export const RELATED_CONDITIONS: Record<string, string[]> = {
  diabetes: ["hypertension", "weight-loss", "hormonal-health"],
  hypertension: ["diabetes", "mental-health", "geriatric"],
  prenatal: ["hormonal-health", "pain-relief", "kids-yoga"],
  "hormonal-health": ["prenatal", "weight-loss", "mental-health"],
  "pain-relief": ["geriatric", "prenatal", "mental-health"],
  "mental-health": ["hypertension", "pain-relief", "kids-yoga"],
  "weight-loss": ["diabetes", "hormonal-health", "hypertension"],
  geriatric: ["pain-relief", "hypertension", "mental-health"],
  "kids-yoga": ["mental-health", "pain-relief"],
};

/**
 * Teacher slug to the conditions that teacher actually works with, mapped by
 * hand from their stated specialties:
 *
 * - dr-sangeeta        "Prenatal and Postnatal Yoga"
 * - dr-hima-bindu      Pain Relief, Stress Relief, Posture Correction,
 *                      Breathwork, Nervous System Regulation
 * - dr-vaishnavi-mayya Clinical Yoga, Lifestyle Disorders, Cardiovascular
 *                      Health, Musculoskeletal Disorders, Women's Health
 *
 * A teacher absent from this map simply gets no condition links, which is the
 * correct outcome: we would rather link nothing than imply a clinical
 * competency nobody claimed.
 */
export const TEACHER_CONDITIONS: Record<string, string[]> = {
  "dr-sangeeta": ["prenatal"],
  "dr-hima-bindu": ["pain-relief", "mental-health"],
  "dr-vaishnavi-mayya": [
    "diabetes",
    "hypertension",
    "hormonal-health",
    "weight-loss",
    "pain-relief",
  ],
};

/** Inverse of TEACHER_CONDITIONS: which teachers to surface on a condition page. */
export function teachersForCondition(slug: string): string[] {
  return Object.entries(TEACHER_CONDITIONS)
    .filter(([, slugs]) => slugs.includes(slug))
    .map(([teacher]) => teacher);
}
