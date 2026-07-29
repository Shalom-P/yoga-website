-- 0035_retain_financial_records_on_delete.sql
-- Detach financial history from deleted customers instead of destroying it.
--
-- Why: POST /api/account/delete (App Store Guideline 5.1.1(v)) removes the auth
-- user, and profiles cascades from auth.users. Before this migration BOTH
-- payments.customer_id (0004) and discount_redemptions.customer_id (0032) were
-- ON DELETE CASCADE, so a customer self-deleting their account would:
--   * hard-delete their Razorpay captures and verified bank transfers — records
--     UAE VAT (~5y) and India GST/income-tax (6y+) require retaining;
--   * silently shrink admin_kpis() month-to-date revenue, which is computed
--     FROM public.payments (0022);
--   * free their promo-code slots: reserve_discount_redemption counts live
--     reserved+committed rows against max_uses / per_email_max, so deleting the
--     rows lets the same person re-register and redeem a one-per-email code
--     again.
-- Guideline 5.1.1(v) explicitly allows retaining data required by law, so
-- keeping these rows does not endanger the App Store deletion requirement.
--
-- What changes: the two FKs become ON DELETE SET NULL with a nullable column.
-- The rows survive anonymised at the FK level (the redemption's snapshotted
-- lowercased email — needed for per_email_max — survives with the row; it is
-- billing data retained under the same legal basis as the payment itself).
-- PHI is untouched: medical_documents and its shares/access log keep their
-- cascades — deletion still removes all health data.
--
-- RLS: the self-read policies on both tables use auth.uid() = customer_id,
-- which is never true for NULL customer_id, so detached rows are visible to
-- admins / the service role only. No policy change needed.
--
-- Apply to the live DB (psql / Supabase SQL editor) BEFORE deploying
-- /api/account/delete. Per repo convention: writing the file is not enough.

begin;

-- Drop whatever FK currently covers <table>.customer_id by discovery, not by
-- guessed name: `drop constraint if exists <wrong-name>` would silently no-op
-- and the subsequent ADD would then leave the old CASCADE constraint alive
-- alongside the new one.
do $$
declare
  rec record;
begin
  for rec in
    select conrelid::regclass as tbl, conname
      from pg_constraint
     where contype = 'f'
       and conrelid in ('public.payments'::regclass,
                        'public.discount_redemptions'::regclass)
       and 'customer_id' = any (
             select attname
               from unnest(conkey) as k
               join pg_attribute on attrelid = conrelid and attnum = k
           )
  loop
    execute format('alter table %s drop constraint %I', rec.tbl, rec.conname);
  end loop;
end $$;

-- payments: keep the money trail.
alter table public.payments
  alter column customer_id drop not null;
alter table public.payments
  add constraint payments_customer_id_fkey
    foreign key (customer_id) references public.profiles(id) on delete set null;

-- discount_redemptions: keep the promo audit trail + abuse counters.
alter table public.discount_redemptions
  alter column customer_id drop not null;
alter table public.discount_redemptions
  add constraint discount_redemptions_customer_id_fkey
    foreign key (customer_id) references public.profiles(id) on delete set null;

commit;
