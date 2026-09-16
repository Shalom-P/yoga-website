-- 0039_admin_overrides_and_manual_payments.sql
--
-- Two capabilities the schema could not express, plus four latent bugs the
-- first of them would otherwise walk straight into.
--
-- A. ADMIN ASSIGNMENT POWERS
--    `book_session` (0017, current body 0021) is the ONLY code path in this repo
--    that inserts a row into public.bookings, and it always CREATES a session:
--    it takes p_teacher/p_start/p_end, never a session id, and hard-codes
--    capacity 1. Consequences today: an admin cannot put an existing customer
--    into an existing class, a session with capacity > 1 can never be filled,
--    and sessions.capacity is enforced NOWHERE. The admin "cancel one booking"
--    that does exist is a raw browser UPDATE (components/admin/BookingsAdmin.tsx)
--    that never calls refund_session_credit, so it silently destroys a paid
--    credit. So does the admin cancel-whole-session cascade
--    (app/api/admin/sessions/route.ts DELETE).
--
-- B. MANUAL PAYMENT ENTRY
--    payments has no provenance columns, so a hand-entered row is
--    indistinguishable from one the webhook wrote, and there is no method value
--    for an offline receipt that carries no Razorpay id.
--
-- The load-bearing change is the bookings uniqueness swap. `unique (session_id,
-- customer_id)` from 0003 is TOTAL, so a cancelled booking occupies the pair
-- forever and "re-add the student who cancelled" raises 23505. Resurrecting the
-- row instead is worse: credit_ledger_booking_refund_once (0021) is unique on
-- booking_id, so a resurrected booking could never be refunded a second time and
-- the customer silently loses a paid session. A PARTIAL unique on non-cancelled
-- rows preserves the real invariant (one LIVE booking per customer per session)
-- while giving every enrolment its own row, which is what lets
-- refund_session_credit stay EXACTLY as it is. That function is called from the
-- Deno cancel-booking Edge Function as well as the Node route; it is not touched
-- here on purpose.
--
-- Single begin/commit: there is no `ALTER TYPE ... ADD VALUE` anywhere below
-- (the manual rail reuses payment_status, credit corrections reuse the existing
-- credit_reason labels), so the transaction is legal per the rule 0020/0022 set.
--
-- Apply:  psql "$SUPABASE_DB_URL" -f supabase/migrations/0039_admin_overrides_and_manual_payments.sql
--
-- Verify after:
--   select indexdef from pg_indexes where indexname = 'bookings_one_live_per_session';
--   select count(*) from pg_proc where proname in
--     ('admin_enrol_booking','admin_cancel_booking','admin_set_booking_attendance',
--      'admin_move_booking','admin_update_session','admin_cancel_session',
--      'list_booked_teachers');  -- expect 7
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'payments_method_check';
--   select polname from pg_policy p join pg_class c on c.oid = p.polrelid
--    where c.relname = 'sessions';  -- sessions_public_read_scheduled must be GONE
--   select polname from pg_policy p join pg_class c on c.oid = p.polrelid
--    where c.relname = 'bookings';  -- bookings_self_insert must be GONE
--   \d public.meet_orphan_events
--
-- Rollback note: the two dropped policies are recreatable from 0003/0007 if
-- something unexpected depends on them, but do NOT recreate them casually --
-- between them they let any authenticated user read the Meet link of any
-- scheduled class (see sections 4 and 4b). Recreate the FEATURE that needed
-- them instead.

begin;

-- ===========================================================================
-- 1. bookings: total unique -> partial unique on LIVE rows
-- ===========================================================================
-- The 0003 constraint was declared inline and is therefore auto-named
-- (bookings_session_id_customer_id_key on a stock install). Discover it rather
-- than guess, the same way 0038 and 0035 do. NOTE lib/db/schema.ts claims a
-- third name, bookings_session_customer_uq, that has never existed in the live
-- DB. Do not trust it.

do $$
declare
  v_name text;
begin
  select con.conname into v_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'bookings'
    and con.contype = 'u'
    and pg_get_constraintdef(con.oid) ilike '%(session_id, customer_id)%'
  limit 1;

  if v_name is not null then
    execute format('alter table public.bookings drop constraint %I', v_name);
  end if;
end $$;

-- Safe to build: the constraint just dropped guaranteed no duplicate pair exists,
-- and this index is strictly looser than it was.
create unique index if not exists bookings_one_live_per_session
  on public.bookings (session_id, customer_id)
  where status <> 'cancelled';

comment on index public.bookings_one_live_per_session is
  'One LIVE booking per customer per session. Deliberately partial: a cancelled booking must not block a re-enrol, and each enrolment needs its own booking_id so credit_ledger_booking_refund_once (0021) stays meaningful.';

-- ===========================================================================
-- 2. bookings: provenance + credit outcome on the row itself
-- ===========================================================================
-- Without these, reconciling from bookings + credit_ledger alone cannot tell a
-- deliberate no-refund late cancel from the BookingsAdmin bug this migration
-- exists to fix.

alter table public.bookings
  add column if not exists comped boolean not null default false,
  add column if not exists credit_refunded boolean not null default false,
  add column if not exists moved_from_session_id uuid
    references public.sessions(id) on delete set null,
  add column if not exists enrolled_by uuid
    references public.profiles(id) on delete set null;

comment on column public.bookings.comped is
  'Admin enrolled this student without charging a session credit. No booking_spend ledger row exists for it, and cancelling it must never refund.';
