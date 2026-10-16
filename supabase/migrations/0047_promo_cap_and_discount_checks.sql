-- 0047_promo_cap_and_discount_checks.sql
-- Payments follow-ups from the October 2026 security audit. Idempotent.
--
-- Apply AFTER the app release that calls discount_redemption_commit_allowed
-- (lib/razorpay/fulfillment.ts fails open while it is missing), any order
-- relative to 0046.
-- Apply: psql "$SUPABASE_DB_URL" -f supabase/migrations/0047_promo_cap_and_discount_checks.sql

begin;

-- ── 1. A superseded/swept promo reservation may not resurrect past its caps ──
-- reserve_discount_redemption releases the caller's earlier unpaid reservation,
-- and commit resurrected 'released' rows with no cap re-check. So a buyer could
-- open N discounted orders for a 1-per-email code (each reserve freeing the
-- last) and pay them all. Resurrection is still allowed, so a genuine late
-- capture after the stale sweep works, but only while the caps still have room.

create or replace function public.discount_redemption_commit_allowed(p_redemption_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  r public.discount_redemptions%rowtype;
  d public.discount_codes%rowtype;
  v_live int;
begin
  select * into r from public.discount_redemptions where id = p_redemption_id;
  if not found then return false; end if;
  if r.status in ('reserved', 'committed') then return true; end if;
  if r.status <> 'released' then return false; end if;  -- reversed is terminal

  select * into d from public.discount_codes where id = r.discount_code_id for update;
  if not found then return false; end if;

  if d.max_uses is not null then
    select count(*) into v_live from public.discount_redemptions
     where discount_code_id = d.id and status in ('reserved', 'committed') and id <> r.id;
    if v_live >= d.max_uses then return false; end if;
  end if;
  if d.per_email_max is not null then
    select count(*) into v_live from public.discount_redemptions
     where discount_code_id = d.id and lower(email) = lower(r.email)
       and status in ('reserved', 'committed') and id <> r.id;
    if v_live >= d.per_email_max then return false; end if;
  end if;
  return true;
end $$;
revoke execute on function public.discount_redemption_commit_allowed(uuid) from public, anon, authenticated;
grant execute on function public.discount_redemption_commit_allowed(uuid) to service_role;

create or replace function public.commit_discount_redemption(
  p_redemption_id uuid,
  p_order_id text,
  p_payment_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Locks the code row when re-checking a released row (serialises with reserve).
  if not public.discount_redemption_commit_allowed(p_redemption_id) then
    -- Leave it released; fulfilment flags a captured payment for refund review.
    return;
  end if;
  with upd as (
    update public.discount_redemptions
       set status = 'committed',
           payment_id = p_payment_id,
           razorpay_order_id = coalesce(razorpay_order_id, p_order_id),
           committed_at = now()
     where id = p_redemption_id and status in ('reserved', 'released')
     returning discount_code_id
  )
  update public.discount_codes
     set times_used = times_used + 1, updated_at = now()
    from upd
   where discount_codes.id = upd.discount_code_id;
end $$;
revoke execute on function public.commit_discount_redemption(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.commit_discount_redemption(uuid, text, uuid) to service_role;

-- ── 2. Discount code sanity, enforced in the DB (was UI-only) ───────────────
-- A fixed-amount code with currency "Any" applies its integer in whatever
-- currency the order is in: INR 200 off (20000 paise) became AED 200 off.
-- NOT VALID so an existing bad row doesn't block the migration; see below.
alter table public.discount_codes drop constraint if exists discount_codes_fixed_needs_currency;
alter table public.discount_codes add constraint discount_codes_fixed_needs_currency
  check (discount_type::text not like 'fixed%' or currency is not null) not valid;

alter table public.discount_codes drop constraint if exists discount_codes_value_bounds;
alter table public.discount_codes add constraint discount_codes_value_bounds
  check (discount_value > 0 and (discount_type::text <> 'percentage' or discount_value <= 100)) not valid;

commit;

-- ── After applying ───────────────────────────────────────────────────────────
-- Codes that break the new rules (fix them in /admin/discounts, then validate):
--   select id, code, discount_type, discount_value, currency from public.discount_codes
--    where (discount_type::text like 'fixed%' and currency is null)
--       or discount_value <= 0
--       or (discount_type::text = 'percentage' and discount_value > 100);
--   alter table public.discount_codes validate constraint discount_codes_fixed_needs_currency;
--   alter table public.discount_codes validate constraint discount_codes_value_bounds;
