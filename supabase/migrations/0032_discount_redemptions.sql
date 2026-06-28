-- 0032_discount_redemptions.sql
-- Wire promo/discount codes into the CURRENT one-time Razorpay + bank-transfer
-- credit-pack flow, and link every redemption to the buyer's email.
--
-- Context: discount_codes (0004) + validate_discount_code (0004/0007) were built
-- for the retired PayPal subscription rail (the only discount_code_id FK lived on
-- `subscriptions`, dropped in 0020). The current credit-pack path (plans /
-- plan_prices -> payments -> grant_session_credits) had NO discount plumbing.
--
-- Model: a redemption is RESERVED at create-order / bank-transfer-intent time
-- (when the buyer's email is known from the session) and COMMITTED at fulfilment
-- (when money has settled), exactly-once, mirroring the credit_ledger_purchase_once
-- idempotency. The discounted amount is baked into the Razorpay order / pending
-- transfer SERVER-SIDE, so the client can never set or tamper with what it pays.
--
-- All value-mutating RPCs here are SECURITY DEFINER + service-role-only (revoked
-- from public/anon/authenticated), matching grant_session_credits (0011).

begin;

-- 1. Per-email cap + optional currency lock on discount_codes ---------------
--    max_uses stays the GLOBAL cap; per_email_max caps uses per email per code.
--    currency (NULL = any) lets a fixed-amount code be locked to AED or INR so
--    the same integer minor-units value isn't applied across currencies
--    (AED ~= 22x INR). percentage codes leave currency NULL.
alter table public.discount_codes
  add column if not exists per_email_max int,
  add column if not exists currency text;

alter table public.discount_codes
  drop constraint if exists discount_codes_currency_chk;
alter table public.discount_codes
  add constraint discount_codes_currency_chk
  check (currency is null or currency in ('INR', 'AED'));

alter table public.discount_codes
  drop constraint if exists discount_codes_per_email_max_chk;
alter table public.discount_codes
  add constraint discount_codes_per_email_max_chk
  check (per_email_max is null or per_email_max > 0);

-- 2. Record the applied discount on the payment (queryable per-payment) ------
alter table public.payments
  add column if not exists discount_code_id uuid references public.discount_codes(id) on delete set null,
  add column if not exists discount_amount_cents int;

-- 3. The redemption ledger: one row per code-use, the durable EMAIL link -----
create table if not exists public.discount_redemptions (
  id uuid primary key default uuid_generate_v4(),
  discount_code_id uuid not null references public.discount_codes(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  -- Lowercased canonical email captured at reserve time from the auth session.
  -- Snapshotted (not joined off profiles.email, which is a nullable trigger
  -- mirror) so per-email enforcement works at webhook time with no session and
  -- no dependence on a possibly-stale/null profiles.email.
  email text not null,
  -- Razorpay rail keys commit on razorpay_order_id; bank-transfer rail keys on
  -- payment_id. Both nullable; exactly one is set per row in practice.
  razorpay_order_id text,
  payment_id uuid references public.payments(id) on delete set null,
  currency text not null,
  original_amount_cents int not null check (original_amount_cents >= 0),
  discount_amount_cents int not null check (discount_amount_cents >= 0),
  final_amount_cents int not null check (final_amount_cents >= 0),
  -- reserved  : slot held at checkout-start, awaiting payment
  -- committed : payment settled (the durable, email-linked, counted use)
  -- released  : reservation freed before commit (abandoned / swept / superseded);
  --             a later payment can still RESURRECT it to committed
  -- reversed  : a committed use undone by a full refund (terminal; never re-commits)
  status text not null default 'reserved' check (status in ('reserved', 'committed', 'released', 'reversed')),
  created_at timestamptz not null default now(),
  committed_at timestamptz
);

-- One redemption per order / per payment (idempotency for commit + linkage).
create unique index if not exists discount_redemptions_order_uq
  on public.discount_redemptions (razorpay_order_id)
  where razorpay_order_id is not null;
create unique index if not exists discount_redemptions_payment_uq
  on public.discount_redemptions (payment_id)
  where payment_id is not null;
-- Per-(code,email) live-redemption count (the per-email cap) + email audit.
create index if not exists discount_redemptions_code_email_idx
  on public.discount_redemptions (discount_code_id, lower(email))
  where status in ('reserved', 'committed');
create index if not exists discount_redemptions_code_live_idx
  on public.discount_redemptions (discount_code_id)
  where status in ('reserved', 'committed');
create index if not exists discount_redemptions_email_idx
  on public.discount_redemptions (lower(email));

alter table public.discount_redemptions enable row level security;
-- Admins manage/report; a customer may read their own redemptions. No customer
-- INSERT/UPDATE policy: every write goes through the SECURITY DEFINER RPCs below
-- on the service-role path.
drop policy if exists discount_redemptions_admin_all on public.discount_redemptions;
create policy discount_redemptions_admin_all on public.discount_redemptions
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists discount_redemptions_self_read on public.discount_redemptions;
create policy discount_redemptions_self_read on public.discount_redemptions
  for select using (auth.uid() = customer_id);

-- 4. RPCs -------------------------------------------------------------------

-- reserve_discount_redemption: validate the code, compute the discount in the
-- order currency, and atomically reserve a use — all under a row lock on the
-- code so concurrent buyers can't oversubscribe max_uses / per_email_max. The
-- charged amount is derived HERE, never from the client. Returns a jsonb result:
--   { ok:true, redemption_id, discount_code_id, discount_amount_cents,
--     final_amount_cents, discount_type, code }
--   or { ok:false, error:'invalid_code'|'code_exhausted'|'email_limit_reached'
--                          |'currency_not_allowed'|'amount_below_minimum' }
-- One (and only one) of p_order_id / p_payment_id is set per rail; either may be
-- null at reserve time and patched in immediately after the order/payment row
-- exists (the unique partial indexes tolerate the transient null).
create or replace function public.reserve_discount_redemption(
  p_code text,
  p_plan_id uuid,
  p_customer uuid,
  p_email text,
  p_currency text,
  p_original_amount_cents int,
  p_order_id text default null,
  p_payment_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d public.discount_codes%rowtype;
  v_email text := lower(trim(p_email));
  v_live_total int;
  v_live_email int;
  v_discount int;
  v_final int;
  v_id uuid;
begin
  if v_email is null or v_email = '' then
    return jsonb_build_object('ok', false, 'error', 'email_required');
  end if;

  -- Lock the code row: serializes the cap checks against concurrent reservations.
  select * into d from public.discount_codes
  where upper(code) = upper(trim(p_code))
    and is_active = true
    and (valid_from <= now())
    and (valid_until is null or valid_until > now())
    and (applies_to_plan_ids is null or p_plan_id = any(applies_to_plan_ids))
  limit 1
  for update;

  if d.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  -- Currency lock (NULL = any). Guards fixed-amount codes from crossing AED/INR.
  if d.currency is not null and d.currency <> p_currency then
    return jsonb_build_object('ok', false, 'error', 'currency_not_allowed');
  end if;

  -- A fresh checkout for this code supersedes the caller's OWN earlier, still-
  -- unpaid Razorpay reservation for it — so an abandoned modal never blocks the
  -- buyer's immediate retry against per_email_max. Scoped to payment_id IS NULL so
  -- it never disturbs a bank-transfer reservation tied to a real pending wire
  -- (that one is released only by admin reject). If a superseded order is somehow
  -- still paid later, commit RESURRECTS it from 'released', so nothing is lost.
  -- Safe under the FOR UPDATE lock above (serialized per code).
  update public.discount_redemptions
     set status = 'released'
   where discount_code_id = d.id and customer_id = p_customer
     and status = 'reserved' and payment_id is null;

  -- Live = reserved + committed. Counting reserved (pre-payment) holds the slot
  -- so we never charge a discounted order we then can't honour. Stale reserved
  -- rows are swept by release_stale_discount_reservations().
  select count(*) into v_live_total from public.discount_redemptions
  where discount_code_id = d.id and status in ('reserved', 'committed');
  if d.max_uses is not null and v_live_total >= d.max_uses then
    return jsonb_build_object('ok', false, 'error', 'code_exhausted');
  end if;

  if d.per_email_max is not null then
    select count(*) into v_live_email from public.discount_redemptions
    where discount_code_id = d.id and lower(email) = v_email
      and status in ('reserved', 'committed');
    if v_live_email >= d.per_email_max then
      return jsonb_build_object('ok', false, 'error', 'email_limit_reached');
    end if;
  end if;

  -- Discount math in the order currency. percentage is currency-agnostic;
  -- fixed_* is integer minor units, clamped so it can never exceed the price.
  if d.discount_type = 'percentage' then
    v_discount := round(p_original_amount_cents * d.discount_value / 100.0);
  else
    v_discount := least(d.discount_value, p_original_amount_cents);
  end if;
  v_discount := greatest(v_discount, 0);
  v_final := greatest(p_original_amount_cents - v_discount, 0);

  -- Razorpay (and our floor) won't accept an order below the 100 minor-unit
  -- minimum; a code that would zero out / under-floor the pack is rejected
  -- rather than silently clamped.
  if v_final < 100 then
    return jsonb_build_object('ok', false, 'error', 'amount_below_minimum');
  end if;

  insert into public.discount_redemptions (
    discount_code_id, customer_id, email, razorpay_order_id, payment_id,
    currency, original_amount_cents, discount_amount_cents, final_amount_cents, status
  ) values (
    d.id, p_customer, v_email, p_order_id, p_payment_id,
    p_currency, p_original_amount_cents, v_discount, v_final, 'reserved'
  ) returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'redemption_id', v_id,
    'discount_code_id', d.id,
    'discount_amount_cents', v_discount,
    'final_amount_cents', v_final,
    'discount_type', d.discount_type,
    'code', d.code
  );
end $$;

-- commit_discount_redemption: flip a redemption (by its id, carried in the
-- Razorpay order notes) to committed, link its payment + order, and advance the
-- code's committed counter EXACTLY once. The `status in ('reserved','released')`
-- guard does two jobs: a verify/webhook double-fire is a no-op (second call sees
-- 'committed' => 0 rows => times_used not re-incremented), AND a payment that
-- captures AFTER the stale sweep already released its reservation still commits
-- (RESURRECTS the row) instead of silently ghosting. A refunded ('reversed') row
-- is excluded, so it can never re-commit. Keying on the redemption id (not the
-- order id) avoids a fragile post-order-create DB patch — order id is recorded
-- here via coalesce.
create or replace function public.commit_discount_redemption(
  p_redemption_id uuid,
  p_order_id text,
  p_payment_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
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

-- commit_discount_redemption_by_payment: bank-transfer variant — the reservation
-- is keyed on payment_id (no Razorpay order). Same exactly-once + resurrect
-- guarantee: an admin who verifies a wire days later (after the sweep released
-- the reservation) still commits it. 'reversed' is excluded.
create or replace function public.commit_discount_redemption_by_payment(
  p_payment_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  with upd as (
    update public.discount_redemptions
       set status = 'committed', committed_at = now()
     where payment_id = p_payment_id and status in ('reserved', 'released')
     returning discount_code_id
  )
  update public.discount_codes
     set times_used = times_used + 1, updated_at = now()
    from upd
   where discount_codes.id = upd.discount_code_id;
end $$;

-- release_discount_redemption: free a use back to the pool. On a FULL refund a
-- committed use becomes 'reversed' (terminal — NOT 'released', so a redelivered
-- capture webhook can't resurrect a refunded redemption) and the committed
-- counter is decremented. On a bank-transfer reject the still-reserved row
-- becomes 'released'. Idempotent on redelivery: a second call finds no
-- committed/reserved row and is a no-op.
create or replace function public.release_discount_redemption(
  p_payment_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  with upd as (
    update public.discount_redemptions
       set status = 'reversed'
     where payment_id = p_payment_id and status = 'committed'
     returning discount_code_id
  )
  update public.discount_codes
     set times_used = greatest(times_used - 1, 0), updated_at = now()
    from upd
   where discount_codes.id = upd.discount_code_id;

  update public.discount_redemptions
     set status = 'released'
   where payment_id = p_payment_id and status = 'reserved';
end $$;

-- release_discount_reservation: drop a still-reserved row by its id — called
-- best-effort when order/payment creation fails (or loses a race) after a
-- reservation, so a stranded reservation doesn't permanently consume a
-- max_uses / per_email_max slot.
create or replace function public.release_discount_reservation(
  p_redemption_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.discount_redemptions
     set status = 'released'
   where id = p_redemption_id and status = 'reserved';
end $$;

-- release_stale_discount_reservations: sweep reserved-but-unpaid Razorpay
-- redemptions older than p_older_than (default 2h) so abandoned checkouts free
-- their slot. ONLY rows with no linked payment (payment_id is null) are eligible:
-- a bank-transfer reservation is linked to a 'pending' payment the moment it is
-- created and can legitimately sit for days awaiting a human wire + admin verify,
-- so it must NOT be swept here (admin reject releases it instead). Even so, a
-- swept reservation that later pays is resurrected by commit, so this is a
-- soft-cap optimization, not a correctness dependency. Bounded; returns the count.
create or replace function public.release_stale_discount_reservations(
  p_older_than interval default interval '2 hours',
  p_limit int default 500
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  with stale as (
    select id from public.discount_redemptions
     where status = 'reserved' and payment_id is null and created_at < now() - p_older_than
     order by created_at
     limit p_limit
     for update skip locked
  )
  update public.discount_redemptions r
     set status = 'released'
    from stale
   where r.id = stale.id;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Service-role only (the service client bypasses these grants), matching
-- grant_session_credits / spend_session_credit (0011).
revoke execute on function public.reserve_discount_redemption(text, uuid, uuid, text, text, int, text, uuid) from public, anon, authenticated;
revoke execute on function public.commit_discount_redemption(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.commit_discount_redemption_by_payment(uuid) from public, anon, authenticated;
revoke execute on function public.release_discount_redemption(uuid) from public, anon, authenticated;
revoke execute on function public.release_discount_reservation(uuid) from public, anon, authenticated;
revoke execute on function public.release_stale_discount_reservations(interval, int) from public, anon, authenticated;

commit;
