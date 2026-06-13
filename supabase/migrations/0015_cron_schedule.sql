-- 0015_cron_schedule.sql
-- Schedules the /api/cron/* handlers from inside Postgres using pg_cron + pg_net.
-- Host-agnostic: runs the Meet-retry / reminders / no-show sweeps without
-- depending on a specific hosting platform's scheduler.
--
-- APPLY THIS POST-DEPLOY — it needs the deployed public URL and the shared secret:
--   1. Deploy so https://<your-domain>/api/cron/* is reachable.
--   2. Store CRON_SECRET in Supabase Vault (run once; same value as the app env):
--        select vault.create_secret('<your CRON_SECRET>', 'cron_secret');
--   3. Replace 'https://YOUR_DOMAIN' below with your real domain.
--   4. Apply:  psql "$SUPABASE_DB_URL" -f supabase/migrations/0015_cron_schedule.sql
--
-- Re-running is safe: each job is unscheduled first if it already exists. The
-- secret is read from Vault at run time, never written into the cron command.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  base_url text := 'https://YOUR_DOMAIN';  -- <-- replace with your deployed domain
  jobs text[][] := array[
    ['myc-meet-retry',    '*/15 * * * *', '/api/cron/meet-retry'],
    ['myc-reminders',     '*/15 * * * *', '/api/cron/reminders'],
    ['myc-no-show-sweep', '0 * * * *',    '/api/cron/no-show-sweep']
  ];
  j text[];
begin
  foreach j slice 1 in array jobs loop
    if exists (select 1 from cron.job where jobname = j[1]) then
      perform cron.unschedule(j[1]);
    end if;
    perform cron.schedule(
      j[1],
      j[2],
      format($f$
        select net.http_post(
          url     := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
          )
        );
      $f$, base_url || j[3])
    );
  end loop;
end $$;
