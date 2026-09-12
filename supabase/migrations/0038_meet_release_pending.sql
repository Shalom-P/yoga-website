-- 0038: a fourth meet_status, for a Meet event that should be torn down.
--
-- Cancelling a booking has to delete the Google Calendar event, or the teacher
-- keeps a dead hour on their calendar and the customer keeps a join link to a
-- class that is not happening. Deleting it needs Google credentials, which
-- authenticate through Vercel OIDC -> GCP Workload Identity Federation and
-- therefore exist only on the Node side.
--
-- The `cancel-booking` Edge Function has no such credentials, for the same
-- reason `book-session` cannot provision a link (see its header). So it marks
-- the session instead, and cron/meet-retry — which already runs on Node with
-- those credentials — sweeps the marked ones and does the deletion.
--
-- This is the mirror image of what already happens on the way in: 'pending'
-- means "no link yet, go and make one", 'release_pending' means "link exists,
-- go and destroy it". Same cron, same cadence, opposite direction.
--
-- The constraint added in 0007 was inline and therefore auto-named, so it is
-- looked up rather than assumed.

do $$
declare
  v_name text;
begin
  select con.conname
    into v_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'sessions'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%meet_status%'
  limit 1;

  if v_name is not null then
    execute format('alter table public.sessions drop constraint %I', v_name);
  end if;

  alter table public.sessions
    add constraint sessions_meet_status_check
    check (meet_status in ('pending', 'created', 'failed', 'release_pending'));
end $$;

-- The sweep reads exactly this set, and it is normally empty.
create index if not exists sessions_meet_release_idx
  on public.sessions (meet_status)
  where meet_status = 'release_pending';
