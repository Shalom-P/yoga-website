-- 0026_teacher_provisioning_fixes.sql
-- Two fixes to the teacher-provisioning objects added in 0025:
--
--   1. (CRITICAL) tg_teachers_lock_admin_cols clobbered profile_id on the very
--      UPDATE that promote_to_teacher uses to link a teacher. promote_to_teacher
--      runs via the service-role invite handler, where auth.uid() is NULL, so
--      is_admin(auth.uid()) was false and the trigger pinned profile_id back to
--      its OLD value (NULL) — the teacher was never actually linked. A NULL
--      auth.uid() means a service-role / SECURITY DEFINER server path, which is
--      already gated by its own admin check AND by the fact that anon/authenticated
--      non-admins have no UPDATE policy on teachers; so treat it as privileged.
--      Only an authenticated NON-admin (a teacher editing their own row) gets the
--      admin-only columns pinned.
--
--   2. demote_from_teacher set role='customer' for ANY target, so it could quietly
--      demote an admin. Scope the role flip to actual teachers.
--
-- Both are create-or-replace, safe to re-run.
-- Apply: psql "$SUPABASE_DB_URL" -f supabase/migrations/0026_teacher_provisioning_fixes.sql

-- ── 1. Column guard: don't pin columns on privileged (admin / server) writes ──
create or replace function public.tg_teachers_lock_admin_cols()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Admins (browser, auth.uid() = admin) change anything; a NULL auth.uid() is a
  -- service-role / SECURITY DEFINER path (e.g. promote_to_teacher linking
  -- profile_id), already gated upstream. Only a logged-in non-admin teacher gets
  -- the admin-only columns pinned to their OLD values.
  if auth.uid() is null or public.is_admin(auth.uid()) then
    return new;
  end if;
  new.profile_id         := old.profile_id;
  new.slug               := old.slug;
  new.is_active          := old.is_active;
  new.sort_order         := old.sort_order;
  new.rating_avg         := old.rating_avg;
  new.rating_count       := old.rating_count;
  new.google_calendar_id := old.google_calendar_id;
  new.timezone           := old.timezone; -- availability is interpreted in this TZ
  return new;
end $$;

-- ── 2. demote_from_teacher: never silently demote a non-teacher (e.g. an admin) ─
create or replace function public.demote_from_teacher(target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'only admins can demote teachers';
  end if;
  if auth.uid() = target_user_id then
    raise exception 'you cannot demote yourself';
  end if;
  -- Scope the role flip to actual teachers so calling this on an admin/customer
  -- can't strip their role. The unlink below is still unconditional and harmless
  -- (clears any dangling profile_id link on the teacher record).
  update public.profiles set role = 'customer'
   where id = target_user_id and role = 'teacher';
  update public.teachers set profile_id = null where profile_id = target_user_id;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, payload)
  values (auth.uid(), 'demote_from_teacher', 'profile', target_user_id::text, '{}'::jsonb);
end $$;
