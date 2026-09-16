"use client";

import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ChevronDownIcon, CheckIcon, SearchIcon, Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AdminCustomerRow, AdminCustomerSearchResponse } from "@/lib/admin/contracts";

export type CustomerOption = AdminCustomerRow;

/** Long enough that a fast typist issues one request, short enough to feel live. */
const DEBOUNCE_MS = 250;
const MIN_QUERY = 1;

// Module-level so the "nothing to offer yet" case keeps a stable identity and
// does not invalidate the options memo on every render.
const NO_OPTIONS: CustomerOption[] = [];

/**
 * Searchable customer picker for the admin surface, backed by
 * GET /api/admin/customers. There is no cmdk in this repo and none is added:
 * this is the same base-ui Combobox composition as components/ui/timezone-select
 * with the built-in filtering turned off (`filter={null}`), because the matching
 * happens in Postgres, not in the browser.
 *
 * Three things the timezone picker does not need and this one does:
 *   * a 250 ms debounce, so a typed name is one query rather than eight;
 *   * an AbortController, so a slow response for "ra" cannot land after the
 *     response for "ravi" and repopulate the list with the wrong people;
 *   * a per-instance query cache, so backspacing is instant and does not re-ask.
 *
 * Each row shows the name on line one and `email - N left` on line two, because
 * two students called Priya are otherwise indistinguishable, and because the
 * prepaid balance is what decides whether the admin can charge this enrolment.
 */
export function CustomerCombobox({
  value,
  onValueChange,
  id,
  placeholder = "Search by name or email",
  excludeIds,
  className,
}: {
  value: CustomerOption | null;
  onValueChange: (customer: CustomerOption | null) => void;
  id?: string;
  placeholder?: string;
  excludeIds?: string[];
  className?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<CustomerOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Per-instance, keyed on the trimmed lowercased query. Not a module-level
  // cache: credit balances are shown here and must not survive the dialog.
  const cache = React.useRef(new Map<string, CustomerOption[]>());

  const q = query.trim();
  const tooShort = q.length < MIN_QUERY;

  // Every setState below happens inside the timer callback, never in the effect
  // body. A synchronous setState in an effect cascades a second render before
  // paint, on every keystroke here (react-hooks/set-state-in-effect). The
  // too-short case therefore clears nothing: `options` derives an empty list
  // from `tooShort` instead, so there is no stale state to reset.
  React.useEffect(() => {
    if (tooShort) return;

    const key = q.toLowerCase();
    const cached = cache.current.get(key);
    const controller = new AbortController();

    // A cache hit still goes through the timer (so the effect body stays free of
    // setState) but with no delay, which keeps backspacing instant.
    const timer = setTimeout(async () => {
      if (cached) {
        setResults(cached);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const body = (await res.json()) as AdminCustomerSearchResponse | { error?: string };
        const customers = "customers" in body && Array.isArray(body.customers) ? body.customers : [];
        cache.current.set(key, customers);
        setResults(customers);
      } catch (err) {
        // An abort is the expected outcome of typing another character, not a
        // failure worth reporting. Anything else leaves the list empty, which
        // the Empty block explains.
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[customer-combobox] search failed:", err);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, cached ? 0 : DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, tooShort]);

  const options = React.useMemo(() => {
    // Derived, not stored: below the minimum query length there is nothing to
    // offer, and deriving it is what lets the effect above avoid a reset.
    if (tooShort) return NO_OPTIONS;
    if (!excludeIds || excludeIds.length === 0) return results;
    const skip = new Set(excludeIds);
    return results.filter((c) => !skip.has(c.id));
  }, [results, excludeIds, tooShort]);

  // An in-flight search that the user backspaces out of never resolves (the
  // cleanup aborts it), so `loading` can stay true with nothing to search for.
  const showLoading = loading && !tooShort;

  const labelFor = React.useCallback(
    (c: CustomerOption) => c.fullName?.trim() || c.email || "Unnamed customer",
    [],
  );

  return (
    <Combobox.Root
      items={options}
      value={value}
      onValueChange={(item: CustomerOption | null) => onValueChange(item)}
      isItemEqualToValue={(a: CustomerOption, b: CustomerOption) => a.id === b.id}
      itemToStringLabel={labelFor}
      // Filtering is the server's job; the browser must not second-guess a
      // result set it did not produce.
      filter={null}
      inputValue={query}
      onInputValueChange={(next: string) => setQuery(next)}
    >
      <Combobox.Trigger
        id={id}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          className,
        )}
      >
        <Combobox.Value>
          {(val: CustomerOption | null) =>
            val ? (
              <span className="line-clamp-1 text-left">{labelFor(val)}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )
          }
        </Combobox.Value>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Positioner side="bottom" sideOffset={4} align="start" className="isolate z-50">
          <Combobox.Popup
            // Lenis hijacks wheel events page-wide; without this the list cannot
            // be scrolled inside the popup.
            data-lenis-prevent
            className="z-50 flex max-h-72 w-[max(var(--anchor-width),18rem)] origin-(--transform-origin) flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              {showLoading ? (
                <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              )}
              <Combobox.Input
                placeholder={placeholder}
                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Combobox.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              {tooShort
                ? "Type a name or email."
                : showLoading
                  ? "Searching..."
                  : "No customer matches that."}
            </Combobox.Empty>
            <Combobox.List className="max-h-60 overflow-y-auto p-1">
              {(item: CustomerOption) => (
                <Combobox.Item
                  key={item.id}
                  value={item}
                  className="relative flex w-full cursor-default flex-col items-start gap-0.5 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span className="line-clamp-1 font-medium">{labelFor(item)}</span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">
                    {item.email ?? "No email"}
                    {" · "}
                    {item.credits} left
                    {item.hasLiveFreeTrial ? " · trial used" : ""}
                  </span>
                  <Combobox.ItemIndicator className="absolute top-2 right-2 flex size-4 items-center justify-center">
                    <CheckIcon className="size-4" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
