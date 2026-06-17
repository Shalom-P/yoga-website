-- 0017_booking_integrity.sql
-- Round-2 code-review fixes for the booking engine:
--
--   * Double-booking race (TOCTOU): the route used a SELECT-then-INSERT overlap
--     check, so two concurrent requests for the same 1:1 slot could both pass the
--     SELECT and both INSERT. A GiST EXCLUDE constraint now rejects any two
--     non-cancelled sessions whose time ranges overlap for the same teacher —
--     the database makes the race impossible regardless of app timing.
--   * Non-atomic credit spend + unlinked ledger: book_session() runs the credit
--     spend, session insert, booking insert, and ledger entry in ONE transaction.
--     If anything fails (overlap 23P01, duplicate trial 23505, …) the whole thing
--     rolls back, so a credit is never debited without a booking, and the
--     'booking_spend' ledger row is finally linked to its booking_id.
--
-- Apply:  psql "$SUPABASE_DB_URL" -f supabase/migrations/0017_booking_integrity.sql
--
-- NOTE: ADD CONSTRAINT fails if the table already holds overlapping non-cancelled
-- sessions. Detect them first with:
--   select a.id, b.id from public.sessions a join public.sessions b
--     on a.teacher_id = b.teacher_id and a.id < b.id
--    and a.status <> 'cancelled' and b.status <> 'cancelled'
--    and tstzrange(a.start_at, a.end_at) && tstzrange(b.start_at, b.end_at);

create extension if not exists btree_gist;

-- No two non-cancelled sessions for the same teacher may overlap in time.
do $$ begin
  alter table public.sessions
    add constraint sessions_no_overlap
    exclude using gist (
      teacher_id with =,
      tstzrange(start_at, end_at) with &&
    ) where (status <> 'cancelled');
exception when duplicate_object then null;
end $$;

-- Atomic booking. Spends one credit for paid bookings, inserts the session and
-- booking, and links the spend to the booking in the ledger — all in a single
-- transaction. Raises:
--   * 'insufficient_credits' (errcode P0001) when a paid booking has no credit
--   * 23P01 (exclusion_violation) when the slot overlaps an existing session
--   * 23505 (unique_violation)    when it duplicates the one-free-trial index
create or replace function public.book_session(
  p_customer uuid,
  p_teacher uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_is_free_trial boolean
) returns table (booking_id uuid, session_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_session_id uuid;
  v_booking_id uuid;
  v_spent boolean;
begin
  -- Paid bookings reserve one credit up front. The conditional UPDATE is atomic,
  -- so two concurrent bookings can't both spend the last credit. Any rollback
  -- later in this function (overlap, duplicate trial) restores it automatically.
  if not p_is_free_trial then
    update public.customer_credits
      set balance = balance - 1, updated_at = now()
      where customer_id = p_customer and balance > 0
      returning true into v_spent;
    if v_spent is null then
      raise exception 'insufficient_credits' using errcode = 'P0001';
    end if;
  end if;

  insert into public.sessions
    (teacher_id, start_at, end_at, capacity, status, is_free_trial, meet_status)
    values (p_teacher, p_start, p_end, 1, 'scheduled', p_is_free_trial, 'pending')
    returning id into v_session_id;

  insert into public.bookings (session_id, customer_id, is_free_trial, status)
    values (v_session_id, p_customer, p_is_free_trial, 'confirmed')
    returning id into v_booking_id;

  if not p_is_free_trial then
    insert into public.credit_ledger (customer_id, delta, reason, booking_id)
      values (p_customer, -1, 'booking_spend', v_booking_id);
  end if;

  return query select v_booking_id, v_session_id;
end $$;

-- Service-role only (it bypasses these grants), matching the other value RPCs.
revoke execute on function
  public.book_session(uuid, uuid, timestamptz, timestamptz, boolean)
  from public, anon, authenticated;
