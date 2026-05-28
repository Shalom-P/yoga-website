-- 0006_helper_rpcs.sql
-- Server-side RPCs the app calls for things that need extra logic.

-- Promote an existing user to admin. Only callable by an existing admin.
create or replace function public.promote_to_admin(target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'only admins can promote users';
  end if;
  update public.profiles set role = 'admin' where id = target_user_id;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, payload)
  values (auth.uid(), 'promote_to_admin', 'profile', target_user_id::text, '{}'::jsonb);
end $$;

-- KPI helper for the admin dashboard tiles
create or replace function public.admin_kpis()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_signups_today int;
  v_trials_today int;
  v_paid_active int;
  v_mrr_aud_cents bigint;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'admin only';
  end if;

  select count(*) into v_signups_today
    from public.profiles where created_at >= date_trunc('day', now());

  select count(*) into v_trials_today
    from public.bookings where is_free_trial = true and created_at >= date_trunc('day', now());

  select count(*) into v_paid_active
    from public.subscriptions where status = 'active';

  select coalesce(sum(
    case p.billing_interval
      when 'monthly' then p.price_aud_cents
      when 'quarterly' then p.price_aud_cents / 3
      when 'yearly' then p.price_aud_cents / 12
    end
  ), 0) into v_mrr_aud_cents
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.status = 'active';

  return jsonb_build_object(
    'signups_today', v_signups_today,
    'trials_today', v_trials_today,
    'paid_active_subs', v_paid_active,
    'mrr_aud_cents', v_mrr_aud_cents
  );
end $$;

-- Pretty admin_settings get-many helper (the landing page reads several keys at once)
create or replace function public.get_admin_settings(keys text[])
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from public.admin_settings where key = any(keys);
$$;
