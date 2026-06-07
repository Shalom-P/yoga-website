-- 0010_admin_demote.sql
-- Adds a demote_from_admin RPC mirroring promote_to_admin.
--
-- IMPORTANT: apply this to the live DB before using the Demote button in the
-- admin UI (/admin/customers). Run in the Supabase SQL editor or via psql:
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0010_admin_demote.sql

create or replace function public.demote_from_admin(target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'only admins can demote users';
  end if;
  -- Prevent self-demotion to avoid locking yourself out.
  if auth.uid() = target_user_id then
    raise exception 'you cannot demote yourself';
  end if;
  update public.profiles set role = 'customer' where id = target_user_id;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, payload)
  values (auth.uid(), 'demote_from_admin', 'profile', target_user_id::text, '{}'::jsonb);
end $$;
