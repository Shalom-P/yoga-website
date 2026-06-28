-- 0030_bank_transfer_payments.sql
--
-- Manual SWIFT / bank-transfer payments for UAE (AED) customers. This is a
-- TEMPORARY payment rail shown to UAE customers while Razorpay International
-- (AED card payments) is being enabled — India (INR) keeps Razorpay Checkout.
--
-- A UAE customer who clicks "Get this pack" gets a `pending` payment row (method
-- 'bank_transfer') and SWIFT instructions; an admin verifies the incoming
-- transfer, which flips the row to 'completed' and grants the pack's
-- session-credits through the existing grant_session_credits() idempotency
-- (purchase-once on payment_id). No new RPC is needed — the admin verify route
-- mirrors lib/razorpay/fulfillment.ts on the service-role client.
--
-- Apply: psql "$SUPABASE_DB_URL" -f supabase/migrations/0030_bank_transfer_payments.sql

-- 1. New payments columns.
--    - method:      which rail recorded this payment.
--    - plan_id:     the pack purchased (manual transfers carry no Razorpay order
--                   notes, so we must remember which pack to credit on verify).
--    - reference:   short human-friendly code the customer cites in the transfer
--                   so an admin can match an incoming SWIFT payment.
--    - verified_by / verified_at: audit of the admin who released the credits.
alter table public.payments
  add column if not exists method text not null default 'razorpay',
  add column if not exists plan_id uuid references public.plans(id) on delete set null,
  add column if not exists reference text,
  add column if not exists verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists verified_at timestamptz;

-- Backfill: historical PayPal rows predate `method`; label them so the new
-- default ('razorpay') doesn't misattribute them.
update public.payments
  set method = 'paypal'
  where paypal_capture_id is not null and method = 'razorpay';

-- Constrain to the known rails.
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments
  add constraint payments_method_check
  check (method in ('razorpay', 'bank_transfer', 'paypal'));

-- 2. The transfer reference is unique when present, so it can be used to
--    unambiguously reconcile an incoming SWIFT transfer to one pending payment.
create unique index if not exists payments_reference_key
  on public.payments(reference)
  where reference is not null;

-- 3. Index the admin "pending bank transfers" verification queue.
create index if not exists payments_bank_transfer_idx
  on public.payments(status, created_at desc)
  where method = 'bank_transfer';

-- 4. Enforce "at most one OPEN bank transfer per customer + pack" at the DB
--    level, so two concurrent /api/payments/intent calls (double-click, two
--    tabs, a retry) can't both insert a pending row and end up double-credited
--    when an admin verifies each. The intent route catches 23505 and re-reads
--    the row that won the race. (No rows exist yet, so this index builds clean.)
create unique index if not exists payments_one_pending_bank_transfer
  on public.payments(customer_id, plan_id)
  where method = 'bank_transfer' and status = 'pending';

-- RLS is unchanged and already correct:
--   * payments_self_read lets a customer read their own pending transfer (for
--     the /dashboard/plan "view instructions" card).
--   * payments_admin_all (public.is_admin) lets admins read every transfer for
--     the verification queue.
--   * All inserts/verifies run on the service-role client, which bypasses RLS.
