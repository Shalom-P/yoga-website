/**
 * Where each customer stands, for the follow-up view on /admin/customers.
 *
 * Pure on purpose (no DB, no clock): the page passes in the rows and "now",
 * so the rules are pinned by customerLifecycle.test.ts.
 *
 * Attendance is almost never marked (most past bookings read `no_show`, and
 * a no_show row was usually attended), so a session "happened" when it is not
 * cancelled and has started. Status `no_show` is not treated as a miss.
 */

export type LifecycleStage =
  | "staff"
  | "incomplete"
  | "never_booked"
  | "trial_upcoming"
  | "trial_done"
  | "active"
  | "sessions_left"
  | "pack_used_up";

export const STAGE_LABEL: Record<LifecycleStage, string> = {
  staff: "Staff",
  incomplete: "Onboarding unfinished",
  never_booked: "Never booked",
  trial_upcoming: "First session booked",
  trial_done: "Tried, not bought",
  active: "Active",
  sessions_left: "Sessions left, none booked",
  pack_used_up: "Pack used up",
};

/**
 * Stages where a nudge from the studio is the likely next step. "incomplete"
 * is left out: most of those rows are abandoned or internal test sign-ups,
 * many have no phone, and they would bury the real leads. They are still one
 * click away under the "Never booked" filter.
 */
export const FOLLOW_UP_STAGES: ReadonlySet<LifecycleStage> = new Set([
  "never_booked",
  "trial_done",
  "sessions_left",
  "pack_used_up",
]);

/** An auto-flagged customer drops off the list for this long after a contact. */
export const RECONTACT_AFTER_DAYS = 7;

export type LifecycleBooking = {
  status: string;
  is_free_trial: boolean;
  start_at: string | null;
};

export type LifecyclePayment = {
  created_at: string;
  amount_cents: number;
  currency: string;
};

export type LifecycleFollowUp = {
  created_at: string;
  next_follow_up_on: string | null;
  /** 0051. Missing (0050-era callers) reads as "open". */
  outcome?: "open" | "not_interested" | null;
};

export type LifecycleInput = {
  role: string;
  profileComplete: boolean;
  credits: number;
  bookings: LifecycleBooking[];
  /** Completed payments only. */
  payments: LifecyclePayment[];
  /** Any order. */
  followUps: LifecycleFollowUp[];
};

export type Lifecycle = {
  stage: LifecycleStage;
  sessionsDone: number;
  upcomingCount: number;
  lastSessionAt: string | null;
  nextSessionAt: string | null;
  packsBought: number;
  isRepeat: boolean;
  /** Minor units per currency, e.g. { INR: 1900000 }. */
  spent: Record<string, number>;
  lastContactAt: string | null;
  /** From the newest follow-up row; null when nothing is scheduled. */
  followUpOn: string | null;
  /**
   * The newest follow-up row says they are not interested. They stay in
   * their factual stage but leave every follow-up list until a newer open
   * row is written.
   */
  notInterested: boolean;
  followUp: "overdue" | "today" | "scheduled" | "suggested" | null;
};

/**
 * @param now   the current instant
 * @param today the studio's calendar date as yyyy-MM-dd (IST), which is what
 *              next_follow_up_on dates are compared against
 */
export function customerLifecycle(input: LifecycleInput, now: Date, today: string): Lifecycle {
  const nowMs = now.getTime();
  let sessionsDone = 0;
  let upcomingCount = 0;
  let lastSessionAt: string | null = null;
  let nextSessionAt: string | null = null;
  let trialDone = false;
  let trialUpcoming = false;

  for (const b of input.bookings) {
    if (b.status === "cancelled" || !b.start_at) continue;
    const t = Date.parse(b.start_at);
    if (Number.isNaN(t)) continue;
    if (t <= nowMs) {
      sessionsDone += 1;
      if (b.is_free_trial) trialDone = true;
      if (!lastSessionAt || t > Date.parse(lastSessionAt)) lastSessionAt = b.start_at;
    } else {
      upcomingCount += 1;
      if (b.is_free_trial) trialUpcoming = true;
      if (!nextSessionAt || t < Date.parse(nextSessionAt)) nextSessionAt = b.start_at;
    }
  }

  const spent: Record<string, number> = {};
  for (const p of input.payments) {
    spent[p.currency] = (spent[p.currency] ?? 0) + p.amount_cents;
  }
  const packsBought = input.payments.length;
  const bought = packsBought > 0;

  let stage: LifecycleStage;
  if (input.role !== "customer") stage = "staff";
  else if (!input.profileComplete) stage = "incomplete";
  else if (upcomingCount > 0) stage = !bought && trialUpcoming ? "trial_upcoming" : "active";
  else if (input.credits > 0) stage = "sessions_left";
  else if (bought) stage = "pack_used_up";
  else if (trialDone || sessionsDone > 0) stage = "trial_done";
  else stage = "never_booked";

  let latest: LifecycleFollowUp | null = null;
  for (const f of input.followUps) {
    if (!latest || Date.parse(f.created_at) > Date.parse(latest.created_at)) latest = f;
  }
  const lastContactAt = latest?.created_at ?? null;
  const notInterested = latest?.outcome === "not_interested";
  // A closed lead has no due date (0051 CHECK); belt and braces here.
  const followUpOn = notInterested ? null : (latest?.next_follow_up_on ?? null);

  let followUp: Lifecycle["followUp"] = null;
  if (notInterested) {
    followUp = null;
  } else if (followUpOn) {
    followUp = followUpOn < today ? "overdue" : followUpOn === today ? "today" : "scheduled";
  } else if (FOLLOW_UP_STAGES.has(stage)) {
    const quietMs = RECONTACT_AFTER_DAYS * 24 * 60 * 60 * 1000;
    if (!lastContactAt || nowMs - Date.parse(lastContactAt) >= quietMs) followUp = "suggested";
  }

  return {
    stage,
    sessionsDone,
    upcomingCount,
    lastSessionAt,
    nextSessionAt,
    packsBought,
    isRepeat: packsBought >= 2,
    spent,
    lastContactAt,
    followUpOn,
    notInterested,
    followUp,
  };
}

/** True when the customer belongs on the "To follow up" list today. */
export function needsFollowUpNow(l: Pick<Lifecycle, "followUp">): boolean {
  return l.followUp === "overdue" || l.followUp === "today" || l.followUp === "suggested";
}

/**
 * wa.me link for an E.164 phone, or null. wa.me wants the digits only, with
 * the country code and no plus.
 */
export function whatsAppLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

/** yyyy-MM-dd that many days after a yyyy-MM-dd date (calendar math, no zone). */
export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
