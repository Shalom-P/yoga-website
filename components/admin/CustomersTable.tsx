"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Coins,
  Mail,
  MessageCircle,
  NotebookPen,
  Phone,
  Repeat,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserX,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { dayInIst, formatInTz, DEFAULT_CUSTOMER_TZ } from "@/lib/timezone";
import { formatMoney } from "@/lib/i18n/money";
import {
  STAGE_LABEL,
  addDays,
  needsFollowUpNow,
  whatsAppLink,
  type Lifecycle,
  type LifecycleStage,
} from "@/lib/admin/customerLifecycle";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { FollowUpChannel, FollowUpOutcome, UserRole } from "@/lib/supabase/types";

export type FollowUpEntry = {
  id: string;
  channel: FollowUpChannel;
  outcome: FollowUpOutcome;
  note: string;
  next_follow_up_on: string | null;
  created_at: string;
  author: string | null;
};

type Row = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  timezone: string;
  role: UserRole;
  created_at: string;
  experience_level: "beginner" | "intermediate" | "advanced" | null;
  goals: string[] | null;
  referral_source: string | null;
  marketing_opt_in: boolean;
  credits: number;
  lifecycle: Lifecycle;
  /** Newest first. */
  history: FollowUpEntry[];
};

type Filter =
  | "all"
  | "follow_up"
  | "trial_done"
  | "sessions_left"
  | "pack_used_up"
  | "repeat"
  | "never_booked"
  | "active"
  | "not_interested";

// The lead lists (tried, sessions left, pack used up, never booked) leave out
// anyone marked not interested: that is the whole point of marking them. They
// stay under All and have their own tab.
const FILTERS: { key: Filter; label: string; match: (r: Row) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "follow_up", label: "To follow up", match: (r) => needsFollowUpNow(r.lifecycle) },
  {
    key: "trial_done",
    label: "Tried, not bought",
    match: (r) => r.lifecycle.stage === "trial_done" && !r.lifecycle.notInterested,
  },
  {
    key: "sessions_left",
    label: "Sessions left",
    match: (r) => r.lifecycle.stage === "sessions_left" && !r.lifecycle.notInterested,
  },
  {
    key: "pack_used_up",
    label: "Pack used up",
    match: (r) => r.lifecycle.stage === "pack_used_up" && !r.lifecycle.notInterested,
  },
  { key: "repeat", label: "Repeat buyers", match: (r) => r.lifecycle.isRepeat },
  { key: "active", label: "Active", match: (r) => r.lifecycle.stage === "active" },
  {
    key: "never_booked",
    label: "Never booked",
    match: (r) =>
      (r.lifecycle.stage === "never_booked" || r.lifecycle.stage === "incomplete") &&
      !r.lifecycle.notInterested,
  },
  { key: "not_interested", label: "Not interested", match: (r) => r.lifecycle.notInterested },
];

const STAGE_PILL: Record<LifecycleStage, string> = {
  staff: "myc-pill-gray",
  incomplete: "myc-pill-gray",
  never_booked: "myc-pill-gray",
  trial_upcoming: "myc-pill-teal",
  trial_done: "myc-pill-amber",
  active: "myc-pill-green",
  sessions_left: "myc-pill-amber",
  pack_used_up: "myc-pill-free",
};

// Overdue first, then due today, then the auto-suggested ones.
const FOLLOW_UP_RANK: Record<NonNullable<Lifecycle["followUp"]>, number> = {
  overdue: 0,
  today: 1,
  suggested: 2,
  scheduled: 3,
};

const CHANNELS: { key: FollowUpChannel; label: string; icon: typeof Phone }[] = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "call", label: "Call", icon: Phone },
  { key: "email", label: "Email", icon: Mail },
  { key: "note", label: "Note", icon: NotebookPen },
];

const CHANNEL_LABEL: Record<FollowUpChannel, string> = {
  whatsapp: "WhatsApp",
  call: "Call",
  email: "Email",
  note: "Note",
};

