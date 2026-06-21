-- 0022_multi_currency.sql
-- Multi-currency pricing for the UAE + India market shift.
--
-- The studio moved its customer market from Australia (AUD) to the UAE (AED) +
-- India (INR). A price is now per-(plan, currency), so:
--   1. a new `plan_prices` child table holds the per-currency amount,
--   2. the AU-specific money columns are renamed to currency-neutral names
--      (`plans.price_aud_cents` -> `price_base_cents`, kept as a fallback;
--       `payments.amount_aud_cents` -> `amount_cents`),
--   3. the `discount_type` enum gains a currency-neutral `fixed_amount_cents`
--      value (the old `fixed_aud_cents` is left in place — Postgres can't drop an
--      enum value cheaply, and nothing reads it at runtime),
--   4. `profiles.timezone` default flips to Asia/Kolkata (India is the larger
--      market; the real zone is device-detected at onboarding regardless),
--   5. `admin_kpis()` drops the dead subscription-MRR (subscriptions were retired
--      in 0020) and returns month-to-date revenue grouped by currency instead —
--      revenue can't be summed across currencies, so it is reported side by side.
--
-- Existing rows are preserved: legacy `payments.currency = 'AUD'` rows stay AUD
-- (historical truth); column renames are metadata-only (no data rewrite).
--
-- Apply (NOT in a single transaction — ALTER TYPE ADD VALUE must commit before
-- the new value is used below):
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0022_multi_currency.sql

-- 1. discount_type: add the currency-neutral value (committed before first use).
alter type public.discount_type add value if not exists 'fixed_amount_cents';

-- 2. Rename AU-specific money columns to currency-neutral names (metadata-only).
alter table public.plans   rename column price_aud_cents  to price_base_cents;
alter table public.payments rename column amount_aud_cents to amount_cents;
-- Fulfilment always stamps the real currency from Razorpay — no AUD default.
alter table public.payments alter column currency drop default;

-- 3. Per-currency price rows. RLS mirrors `plans`: public-read for prices of an
--    active plan, admin-all for management.
create table public.plan_prices (
  id uuid primary key default uuid_generate_v4(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  currency text not null check (currency in ('INR', 'AED')),
  amount_cents int not null check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, currency)
);
create index plan_prices_plan_idx on public.plan_prices(plan_id);
create trigger plan_prices_set_updated_at before update on public.plan_prices
  for each row execute function public.tg_set_updated_at();
alter table public.plan_prices enable row level security;
create policy "plan_prices_public_read" on public.plan_prices for select
  using (exists (select 1 from public.plans p where p.id = plan_id and p.is_active = true));
create policy "plan_prices_admin_all" on public.plan_prices for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- 4. Backfill per-currency prices for the live packs. Converted from the prior
--    AUD pack prices (A$180 / A$340) at ~1 AUD = 2.42 AED = INR 55. Sensible
--    defaults — admins reconfigure them in /admin/plans (writes plan_prices).
--    Smallest unit (paise / fils).
--      pack-5  : INR 10,000 (1000000) | AED 435 (43500)
--      pack-10 : INR 19,000 (1900000) | AED 825 (82500)
insert into public.plan_prices (plan_id, currency, amount_cents)
select p.id, v.currency, v.amount_cents
from public.plans p
join (values
  ('pack-5',  'INR', 1000000),
  ('pack-5',  'AED',   43500),
  ('pack-10', 'INR', 1900000),
  ('pack-10', 'AED',   82500)
) as v(slug, currency, amount_cents) on v.slug = p.slug
on conflict (plan_id, currency) do update set amount_cents = excluded.amount_cents;

-- Keep the currency-neutral fallback (price_base_cents) in step with the default
-- currency (INR) for the active packs, so it's sane if a future currency lacks a row.
update public.plans set price_base_cents = 1000000 where slug = 'pack-5';
update public.plans set price_base_cents = 1900000 where slug = 'pack-10';

-- 5. Migrate any existing discount rows off the deprecated enum value.
update public.discount_codes set discount_type = 'fixed_amount_cents'
  where discount_type = 'fixed_aud_cents';

-- 6. New profiles default to India; existing rows are untouched (the global
--    timezone picker lets customers set their real zone).
alter table public.profiles alter column timezone set default 'Asia/Kolkata';

-- 7. Rebuild admin_kpis: subscriptions are retired (0020), so the old MRR was a
--    dead sum. Report month-to-date captured revenue per currency from payments.
create or replace function public.admin_kpis()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_signups_today int;
  v_trials_today int;
  v_revenue jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'admin only';
  end if;

  select count(*) into v_signups_today
    from public.profiles where created_at >= date_trunc('day', now());

  select count(*) into v_trials_today
    from public.bookings where is_free_trial = true and created_at >= date_trunc('day', now());

  -- Month-to-date completed revenue, grouped by currency (never summed across).
  select coalesce(jsonb_object_agg(t.currency, t.total), '{}'::jsonb) into v_revenue
  from (
    select currency, sum(amount_cents)::bigint as total
    from public.payments
    where status = 'completed' and paid_at >= date_trunc('month', now())
    group by currency
  ) t;

  return jsonb_build_object(
    'signups_today', v_signups_today,
    'trials_today', v_trials_today,
    'revenue_mtd_by_currency', v_revenue
  );
end $$;
