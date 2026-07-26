/**
 * Customer-facing wording for what a pack purchase grants.
 *
 * We sell prepaid **one-to-one sessions with a human teacher**. Internally those
 * are rows in `credit_ledger` with a `session_credits` count, and that vocabulary
 * leaked into display copy ("Credits never expire").
 *
 * That wording is an App Store liability: guideline 3.1.1 requires in-app
 * purchase for "in-app currency", and a balance called *credits* reads exactly
 * like in-app currency to a reviewer. What we actually sell falls under the
 * 3.1.3(d) person-to-person carve-out (one-to-one realtime fitness training),
 * which may use payment methods other than IAP. The wording, not the product,
 * was the risk.
 *
 * So: DB column names stay as they are, and this rewrites display strings only.
 *
 * Pure and dependency-free so it can be unit-tested and used from both server
 * and client code.
 */

/** Preserve the leading capital of whatever matched ("Credits" → "Sessions"). */
function like(match: string, replacement: string): string {
  return match[0] === match[0].toUpperCase()
    ? replacement[0].toUpperCase() + replacement.slice(1)
    : replacement;
}

/**
 * Rewrite "credit" wording to "session" wording in customer-facing copy.
 *
 * Longest patterns first, so "session credits" collapses to "sessions" rather
 * than expanding to "session sessions". "credit card" is never touched: that's
 * a payment instrument, not a balance.
 */
export function sessionsNotCredits(s: string): string {
  return (
    s
      // "credit refunded" would become "session refunded", which reads oddly, so
      // the refund phrasing gets its own natural wording.
      .replace(/\bcredits?\s+refunded\b/gi, (m) => like(m, "session returned"))
      .replace(/\bsession[-\s]credits\b/gi, (m) => like(m, "sessions"))
      .replace(/\bsession[-\s]credit\b/gi, (m) => like(m, "session"))
      .replace(/\bcredits\b(?!\s+cards?\b)/gi, (m) => like(m, "sessions"))
      .replace(/\bcredit\b(?!\s+cards?\b)/gi, (m) => like(m, "session"))
  );
}
