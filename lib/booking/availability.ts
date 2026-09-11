/**
 * Re-export of the booking availability rules.
 *
 * The canonical copy lives in `supabase/functions/_shared/availability.ts`
 * because the `book-session` Edge Function must be able to bundle it, and
 * `supabase functions deploy` only reliably bundles files under
 * `supabase/functions/`. Next.js can import from anywhere in the repo, so the
 * dependency points this way rather than the other.
 *
 * Do not add rules here. There is exactly one copy of them, and booking is the
 * flow where a divergence double-books a teacher and spends a credit twice.
 */
export {
  padHms,
  teacherDateISO,
  teacherHms,
  teacherDayOfWeek,
  slotInsideAvailability,
  type AvailabilityWindow,
} from "../../supabase/functions/_shared/availability";
