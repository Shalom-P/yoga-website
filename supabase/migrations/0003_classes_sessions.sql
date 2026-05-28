-- 0003_classes_sessions.sql
-- Class categories (metadata) and concrete scheduled sessions (with Meet links).

create type public.intensity_level as enum ('gentle', 'moderate', 'intense');
create type public.session_status as enum ('scheduled', 'live', 'completed', 'cancelled');
create type public.booking_status as enum ('confirmed', 'cancelled', 'attended', 'no_show');

create table public.class_categories (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  name text not null,
  description text,
  intensity public.intensity_level not null default 'moderate',
  icon_name text,
  cover_image_url text,
  props_needed text[] default '{}',
  sort_order int default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger class_categories_set_updated_at before update on public.class_categories for each row execute function public.tg_set_updated_at();
alter table public.class_categories enable row level security;
create policy "class_categories_public_read" on public.class_categories for select using (is_active = true);
create policy "class_categories_admin_all" on public.class_categories for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Sessions: concrete scheduled class instances. start_at/end_at are timestamptz (UTC).
-- For AU customer in Australia/Sydney, IN teacher in Asia/Kolkata, the conversion
-- happens at the application layer using date-fns-tz.
create table public.sessions (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  class_category_id uuid references public.class_categories(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  capacity int not null default 1, -- 1 = private 1:1
  status public.session_status not null default 'scheduled',
  meet_link text,
  meet_event_id text,
  is_free_trial boolean not null default false,
  recording_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sessions_start_at_idx on public.sessions(start_at);
create index sessions_teacher_idx on public.sessions(teacher_id);
create trigger sessions_set_updated_at before update on public.sessions for each row execute function public.tg_set_updated_at();

alter table public.sessions enable row level security;
create policy "sessions_public_read_scheduled"
  on public.sessions for select
  using (status in ('scheduled', 'live') and start_at > now());
create policy "sessions_booked_customer_read"
  on public.sessions for select
  using (exists (
    select 1 from public.bookings b
    where b.session_id = sessions.id and b.customer_id = auth.uid() and b.status != 'cancelled'
  ));
create policy "sessions_admin_all" on public.sessions for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table public.bookings (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  status public.booking_status not null default 'confirmed',
  is_free_trial boolean not null default false,
  payment_id uuid, -- FK added in 0004 once payments exists
  cancellation_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, customer_id)
);
create index bookings_customer_idx on public.bookings(customer_id);
create index bookings_session_idx on public.bookings(session_id);
create trigger bookings_set_updated_at before update on public.bookings for each row execute function public.tg_set_updated_at();

alter table public.bookings enable row level security;
create policy "bookings_self_read" on public.bookings for select using (auth.uid() = customer_id);
create policy "bookings_self_insert" on public.bookings for insert with check (auth.uid() = customer_id);
create policy "bookings_self_update_cancel" on public.bookings for update using (auth.uid() = customer_id) with check (auth.uid() = customer_id);
create policy "bookings_admin_all" on public.bookings for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
