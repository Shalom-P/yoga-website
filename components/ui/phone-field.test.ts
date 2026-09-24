import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { getCountries } from "react-phone-number-input";

// PhoneField draws the selected country's flag from public/flags/3x2 (FLAG_URL
// in phone-field.tsx). A country with no file there shows a broken image, so a
// library upgrade that adds a country needs its flag copied in as well:
//   cp node_modules/country-flag-icons/3x2/XX.svg public/flags/3x2/
describe("PhoneField flags", () => {
  it("has a flag for every country the picker offers", () => {
    // Compared against the listing rather than existsSync: macOS disks are
    // case-insensitive, so "in.svg" would pass here and 404 on Vercel's Linux.
    const files = new Set(readdirSync(path.join(process.cwd(), "public/flags/3x2")));
    const missing = getCountries().filter((c) => !files.has(`${c}.svg`));
    expect(missing).toEqual([]);
  });
});