comment on column public.bookings.credit_refunded is
  'A refund ledger row landed for this booking. Set by admin_cancel_booking, admin_cancel_session and both customer cancel paths; read by the roster UI so a no-refund cancel is visibly deliberate.';

-- Backfill from the ledger, which is the actual record of what happened. The
-- column defaults to false, so without this EVERY booking cancelled before 0039
-- would render as "No refund" in the roster and the bookings queue -- the exact
-- deliberate-vs-bug distinction the column was added to make. credit_ledger is
-- authoritative here: refund_session_credit (0021) writes one row per booking
-- and credit_ledger_booking_refund_once makes it at most one, so this cannot
-- double-count. Guarded on the current value so a re-run is a no-op.
update public.bookings b
   set credit_refunded = true
 where b.credit_refunded = false
   and exists (
     select 1 from public.credit_ledger l
      where l.booking_id = b.id and l.reason = 'refund'
   );
comment on column public.bookings.moved_from_session_id is
  'Set by admin_move_booking on the repointed row.';
comment on column public.bookings.enrolled_by is
  'The admin who put this student in the class. NULL for a customer self-booking through book_session.';

-- ===========================================================================
-- 3. sessions.capacity becomes real
-- ===========================================================================
-- capacity has existed since 0003 and is enforced by nothing. The RPCs below
-- lock the session and count, but this trigger is the backstop for EVERY writer
-- (including any future one), and the FOR UPDATE inside it serialises the
-- count-then-insert so two concurrent enrolments cannot both take the last seat.

create or replace function public.tg_bookings_enforce_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_capacity int;
  v_live int;
begin
  if new.status = 'cancelled' then
    return new;
  end if;
  -- Only re-check when the row is entering or moving between sessions, or
  -- coming back from cancelled. A plain attendance flip must not pay for a lock.
  if tg_op = 'UPDATE'
     and old.session_id = new.session_id
     and old.status <> 'cancelled' then
    return new;
  end if;

  select capacity into v_capacity from public.sessions where id = new.session_id for update;
  if v_capacity is null then
    return new;  -- the FK rejects a bad session_id; nothing to enforce here
  end if;

  select count(*) into v_live
    from public.bookings
   where session_id = new.session_id
     and status <> 'cancelled'
     and id <> new.id;

  if v_live + 1 > v_capacity then
    raise exception 'session_full' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists bookings_enforce_capacity on public.bookings;
create trigger bookings_enforce_capacity
  before insert or update of session_id, status on public.bookings
  for each row execute function public.tg_bookings_enforce_capacity();

-- ===========================================================================
-- 4. sessions: stop leaking meet_link and notes to anon
-- ===========================================================================
-- sessions_public_read_scheduled (widened by 0007 to drop the start_at filter)
-- is `using (status in ('scheduled','live'))` with NO auth requirement, and it
-- exposes the WHOLE row: meet_link and notes included. Anyone could read the
-- join link of any scheduled class. Nothing in app/, lib/, components/ or
-- supabase/functions reads public.sessions anonymously (verified by grep):
-- create-link proves ownership through bookings and then reads under
-- sessions_booked_customer_read (0003), the dashboard reads sessions embedded
-- through bookings under that same policy, the (marketing) group performs no
-- sessions read at all, admins use sessions_admin_all, teachers use
-- sessions_teacher_read (0025), and cron / Edge Functions / fulfilment all run
-- on the service role. Drop it.

drop policy if exists "sessions_public_read_scheduled" on public.sessions;

comment on column public.sessions.notes is
  'Internal admin note. Since 0039 this row is no longer anon-readable, so it is genuinely private to admins and the booked customer. Still not for health context: the booked customer can read it.';

-- ===========================================================================
-- 4a. sessions: let a customer still see their OWN cancelled bookings
-- ===========================================================================
-- sessions_booked_customer_read (0003) requires `b.status != 'cancelled'`, so
-- with the anon policy gone a customer's CANCELLED bookings would embed a null
-- session. app/(dashboard)/dashboard/bookings/page.tsx selects bookings of every
-- status and embeds session:sessions(...), so the booking history would render
-- rows with no date, no teacher and no class name. That is the same
-- cancelled-booking blind spot section 4c fixes for the health-document
-- dropdown; it applies here too, and dropping the anon policy without this
-- would be a straight regression for every customer who has ever cancelled.
--
-- The honest trade-off, recorded so nobody has to rediscover it:
-- widening this policy means someone who cancelled a booking on a GROUP class
-- (capacity > 1) can still read that session row, including meet_link, while
-- other attendees keep the class alive. app/api/bookings/cancel deliberately
-- does not delete the Calendar event while others remain, and
-- releaseSessionMeet never nulls sessions.meet_link, so that link stays valid.
-- It is not a regression (today sessions_public_read_scheduled hands the same
-- link to the entire internet, unauthenticated) and the exposed population goes
-- from "everyone" to "people who actually booked this class", but it is not
-- zero. It is also currently near-empty: book_session hardcodes capacity 1, so
-- group classes exist only where an admin made one.
--
-- Closing the remainder needs column-level protection, which row-level security
-- cannot express: either meet_link moves behind a view / RPC that withholds it
-- for cancelled bookings, or it is nulled once a customer leaves. Both are
-- bigger than this migration and neither blocks it.

drop policy if exists "sessions_booked_customer_read" on public.sessions;
create policy "sessions_booked_customer_read"
  on public.sessions for select
  using (exists (
    select 1 from public.bookings b
    where b.session_id = sessions.id and b.customer_id = auth.uid()
  ));

