-- 0034_push_tokens.sql
-- Device push tokens for the native iOS app (APNs). Captured client-side after
-- the user grants notification permission (lib/native/push.ts → POST
-- /api/push/register) and read service-side by the reminders cron to send pushes
-- (lib/push/apns.ts). One row per device token; a token re-registers to whichever
-- user most recently signed in on that device.
--
-- Apply to the live DB (psql / Supabase SQL editor) before launch — the register
-- endpoint and the push leg of the reminders cron are inert until this exists.

create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  token       text not null unique,
  platform    text not null default 'ios',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

-- Pin the token shape at the DB level. The register route validates the same
-- shape, but the DB must enforce it too: the token is later interpolated into
-- the APNs HTTP/2 :path (lib/push/apns.ts), so no write path may bypass it.
alter table public.push_tokens
  drop constraint if exists push_tokens_token_format;
alter table public.push_tokens
  add constraint push_tokens_token_format check (token ~ '^[0-9a-fA-F]{64,200}$');

alter table public.push_tokens enable row level security;

-- Read/delete own rows only. Deliberately NO client INSERT/UPDATE policies:
-- POST /api/push/register (service role) is the only writer, which is what
-- enforces the token regex and the per-user row cap. A client write policy
-- would open a second PostgREST write path around both (Supabase's default
-- table grants to `authenticated` make RLS the only write boundary here).
drop policy if exists "push_tokens_select_own" on public.push_tokens;
create policy "push_tokens_select_own" on public.push_tokens
  for select using (auth.uid() = user_id);

drop policy if exists "push_tokens_insert_own" on public.push_tokens;
drop policy if exists "push_tokens_update_own" on public.push_tokens;

drop policy if exists "push_tokens_delete_own" on public.push_tokens;
create policy "push_tokens_delete_own" on public.push_tokens
  for delete using (auth.uid() = user_id);
