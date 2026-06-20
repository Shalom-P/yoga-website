-- 0021_refund_idempotency_and_blocklist.sql
-- Two payment/booking-integrity hardening fixes from the site review:
--
--   1. Cancel-refunds were not DB-idempotent. The cancel route guards against a
--      double-cancel race with `.eq("status","confirmed")`, but the credit grant
--      itself (grant_session_credits reason='refund') had no dedupe key — only
--      purchases were guarded (credit_ledger_purchase_once, 0011). A retried or
--      duplicated cancel could in principle refund twice. Add a refund-once index
--      keyed on booking_id and a dedicated idempotent refund_session_credit RPC.
--
--   2. book_session (0017) enforced overlap + one-free-trial but NOT the teacher's
--      one-off date blocklist (teacher_slot_overrides.is_blocked). The confirm
--      route checks it before calling, but the RPC is the value/integrity choke
--      point — add the blocklist check inside it as defense-in-depth so any future
--      caller can't book an explicitly blocked date.
--
-- Apply: psql "$SUPABASE_DB_URL" -f supabase/migrations/0021_refund_idempotency_and_blocklist.sql

-- 1. Refund-once: at most one 'refund' ledger row per booking.
create unique index if not exists credit_ledger_refund_once
  on public.credit_ledger(booking_id)
  where reason = 'refund';

-- Idempotent refund of one credit for a cancelled paid booking. Mirrors the
-- purchase-once design in grant_session_credits: the ledger insert is the dedupe
-- key, and the balance only moves when a NEW row is actually inserted. Returns
-- true if this call performed the refund, false if it was already refunded.
create or replace function public.refund_session_credit(
  p_customer uuid,
  p_booking_id uuid
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_inserted boolean;
begin
  insert into public.credit_ledger (customer_id, delta, reason, booking_id)
  values (p_customer, 1, 'refund', p_booking_id)
  on conflict (booking_id) where reason = 'refund' do nothing;
  v_inserted := found;

  if v_inserted then
    insert into public.customer_credits (customer_id, balance)
    values (p_customer, 1)
    on conflict (customer_id)
      do update set balance = public.customer_credits.balance + 1,
                    updated_at = now();
  end if;

  return v_inserted;
end $$;

revoke execute on function public.refund_session_credit(uuid, uuid) from public, anon, authenticated;

-- 2. book_session + blocklist defense-in-depth. Same body as 0017 plus an upfront
--    rejection of explicitly blocked teacher dates (raises 'slot_blocked').
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
  v_teacher_tz text;
begin
  -- Defense-in-depth: never book a date the teacher has explicitly blocked, even
  -- if a future caller skips the route-level check. The blocklist is keyed on the
  -- teacher-local calendar date.
  select coalesce(timezone, 'Asia/Kolkata') into v_teacher_tz
    from public.teachers where id = p_teacher;
  if exists (
    select 1 from public.teacher_slot_overrides o
    where o.teacher_id = p_teacher
      and o.is_blocked
      and o.date = (p_start at time zone v_teacher_tz)::date
  ) then
    raise exception 'slot_blocked' using errcode = 'P0001';
  end if;

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

revoke execute on function
  public.book_session(uuid, uuid, timestamptz, timestamptz, boolean)
  from public, anon, authenticated;
