-- 0019_refund_reconciliation.sql
-- Round-2 code-review fix: the Razorpay webhook ignored refund events, so a
-- refunded customer kept their granted session-credits. This adds an idempotent
-- clawback that the webhook calls on a full refund.
--
--   * credit_ledger.external_ref + a partial unique index keyed on the Razorpay
--     refund id makes a redelivered refund webhook a no-op.
--   * clawback_session_credits() debits the customer's balance (clamped at 0 —
--     credits already spent on a booking can't be reclaimed) and writes the
--     'refund' audit ledger row.
--
-- Apply:  psql "$SUPABASE_DB_URL" -f supabase/migrations/0019_refund_reconciliation.sql

alter table public.credit_ledger
  add column if not exists external_ref text;

-- One clawback per refund reference (idempotency for redelivered webhooks).
create unique index if not exists credit_ledger_refund_once
  on public.credit_ledger(external_ref)
  where reason = 'refund';

create or replace function public.clawback_session_credits(
  p_customer uuid,
  p_amount int,
  p_external_ref text,
  p_payment_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_amount is null or p_amount <= 0 or p_external_ref is null then
    return;
  end if;

  -- Idempotency: one clawback per refund reference. If this refund was already
  -- processed, the ledger insert is a no-op and we stop.
  insert into public.credit_ledger (customer_id, delta, reason, payment_id, external_ref)
  values (p_customer, -p_amount, 'refund', p_payment_id, p_external_ref)
  on conflict (external_ref) where reason = 'refund' do nothing;
  if not found then
    return;
  end if;

  -- Debit the balance, clamped at zero: a customer who already spent the credits
  -- can't be pushed negative (the balance >= 0 CHECK would otherwise reject it).
  update public.customer_credits
    set balance = greatest(balance - p_amount, 0), updated_at = now()
    where customer_id = p_customer;
end $$;

revoke execute on function
  public.clawback_session_credits(uuid, int, text, uuid)
  from public, anon, authenticated;
