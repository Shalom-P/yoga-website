-- 0050_customer_follow_ups.sql
--
-- Customer follow-up log for /admin/customers.
--
-- The studio follows people up by hand (WhatsApp, a call, an email) and had
-- nowhere to write down who was contacted, what they said, or when to try
-- again. Each row is one contact or note; the newest row's next_follow_up_on
-- is that customer's current due date (NULL on the newest row = nothing due).
-- Append-only: no UPDATE or DELETE policy, so the history cannot be quietly
-- rewritten. A wrong note is corrected by writing a newer one.
--
-- Admin-only, like the rest of the admin console. Rows go when the customer is
-- deleted (on delete cascade from profiles, which auth.admin.deleteUser
-- already cascades into), so neither copy of the account-delete cascade
-- (lib/account/deleteAccount.ts, supabase/functions/delete-account) needs a
-- change. These are sales notes, not health records: medical documents keep
-- their own private bucket, which admins deliberately cannot read.
--
-- Additive, safe to apply before the code that reads it deploys.
create table if not exists public.customer_follow_ups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  channel text not null default 'note'
    check (channel in ('whatsapp', 'call', 'email', 'note')),
  note text not null check (char_length(btrim(note)) between 1 and 2000),
  next_follow_up_on date,
  created_at timestamptz not null default now()
);

comment on table public.customer_follow_ups is
  'Append-only admin log of customer contacts (0050). Newest row per customer carries the current next_follow_up_on.';

create index if not exists customer_follow_ups_customer_idx
  on public.customer_follow_ups (customer_id, created_at desc);

alter table public.customer_follow_ups enable row level security;

drop policy if exists "customer_follow_ups_admin_read" on public.customer_follow_ups;
create policy "customer_follow_ups_admin_read" on public.customer_follow_ups
  for select to authenticated
  using (public.is_admin(auth.uid()));

-- author_id must be the writer, so the log says truthfully who wrote each line.
drop policy if exists "customer_follow_ups_admin_insert" on public.customer_follow_ups;
create policy "customer_follow_ups_admin_insert" on public.customer_follow_ups
  for insert to authenticated
  with check (public.is_admin(auth.uid()) and author_id = auth.uid());

revoke all on public.customer_follow_ups from anon, authenticated;
grant select, insert on public.customer_follow_ups to authenticated;