-- ===========================================================================
-- 4b. bookings: drop the self-grant that made the leak above exploitable
-- ===========================================================================
-- bookings_self_insert (0003) is `for insert with check (auth.uid() =
-- customer_id)`. It constrains WHO the row is for and nothing else: no
-- session_id constraint, no capacity check, no payment check. So any
-- authenticated user who knows a session UUID could insert a booking row for
-- it, thereby satisfying sessions_booked_customer_read (0003) and reading that
-- session's meet_link -- i.e. joining a stranger's private 1:1 class. Until the
-- drop above, session UUIDs were not even secret: anon could enumerate every
-- scheduled session (and read meet_link directly, skipping the booking step).
-- The two policies composed into a working attack; dropping only the anon one
-- would leave the self-grant standing behind it.
--
-- It is safe to drop because NOTHING uses it. There is no .insert() against
-- public.bookings on any RLS-bound client anywhere in the repo (verified by
-- grep across app/, lib/, components/, supabase/functions/). Every booking
-- insert happens inside book_session (0017, current body 0021) or the
-- admin_* functions below, all SECURITY DEFINER, all of which bypass RLS.
-- Customers keep bookings_self_read and the narrowed bookings_self_update_cancel
-- (0018), so self-service cancel is unaffected.
--
-- This also bounds the partial unique added in section 1: with the total unique
-- gone, a customer could otherwise self-insert and self-cancel the same
-- (session, customer) pair without limit and accumulate cancelled rows.

drop policy if exists "bookings_self_insert" on public.bookings;

-- ===========================================================================
-- 4c. list_booked_teachers(): the health-doc share list, without session rows
-- ===========================================================================
-- lib/medical/documents.ts builds "teachers you may share a document with" by
-- selecting session:sessions(teacher:teachers(...)) off bookings with NO
-- booking-status filter. That read depended on the anon policy dropped above:
-- sessions_booked_customer_read only covers non-cancelled bookings, so a
-- cancelled booking on a still-scheduled session used to contribute a teacher
-- purely through the public policy. Dropping that policy alone would silently
-- shrink the list.
--
-- The share GATE, customer_booked_teacher (0027), has no status filter at all:
-- `where b.customer_id = uid and s.teacher_id = t_id`. So the intent is "any
-- teacher you have ever booked" and the dropdown was the thing that was wrong.
--
-- Section 4a does now widen that policy, for the dashboard's sake, so the join
-- would technically work again. This RPC still earns its place: it returns the
-- teacher columns and nothing else, so the dropdown stops depending on session
-- row visibility at all, and it is defined in the same shape as the gate, so
-- the two cannot drift apart again the way they already did once. It also means
-- that if 4a's widening is ever narrowed back to close the meet_link remainder
-- noted there, this list does not silently shrink a second time.

create or replace function public.list_booked_teachers()
returns table (teacher_id uuid, display_name text)
language sql security definer set search_path = public stable as $$
  select distinct t.id, t.display_name
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  join public.teachers t on t.id = s.teacher_id
  where b.customer_id = auth.uid()
  order by t.display_name;
$$;

-- auth.uid() scopes this to the caller, so unlike the admin_* functions below
-- it is granted to authenticated rather than reserved to the service role.
revoke execute on function public.list_booked_teachers() from public, anon;
grant execute on function public.list_booked_teachers() to authenticated;

-- ===========================================================================
-- 5. Orphaned Google Calendar events
-- ===========================================================================
-- A reschedule must delete the old event and create a new one (lib/google/
-- calendar.ts has createMeetEvent / findMeetEventBySession / deleteMeetEvent and
-- NO patch-time helper). If the process dies between the DB commit and the
-- Google delete, the event id is already gone from sessions and nothing will
-- ever remove that event. Record it here inside the transaction; cron/meet-retry
-- sweeps it.

create table if not exists public.meet_orphan_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  calendar_id text,
  session_id uuid references public.sessions(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  attempts int not null default 0
);
create unique index if not exists meet_orphan_events_live_key
  on public.meet_orphan_events (event_id)
  where deleted_at is null;
create index if not exists meet_orphan_events_pending_idx
  on public.meet_orphan_events (created_at)
  where deleted_at is null;

alter table public.meet_orphan_events enable row level security;
-- No policies at all: service-role only (cron + admin routes).

-- ===========================================================================
-- 6. audit_log: entity lookups
-- ===========================================================================
-- audit_log has only audit_log_created_at_idx (0005), so "what happened to this
-- booking" is a seq scan. Every RPC below writes an entity-keyed row and the
-- roster screen reads them back.

create index if not exists audit_log_entity_idx
  on public.audit_log (entity_type, entity_id, created_at desc);

-- ===========================================================================
-- 7. payments: provenance for a hand-entered row
-- ===========================================================================
-- entry_source is a NEW COLUMN, not a new payments.method value: a manually
-- entered Razorpay payment is still method='razorpay'. A new method value would
-- silently change the meaning of payments_bank_transfer_idx (0030),
-- payments_one_pending_bank_transfer (0030) and app/admin/payments/page.tsx.
-- 'manual' IS added to the method check, but only for an offline receipt that
-- has no Razorpay id at all (cash, a UPI transfer reconciled elsewhere).

alter table public.payments
  add column if not exists entry_source text,
  add column if not exists recorded_by uuid references public.profiles(id) on delete set null,
  add column if not exists admin_note text,
  add column if not exists reconciled_at timestamptz;

