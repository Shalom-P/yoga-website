import { describe, it, expect } from "vitest";
import {
  RELATED_CONDITIONS,
  TEACHER_CONDITIONS,
  teachersForCondition,
} from "./condition-links";
import { CONDITION_SLUGS } from "./condition-pages";

describe("condition link graph", () => {
  it("only references condition slugs that exist", () => {
    const known = new Set(CONDITION_SLUGS);
    for (const [from, targets] of Object.entries(RELATED_CONDITIONS)) {
      expect(known.has(from), `unknown source slug ${from}`).toBe(true);
      for (const t of targets) {
        expect(known.has(t), `${from} links unknown slug ${t}`).toBe(true);
      }
    }
    for (const [teacher, targets] of Object.entries(TEACHER_CONDITIONS)) {
      for (const t of targets) {
        expect(known.has(t), `${teacher} links unknown slug ${t}`).toBe(true);
      }
    }
  });

  it("covers every condition page", () => {
    for (const slug of CONDITION_SLUGS) {
      expect(RELATED_CONDITIONS[slug], `${slug} has no related conditions`).toBeDefined();
    }
  });

  it("never links a page to itself", () => {
    for (const [from, targets] of Object.entries(RELATED_CONDITIONS)) {
      expect(targets).not.toContain(from);
    }
  });

  // The whole point of the map: no condition may be a link sink. Two inbound
  // edges is the floor, so equity reaches every page from more than one route.
  it("gives every condition at least two inbound links", () => {
    const inbound = new Map<string, number>(CONDITION_SLUGS.map((s) => [s, 0]));
    for (const targets of Object.values(RELATED_CONDITIONS)) {
      for (const t of targets) inbound.set(t, (inbound.get(t) ?? 0) + 1);
    }
    for (const [slug, n] of inbound) {
      expect(n, `${slug} has only ${n} inbound link(s)`).toBeGreaterThanOrEqual(2);
    }
  });

  it("resolves teachers for a condition", () => {
    expect(teachersForCondition("prenatal")).toContain("dr-sangeeta");
    expect(teachersForCondition("hypertension")).toContain("dr-vaishnavi-mayya");
    expect(teachersForCondition("kids-yoga")).toEqual([]);
  });
});
