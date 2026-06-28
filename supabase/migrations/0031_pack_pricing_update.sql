-- 0031_pack_pricing_update.sql
--
-- 2026-06-28 pricing update (AED figures set by the studio). Introduces a
-- 1-session pack and re-prices the existing two in AED:
--
--   1-Session Pack  : AED 59   (NEW)
--   5-Session Pack  : AED 275  (was AED 435)
--   10-Session Pack : AED 499  (was AED 825)
--
-- INR is intentionally LEFT UNCHANGED for the existing packs — India billing
-- isn't live yet and the real INR prices are still to come. The new pack-1 gets
-- a PLACEHOLDER INR (~₹1,350) only to satisfy the not-null base price; replace
-- it from /admin/plans (or a later migration) once the India price is decided.
--
-- Amounts are minor units: fils for AED, paise for INR.
-- Idempotent — safe to re-run.
--
-- Apply: psql "$SUPABASE_DB_URL" -f supabase/migrations/0031_pack_pricing_update.sql

-- 1. The new 1-session pack (sort_order 0 → shows first in the pricing grid).
insert into public.plans
  (slug, name, description, price_base_cents, billing_interval, session_credits,
   included_sessions_per_month, included_session_types, is_active, is_featured, sort_order)
values
  ('pack-1', '1-Session Pack',
   'A single private 1:1 session — perfect for a one-off or a top-up.',
   135000, 'one_time', 1, null, '{}', true, false, 0)
on conflict (slug) do update set
  name             = excluded.name,
  description      = excluded.description,
  price_base_cents = excluded.price_base_cents,
  billing_interval = excluded.billing_interval,
  session_credits  = excluded.session_credits,
  is_active        = excluded.is_active,
  is_featured      = excluded.is_featured,
  sort_order       = excluded.sort_order;

-- 2. Per-currency prices. AED for all three (the studio's figures); INR only for
--    the new pack (placeholder). The existing pack-5 / pack-10 INR rows are
--    deliberately NOT touched here.
insert into public.plan_prices (plan_id, currency, amount_cents)
select p.id, v.currency, v.amount_cents
from (values
  ('pack-1',  'AED',   5900),
  ('pack-1',  'INR', 135000),  -- PLACEHOLDER — replace with the real India price
  ('pack-5',  'AED',  27500),
  ('pack-10', 'AED',  49900)
) as v(slug, currency, amount_cents)
join public.plans p on p.slug = v.slug
on conflict (plan_id, currency) do update set
  amount_cents = excluded.amount_cents,
  updated_at   = now();

-- 3. Feature list for the new pack (idempotent: clear then insert).
delete from public.plan_features
  where plan_id = (select id from public.plans where slug = 'pack-1');

insert into public.plan_features (plan_id, feature_text, is_included, sort_order)
select p.id, f.feature_text, true, f.sort_order
from (values
  ('1 personalised 1:1 session',                  1),
  ('Book any teacher, any style',                 2),
  ('60-min session on Google Meet',               3),
  ('Credit never expires',                        4),
  ('Cancel before the session — credit refunded', 5)
) as f(feature_text, sort_order)
cross join (select id from public.plans where slug = 'pack-1') p;
