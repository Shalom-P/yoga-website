import { describe, expect, it } from "vitest";
import { rosterLanguageSentence } from "./languages";

describe("rosterLanguageSentence", () => {
  it("names the shared language and each teacher's extras", () => {
    expect(
      rosterLanguageSentence([
        { display_name: "Dr A", languages: ["English"] },
        { display_name: "Dr B", languages: ["English", "Kannada", "Hindi"] },
      ]),
    ).toBe("All our teachers teach in English. Dr B also teaches in Kannada and Hindi.");
  });

  it("lists three or more with commas", () => {
    expect(
      rosterLanguageSentence([{ display_name: "Dr A", languages: ["English", "Hindi", "Tamil"] }]),
    ).toBe("All our teachers teach in English, Hindi and Tamil.");
  });

  it("handles no shared language", () => {
    expect(
      rosterLanguageSentence([
        { display_name: "Dr A", languages: ["Hindi"] },
        { display_name: "Dr B", languages: ["Tamil"] },
      ]),
    ).toBe("Dr A teaches in Hindi. Dr B teaches in Tamil.");
  });

  it("returns null for an empty roster or no languages", () => {
    expect(rosterLanguageSentence([])).toBeNull();
    expect(rosterLanguageSentence([{ display_name: "Dr A", languages: null }])).toBeNull();
  });
});