update public.payments
   set entry_source = case
         when method = 'bank_transfer'      then 'bank_transfer'
         when paypal_capture_id is not null then 'legacy'
         else 'razorpay_auto'
       end
 where entry_source is null;

alter table public.payments alter column entry_source set default 'razorpay_auto';
alter table public.payments alter column entry_source set not null;

-- payments_self_read (0004) is `for select using (auth.uid() = customer_id)`
-- and exposes the WHOLE row, so admin_note is readable by the customer it is
-- about. Row-level security cannot withhold a single column, and narrowing that
-- policy would need a view that every existing customer read would have to move
-- to. So the column is documented as customer-visible and the Record-payment
-- dialog labels it that way, rather than promising a privacy property the
-- schema does not provide. Anything genuinely internal belongs in audit_log,
-- which has an admin-only read policy (0005).
comment on column public.payments.admin_note is
  'Reconciliation note shown to admins. NOT private: payments_self_read (0004) lets the customer read their own payment row in full, this column included. Keep internal commentary in audit_log instead.';

alter table public.payments drop constraint if exists payments_entry_source_check;
alter table public.payments add constraint payments_entry_source_check
  check (entry_source in (
    'razorpay_auto',            -- lib/razorpay/fulfillment.ts
    'bank_transfer',            -- app/api/payments/intent/route.ts
    'admin_manual',             -- hand-entered, not yet seen by a webhook
    'admin_manual_reconciled',  -- hand-entered, later confirmed by Razorpay
    'legacy'                    -- pre-Razorpay PayPal rows
  ));

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('razorpay', 'bank_transfer', 'paypal', 'manual'));

-- A hand-entered row carries a Razorpay payment id IF AND ONLY IF it claims the
-- Razorpay rail. Without this, an admin could file a real Razorpay payment as
-- 'manual' with a NULL razorpay_payment_id, and since
-- payments_razorpay_payment_id_key is NULLS DISTINCT (0033) nothing would dedupe
-- it against the webhook's own row later. Scoped to admin-entered rows so
-- legacy data is not re-validated.
alter table public.payments drop constraint if exists payments_manual_ids_check;
alter table public.payments add constraint payments_manual_ids_check
  check (
    entry_source not in ('admin_manual', 'admin_manual_reconciled')
    or ((method = 'razorpay') = (razorpay_payment_id is not null))
  );

comment on column public.payments.entry_source is
  'How the row got here, not how the money moved (that is method). admin_manual rows are protected from paid_at / customer_id clobber by lib/razorpay/fulfillment.ts when the real webhook later arrives.';
comment on column public.payments.recorded_by is
  'The admin who hand-entered the row. Distinct from verified_by, which is whoever released the credits.';

-- /admin/payments stops filtering on method, so it needs a plain recency index,
-- and hand-entered rows need to be findable as a class.
create index if not exists payments_created_at_idx
  on public.payments (created_at desc);
create index if not exists payments_entry_source_idx
  on public.payments (entry_source, created_at desc)
  where entry_source in ('admin_manual', 'admin_manual_reconciled');

-- ===========================================================================
-- 8. RPCs
-- ===========================================================================
-- All of these move credits or override booking invariants, so they are
-- service-role only (EXECUTE revoked at the end), matching book_session (0017),
-- grant_session_credits (0011) and refund_session_credit (0021). The route
-- handler does the admin gate; p_acting_admin is passed EXPLICITLY because
-- auth.uid() is NULL on the service-role client, the same reason
-- promote_to_teacher takes acting_admin_id (0025).
--
-- Each one writes exactly one audit_log row for the action it performed, and
-- entity_id is cast to text because audit_log.entity_id is TEXT (0005).

-- 8a. Enrol an existing customer into an EXISTING session -------------------
-- Deliberately does NOT re-check the teacher's availability window or the
-- one-off blocked-date list. book_session bakes the blocklist in because a
-- CUSTOMER is picking a slot; here an admin has decided this class exists and
-- the override is the point. The route surfaces it as a non-blocking warning.

