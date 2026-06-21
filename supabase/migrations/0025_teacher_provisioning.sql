-- 0025_teacher_provisioning.sql
-- Teacher login accounts: identity helpers, promote/demote RPCs, teacher-self RLS,
-- and a column guard so a teacher can edit their own public profile but not the
-- admin-only fields. Mirrors the promote_to_admin (0006) / demote_from_admin (0010)
-- privilege-grant pattern and the SECURITY DEFINER is_admin() helper (0001).
--
-- Depends on 0024 (the 'teacher' enum value) already being applied.
-- Apply: psql "$SUPABASE_DB_URL" -f supabase/migrations/0025_teacher_provisioning.sql

-- ── Identity helpers (SECURITY DEFINER → never re-enter RLS, so no recursion) ──
create or replace function public.is_teacher(uid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = uid and role = 'teacher');
$$;

-- True when uid is the linked account for teacher record t_id.
create or replace function public.owns_teacher(uid uuid, t_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.teachers where id = t_id and profile_id = uid);
$$;

-- True when uid is the teacher for the session a booking belongs to. Used by the
-- bookings RLS below; being SECURITY DEFINER it reads sessions WITHOUT RLS, which
-- breaks the bookings→sessions→bookings policy cycle (sessions_booked_customer_read
-- in 0003 references bookings).
create or replace function public.teacher_owns_booking(uid uuid, b_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from public.bookings b
    join public.sessions s on s.id = b.session_id
    join public.teachers t on t.id = s.teacher_id
    where b.id = b_id and t.profile_id = uid
  );
$$;

-- ── Provisioning RPCs (mirror promote_to_admin 0006 / demote_from_admin 0010) ─
-- Elevate an existing auth user to 'teacher' AND link them to a teacher record,
-- atomically. acting_admin_id lets the service-role invite handler call this when
-- there is no auth.uid(); browser callers (the logged-in admin) can omit it.
create or replace function public.promote_to_teacher(
  target_user_id uuid,
  target_teacher_id uuid,
  acting_admin_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := coalesce(auth.uid(), acting_admin_id);
begin
  if not public.is_admin(v_actor) then
    raise exception 'only admins can promote teachers';
  end if;
  -- Link the teacher record. Guard makes a repeat call (same user) a no-op and
  -- refuses to steal a record already linked to a different account.
  update public.teachers
     set profile_id = target_user_id
   where id = target_teacher_id
     and (profile_id is null or profile_id = target_user_id);
  if not found then
    raise exception 'teacher record not found or already linked to another account';
  end if;
  update public.profiles set role = 'teacher' where id = target_user_id;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, payload)
  values (v_actor, 'promote_to_teacher', 'profile', target_user_id::text,
          jsonb_build_object('teacher_id', target_teacher_id));
end $$;

-- Revoke teacher access: revert role to customer and unlink the teacher record.
-- The teacher data record itself is preserved (falls back to admin management).
create or replace function public.demote_from_teacher(target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'only admins can demote teachers';
  end if;
  if auth.uid() = target_user_id then
    raise exception 'you cannot demote yourself';
  end if;
  update public.profiles set role = 'customer' where id = target_user_id;
  update public.teachers set profile_id = null where profile_id = target_user_id;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, payload)
  values (auth.uid(), 'demote_from_teacher', 'profile', target_user_id::text, '{}'::jsonb);
end $$;

-- Keep both out of anon's reach; grant to authenticated (the admin UI calls
-- demote as the logged-in admin, and promote self-gates via is_admin()). Matches
-- the 0018 grant hardening for promote_to_admin / demote_from_admin.
revoke execute on function public.promote_to_teacher(uuid, uuid, uuid) from public, anon;
revoke execute on function public.demote_from_teacher(uuid) from public, anon;
grant execute on function public.promote_to_teacher(uuid, uuid, uuid) to authenticated;
grant execute on function public.demote_from_teacher(uuid) to authenticated;

-- ── Column guard: a non-admin teacher may edit only public profile fields ─────
-- RLS WITH CHECK can't diff columns, so pin the admin-only columns to their OLD
-- values on a non-admin UPDATE. A teacher can change display_name / headline / bio
-- / specialties / languages / years_experience / certifications / *_url; admins
-- still change anything. Fires alongside teachers_set_updated_at (0002); trigger
-- name sorts before it so updated_at is still stamped afterwards.
create or replace function public.tg_teachers_lock_admin_cols()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin(auth.uid()) then
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

drop trigger if exists teachers_lock_admin_cols on public.teachers;
create trigger teachers_lock_admin_cols
  before update on public.teachers
  for each row execute function public.tg_teachers_lock_admin_cols();

-- ── Teacher-self RLS (all via the SECURITY DEFINER helpers → no recursion) ────
-- Existing public/admin/customer policies from 0002/0003 are left intact; these
-- are additive (PostgREST OR's policies of the same command).

-- teachers: read + update own row. The column guard above restricts which fields
-- actually change; teachers_public_read (0002) still serves the marketing site,
-- and this self-read also covers a hidden (is_active=false) teacher seeing self.
drop policy if exists "teachers_self_read" on public.teachers;
create policy "teachers_self_read" on public.teachers
  for select using (public.owns_teacher(auth.uid(), id));

drop policy if exists "teachers_self_update" on public.teachers;
create policy "teachers_self_update" on public.teachers
  for update using (public.owns_teacher(auth.uid(), id))
  with check (public.owns_teacher(auth.uid(), id));

-- availability + overrides: teacher self-manages their own (still public-read
-- from 0002, so customers keep seeing bookable slots).
drop policy if exists "teacher_availability_self_all" on public.teacher_availability;
create policy "teacher_availability_self_all" on public.teacher_availability
  for all using (public.owns_teacher(auth.uid(), teacher_id))
  with check (public.owns_teacher(auth.uid(), teacher_id));

drop policy if exists "teacher_slot_overrides_self_all" on public.teacher_slot_overrides;
create policy "teacher_slot_overrides_self_all" on public.teacher_slot_overrides
  for all using (public.owns_teacher(auth.uid(), teacher_id))
  with check (public.owns_teacher(auth.uid(), teacher_id));

-- sessions + bookings: read-only for the owning teacher. Creation, cancellation
-- and attendance/no_show stay with the admin API + cron (service role).
drop policy if exists "sessions_teacher_read" on public.sessions;
create policy "sessions_teacher_read" on public.sessions
  for select using (public.owns_teacher(auth.uid(), teacher_id));

drop policy if exists "bookings_teacher_read" on public.bookings;
create policy "bookings_teacher_read" on public.bookings
  for select using (public.teacher_owns_booking(auth.uid(), id));

-- Speeds up owns_teacher() / teacher-self reads.
create index if not exists teachers_profile_id_idx on public.teachers (profile_id);
