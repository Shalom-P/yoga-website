-- 0018_rls_and_grants_hardening.sql
-- Round-2 code-review RLS / grant hardening:
--
--   * reviews_self_update had USING but no WITH CHECK, so a customer could
--     UPDATE their own review and set is_approved/is_featured = true, pushing
--     unmoderated content onto the public marketing site. Add a WITH CHECK that
--     pins both flags false on self-edits (only the admin policy can approve).
--   * bookings_self_update_cancel was named "cancel" but allowed a customer to
--     mutate ANY column of their own booking (e.g. flip no_show -> attended).
--     Restrict the self-UPDATE to a confirmed -> cancelled transition.
--   * promote_to_admin / demote_from_admin / admin_kpis self-gate via is_admin()
--     but were EXECUTE-able by anon by PostgREST default. Revoke from anon so an
--     unauthenticated caller can't even attempt them. They remain callable by
--     `authenticated` because the admin UI invokes them as the logged-in admin.
--   * subscribe_newsletter: tighten the email-shape check (the old one accepted
--     a bare "@").
--
-- Apply:  psql "$SUPABASE_DB_URL" -f supabase/migrations/0018_rls_and_grants_hardening.sql

-- Reviews: a customer can edit their own review text/rating, but cannot approve
-- or feature it. Approval/featuring is the admin policy's job.
drop policy if exists "reviews_self_update" on public.reviews;
create policy "reviews_self_update" on public.reviews for update
  using (auth.uid() = customer_id)
  with check (
    auth.uid() = customer_id
    and is_approved = false
    and is_featured = false
  );

-- Bookings: self-service update is cancellation only (confirmed -> cancelled).
-- Any other status change / field edit must go through the service-role API.
drop policy if exists "bookings_self_update_cancel" on public.bookings;
create policy "bookings_self_update_cancel" on public.bookings for update
  using (auth.uid() = customer_id and status = 'confirmed')
  with check (auth.uid() = customer_id and status = 'cancelled');

-- Admin mutators / KPIs: keep them out of anon's reach entirely. EXECUTE is
-- granted via PUBLIC by default, so revoking from `anon` alone leaves the PUBLIC
-- grant intact — revoke from PUBLIC and re-grant to `authenticated` (the admin
-- UI calls these as the logged-in admin; they self-gate via is_admin()).
-- Guarded so this applies whether or not 0010 (demote_from_admin) has run yet.
do $$ begin
  execute 'revoke execute on function public.promote_to_admin(uuid) from public, anon';
  execute 'grant execute on function public.promote_to_admin(uuid) to authenticated';
exception when undefined_function then null; end $$;
do $$ begin
  execute 'revoke execute on function public.demote_from_admin(uuid) from public, anon';
  execute 'grant execute on function public.demote_from_admin(uuid) to authenticated';
exception when undefined_function then null; end $$;
do $$ begin
  execute 'revoke execute on function public.admin_kpis() from public, anon';
  execute 'grant execute on function public.admin_kpis() to authenticated';
exception when undefined_function then null; end $$;

-- Newsletter: stricter email shape (still SECURITY DEFINER + on-conflict-do-nothing
-- so it can't be used to enumerate subscribed emails).
create or replace function public.subscribe_newsletter(p_email text, p_source text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_email is null
     or length(p_email) > 320
     or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return;
  end if;
  insert into public.newsletter_signups (email, source)
  values (lower(trim(p_email)), substr(coalesce(p_source, ''), 1, 50))
  on conflict (email) do nothing;
end $$;
