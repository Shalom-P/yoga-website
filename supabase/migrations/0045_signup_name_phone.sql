-- 0045_signup_name_phone.sql
--
-- Copy the name and phone an email sign-up gives on /login into the new profile.
--
-- Before this, an email sign-up created its auth user (and, through this
-- trigger, its profile) the moment the code was requested, with only the email
-- on it. Name and phone were asked for later, on /onboarding, so anyone who
-- never entered the code left an email-only customer row behind (11 Oct 2026:
-- omanm831d@gmail.com).
--
-- The login form now asks a NEW address for full name and mobile number before
-- sending the code, and passes them to signInWithOtp as user metadata
-- (raw_user_meta_data.full_name / .phone). full_name was already read here; this
-- adds phone. The metadata is client-supplied, so the phone is taken only when it
-- is canonical E.164 (what the form's toE164 produces) and the name is trimmed
-- and capped; anything else is ignored and /onboarding asks again.
--
-- The phone is not verified (neither is any other profiles.phone: it is a contact
-- field, never an auth factor). Onboarding is still required: the site treats a
-- profile as complete only with full_name, phone AND experience_level.
--
-- The live function had drifted from 0001: it also writes `role`, with a
-- hard-coded bootstrap that makes poshithsreddy@gmail.com an admin. That branch
-- is kept verbatim so this migration changes nothing but name/phone. (It is
-- effectively inert: 0029's INSERT branch pins role to 'customer' anyway.)
--
-- tg_profiles_lock_sensitive (0029) keeps new.phone on INSERT
-- (coalesce(new.phone, au.phone)), so the value survives that trigger.
--
-- Safe to apply before or after the deploy: without metadata it behaves exactly
-- like 0001's version. Idempotent.
-- Apply: supabase db query --linked -f supabase/migrations/0045_signup_name_phone.sql

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta_name  text := nullif(left(btrim(coalesce(
                       new.raw_user_meta_data->>'full_name',
                       new.raw_user_meta_data->>'name')), 120), '');
  meta_phone text := new.raw_user_meta_data->>'phone';
begin
  if meta_phone !~ '^\+[1-9][0-9]{6,14}$' then
    meta_phone := null;
  end if;

  insert into public.profiles (id, email, full_name, phone, avatar_url, role)
  values (
    new.id,
    new.email,
    meta_name,
    coalesce(nullif(new.phone, ''), meta_phone),
    new.raw_user_meta_data->>'avatar_url',
    case when lower(new.email) = 'poshithsreddy@gmail.com' then 'admin'::public.user_role
         else 'customer'::public.user_role end
  )
  on conflict (id) do nothing;
  return new;
end $$;
