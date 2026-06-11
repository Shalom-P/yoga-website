-- 0013_profiles_insert_hardening.sql
-- Closes two gaps in 0012's profiles self-INSERT path:
--   * privilege escalation: tg_profiles_lock_sensitive (0007) fired BEFORE UPDATE
--     only, so a user whose profile row was missing could INSERT their own row
--     with role='admin' — the column default doesn't apply to explicit values,
--     and the policy's WITH CHECK only constrained id.
--   * identity drift: a self-inserted row carried whatever email/phone the client
--     sent (usually nothing), and the UPDATE lock then made a NULL email
--     permanent — reminder emails silently skip profiles with no email.
-- Fix at the trigger level: on non-admin INSERT, force role='customer' and take
-- email/phone/avatar from auth.users — the same source handle_new_user() uses.

create or replace function public.tg_profiles_lock_sensitive()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  au auth.users%rowtype;
begin
  if public.is_admin(auth.uid()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'customer';
    select * into au from auth.users where id = new.id;
    new.email := au.email;
    new.phone := coalesce(new.phone, au.phone);
    new.avatar_url := coalesce(new.avatar_url, au.raw_user_meta_data->>'avatar_url');
  else
    new.role := old.role;
    new.email := old.email;
  end if;
  return new;
end $$;

drop trigger if exists profiles_lock_sensitive on public.profiles;
create trigger profiles_lock_sensitive
  before insert or update on public.profiles
  for each row execute function public.tg_profiles_lock_sensitive();

-- Belt-and-braces: constrain the policy too, so the invariant holds even if the
-- trigger is ever dropped or renamed.
drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert"
  on public.profiles for insert
  with check (auth.uid() = id and role = 'customer');

-- Repair any rows self-inserted between 0012 and this migration that are
-- missing the email handle_new_user() would have copied.
update public.profiles p
set email = u.email,
    phone = coalesce(p.phone, u.phone)
from auth.users u
where u.id = p.id
  and p.email is null
  and u.email is not null;