const QUICK_DATES = [
  { label: "2 days", days: 2 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
];

/** Written into the log when "Not interested" is saved without a note. */
const NOT_INTERESTED_DEFAULT_NOTE = "Not interested";

const TH =
  "bg-foreground/4 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap";

// Pill-shaped choice used by the filter bar and the dialog's channel/outcome
// pickers. 36px tall on touch screens, 28px with a pointer.
const CHIP =
  "inline-flex items-center justify-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors min-h-9 sm:min-h-7";
const CHIP_ON = "border-primary bg-primary text-primary-foreground";
const CHIP_OFF = "border-border text-muted-foreground hover:bg-foreground/4 hover:text-foreground";

function shortDay(ymd: string): string {
  return formatInTz(`${ymd}T12:00:00Z`, "UTC", "d MMM");
}

function spentLabel(spent: Record<string, number>): string | null {
  const parts = Object.entries(spent).map(([cur, cents]) => formatMoney(cents, cur));
  return parts.length ? parts.join(" + ") : null;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** The follow-up status line, shared by the table cell and the phone card. */
function FollowUpStatus({ l }: { l: Lifecycle }) {
  if (l.notInterested) {
    return (
      <span className="myc-pill myc-pill-gray inline-flex items-center gap-1">
        <UserX className="size-3" />
        Not interested
      </span>
    );
  }
  if (l.followUp === "overdue" && l.followUpOn) {
    return <span className="font-medium text-destructive">Overdue, {shortDay(l.followUpOn)}</span>;
  }
  if (l.followUp === "today") {
    return <span className="font-medium text-[var(--myc-pill-amber-fg)]">Due today</span>;
  }
  if (l.followUp === "scheduled" && l.followUpOn) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1">
        <CalendarClock className="size-3.5" />
        {shortDay(l.followUpOn)}
      </span>
    );
  }
  if (l.followUp === "suggested") {
    return (
      <span className="text-[var(--myc-pill-amber-fg)]">
        {l.lastContactAt ? "Time to check in" : "Not contacted yet"}
      </span>
    );
  }
  return null;
}