create or replace function public.admin_enrol_booking(
  p_session uuid,
  p_customer uuid,
  p_is_free_trial boolean default false,
  p_charge_credit boolean default true,
  p_acting_admin uuid default null,
  p_reason text default null
) returns table (booking_id uuid, charged boolean, comped boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_capacity int;
  v_status public.session_status;
  v_live int;
  v_id uuid;
  v_charged boolean := false;
  v_comped boolean := false;
  v_spent boolean;
begin
  if p_acting_admin is null or not public.is_admin(p_acting_admin) then
    raise exception 'admin_only' using errcode = 'P0001';
  end if;

  select capacity, status into v_capacity, v_status
    from public.sessions where id = p_session for update;
  if not found then raise exception 'session_not_found' using errcode = 'P0001'; end if;
  if v_status in ('cancelled', 'completed') then
    raise exception 'session_not_open' using errcode = 'P0001';
  end if;

  -- Never enrol a teacher or admin account as a student.
  if not exists (select 1 from public.profiles where id = p_customer and role = 'customer') then
    raise exception 'customer_not_eligible' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.bookings
     where session_id = p_session and customer_id = p_customer and status <> 'cancelled'
  ) then
    raise exception 'already_enrolled' using errcode = 'P0001';
  end if;

  -- Friendly pre-check for bookings_one_free_trial_per_customer (0007). The
  -- partial unique index is still the real defence; this avoids a bare 23505.
  if coalesce(p_is_free_trial, false) and exists (
    select 1 from public.bookings
     where customer_id = p_customer and is_free_trial and status <> 'cancelled'
  ) then
    raise exception 'trial_already_claimed' using errcode = 'P0001';
  end if;

  select count(*) into v_live
    from public.bookings where session_id = p_session and status <> 'cancelled';
  if v_live >= coalesce(v_capacity, 1) then
    raise exception 'session_full' using errcode = 'P0001';
  end if;

  if coalesce(p_is_free_trial, false) then
    v_charged := false;            -- the complimentary first session never spends
  elsif coalesce(p_charge_credit, true) then
    -- Same atomic conditional UPDATE as book_session (0021): two concurrent
    -- enrolments cannot both spend the last credit, and any failure below rolls
    -- the reservation back with the transaction.
    update public.customer_credits
       set balance = balance - 1, updated_at = now()
     where customer_id = p_customer and balance > 0
    returning true into v_spent;
    if v_spent is null then
      raise exception 'insufficient_credits' using errcode = 'P0001';
    end if;
    v_charged := true;
  else
    v_comped := true;
  end if;

  insert into public.bookings
    (session_id, customer_id, is_free_trial, status, comped, enrolled_by)
  values
    (p_session, p_customer, coalesce(p_is_free_trial, false), 'confirmed', v_comped, p_acting_admin)
  returning id into v_id;

  if v_charged then
    insert into public.credit_ledger (customer_id, delta, reason, booking_id)
    values (p_customer, -1, 'booking_spend', v_id);
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, payload)
  values (p_acting_admin, 'admin_enrol_booking', 'booking', v_id::text,
          jsonb_build_object(
            'session_id', p_session, 'customer_id', p_customer,
            'is_free_trial', coalesce(p_is_free_trial, false),
            'charged', v_charged, 'comped', v_comped, 'reason', p_reason));

  return query select v_id, v_charged, v_comped;
end $$;

-- 8b. Remove ONE student from a session ------------------------------------
-- Replaces components/admin/BookingsAdmin.tsx's raw browser UPDATE, which never
-- refunds. p_refund is explicit and always logged: refunding a late no-show
-- would be wrong, and so would silently burning a credit the studio owes back.
-- Meet teardown stays in the route (Postgres has no Google credentials).

create or replace function public.admin_cancel_booking(
  p_booking uuid,
  p_refund boolean,
  p_acting_admin uuid default null,
  p_reason text default null
) returns table (
  customer_id uuid,
  session_id uuid,
  refunded boolean,
  session_now_empty boolean
)
language plpgsql security definer set search_path = public as $$
declare
  v_row public.bookings%rowtype;
  v_hit int;
  v_refunded boolean := false;
  v_remaining int;
begin
  if p_acting_admin is null or not public.is_admin(p_acting_admin) then
    raise exception 'admin_only' using errcode = 'P0001';
  end if;

  select * into v_row from public.bookings where id = p_booking for update;
  if not found then raise exception 'booking_not_found' using errcode = 'P0001'; end if;
  if v_row.status = 'cancelled' then
    raise exception 'already_cancelled' using errcode = 'P0001';
  end if;

  -- Optimistic guard, mirroring app/api/bookings/cancel/route.ts, so a
  -- concurrent cancel cannot make us refund twice.
  update public.bookings
     set status = 'cancelled',
         cancellation_reason = coalesce(p_reason, 'cancelled_by_admin'),
         cancelled_at = now()
   where id = p_booking and status <> 'cancelled';
  get diagnostics v_hit = row_count;
  if v_hit = 0 then raise exception 'already_cancelled' using errcode = 'P0001'; end if;

  -- A free-trial booking never spent a credit; nor did a comped one.
  if coalesce(p_refund, false) and not v_row.is_free_trial and not v_row.comped then
    v_refunded := public.refund_session_credit(v_row.customer_id, p_booking);
    if v_refunded then
      update public.bookings set credit_refunded = true where id = p_booking;
    end if;
  end if;

  -- Aliased and fully qualified: this function's RETURNS TABLE declares
  -- session_id and customer_id, so a bare column name here resolves to the
  -- OUT variable instead and Postgres raises 42702 "column reference is
  -- ambiguous" at RUNTIME. Nothing catches that before a live call.
  select count(*) into v_remaining
    from public.bookings b
   where b.session_id = v_row.session_id and b.status <> 'cancelled';

  insert into public.audit_log (actor_id, action, entity_type, entity_id, payload)
  values (p_acting_admin, 'admin_cancel_booking', 'booking', p_booking::text,
          jsonb_build_object(
            'session_id', v_row.session_id, 'customer_id', v_row.customer_id,
            'was_status', v_row.status, 'is_free_trial', v_row.is_free_trial,
            'comped', v_row.comped, 'refund_requested', coalesce(p_refund, false),
            'refund_applied', v_refunded, 'reason', p_reason));

  return query select v_row.customer_id, v_row.session_id, v_refunded, (v_remaining = 0);
end $$;

-- 8c. Attendance, including the walk-back ----------------------------------
-- Credit-neutral by construction: attendance never touches the ledger. The
-- p_expected_status guard is what stops this racing cron/no-show-sweep, which
-- flips confirmed -> no_show two hours after every class ends.

