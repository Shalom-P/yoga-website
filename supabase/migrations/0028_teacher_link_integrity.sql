-- 0028_teacher_link_integrity.sql
-- Two follow-ups to teacher provisioning (0025/0026) + medical sharing (0027),
-- from the post-merge review:
--
--   1. (INTEGRITY) Nothing at the DB level stopped one profile being linked to two
--      teacher records. The invite handler guards this with check-then-act reads
--      (app/api/admin/teachers/[id]/invite), but two concurrent invites of the same
--      email to two DIFFERENT teacher records could both pass and double-link —
--      after which every `.eq("profile_id", …).single()` teacher lookup throws.
--      A partial UNIQUE index makes the DB the source of truth: the second writer
--      now fails loudly (23505) instead of corrupting state.
--
--   2. (PHI) medical_document_shares.teacher_id references the teacher RECORD, not
--      the linked person. demote_from_teacher (0025) only nulls teachers.profile_id
--      and leaves shares active, so re-linking that record to a DIFFERENT account
--      later would silently inherit every document previously shared with it. Revoke
--      a teacher record's active shares the moment its profile_id moves away from a
--      person (demote, or any admin re-assignment) so PHI access ends with the
--      relationship. Record deletion already cascades shares away (0027 FK), so this
--      only needs to cover the unlink / re-assign path.
--
-- Depends on 0025 (teachers.profile_id, demote_from_teacher) + 0027 (shares table).
-- Idempotent / safe to re-run.
-- Apply: psql "$SUPABASE_DB_URL" -f supabase/migrations/0028_teacher_link_integrity.sql

-- ── 1. One profile ↔ at most one teacher record ──────────────────────────────
-- Partial UNIQUE ignores the many unlinked records (all NULL profile_id). It
-- FAILS LOUDLY if a duplicate link already exists — resolve that before re-running.
-- It also covers the `profile_id = uid` equality lookups owns_teacher() does, so the
-- older non-unique teachers_profile_id_idx (0025) is now redundant and is dropped.
drop index if exists public.teachers_profile_id_idx;
create unique index if not exists teachers_profile_id_uniq
  on public.teachers (profile_id) where profile_id is not null;

-- ── 2. Revoke a teacher record's shares when it is unlinked / re-assigned ─────
-- AFTER trigger (no recursion: it writes a different table). The WHEN clause fires
-- ONLY when profile_id moves away from a real person — A→NULL on demote, or A→B on
-- an admin re-assignment — never on the initial NULL→A link or an unrelated profile
-- edit (where tg_teachers_lock_admin_cols already pins profile_id unchanged).
create or replace function public.tg_teachers_revoke_shares_on_unlink()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- The new linked account, if any, must not inherit the prior person's grants.
  update public.medical_document_shares
     set revoked_at = now()
   where teacher_id = old.id
     and revoked_at is null;
  return null;
end $$;

drop trigger if exists teachers_revoke_shares_on_unlink on public.teachers;
create trigger teachers_revoke_shares_on_unlink
  after update of profile_id on public.teachers
  for each row
  when (old.profile_id is not null and old.profile_id is distinct from new.profile_id)
  execute function public.tg_teachers_revoke_shares_on_unlink();