export function CustomersTable({
  rows,
  adminId,
  today,
}: {
  rows: Row[];
  adminId: string;
  /** Studio date (IST), yyyy-MM-dd. */
  today: string;
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<Row | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [demoteTarget, setDemoteTarget] = useState<Row | null>(null);
  const [demoting, setDemoting] = useState(false);
  const [creditTarget, setCreditTarget] = useState<Row | null>(null);
  const [creditAmount, setCreditAmount] = useState("1");
  const [granting, setGranting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [followTarget, setFollowTarget] = useState<Row | null>(null);
  const [fuChannel, setFuChannel] = useState<FollowUpChannel>("whatsapp");
  const [fuOutcome, setFuOutcome] = useState<FollowUpOutcome>("open");
  const [fuNote, setFuNote] = useState("");
  const [fuNext, setFuNext] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  const counts = useMemo(() => {
    const out = {} as Record<Filter, number>;
    for (const f of FILTERS) out[f.key] = rows.filter(f.match).length;
    return out;
  }, [rows]);

  const visible = useMemo(() => {
    const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
    const q = query.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        active.match(r) &&
        (!q ||
          [r.full_name, r.email, r.phone].some((v) => v?.toLowerCase().includes(q)))
    );
    if (filter === "follow_up") {
      list.sort(
        (a, b) =>
          FOLLOW_UP_RANK[a.lifecycle.followUp ?? "scheduled"] -
          FOLLOW_UP_RANK[b.lifecycle.followUp ?? "scheduled"]
      );
    }
    return list;
  }, [rows, filter, query]);

  function openFollowUp(r: Row) {
    setFollowTarget(r);
    setFuChannel(r.phone ? "whatsapp" : "email");
    // Reopening someone marked not interested is the way back in, so the
    // dialog starts on "keep following up" either way.
    setFuOutcome("open");
    setFuNote("");
    setFuNext(addDays(today, 7));
  }

  const closingLead = fuOutcome === "not_interested";
  const canSaveFollowUp = closingLead || fuNote.trim().length > 0;

  async function saveFollowUp() {
    if (!followTarget) return;
    const typed = fuNote.trim();
    if (!typed && !closingLead) {
      toast.error("Write a short note about the contact.");
      return;
    }
    const note = (typed || NOT_INTERESTED_DEFAULT_NOTE).slice(0, 2000);
    setSavingFollowUp(true);
    const { error } = await supabase.from("customer_follow_ups").insert({
      customer_id: followTarget.id,
      author_id: adminId,
      channel: fuChannel,
      outcome: fuOutcome,
      note,
      // A closed lead has no due date (0051 CHECK).
      next_follow_up_on: closingLead ? null : fuNext || null,
    });
    setSavingFollowUp(false);
    if (error) {
      toast.error("Could not save the follow-up. Are migrations 0050 and 0051 applied?");
      return;
    }
    const who = followTarget.full_name ?? followTarget.email ?? "Customer";
    toast.success(
      closingLead
        ? `${who} marked not interested. They are off the follow-up list.`
        : fuNext
          ? `Saved. Next follow-up ${shortDay(fuNext)}.`
          : "Saved. No further follow-up scheduled."
    );
    setFollowTarget(null);
    router.refresh();
  }

  async function promote() {
    if (!target) return;
    setPromoting(true);
    const { error } = await supabase.rpc("promote_to_admin", { target_user_id: target.id });
    setPromoting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${target.full_name ?? target.email} is now an admin.`);
    setTarget(null);
    router.refresh();
  }

  async function demote() {
    if (!demoteTarget) return;
    setDemoting(true);
    const { error } = await supabase.rpc("demote_from_admin", {
      target_user_id: demoteTarget.id,
    });
    setDemoting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${demoteTarget.full_name ?? demoteTarget.email} demoted to customer.`);
    setDemoteTarget(null);
    router.refresh();
  }

  async function addCredits() {
    if (!creditTarget) return;
    const amount = Number(creditAmount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
      toast.error("Enter a whole number between 1 and 100.");
      return;
    }
    setGranting(true);
    const res = await fetch("/api/admin/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: creditTarget.id, amount }),
    });
    setGranting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error ?? "Failed to add credits.");
      return;
    }
    const { balance } = await res.json();
    toast.success(
      `Added ${amount} credit${amount === 1 ? "" : "s"} to ${creditTarget.full_name ?? creditTarget.email}. New balance: ${balance}.`
    );
    setCreditTarget(null);
    setCreditAmount("1");
    router.refresh();
  }

  function closeDelete() {
    setDeleteTarget(null);
    setDeleteConfirm("");
  }

  async function removeUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/customers/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.message ?? body?.error ?? "Failed to delete account.");
      return;
    }
    toast.success(`${deleteTarget.full_name ?? deleteTarget.email ?? "Account"} permanently deleted.`);
    closeDelete();
    router.refresh();
  }

  /** The row actions, shared by the table's last cell and the phone card. */
  function rowActions(c: Row, primary = false) {
    return (
      <>
        <Button size="sm" variant={primary ? "default" : "ghost"} onClick={() => openFollowUp(c)}>
          <NotebookPen className="size-3.5 mr-1" />
          Follow up
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setCreditTarget(c)}>
          <Coins className="size-3.5 mr-1" />
          Add credits
        </Button>
        {c.role !== "admin" ? (
          <Button size="sm" variant="ghost" onClick={() => setTarget(c)}>
            Promote to admin
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setDemoteTarget(c)}
          >
            <ShieldOff className="size-3.5 mr-1" />
            Demote
          </Button>
        )}
        {/* Customers only. Deleting a teacher would unlink their live
            teachers record and revoke every student's document share,
            so those get demoted first (the API refuses them too). */}
        {c.role === "customer" && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(c)}
            aria-label={`Delete ${c.full_name ?? c.email ?? "account"}`}
          >
            <Trash2 className="size-3.5 mr-1" />
            Delete
          </Button>
        )}
      </>
    );
  }

  const followHistoryNewest = followTarget?.history[0];
  const emptyMessage = rows.length === 0 ? "No customers yet." : "Nobody matches this view.";

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Customer filter">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(CHIP, filter === f.key ? CHIP_ON : CHIP_OFF)}
            >
              {f.label}
              <span className="ml-0.5 tabular-nums opacity-70">{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <div className="relative md:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, phone"
            aria-label="Search customers"
            className="pl-8"
          />
        </div>
      </div>

      {/* Phones and the iOS app: one card per customer, with the follow-up
          state and the actions in reach. The 16-column table below put the
          Follow up button a long horizontal scroll away. */}
      <div className="space-y-2 md:hidden">
        {visible.map((c) => {
          const l = c.lifecycle;
          const wa = whatsAppLink(c.phone);
          const lastNote = c.history[0];
          const status = FollowUpStatus({ l });
          return (
            <div key={c.id} className="myc-glass rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.full_name ?? c.email ?? "-"}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={cn("myc-pill", STAGE_PILL[l.stage])}>{STAGE_LABEL[l.stage]}</span>
                    {l.isRepeat && (
                      <span className="myc-pill myc-pill-green inline-flex items-center gap-1">
                        <Repeat className="size-3" />
                        Repeat
                      </span>
                    )}
                  </div>
                </div>
                {status && <div className="shrink-0 text-right text-sm">{status}</div>}
              </div>

              <div className="mt-2 text-xs text-muted-foreground">
                {plural(l.sessionsDone, "session")} done
                {l.upcomingCount > 0 && `, ${l.upcomingCount} booked`}
                {" · "}
                {plural(l.packsBought, "pack")}
                {" · "}
                {c.credits} left
              </div>

              {lastNote && (
                <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  <span className="text-xs">{dayInIst(lastNote.created_at)}: </span>
                  {lastNote.note}
                </div>
              )}

              {(c.phone || c.email) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({ size: "sm", variant: "outline" })}
                    >
                      <MessageCircle className="size-3.5 mr-1" />
                      WhatsApp
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                      <Phone className="size-3.5 mr-1" />
                      Call
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                      <Mail className="size-3.5 mr-1" />
                      Email
                    </a>
                  )}
                </div>
              )}

              <div className="-mx-1 mt-3 flex flex-wrap gap-1 border-t border-border pt-3">
                {rowActions(c, true)}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="myc-glass rounded-xl px-4 py-12 text-center text-muted-foreground">{emptyMessage}</div>
        )}
      </div>

      <div className="myc-glass hidden overflow-x-auto md:block">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr>
              <th className={TH}>Name</th>
              <th className={TH}>Stage</th>
              <th className={TH}>Follow-up</th>
              <th className={TH}>Sessions</th>
              <th className={TH}>Packs</th>
              <th className={TH}>Phone</th>
              <th className={TH}>Email</th>
              <th className={TH}>Credits</th>
              <th className={TH}>Level</th>
              <th className={TH}>Goals</th>
              <th className={TH}>Referral</th>
              <th className={TH}>Mktg</th>
              <th className={TH}>Timezone</th>
              <th className={TH}>Role</th>
              <th className={TH}>Joined</th>
              <th className="bg-foreground/4 px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const l = c.lifecycle;
              const wa = whatsAppLink(c.phone);
              const spent = spentLabel(l.spent);
              const lastNote = c.history[0];
              const status = FollowUpStatus({ l });
              return (
                <tr key={c.id} className="border-t border-border transition-colors hover:bg-foreground/4">
                  <td className="px-4 py-3">{c.full_name ?? "-"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cn("myc-pill", STAGE_PILL[l.stage])}>{STAGE_LABEL[l.stage]}</span>
                    {l.isRepeat && (
                      <span className="myc-pill myc-pill-green ml-1.5 inline-flex items-center gap-1">
                        <Repeat className="size-3" />
                        Repeat
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-[220px]">
                    {status}
                    {!status && !lastNote && <span className="text-muted-foreground">-</span>}
                    {lastNote && (
                      <div
                        className="truncate text-xs text-muted-foreground"
                        title={`${CHANNEL_LABEL[lastNote.channel]}, ${dayInIst(lastNote.created_at)}: ${lastNote.note}`}
                      >
                        {dayInIst(lastNote.created_at)}: {lastNote.note}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="tabular-nums">{l.sessionsDone}</span>
                    <span className="text-muted-foreground"> done</span>
                    {l.upcomingCount > 0 && (
                      <span className="text-muted-foreground">, {l.upcomingCount} booked</span>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {l.nextSessionAt
                        ? `Next ${formatInTz(l.nextSessionAt, DEFAULT_CUSTOMER_TZ, "d MMM")}`
                        : l.lastSessionAt
                          ? `Last ${formatInTz(l.lastSessionAt, DEFAULT_CUSTOMER_TZ, "d MMM")}`
                          : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="tabular-nums">{l.packsBought}</span>
                    {spent && <div className="text-xs text-muted-foreground">{spent}</div>}
                  </td>
                  {/* Stored E.164, so it is dialable as-is. Profiles created
                      before phone became mandatory at sign-up still have none. */}
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {c.phone ? (
                      <span className="inline-flex items-center gap-2">
                        <a href={`tel:${c.phone}`} className="hover:text-foreground hover:underline">
                          {c.phone}
                        </a>
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--myc-pill-green-fg)] hover:opacity-80"
                            aria-label={`WhatsApp ${c.full_name ?? c.phone}`}
                            title="Open WhatsApp chat"
                          >
                            <MessageCircle className="size-4" />
                          </a>
                        )}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email ?? "-"}</td>
                  <td className="px-4 py-3 tabular-nums">{c.credits}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {c.experience_level ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate" title={(c.goals ?? []).join(", ") || undefined}>
                    {(c.goals ?? []).join(", ") || "-"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.referral_source ?? "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.marketing_opt_in ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.timezone}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        c.role === "admin"
                          ? "text-primary font-medium inline-flex items-center gap-1"
                          : "text-muted-foreground"
                      }
                    >
                      {c.role === "admin" && <ShieldCheck className="size-3.5" />}
                      {c.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {dayInIst(c.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {rowActions(c)}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={16} className="text-center px-4 py-12 text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* The follow-up dialog is the one admins use from a phone. On small
          screens it is a bottom sheet with its own scrolling body, so the
          title and the Save button stay in view while the note, dates and
          history scroll; centred dialogs taller than the viewport could not be
          scrolled at all. */}
      <Dialog open={followTarget !== null} onOpenChange={(o) => !o && setFollowTarget(null)}>
        <DialogContent
          className={cn(
            "flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-lg",
            "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0",
            "max-sm:max-h-[92dvh] max-sm:rounded-b-none max-sm:ring-0 max-sm:border-t max-sm:border-border"
          )}
        >
          <DialogHeader className="pr-8">
            <DialogTitle>Follow up with {followTarget?.full_name ?? followTarget?.email}</DialogTitle>
            <DialogDescription>
              {followTarget &&
                `${STAGE_LABEL[followTarget.lifecycle.stage]}. ${plural(followTarget.lifecycle.sessionsDone, "session")} done, ${plural(followTarget.lifecycle.packsBought, "pack")} bought, ${followTarget.credits} left.`}
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-4 min-h-0 flex-1 space-y-4 overflow-y-auto px-4">
            {followTarget?.lifecycle.notInterested && followHistoryNewest && (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-foreground/4 px-3 py-2 text-xs text-muted-foreground">
                <UserX className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Marked not interested on {dayInIst(followHistoryNewest.created_at)}
                  {followHistoryNewest.author ? ` by ${followHistoryNewest.author}` : ""}. Saving a
                  follow-up here puts them back on the list.
                </span>
              </div>
            )}

            {followTarget && (whatsAppLink(followTarget.phone) || followTarget.email) && (
              <div className="flex flex-wrap gap-2">
                {whatsAppLink(followTarget.phone) && (
                  <a
                    href={whatsAppLink(followTarget.phone)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ size: "sm", variant: "outline" })}
                  >
                    <MessageCircle className="size-3.5 mr-1" />
                    Open WhatsApp
                  </a>
                )}
                {followTarget.phone && (
                  <a href={`tel:${followTarget.phone}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                    <Phone className="size-3.5 mr-1" />
                    Call
                  </a>
                )}
                {followTarget.email && (
                  <a href={`mailto:${followTarget.email}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                    <Mail className="size-3.5 mr-1" />
                    Email
                  </a>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">How you reached them</div>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="How you contacted them">
                {CHANNELS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={fuChannel === key}
                    onClick={() => setFuChannel(key)}
                    className={cn(CHIP, fuChannel === key ? CHIP_ON : CHIP_OFF)}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              value={fuNote}
              onChange={(e) => setFuNote(e.target.value)}
              maxLength={2000}
              placeholder={
                closingLead
                  ? "Why, e.g. found a local studio, too expensive right now (optional)"
                  : "What was said, e.g. busy this month, asked to call after Diwali"
              }
              aria-label="Follow-up note"
            />

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">Outcome</div>
              <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Outcome">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!closingLead}
                  onClick={() => setFuOutcome("open")}
                  className={cn(CHIP, !closingLead ? CHIP_ON : CHIP_OFF)}
                >
                  <CalendarClock className="size-3.5" />
                  Keep following up
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={closingLead}
                  onClick={() => setFuOutcome("not_interested")}
                  className={cn(CHIP, closingLead ? CHIP_ON : CHIP_OFF)}
                >
                  <UserX className="size-3.5" />
                  Not interested
                </button>
              </div>
              {closingLead ? (
                <p className="text-xs text-muted-foreground">
                  They leave the follow-up list and the lead views, and show under Not interested.
                  Logging a new follow-up later brings them back.
                </p>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <div className="text-xs font-medium text-muted-foreground">Next follow-up</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {QUICK_DATES.map((o) => (
                      <Button
                        key={o.days}
                        size="sm"
                        variant={fuNext === addDays(today, o.days) ? "default" : "outline"}
                        onClick={() => setFuNext(addDays(today, o.days))}
                      >
                        {o.label}
                      </Button>
                    ))}
                    <Button size="sm" variant={fuNext === "" ? "default" : "outline"} onClick={() => setFuNext("")}>
                      None
                    </Button>
                    <Input
                      type="date"
                      value={fuNext}
                      min={today}
                      onChange={(e) => setFuNext(e.target.value)}
                      aria-label="Next follow-up date"
                      className="h-8 w-full sm:w-auto"
                    />
                  </div>
                </div>
              )}
            </div>

            {followTarget && followTarget.history.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="text-xs font-medium text-muted-foreground">History</div>
                {followTarget.history.map((h) => (
                  <div key={h.id} className="text-sm">
                    <div className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                      <span>
                        {formatInTz(h.created_at, DEFAULT_CUSTOMER_TZ, "d MMM yyyy, h:mm a")} · {CHANNEL_LABEL[h.channel]}
                        {h.author ? ` · ${h.author}` : ""}
                        {h.next_follow_up_on ? ` · next ${shortDay(h.next_follow_up_on)}` : ""}
                      </span>
                      {h.outcome === "not_interested" && (
                        <span className="myc-pill myc-pill-gray">Not interested</span>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap">{h.note}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button variant="outline" onClick={() => setFollowTarget(null)} disabled={savingFollowUp}>
              Cancel
            </Button>
            <Button
              variant={closingLead ? "destructive" : "default"}
              onClick={saveFollowUp}
              disabled={savingFollowUp || !canSaveFollowUp}
            >
              {savingFollowUp ? "Saving…" : closingLead ? "Mark not interested" : "Save follow-up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to admin?</DialogTitle>
            <DialogDescription>
              {target?.full_name ?? target?.email} will get full access to the admin shell. You can
              demote them later from this same table.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={promoting}>
              Cancel
            </Button>
            <Button onClick={promote} disabled={promoting}>
              {promoting ? "Promoting…" : "Promote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={creditTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setCreditTarget(null);
            setCreditAmount("1");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add session credits</DialogTitle>
            <DialogDescription>
              Grant extra credits to {creditTarget?.full_name ?? creditTarget?.email}. Current
              balance: {creditTarget?.credits}. Credits can only be added, never removed.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="number"
            min={1}
            max={100}
            step={1}
            value={creditAmount}
            onChange={(e) => setCreditAmount(e.target.value)}
            aria-label="Credits to add"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreditTarget(null);
                setCreditAmount("1");
              }}
              disabled={granting}
            >
              Cancel
            </Button>
            <Button onClick={addCredits} disabled={granting}>
              {granting ? "Adding…" : "Add credits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={demoteTarget !== null} onOpenChange={(o) => !o && setDemoteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demote from admin?</DialogTitle>
            <DialogDescription>
              {demoteTarget?.full_name ?? demoteTarget?.email} will lose admin access and revert to
              the customer role. Their bookings and data are unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDemoteTarget(null)} disabled={demoting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={demote}
              disabled={demoting}
            >
              {demoting ? "Demoting…" : "Demote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && closeDelete()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this account permanently?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.full_name ?? deleteTarget?.email ?? "This account"} will be removed
              from the studio. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>What happens:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Their upcoming sessions are cancelled and the Meet invites are pulled from the teacher calendars.</li>
              <li>
                Their profile, bookings, health documents and{" "}
                {deleteTarget?.credits ?? 0} unused session
                {deleteTarget?.credits === 1 ? "" : "s"} are destroyed.
              </li>
              <li>Payment records are kept, detached from the person, because tax rules require it.</li>
            </ul>
          </div>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="Type DELETE to confirm"
            aria-label="Type DELETE to confirm"
            autoComplete="off"
          />
          <DialogFooter>
            <Button variant="outline" onClick={closeDelete} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={removeUser}
              disabled={deleting || deleteConfirm.trim().toUpperCase() !== "DELETE"}
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
