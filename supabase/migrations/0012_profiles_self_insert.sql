-- 0012_profiles_self_insert.sql
-- Users can insert their own profile row. Normally handle_new_user() creates it
-- on signup, but accounts created before that trigger existed (or if it ever
-- fails) have no row — and a client-side UPDATE matching zero rows reports
-- success, so onboarding silently no-ops and re-appears on every login.
-- With this policy the onboarding form can upsert, making the flow self-healing.
-- role/email remain protected: role defaults to 'customer' on insert and the
-- profiles_lock_sensitive trigger blocks non-admin changes on update.

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert"
  on public.profiles for insert
  with check (auth.uid() = id);
