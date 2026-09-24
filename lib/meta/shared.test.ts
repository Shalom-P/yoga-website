import { describe, expect, it } from "vitest";

import {
  buildFbc,
  buildFbp,
  clientIpFromHeaders,
  fbcMatches,
  metaContextFromNotes,
  metaContextToNotes,
  metaTrackingAllowed,
  readCookie,
} from "./shared";

const ORIGIN = "https://myyogaclasses.fit";

describe("cookie formats", () => {
  it("builds _fbp and _fbc in Meta's documented shape", () => {
    expect(buildFbp(1700000000000, 0.123456789)).toBe("fb.1.1700000000000.1234567890");
    expect(buildFbc(1700000000000, "AbC")).toBe("fb.1.1700000000000.AbC");
  });

  it("recognises an _fbc that already carries this click id", () => {
    expect(fbcMatches("fb.1.1.AbC", "AbC")).toBe(true);
    expect(fbcMatches("fb.1.1.Other", "AbC")).toBe(false);
    expect(fbcMatches(undefined, "AbC")).toBe(false);
  });

  it("reads a cookie out of a raw header", () => {
    expect(readCookie("a=1; _fbp=fb.1.2.3; b=2", "_fbp")).toBe("fb.1.2.3");
    expect(readCookie("a=1", "_fbp")).toBeUndefined();
    expect(readCookie(null, "_fbp")).toBeUndefined();
  });
});

describe("metaTrackingAllowed", () => {
  const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

  it("allows an ordinary browser", () => {
    expect(metaTrackingAllowed(new Headers({ "user-agent": safari }))).toBe(true);
  });

  it("never tracks the iOS app (no ATT prompt is shown)", () => {
    expect(metaTrackingAllowed(new Headers({ "user-agent": `${safari} MyYogaClassesiOS` }))).toBe(false);
  });

  it("honours Global Privacy Control", () => {
    expect(metaTrackingAllowed(new Headers({ "user-agent": safari, "sec-gpc": "1" }))).toBe(false);
  });
});

describe("clientIpFromHeaders", () => {
  it("takes the left-most forwarded hop", () => {
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIpFromHeaders(new Headers())).toBeUndefined();
  });
});

describe("order-notes round trip", () => {
  it("keeps a Facebook in-app user agent whole across two notes", () => {
    const fbUa = "Mozilla/5.0 (iPhone) " + "FBAN/FBIOS;".repeat(30);
    const ctx = { ip: "1.2.3.4", userAgent: fbUa, fbp: "fb.1.2.3", sourceUrl: `${ORIGIN}/dashboard/plan` };
    const notes = metaContextToNotes(ctx);
    expect(fbUa.length).toBeGreaterThan(256);
    expect(Object.values(notes).every((v) => v.length <= 256)).toBe(true);
    expect(notes).not.toHaveProperty("mFbc");
    expect(metaContextFromNotes({ ...notes, customerId: "u1" })).toEqual(ctx);
  });

  it("carries an opt-out through to fulfilment", () => {
    const notes = metaContextToNotes({ optOut: true, ip: "1.2.3.4" });
    expect(notes).toEqual({ mOff: "1" });
    expect(metaContextFromNotes(notes)).toEqual({ optOut: true });
  });

  it("reads orders created before this integration as empty context", () => {
    expect(metaContextFromNotes({ customerId: "u1", planId: "p1" })).toEqual({});
  });
});
