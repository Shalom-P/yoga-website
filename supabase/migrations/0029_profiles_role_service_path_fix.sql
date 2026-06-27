-- 0029_profiles_role_service_path_fix.sql
-- (CRITICAL) tg_profiles_lock_sensitive (0007/0013) pinned new.role := old.role on
-- EVERY non-admin UPDATE — including the service-role / SECURITY DEFINER server path
-- where auth.uid() IS NULL. promote_to_teacher / promote_to_admin / demote_* run via
-- the service-role client (the teacher invite handler, app/api/admin/teachers/[id]/
-- invite), where auth.uid() is NULL, so is_admin(auth.uid()) was false and this
-- trigger SILENTLY REVERTED the role flip those RPCs exist to perform. The teacher
-- record got linked (0026 already exempted the teachers trigger for NULL auth.uid())
-- and the audit_log row was written, but the profile stayed role='customer' — a
-- half-promoted teacher who then gets bounced out of /teacher by the middleware.
--
-- Fix is the exact analog of 0026's teachers-trigger carve-out: a NULL auth.uid()
-- is a service-role / SECURITY DEFINER path, already gated upstream (the promote/
-- demote RPCs self-gate on is_admin(v_actor); the service client bypasses RLS by
-- design; and no anon/authenticated UPDATE policy on profiles passes without
-- auth.uid() = id). So only a LOGGED-IN non-admin (auth.uid() = their own id, the
-- profiles_self_update path) gets role/email pinned.
--
-- Scope kept minimal: only the UPDATE branch's role/email pin is relaxed. The
-- INSERT hardening (0013: force role='customer' + identity from auth.users on
-- self-insert) is left fully intact, so elevation can still ONLY happen through the
-- promote_* RPCs, never via a self-INSERT with role='admin'/'teacher'.
--
-- Depends on 0013 (current tg_profiles_lock_sensitive). Idempotent / safe to re-run.
-- Apply: psql "$SUPABASE_DB_URL" -f supabase/migrations/0029_profiles_role_service_path_fix.sql

create or replace function public.tg_profiles_lock_sensitive()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  au auth.users%rowtype;
begin
  if public.is_admin(auth.uid()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- Unchanged from 0013: a non-admin self-insert is forced to role='customer'
    -- with identity copied from auth.users. A NULL auth.uid() insert (handle_new_user
    -- / server paths) is likewise pinned to 'customer' on purpose — elevation must
    -- go through the promote_* RPCs (an UPDATE), never a privileged INSERT.
    new.role := 'customer';
    select * into au from auth.users where id = new.id;
    new.email := au.email;
    new.phone := coalesce(new.phone, au.phone);
    new.avatar_url := coalesce(new.avatar_url, au.raw_user_meta_data->>'avatar_url');
  else
    -- UPDATE. A logged-in non-admin (auth.uid() = their id) may not change their
    -- own role/email, so pin both. But auth.uid() IS NULL means a service-role /
    -- SECURITY DEFINER server path (e.g. promote_to_teacher) that is already gated
    -- upstream — letting it through is what makes the promote/demote RPCs actually
    -- stick. (Analog of the 0026 fix for tg_teachers_lock_admin_cols.)
    if auth.uid() is not null then
      new.role := old.role;
      new.email := old.email;
    end if;
  end if;
  return new;
end $$;

-- Trigger definition itself is unchanged (0013); create-or-replace of the function
-- is enough. Re-asserted here for clarity / standalone re-runs.
drop trigger if exists profiles_lock_sensitive on public.profiles;
create trigger profiles_lock_sensitive
  before insert or update on public.profiles
  for each row execute function public.tg_profiles_lock_sensitive();
