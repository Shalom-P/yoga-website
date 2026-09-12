-- 0036_international_currencies.sql
-- Widen the set of currencies a pack may be priced in.
--
-- The studio dropped its service-area gate (customers can sign up and book from
-- anywhere), but pricing was still limited to INR and AED by a CHECK on
-- plan_prices.currency, so everyone else was billed in rupees. This lets an
-- admin price the packs in USD, GBP and EUR as well.
--
-- IMPORTANT — this migration deliberately inserts NO prices.
--
-- A currency only goes live once EVERY active plan has a plan_prices row for it
-- (see pricedCurrencies() in lib/razorpay/catalog.ts). Until an admin sets those
-- amounts in /admin/plans, resolution downgrades to INR exactly as it does
-- today, so applying this changes nothing a customer can see. That is the point:
-- the prices are a commercial decision, not a schema one, and nobody should be
-- charged a number that a migration guessed from an exchange rate.
--
-- Note also that `plans.price_base_cents` is INR-denominated and is only ever a
-- fallback for INR. Before 0036 the catalog used it as the fallback for *any*
-- currency, so a plan missing its row would have been charged the rupee figure
-- under a foreign symbol (99900 paise -> USD 999.00). That fallback is gone.
--
-- Enabling a currency still requires Razorpay International acceptance on the
-- account; the schema is necessary but not sufficient.
--
-- Apply:
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0036_international_currencies.sql

alter table public.plan_prices
  drop constraint if exists plan_prices_currency_check;

alter table public.plan_prices
  add constraint plan_prices_currency_check
  check (currency in ('INR', 'AED', 'USD', 'GBP', 'EUR'));

-- `payments.currency` is written from what the provider actually captured and
-- has never been constrained (legacy AUD rows still exist), so it needs no
-- change here.

comment on column public.plan_prices.currency is
  'ISO 4217. Must be one of the app''s SUPPORTED_CURRENCIES (lib/geo/region.ts). A currency is only offered once every active plan has a row for it.';