create or replace function public.admin_set_booking_attendance(
  p_booking uuid,
  p_status public.booking_status,
  p_expected_status public.booking_status default null,
  p_acting_admin uuid default null,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prev public.booking_status;
begin
  if p_acting_admin is null or not public.is_admin(p_acting_admin) then
    raise exception 'admin_only' using errcode = 'P0001';
  end if;
  if p_status not in ('attended', 'no_show', 'confirmed') then
    raise exception 'bad_status' using errcode = 'P0001';
  end if;

  select status into v_prev from public.bookings where id = p_booking for update;
  if v_prev is null then raise exception 'booking_not_found' using errcode = 'P0001'; end if;
  if v_prev = 'cancelled' then
    -- Un-cancelling is enrolment, not attendance: it must re-spend a credit and
    -- re-check capacity, so it goes through admin_enrol_booking.
    raise exception 'booking_cancelled' using errcode = 'P0001';
  end if;
  if p_expected_status is not null and v_prev <> p_expected_status then
    raise exception 'status_changed' using errcode = 'P0001';
  end if;

  update public.bookings set status = p_status where id = p_booking;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, payload)
  values (p_acting_admin, 'admin_set_attendance', 'booking', p_booking::text,
          jsonb_build_object('from', v_prev, 'to', p_status, 'reason', p_reason));
end $$;

-- 8d. Move a student to another session ------------------------------------
-- ONE row repointed. No refund, no re-spend, no ledger rows at all, so a move
-- is credit-neutral by construction rather than by arithmetic, and a customer
-- with zero spare credits can always be moved. This is only possible because
-- bookings_one_live_per_session (section 1) is partial: a cancelled row on the
-- target no longer blocks the pair, so there is no fallback branch to get wrong.

create or replace function public.admin_move_booking(
  p_booking uuid,
  p_target_session uuid,
  p_acting_admin uuid default null,
  p_reason text default null
) returns table (
  booking_id uuid,
  customer_id uuid,
  source_session uuid,
  source_now_empty boolean
)
language plpgsql security definer set search_path = public as $$
declare
  v_row public.bookings%rowtype;
  v_capacity int;
  v_sstatus public.session_status;
  v_live int;
  v_remaining int;
begin
  if p_acting_admin is null or not public.is_admin(p_acting_admin) then
    raise exception 'admin_only' using errcode = 'P0001';
  end if;

  -- Lock the target session BEFORE the booking. A consistent order across
  -- concurrent moves avoids a deadlock between two admins swapping students.
  select capacity, status into v_capacity, v_sstatus
    from public.sessions where id = p_target_session for update;
  if not found then raise exception 'target_not_found' using errcode = 'P0001'; end if;
  if v_sstatus in ('cancelled', 'completed') then
    raise exception 'target_not_open' using errcode = 'P0001';
  end if;

  select * into v_row from public.bookings where id = p_booking for update;
  if not found then raise exception 'booking_not_found' using errcode = 'P0001'; end if;
  if v_row.status = 'cancelled' then raise exception 'booking_cancelled' using errcode = 'P0001'; end if;
  if v_row.session_id = p_target_session then raise exception 'same_session' using errcode = 'P0001'; end if;

  -- Aliased for the same reason as admin_cancel_booking above: customer_id is
  -- one of this function's OUT columns, so an unqualified reference is ambiguous.
  if exists (
    select 1 from public.bookings b
     where b.session_id = p_target_session and b.customer_id = v_row.customer_id
       and b.status <> 'cancelled'
  ) then
    raise exception 'already_enrolled' using errcode = 'P0001';
  end if;

  select count(*) into v_live
    from public.bookings where session_id = p_target_session and status <> 'cancelled';
  if v_live >= coalesce(v_capacity, 1) then
    raise exception 'session_full' using errcode = 'P0001';
  end if;

  -- The time changed, so the 0016 reminder claims must be released or the cron
  -- (which claims each window exactly once via a conditional UPDATE on IS NULL)
  -- stays silent for the new time forever.
  update public.bookings
     set session_id = p_target_session,
         moved_from_session_id = v_row.session_id,
         reminded_at_24h = null,
         reminded_at_1h = null
   where id = p_booking;

  select count(*) into v_remaining
    from public.bookings where session_id = v_row.session_id and status <> 'cancelled';

  insert into public.audit_log (actor_id, action, entity_type, entity_id, payload)
  values (p_acting_admin, 'admin_move_booking', 'booking', p_booking::text,
          jsonb_build_object(
            'from_session', v_row.session_id, 'to_session', p_target_session,
            'customer_id', v_row.customer_id, 'reason', p_reason));

  return query select p_booking, v_row.customer_id, v_row.session_id, (v_remaining = 0);
end $$;

-- 8e. Edit a session --------------------------------------------------------
-- sessions are write-once today: app/api/admin/sessions/route.ts exports only
-- POST and DELETE. A time or teacher change can raise 23P01 from the
-- sessions_no_overlap EXCLUDE constraint (0017); that propagates to the caller
-- unchanged and is mapped to slot_taken there. The existing POST handler does
-- NOT translate 23P01 (it falls through to create_failed 500). Do not copy it.
--
-- PHI: reassigning the teacher does not fire teachers_revoke_shares_on_unlink
-- (0028), which is keyed on teachers.profile_id. Since share_medical_document is
-- gated by customer_booked_teacher (0027), the grant's premise is gone once the
-- booking relationship is. But revoking is destructive and only the CUSTOMER can
-- re-share, so it is OPT-IN (p_revoke_phi_shares) and the route previews the
-- count first.

