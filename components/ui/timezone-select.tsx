"use client";

import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ChevronDownIcon, CheckIcon, SearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { getTimezoneOptions } from "@/lib/timezone";

type TzOption = { value: string; label: string };

/**
 * Searchable timezone picker. The IANA list runs to ~400 zones, so a plain
 * <Select> scroll is unusable (especially on mobile) — this wraps base-ui's
 * Combobox with a search box inside the popup. `value` is an IANA id; the
 * trigger shows a friendly label even if the id isn't in the generated list
 * (e.g. a legacy zone already saved on a profile).
 */
export function TimezoneSelect({
  value,
  onValueChange,
  id,
  className,
  placeholder = "Select your timezone",
}: {
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
}) {
  // The IANA list is stable for the session — compute once.
  const options = React.useMemo(() => getTimezoneOptions(), []);
  // Resolve the current value to an option so the trigger can render its label;
  // synthesise one for an unknown id rather than blanking the field.
  const selected = React.useMemo<TzOption | null>(() => {
    if (!value) return null;
    return (
      options.find((o) => o.value === value) ?? {
        value,
        label: value.replace(/_/g, " "),
      }
    );
  }, [options, value]);

  return (
    <Combobox.Root
      items={options}
      value={selected}
      onValueChange={(item: TzOption | null) => item && onValueChange(item.value)}
      isItemEqualToValue={(a: TzOption, b: TzOption) => a.value === b.value}
    >
      <Combobox.Trigger
        id={id}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          className
        )}
      >
        <Combobox.Value>
          {(val: TzOption | null) =>
            val ? (
              <span className="line-clamp-1 text-left">{val.label}</span>
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
            data-lenis-prevent
            className="z-50 flex max-h-72 w-[max(var(--anchor-width),16rem)] origin-(--transform-origin) flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <Combobox.Input
                placeholder="Search timezones…"
                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Combobox.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              No timezones found.
            </Combobox.Empty>
            <Combobox.List className="max-h-60 overflow-y-auto p-1">
              {(item: TzOption) => (
                <Combobox.Item
                  key={item.value}
                  value={item}
                  className="relative flex w-full cursor-default items-center rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span className="line-clamp-1 flex-1">{item.label}</span>
                  <Combobox.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
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
