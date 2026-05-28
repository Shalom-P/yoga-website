-- 0005_reviews_media_settings.sql
-- Reviews (social proof), promotional media, admin_settings (public-readable config), audit_log.

create type public.media_kind as enum ('hero_video', 'hero_image', 'banner', 'testimonial_photo', 'class_thumbnail');

create table public.reviews (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  body text,
  is_featured boolean not null default false,
  is_approved boolean not null default false,
  display_name_override text,
  display_location text, -- e.g., "Melbourne, AU"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_featured_idx on public.reviews(is_featured) where is_featured = true;
create trigger reviews_set_updated_at before update on public.reviews for each row execute function public.tg_set_updated_at();
alter table public.reviews enable row level security;
create policy "reviews_public_read_approved" on public.reviews for select using (is_approved = true);
create policy "reviews_self_insert" on public.reviews for insert with check (auth.uid() = customer_id);
create policy "reviews_self_update" on public.reviews for update using (auth.uid() = customer_id);
create policy "reviews_admin_all" on public.reviews for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table public.promotional_media (
  id uuid primary key default uuid_generate_v4(),
  kind public.media_kind not null,
  url text not null,
  alt_text text,
  caption text,
  placement text, -- e.g., 'landing.hero', 'landing.banner_1'
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index promotional_media_placement_idx on public.promotional_media(placement);
create trigger promotional_media_set_updated_at before update on public.promotional_media for each row execute function public.tg_set_updated_at();
alter table public.promotional_media enable row level security;
create policy "promotional_media_public_read"
  on public.promotional_media for select
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );
create policy "promotional_media_admin_all" on public.promotional_media for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- admin_settings is publicly readable (this is the "admin settings visible to all customers" requirement)
create table public.admin_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.admin_settings enable row level security;
create policy "admin_settings_public_read" on public.admin_settings for select using (true);
create policy "admin_settings_admin_write" on public.admin_settings for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create or replace function public.tg_admin_settings_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger admin_settings_set_updated_at before update on public.admin_settings for each row execute function public.tg_admin_settings_updated_at();

create table public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_at_idx on public.audit_log(created_at desc);
alter table public.audit_log enable row level security;
create policy "audit_log_admin_read" on public.audit_log for select using (public.is_admin(auth.uid()));
-- Inserts come from service role only.

-- Newsletter signups (for non-converted visitors)
create table public.newsletter_signups (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  source text,
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.newsletter_signups enable row level security;
create policy "newsletter_anyone_insert" on public.newsletter_signups for insert with check (true);
create policy "newsletter_admin_read" on public.newsletter_signups for select using (public.is_admin(auth.uid()));