create or replace function public.admin_update_session(
  p_session uuid,
  p_teacher uuid default null,
  p_class_category_id uuid default null,
  p_clear_category boolean default false,
  p_start timestamptz default null,
  p_end timestamptz default null,
  p_capacity int default null,
  p_notes text default null,
  p_set_notes boolean default false,
  p_revoke_phi_shares boolean default false,
  p_acting_admin uuid default null,
  p_reason text default null
) returns table (
  meet_action text,
  phi_shares_revoked int,
  phi_shares_affected int,
  reminders_reset int,
  enrolled int
)
language plpgsql security definer set search_path = public as $$
declare
  v_old public.sessions%rowtype;
  v_teacher uuid; v_category uuid;
  v_start timestamptz; v_end timestamptz; v_capacity int;
  v_time_moved boolean; v_teacher_moved boolean;
  v_enrolled int; v_phi int := 0; v_phi_affected int := 0;
  v_rem int := 0; v_meet text := 'none';
begin
  if p_acting_admin is null or not public.is_admin(p_acting_admin) then
    raise exception 'admin_only' using errcode = 'P0001';
  end if;

  select * into v_old from public.sessions where id = p_session for update;
  if not found then raise exception 'session_not_found' using errcode = 'P0001'; end if;
  if v_old.status = 'cancelled' then raise exception 'session_cancelled' using errcode = 'P0001'; end if;

  v_teacher  := coalesce(p_teacher, v_old.teacher_id);
  v_category := case when p_clear_category then null
                     else coalesce(p_class_category_id, v_old.class_category_id) end;
  v_start    := coalesce(p_start, v_old.start_at);
  v_end      := coalesce(p_end,   v_old.end_at);
  v_capacity := coalesce(p_capacity, v_old.capacity);

  if v_end <= v_start then raise exception 'bad_time_range' using errcode = 'P0001'; end if;

  v_time_moved    := (v_start <> v_old.start_at) or (v_end <> v_old.end_at);
  v_teacher_moved := (v_teacher is distinct from v_old.teacher_id);

  if v_old.status <> 'scheduled' and (v_time_moved or v_teacher_moved) then
    raise exception 'session_not_reschedulable' using errcode = 'P0001';
  end if;

  if v_teacher_moved and not exists (select 1 from public.teachers where id = v_teacher) then
    raise exception 'teacher_not_found' using errcode = 'P0001';
  end if;
  if v_category is not null and not exists (select 1 from public.class_categories where id = v_category) then
    raise exception 'category_not_found' using errcode = 'P0001';
  end if;

  select count(*) into v_enrolled
    from public.bookings where session_id = p_session and status <> 'cancelled';
  if v_capacity < v_enrolled then
    raise exception 'capacity_below_enrolled' using errcode = 'P0001';
  end if;

  -- May raise 23P01 (sessions_no_overlap). Intentionally not caught: the route
  -- maps the code so the admin sees a real conflict, not a generic 500.
  update public.sessions
     set teacher_id        = v_teacher,
         class_category_id = v_category,
         start_at          = v_start,
         end_at            = v_end,
         capacity          = v_capacity,
         notes             = case when p_set_notes then p_notes else notes end
   where id = p_session;

  if v_time_moved then
    update public.bookings
       set reminded_at_24h = null, reminded_at_1h = null
     where session_id = p_session and status <> 'cancelled';
    get diagnostics v_rem = row_count;
  end if;

  if v_teacher_moved then
    -- "Orphaned" = a student in this class who, after the move, has no other
    -- live booking left with the outgoing teacher. Only those lose the premise
    -- customer_booked_teacher checks, so only their shares are in scope.
    with affected as (
      select distinct b.customer_id
        from public.bookings b
       where b.session_id = p_session and b.status <> 'cancelled'
    ), orphaned as (
      select a.customer_id from affected a
       where not exists (
         select 1 from public.bookings b2
           join public.sessions s2 on s2.id = b2.session_id
          where b2.customer_id = a.customer_id
            and b2.status <> 'cancelled'
            and s2.teacher_id = v_old.teacher_id
            and s2.id <> p_session)
    )
    select count(*) into v_phi_affected
      from public.medical_document_shares sh
      join public.medical_documents d on d.id = sh.document_id
     where sh.teacher_id = v_old.teacher_id
       and sh.revoked_at is null
       and d.customer_id in (select customer_id from orphaned);

    if coalesce(p_revoke_phi_shares, false) and v_phi_affected > 0 then
      with affected as (
        select distinct b.customer_id from public.bookings b
         where b.session_id = p_session and b.status <> 'cancelled'
      ), orphaned as (
        select a.customer_id from affected a
         where not exists (
           select 1 from public.bookings b2
             join public.sessions s2 on s2.id = b2.session_id
            where b2.customer_id = a.customer_id
              and b2.status <> 'cancelled'
              and s2.teacher_id = v_old.teacher_id
              and s2.id <> p_session)
      )
      update public.medical_document_shares sh
         set revoked_at = now()
        from public.medical_documents d
       where sh.document_id = d.id
         and sh.teacher_id = v_old.teacher_id
         and sh.revoked_at is null
         and d.customer_id in (select customer_id from orphaned);
      get diagnostics v_phi = row_count;
    end if;
  end if;

  -- Meet. NULL meet_status means "no link and none wanted" (0038), so leave it.
  -- Otherwise the existing event is now at the wrong time or on the wrong
  -- calendar: park it for the orphan sweep and re-arm the forward sweep.
  -- 'pending' and never NULL: cron/meet-retry selects only ('pending','failed').
  if (v_time_moved or v_teacher_moved) and v_old.meet_status is not null then
    v_meet := 'reprovision';
    if v_old.meet_event_id is not null then
      insert into public.meet_orphan_events (event_id, calendar_id, session_id, reason)
      values (v_old.meet_event_id, v_old.meet_calendar_id, p_session, 'session_rescheduled')
      on conflict (event_id) where deleted_at is null do nothing;
    end if;
    update public.sessions
       set meet_link = null, meet_event_id = null, meet_calendar_id = null,
           meet_status = 'pending'
     where id = p_session;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, payload)
  values (p_acting_admin, 'admin_update_session', 'session', p_session::text,
          jsonb_build_object(
            'before', jsonb_build_object('teacher_id', v_old.teacher_id,
              'class_category_id', v_old.class_category_id, 'start_at', v_old.start_at,
              'end_at', v_old.end_at, 'capacity', v_old.capacity),
            'after', jsonb_build_object('teacher_id', v_teacher,
              'class_category_id', v_category, 'start_at', v_start,
              'end_at', v_end, 'capacity', v_capacity),
            'enrolled', v_enrolled, 'reminders_reset', v_rem,
            'phi_shares_affected', v_phi_affected, 'phi_shares_revoked', v_phi,
            'meet_action', v_meet, 'reason', p_reason));

  return query select v_meet, v_phi, v_phi_affected, v_rem, v_enrolled;
