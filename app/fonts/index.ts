import localFont from "next/font/local";

// Brand fonts, self-hosted. These are the files next/font/google used to
// download from Google Fonts during `next build`, byte for byte, loaded with the
// same weights, styles and fallbacks, so Latin text renders exactly as before
// but the build no longer depends on Google (see README.md for why and the
// sources).
//
// Google gives each script its own file and unicode-range, so a page downloads
// latin-ext only once it uses one of its characters (₹, accented names).
// next/font/local sets one unicode-range per call, not per file, so each family
// is two calls: the latin file, preloaded as `subsets: ["latin"]` did, and a
// latin-ext companion that is never preloaded. globals.css joins each pair into
// the variable the stylesheets read (e.g. --font-cormorant). Cyrillic, Greek and
// Vietnamese are not shipped; they fall through to the next font in the stack.
//
// The companions' range is Google's latin-ext range minus the code points it
// also lists under latin (ı, Œ, œ, U+0304, U+0308, U+0329). Those stay with the
// latin file, which Google's CSS consulted first. next/font only accepts
// literal options, so the range is written out in every call.
//
// Cormorant and Hanken were requested at 400, 500, 600 and 700: four faces over
// one variable file. A 400-700 range draws those weights identically and clamps
// anything lighter or heavier to 400 or 700, which is where the nearest-face
// match landed too.
//
// adjustFontFallback is off everywhere: globals.css declares the size-adjusted
// fallback faces with the metrics next/font/google used. next/font/local would
// measure each file's default instance instead, and Fraunces's is its 9pt Black,
// which made the stand-in 10% too wide.

const interLatin = localFont({
  src: "./inter-latin.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-inter-latin",
  adjustFontFallback: false,
});

const interLatinExt = localFont({
  src: "./inter-latin-ext.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-inter-latin-ext",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-0130, U+0132-0151, U+0154-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

// Google's file for `axes: ["opsz", "SOFT"]`: weight, optical size and softness.
const frauncesLatin = localFont({
  src: "./fraunces-latin.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-fraunces-latin",
  adjustFontFallback: false,
});

const frauncesLatinExt = localFont({
  src: "./fraunces-latin-ext.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-fraunces-latin-ext",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-0130, U+0132-0151, U+0154-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

const geistMonoLatin = localFont({
  src: "./geist-mono-latin.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-mono-latin",
  adjustFontFallback: false,
});

const geistMonoLatinExt = localFont({
  src: "./geist-mono-latin-ext.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-mono-latin-ext",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-0130, U+0132-0151, U+0154-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

// Marketing-surface fonts (My Yoga Classes design handoff): elegant display
// serif + clean grotesk body. Scoped to .myc-theme / .myc-app in globals.css.
const cormorantLatin = localFont({
  src: [
    { path: "./cormorant-garamond-latin.woff2", weight: "400 700", style: "normal" },
    { path: "./cormorant-garamond-italic-latin.woff2", weight: "400 700", style: "italic" },
  ],
  display: "swap",
  variable: "--font-cormorant-latin",
  adjustFontFallback: false,
});

const cormorantLatinExt = localFont({
  src: [
    { path: "./cormorant-garamond-latin-ext.woff2", weight: "400 700", style: "normal" },
    { path: "./cormorant-garamond-italic-latin-ext.woff2", weight: "400 700", style: "italic" },
  ],
  display: "swap",
  variable: "--font-cormorant-latin-ext",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-0130, U+0132-0151, U+0154-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

const hankenLatin = localFont({
  src: "./hanken-grotesk-latin.woff2",
  weight: "400 700",
  display: "swap",
  variable: "--font-hanken-latin",
  adjustFontFallback: false,
});

const hankenLatinExt = localFont({
  src: "./hanken-grotesk-latin-ext.woff2",
  weight: "400 700",
  display: "swap",
  variable: "--font-hanken-latin-ext",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-0130, U+0132-0151, U+0154-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

// Classes for <html>: each defines one of the variables globals.css combines.
export const fontVariables = [
  interLatin,
  interLatinExt,
  frauncesLatin,
  frauncesLatinExt,
  geistMonoLatin,
  geistMonoLatinExt,
  cormorantLatin,
  cormorantLatinExt,
  hankenLatin,
  hankenLatinExt,
]
  .map((font) => font.variable)
  .join(" ");
