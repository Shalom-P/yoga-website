-- 0011_razorpay_billing.sql
-- Razorpay one-time, session-pack billing (AUD). Replaces PayPal recurring
-- subscriptions with a credits model:
--   * a plan = a pack: a price + N session-credits
--   * buying a pack grants N credits (customer_credits.balance)
--   * booking a PAID session spends 1 credit (atomic, race-safe)
--   * the free 1:1 trial is unchanged — it never touches credits
--
-- PayPal objects (plans.paypal_plan_id, subscriptions, paypal_webhook_events,
-- payments.paypal_capture_id) are intentionally LEFT IN PLACE here; a later
-- migration drops them once the Razorpay flow is confirmed in production.
--
-- Apply to the live DB via psql / SQL editor after review (see CLAUDE.md
-- "Schema ownership" — Drizzle does not generate RLS/RPCs).

-- 1. Plans become packs: how many session-credits a purchase of this plan grants.
alter table public.plans
  add column if not exists session_credits int not null default 0;

-- 2. Payments: bind a row to its Razorpay order/payment. The UNIQUE payment id
--    is the idempotency key for fulfilment — the webhook and the client-side
--    verify can both run and only one grant happens.
alter table public.payments
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text;
create unique index if not exists payments_razorpay_payment_id_key
  on public.payments(razorpay_payment_id)
  where razorpay_payment_id is not null;

-- 3. Credit balance (fast + race-safe) and an append-only ledger (audit trail).
create table if not exists public.customer_credits (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table public.customer_credits enable row level security;
-- Customers read their own balance; all writes go through the SECURITY DEFINER
-- RPCs below (service-role), so there is no client write policy.
create policy "customer_credits_self_read" on public.customer_credits
  for select using (auth.uid() = customer_id);
create policy "customer_credits_admin_all" on public.customer_credits
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

do $$ begin
  create type public.credit_reason as enum ('purchase', 'booking_spend', 'refund', 'admin_adjust');
exception when duplicate_object then null;
end $$;

create table if not exists public.credit_ledger (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  delta int not null,
  reason public.credit_reason not null,
  payment_id uuid references public.payments(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_customer_idx on public.credit_ledger(customer_id);
-- Idempotency: at most one 'purchase' grant per payment. The grant RPC relies on
-- this to make replays (webhook + verify) a no-op.
create unique index if not exists credit_ledger_purchase_once
  on public.credit_ledger(payment_id)
  where reason = 'purchase';
alter table public.credit_ledger enable row level security;
create policy "credit_ledger_self_read" on public.credit_ledger
  for select using (auth.uid() = customer_id);
create policy "credit_ledger_admin_all" on public.credit_ledger
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- 4a. Grant credits. Idempotent for purchases (keyed on payment_id), so the
--     webhook and the verify endpoint can't double-grant. Used for refunds and
--     admin adjustments too.
create or replace function public.grant_session_credits(
  p_customer uuid,
  p_delta int,
  p_reason public.credit_reason,
  p_payment_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_inserted boolean := true;
begin
  if p_delta <= 0 then
    return;
  end if;

  if p_reason = 'purchase' and p_payment_id is not null then
    insert into public.credit_ledger (customer_id, delta, reason, payment_id)
    values (p_customer, p_delta, 'purchase', p_payment_id)
    on conflict (payment_id) where reason = 'purchase' do nothing;
    v_inserted := found;  -- false => this payment was already granted (replay)
  else
    insert into public.credit_ledger (customer_id, delta, reason, payment_id)
    values (p_customer, p_delta, p_reason, p_payment_id);
  end if;

  if v_inserted then
    insert into public.customer_credits (customer_id, balance)
    values (p_customer, p_delta)
    on conflict (customer_id)
      do update set balance = public.customer_credits.balance + p_delta,
                    updated_at = now();
  end if;
end $$;

-- 4b. Spend exactly one credit, atomically. Returns false if the customer has
--     none (the UPDATE matches no row), so the caller can reject the booking.
create or replace function public.spend_session_credit(
  p_customer uuid,
  p_booking_id uuid default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_ok boolean;
begin
  update public.customer_credits
    set balance = balance - 1, updated_at = now()
    where customer_id = p_customer and balance > 0
    returning true into v_ok;
  if v_ok is null then
    return false;
  end if;
  insert into public.credit_ledger (customer_id, delta, reason, booking_id)
  values (p_customer, -1, 'booking_spend', p_booking_id);
  return true;
end $$;

revoke execute on function public.grant_session_credits(uuid, int, public.credit_reason, uuid) from public, anon, authenticated;
revoke execute on function public.spend_session_credit(uuid, uuid) from public, anon, authenticated;
-- Service role only (it bypasses these grants), matching apply_discount_to_subscription in 0007.

-- 5. Razorpay webhook idempotency table. Keyed on the X-Razorpay-Event-Id header
--    so a redelivered webhook is dropped (mirrors paypal_webhook_events in 0007).
create table if not exists public.razorpay_webhook_events (
  event_id text primary key,
  event_type text,
  received_at timestamptz not null default now(),
  payload jsonb
);
alter table public.razorpay_webhook_events enable row level security;
create policy "razorpay_webhook_events_admin_read" on public.razorpay_webhook_events
  for select using (public.is_admin(auth.uid()));
-- Inserts via service role only.