end $$;

-- 8f. Cancel a whole session, WITH refunds ---------------------------------
-- app/api/admin/sessions/route.ts DELETE mass-cancels every booking today with
-- no refund at all, which is the studio's most destructive routine action.
-- Shipping per-student refunds while leaving this wrong would be worse than
-- shipping neither, because it teaches the operator that credits come back.

create or replace function public.admin_cancel_session(
  p_session uuid,
  p_refund boolean default true,
  p_acting_admin uuid default null,
  p_reason text default null
) returns table (
  cancelled_bookings int,
  refunded_bookings int,
  meet_event_id text,
  meet_calendar_id text,
  starts_in_future boolean
)
language plpgsql security definer set search_path = public as $$
declare
  v_old public.sessions%rowtype;
  v_b record;
  v_cancelled int := 0;
  v_refunded int := 0;
  v_did boolean;
begin
  if p_acting_admin is null or not public.is_admin(p_acting_admin) then
    raise exception 'admin_only' using errcode = 'P0001';
  end if;

  select * into v_old from public.sessions where id = p_session for update;
  if not found then raise exception 'session_not_found' using errcode = 'P0001'; end if;
  if v_old.status = 'cancelled' then raise exception 'already_cancelled' using errcode = 'P0001'; end if;

  update public.sessions set status = 'cancelled' where id = p_session;

  for v_b in
    select id, customer_id, is_free_trial, comped, status
      from public.bookings
     where session_id = p_session and status <> 'cancelled'
     for update
  loop
    update public.bookings
       set status = 'cancelled',
           cancellation_reason = coalesce(p_reason, 'session_cancelled_by_admin'),
           cancelled_at = now(),
           reminded_at_24h = null,
           reminded_at_1h = null
     where id = v_b.id;
    v_cancelled := v_cancelled + 1;

    -- Only a CONFIRMED seat is refundable. 'attended' and 'no_show' both mean the
    -- seat was consumed (the rule admin_set_booking_attendance is built on, and
    -- which app/api/admin/bookings/[id] states in the attendance branch), so
    -- cancelling a class that has already run must not hand those sessions back.
    -- Without this test the cursor's `status <> 'cancelled'` sweeps them in and
    -- an admin tidying up a past class silently mints a credit per attendee.
    if coalesce(p_refund, true)
       and v_b.status = 'confirmed'
       and not v_b.is_free_trial
       and not v_b.comped
    then
      v_did := public.refund_session_credit(v_b.customer_id, v_b.id);
      if v_did then
        update public.bookings set credit_refunded = true where id = v_b.id;
        v_refunded := v_refunded + 1;
      end if;
    end if;
  end loop;

  -- Park the Meet event for teardown. release_pending is the mirror of pending
  -- (0038): the route deletes it inline and clears to NULL guarded on this
  -- value, and cron/meet-retry is the backstop if the route dies.
  if v_old.meet_event_id is not null and v_old.start_at > now() then
    update public.sessions set meet_status = 'release_pending' where id = p_session;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, payload)
  values (p_acting_admin, 'admin_cancel_session', 'session', p_session::text,
          jsonb_build_object('cancelled_bookings', v_cancelled,
            'refunded_bookings', v_refunded, 'refund_requested', coalesce(p_refund, true),
            'reason', p_reason));

  return query select v_cancelled, v_refunded, v_old.meet_event_id,
                      v_old.meet_calendar_id, (v_old.start_at > now());
end $$;

-- Service role only (it bypasses these grants). These move credits or override
-- booking invariants, so they must never be reachable with an end-user or admin
-- JWT; the route handler does the admin gate and passes p_acting_admin.
revoke execute on function public.admin_enrol_booking(uuid, uuid, boolean, boolean, uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_cancel_booking(uuid, boolean, uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_set_booking_attendance(uuid, public.booking_status, public.booking_status, uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_move_booking(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_update_session(uuid, uuid, uuid, boolean, timestamptz, timestamptz, int, text, boolean, boolean, uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_cancel_session(uuid, boolean, uuid, text) from public, anon, authenticated;

commit;
