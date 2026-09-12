-- 0037_discount_codes_international_currencies.sql
-- Widen discount_codes.currency to match plan_prices.currency.
--
-- 0036 let a pack be priced in USD/GBP/EUR but left the currency lock added in
-- 0032 at ('INR','AED'). That lock is what stops a fixed-amount code from being
-- applied across currencies whose minor units differ by ~90x, so leaving it
-- behind is worse than not having the new currencies at all:
--
--   * A fixed-amount code CANNOT be created with currency = 'USD' — the old
--     CHECK rejects it — so the only way to offer one to a US customer is to
--     leave currency NULL, which means "any currency".
--   * reserve_discount_redemption then applies the stored integer minor-unit
--     amount directly in the order currency (see the discount math in 0032).
--     A code meant as 50000 paise (INR 500) off becomes 50000 cents (USD 500)
--     off for a US buyer — past the pack price, so it either trips the
--     `final < 100` floor or gives the pack away.
--
-- Percentage codes are currency-agnostic and keep currency NULL; nothing about
-- them changes here.
--
-- No data migration: existing rows are INR, AED or NULL, all still valid.
--
-- Apply:
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0037_discount_codes_international_currencies.sql

alter table public.discount_codes
  drop constraint if exists discount_codes_currency_chk;

alter table public.discount_codes
  add constraint discount_codes_currency_chk
  check (currency is null or currency in ('INR', 'AED', 'USD', 'GBP', 'EUR'));

comment on column public.discount_codes.currency is
  'ISO 4217, or NULL for "any currency". Must stay in step with plan_prices.currency and the app''s SUPPORTED_CURRENCIES (lib/geo/region.ts): a fixed_amount_cents code is only safe when locked to the currency its minor units are denominated in.';
