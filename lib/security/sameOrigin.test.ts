import { describe, expect, it } from "vitest";
import { isCrossOriginMutation } from "./sameOrigin";

const base = {
  requestOrigin: "https://www.myyogaclasses.fit",
  siteUrl: "https://www.myyogaclasses.fit",
};

describe("isCrossOriginMutation", () => {
  it("never blocks safe methods", () => {
    expect(isCrossOriginMutation({ ...base, method: "GET", origin: "https://evil.com", secFetchSite: "cross-site" })).toBe(false);
  });

  it("allows same-origin and apex/www posts", () => {
    expect(isCrossOriginMutation({ ...base, method: "POST", origin: "https://www.myyogaclasses.fit", secFetchSite: "same-origin" })).toBe(false);
    expect(isCrossOriginMutation({ ...base, method: "POST", origin: "https://myyogaclasses.fit" })).toBe(false);
  });

  it("allows server-to-server callers with no Origin (webhook, cron)", () => {
    expect(isCrossOriginMutation({ ...base, method: "POST", origin: null })).toBe(false);
  });

  it("allows the native shell", () => {
    expect(isCrossOriginMutation({ ...base, method: "POST", origin: "capacitor://localhost" })).toBe(false);
  });

  it("blocks foreign origins, sibling subdomains and null", () => {
    for (const origin of ["https://evil.com", "https://blog.myyogaclasses.fit", "null", "http://www.myyogaclasses.fit"]) {
      expect(isCrossOriginMutation({ ...base, method: "POST", origin })).toBe(true);
      expect(isCrossOriginMutation({ ...base, method: "DELETE", origin })).toBe(true);
    }
  });

  it("blocks a cross-site fetch-metadata request even without Origin", () => {
    expect(isCrossOriginMutation({ ...base, method: "POST", origin: null, secFetchSite: "cross-site" })).toBe(true);
  });
});
