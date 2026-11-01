import { describe, expect, it } from "vitest";
import {
  addDays,
  customerLifecycle,
  needsFollowUpNow,
  whatsAppLink,
  type LifecycleInput,
} from "./customerLifecycle";

const NOW = new Date("2026-11-01T06:30:00Z");
const TODAY = "2026-11-01";

function base(over: Partial<LifecycleInput> = {}): LifecycleInput {
  return {
    role: "customer",
    profileComplete: true,
    credits: 0,
    bookings: [],
    payments: [],
    followUps: [],
    ...over,
  };
}

const past = (iso: string, trial = false, status = "no_show") => ({
  status,
  is_free_trial: trial,
  start_at: iso,
});
const pay = (iso: string, amount = 1900000, currency = "INR") => ({
  created_at: iso,
  amount_cents: amount,
  currency,
});

describe("customerLifecycle stage", () => {
  it("marks admins and teachers as staff whatever they did", () => {
    expect(customerLifecycle(base({ role: "admin" }), NOW, TODAY).stage).toBe("staff");
    expect(customerLifecycle(base({ role: "teacher" }), NOW, TODAY).stage).toBe("staff");
  });

  it("puts an unfinished profile ahead of everything else", () => {
    const l = customerLifecycle(base({ profileComplete: false }), NOW, TODAY);
    expect(l.stage).toBe("incomplete");
  });

  it("never_booked with no bookings and no payments", () => {
    expect(customerLifecycle(base(), NOW, TODAY).stage).toBe("never_booked");
  });

  it("trial_upcoming while the free first session is still ahead", () => {
    const l = customerLifecycle(
      base({ bookings: [past("2026-11-03T10:00:00Z", true, "confirmed")] }),
      NOW,
      TODAY
    );
    expect(l.stage).toBe("trial_upcoming");
    expect(l.nextSessionAt).toBe("2026-11-03T10:00:00Z");
  });

  it("trial_done once the free session has passed and nothing was bought", () => {
    // no_show is how most attended sessions read, so it still counts as done.
    const l = customerLifecycle(base({ bookings: [past("2026-10-20T10:00:00Z", true)] }), NOW, TODAY);
    expect(l.stage).toBe("trial_done");
    expect(l.sessionsDone).toBe(1);
  });

  it("ignores cancelled bookings", () => {
    const l = customerLifecycle(
      base({ bookings: [past("2026-10-20T10:00:00Z", true, "cancelled")] }),
      NOW,
      TODAY
    );
    expect(l.stage).toBe("never_booked");
    expect(l.sessionsDone).toBe(0);
  });

  it("active when a paying customer has something booked", () => {
    const l = customerLifecycle(
      base({
        credits: 3,
        payments: [pay("2026-10-01T00:00:00Z")],
        bookings: [past("2026-11-05T10:00:00Z", false, "confirmed")],
      }),
      NOW,
      TODAY
    );
    expect(l.stage).toBe("active");
  });

  it("sessions_left when they hold sessions but have nothing booked", () => {
    const l = customerLifecycle(
      base({ credits: 2, payments: [pay("2026-10-01T00:00:00Z")] }),
      NOW,
      TODAY
    );
    expect(l.stage).toBe("sessions_left");
  });

  it("pack_used_up when they bought before and have nothing left or booked", () => {
    const l = customerLifecycle(base({ payments: [pay("2026-09-01T00:00:00Z")] }), NOW, TODAY);
    expect(l.stage).toBe("pack_used_up");
  });
});

describe("customerLifecycle repeat buyers and spend", () => {
  it("counts packs and flags two or more as repeat", () => {
    const one = customerLifecycle(base({ payments: [pay("2026-09-01T00:00:00Z")] }), NOW, TODAY);
    expect(one.isRepeat).toBe(false);
    const two = customerLifecycle(
      base({
        payments: [pay("2026-09-01T00:00:00Z"), pay("2026-10-01T00:00:00Z", 43500, "AED")],
      }),
      NOW,
      TODAY
    );
    expect(two.packsBought).toBe(2);
    expect(two.isRepeat).toBe(true);
    expect(two.spent).toEqual({ INR: 1900000, AED: 43500 });
  });
});

describe("customerLifecycle follow-ups", () => {
  it("suggests a follow-up for a hot stage nobody has contacted", () => {
    const l = customerLifecycle(base({ bookings: [past("2026-10-20T10:00:00Z", true)] }), NOW, TODAY);
    expect(l.followUp).toBe("suggested");
    expect(needsFollowUpNow(l)).toBe(true);
  });

  it("stays quiet for a week after a contact with no date set", () => {
    const l = customerLifecycle(
      base({ followUps: [{ created_at: "2026-10-29T09:00:00Z", next_follow_up_on: null }] }),
      NOW,
      TODAY
    );
    expect(l.followUp).toBeNull();
    expect(l.lastContactAt).toBe("2026-10-29T09:00:00Z");
  });

  it("suggests again once the week is up", () => {
    const l = customerLifecycle(
      base({ followUps: [{ created_at: "2026-10-20T09:00:00Z", next_follow_up_on: null }] }),
      NOW,
      TODAY
    );
    expect(l.followUp).toBe("suggested");
  });

  it("does not auto-suggest unfinished onboarding", () => {
    const l = customerLifecycle(base({ profileComplete: false }), NOW, TODAY);
    expect(l.followUp).toBeNull();
  });

  it("never suggests for an active customer", () => {
    const l = customerLifecycle(
      base({ credits: 1, payments: [pay("2026-10-01T00:00:00Z")], bookings: [past("2026-11-05T10:00:00Z", false, "confirmed")] }),
      NOW,
      TODAY
    );
    expect(l.followUp).toBeNull();
  });

  it("uses only the newest row's date, so a later contact clears an older one", () => {
    const l = customerLifecycle(
      base({
        followUps: [
          { created_at: "2026-10-31T09:00:00Z", next_follow_up_on: null },
          { created_at: "2026-10-25T09:00:00Z", next_follow_up_on: "2026-10-28" },
        ],
      }),
      NOW,
      TODAY
    );
    expect(l.followUpOn).toBeNull();
    expect(l.followUp).toBeNull();
  });

  it("reads a scheduled date as overdue, today or later", () => {
    const at = (d: string) =>
      customerLifecycle(
        base({ role: "customer", followUps: [{ created_at: "2026-10-25T09:00:00Z", next_follow_up_on: d }] }),
        NOW,
        TODAY
      ).followUp;
    expect(at("2026-10-31")).toBe("overdue");
    expect(at("2026-11-01")).toBe("today");
    expect(at("2026-11-04")).toBe("scheduled");
    // A scheduled date even shows for an active customer: the admin asked for it.
  });
});

describe("whatsAppLink", () => {
  it("strips an E.164 phone to digits", () => {
    expect(whatsAppLink("+919876543210")).toBe("https://wa.me/919876543210");
  });
  it("returns null for missing or too-short numbers", () => {
    expect(whatsAppLink(null)).toBeNull();
    expect(whatsAppLink("+12")).toBeNull();
  });
});

describe("addDays", () => {
  it("crosses month ends", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-11-01", 7)).toBe("2026-11-08");
  });
});
