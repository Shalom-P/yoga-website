-- 0020_credit_packs.sql
-- Align the public pricing with the Razorpay one-time *session-pack* billing
-- model (0011). The seeded plans were still the old PayPal-era monthly
-- subscription tiers (Starter/Unlimited/Therapy) describing "unlimited group
-- classes" and "HSA/FSA invoicing", and — critically — every one of them had
-- session_credits = 0 (the 0011 default was never backfilled), so a customer who
-- bought a "pack" received NOTHING.
--
-- This migration:
--   1. adds a 'one_time' billing interval (packs are not recurring),
--   2. retires the three legacy subscription plans (kept, not deleted, so
--      historical payments/ledger FKs stay intact — just hidden from /pricing),
--   3. seeds two real credit packs (5-pack, 10-pack) with correct session_credits.
--
-- Packs remain fully admin-editable in /admin/plans (price + credits + copy).
--
-- Apply (NOT in a single transaction — ALTER TYPE ADD VALUE must commit before
-- the new value is used below):
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0020_credit_packs.sql

-- 1. One-time interval for non-recurring packs. Committed before first use.
alter type public.billing_interval add value if not exists 'one_time';

-- 2. Retire legacy subscription plans (preserve rows for payment history).
update public.plans set is_active = false, is_featured = false
  where slug in ('starter', 'unlimited', 'therapy');

-- 3. Two one-time session-credit packs.
insert into public.plans
  (slug, name, description, price_aud_cents, billing_interval, session_credits,
   included_sessions_per_month, included_session_types, is_active, is_featured, sort_order)
values
  ('pack-5',  '5-Session Pack',  'Five private 1:1 sessions — your flexible way in.',        18000, 'one_time', 5,  null, '{}', true, false, 1),
  ('pack-10', '10-Session Pack', 'Ten private 1:1 sessions — our best price per session.',   34000, 'one_time', 10, null, '{}', true, true,  2)
on conflict (slug) do update set
  name                = excluded.name,
  description         = excluded.description,
  price_aud_cents     = excluded.price_aud_cents,
  billing_interval    = excluded.billing_interval,
  session_credits     = excluded.session_credits,
  included_session_types = excluded.included_session_types,
  is_active           = excluded.is_active,
  is_featured         = excluded.is_featured,
  sort_order          = excluded.sort_order;

-- Features for the packs. Only TRUE capabilities (credits never expire; cancel
-- refunds the credit — see app/api/bookings/cancel/route.ts).
do $$
declare
  p5  uuid := (select id from public.plans where slug = 'pack-5');
  p10 uuid := (select id from public.plans where slug = 'pack-10');
begin
  delete from public.plan_features where plan_id in (p5, p10);
  insert into public.plan_features (plan_id, feature_text, is_included, sort_order) values
    (p5,  '5 private 1:1 sessions',            true, 1),
    (p5,  'Book any teacher, any style',       true, 2),
    (p5,  '60-min sessions on Google Meet',    true, 3),
    (p5,  'Credits never expire',              true, 4),
    (p5,  'Cancel before the session — credit refunded', true, 5),

    (p10, '10 private 1:1 sessions',           true, 1),
    (p10, 'Book any teacher, any style',       true, 2),
    (p10, 'Lowest price per session',          true, 3),
    (p10, 'Credits never expire',              true, 4),
    (p10, 'Cancel before the session — credit refunded', true, 5);
end $$;
