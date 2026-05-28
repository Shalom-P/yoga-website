-- 0007_security_fixes.sql
-- Hardens the gaps surfaced by the post-build code review:
--   * profiles.role can no longer be self-promoted
--   * sessions remain visible to the booked customer once live (drops start_at > now())
--   * validate_discount_code requires auth (no public brute-force oracle)
--   * one free-trial booking per customer (DB-enforced)
--   * PayPal webhook event_id idempotency table
--   * Discount-apply RPC for the webhook (idempotent times_used increment)
--   * sessions.meet_status for Meet-link retry tracking
--   * newsletter signups gated through a SECURITY DEFINER RPC so anon clients can't
--     enumerate existing emails via unique-conflict probing

-- 1. Lock sensitive columns on profiles via a BEFORE-UPDATE trigger.
--    role/email cannot be changed by non-admins regardless of any update path.
create or replace function public.tg_profiles_lock_sensitive()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
    new.role := old.role;
    new.email := old.email;
  end if;
  return new;
end $$;

drop trigger if exists profiles_lock_sensitive on public.profiles;
create trigger profiles_lock_sensitive
  before update on public.profiles
  for each row execute function public.tg_profiles_lock_sensitive();

-- Add WITH CHECK to profiles_self_update for belt-and-braces protection.
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 2. Sessions: allow continued visibility once live. Authenticated booked
--    customers already have sessions_booked_customer_read; this widens the
--    public-read policy so logged-out previews of "happening now" widgets work.
drop policy if exists "sessions_public_read_scheduled" on public.sessions;
create policy "sessions_public_read_scheduled"
  on public.sessions for select
  using (status in ('scheduled', 'live'));

-- 3. Lock validate_discount_code from anonymous callers and add an auth gate inside.
revoke execute on function public.validate_discount_code(text, uuid) from public;
revoke execute on function public.validate_discount_code(text, uuid) from anon;

create or replace function public.validate_discount_code(p_code text, p_plan_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d public.discount_codes%rowtype;
begin
  if auth.uid() is null then return null; end if;
  select * into d from public.discount_codes
  where upper(code) = upper(p_code)
    and is_active = true
    and (valid_from <= now())
    and (valid_until is null or valid_until > now())
    and (max_uses is null or times_used < max_uses)
    and (applies_to_plan_ids is null or p_plan_id = any(applies_to_plan_ids))
  limit 1;
  if d.id is null then return null; end if;
  return jsonb_build_object(
    'id', d.id,
    'code', d.code,
    'discount_type', d.discount_type,
    'discount_value', d.discount_value
  );
end $$;

grant execute on function public.validate_discount_code(text, uuid) to authenticated;

-- 4. Idempotent discount-apply RPC for the PayPal webhook. Increments
--    discount_codes.times_used at most once per subscription, tracked via
--    subscriptions.discount_applied_at.
alter table public.subscriptions add column if not exists discount_applied_at timestamptz;

create or replace function public.apply_discount_to_subscription(p_subscription_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_code_id uuid;
begin
  update public.subscriptions
    set discount_applied_at = now()
    where id = p_subscription_id
      and discount_code_id is not null
      and discount_applied_at is null
    returning discount_code_id into v_code_id;
  if v_code_id is not null then
    update public.discount_codes
      set times_used = times_used + 1
      where id = v_code_id;
  end if;
end $$;

revoke execute on function public.apply_discount_to_subscription(uuid) from public;
revoke execute on function public.apply_discount_to_subscription(uuid) from anon;
revoke execute on function public.apply_discount_to_subscription(uuid) from authenticated;
-- Service role only.

-- 5. PayPal webhook idempotency table. Primary key on event_id rejects replays.
create table if not exists public.paypal_webhook_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  payload jsonb
);

alter table public.paypal_webhook_events enable row level security;

drop policy if exists "paypal_webhook_events_admin_read" on public.paypal_webhook_events;
create policy "paypal_webhook_events_admin_read"
  on public.paypal_webhook_events for select
  using (public.is_admin(auth.uid()));
-- Inserts via service role only.

-- 6. Sessions.meet_status — explicit Meet-link state for cron retry.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sessions' and column_name = 'meet_status'
  ) then
    alter table public.sessions
      add column meet_status text
      check (meet_status in ('pending', 'created', 'failed'));
    create index sessions_meet_status_idx
      on public.sessions(meet_status)
      where meet_status = 'pending';
  end if;
end $$;

-- 7. Bookings: one non-cancelled free-trial booking per customer.
--    Customer can rebook only if their previous trial was cancelled.
create unique index if not exists bookings_one_free_trial_per_customer
  on public.bookings(customer_id)
  where is_free_trial = true and status <> 'cancelled';

-- 8. Newsletter: replace anon-INSERT policy with a SECURITY DEFINER RPC so
--    unique-conflict errors can't be used to enumerate subscribed emails.
create or replace function public.subscribe_newsletter(p_email text, p_source text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_email is null
     or length(p_email) > 320
     or position('@' in p_email) = 0 then
    return;
  end if;
  insert into public.newsletter_signups (email, source)
  values (lower(trim(p_email)), substr(coalesce(p_source, ''), 1, 50))
  on conflict (email) do nothing;
end $$;

revoke execute on function public.subscribe_newsletter(text, text) from public;
grant execute on function public.subscribe_newsletter(text, text) to anon, authenticated;

drop policy if exists "newsletter_anyone_insert" on public.newsletter_signups;
