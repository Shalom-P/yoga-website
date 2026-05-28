-- 0004_plans_payments.sql
-- Plans (AUD), discount codes, subscriptions (mirrored from PayPal), payments.

create type public.billing_interval as enum ('monthly', 'quarterly', 'yearly');
create type public.discount_type as enum ('percentage', 'fixed_aud_cents');
create type public.subscription_status as enum ('pending', 'active', 'suspended', 'cancelled', 'expired');
create type public.payment_status as enum ('pending', 'completed', 'refunded', 'failed');

create table public.plans (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  name text not null,
  description text,
  price_aud_cents int not null,
  billing_interval public.billing_interval not null default 'monthly',
  paypal_plan_id text,
  included_sessions_per_month int, -- null = unlimited
  included_session_types text[] default '{}',
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger plans_set_updated_at before update on public.plans for each row execute function public.tg_set_updated_at();
alter table public.plans enable row level security;
create policy "plans_public_read" on public.plans for select using (is_active = true);
create policy "plans_admin_all" on public.plans for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table public.plan_features (
  id uuid primary key default uuid_generate_v4(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature_text text not null,
  is_included boolean not null default true,
  sort_order int default 0
);
create index plan_features_plan_idx on public.plan_features(plan_id);
alter table public.plan_features enable row level security;
create policy "plan_features_public_read" on public.plan_features for select using (true);
create policy "plan_features_admin_all" on public.plan_features for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table public.discount_codes (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  discount_type public.discount_type not null,
  discount_value int not null,
  applies_to_plan_ids uuid[],
  max_uses int,
  times_used int not null default 0,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index discount_codes_code_idx on public.discount_codes(upper(code));
create trigger discount_codes_set_updated_at before update on public.discount_codes for each row execute function public.tg_set_updated_at();
alter table public.discount_codes enable row level security;
-- Customers cannot list codes; only validate via RPC.
create policy "discount_codes_admin_all" on public.discount_codes for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  paypal_subscription_id text not null unique,
  status public.subscription_status not null default 'pending',
  discount_code_id uuid references public.discount_codes(id) on delete set null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_billing_at timestamptz,
  started_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_customer_idx on public.subscriptions(customer_id);
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function public.tg_set_updated_at();
alter table public.subscriptions enable row level security;
-- Read your own; no client writes (service role only via webhook).
create policy "subscriptions_self_read" on public.subscriptions for select using (auth.uid() = customer_id);
create policy "subscriptions_admin_all" on public.subscriptions for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  paypal_capture_id text unique,
  amount_aud_cents int not null,
  currency text not null default 'AUD',
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index payments_customer_idx on public.payments(customer_id);
alter table public.payments enable row level security;
create policy "payments_self_read" on public.payments for select using (auth.uid() = customer_id);
create policy "payments_admin_all" on public.payments for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Backfill the bookings.payment_id FK now that payments exists
alter table public.bookings
  add constraint bookings_payment_fk foreign key (payment_id) references public.payments(id) on delete set null;

-- RPC: validate a discount code without leaking the table. Returns the discount info if valid, otherwise null.
create or replace function public.validate_discount_code(p_code text, p_plan_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d public.discount_codes%rowtype;
begin
  select * into d from public.discount_codes
  where upper(code) = upper(p_code)
    and is_active = true
    and (valid_from <= now())
    and (valid_until is null or valid_until > now())
    and (max_uses is null or times_used < max_uses)
    and (applies_to_plan_ids is null or p_plan_id = any(applies_to_plan_ids))
  limit 1;
  if d.id is null then return null; end if;
  return jsonb_build_object(
    'id', d.id,
    'code', d.code,
    'discount_type', d.discount_type,
    'discount_value', d.discount_value
  );
end $$;
