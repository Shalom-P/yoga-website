-- 0002_teachers.sql
-- Teachers live in IST. Each teacher has recurring weekly availability + one-off overrides.

create table public.teachers (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete set null,
  slug text not null unique,
  display_name text not null,
  headline text,
  bio text,
  avatar_url text,
  cover_image_url text,
  intro_video_url text,
  specialties text[] default '{}',
  languages text[] default '{}',
  years_experience int default 0,
  certifications jsonb default '[]'::jsonb,
  rating_avg numeric(3,2) default 5.0,
  rating_count int default 0,
  timezone text not null default 'Asia/Kolkata',
  google_calendar_id text,
  is_active boolean not null default true,
  sort_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teachers_slug_idx on public.teachers(slug);
create index teachers_active_idx on public.teachers(is_active);

create trigger teachers_set_updated_at
  before update on public.teachers
  for each row execute function public.tg_set_updated_at();

alter table public.teachers enable row level security;

create policy "teachers_public_read"
  on public.teachers for select
  using (is_active = true);

create policy "teachers_admin_all"
  on public.teachers for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Recurring weekly availability in the teacher's own timezone
create table public.teacher_availability (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Sun
  start_time time not null,
  end_time time not null,
  slot_duration_minutes int not null default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teacher_availability_teacher_idx on public.teacher_availability(teacher_id);
create trigger teacher_availability_set_updated_at
  before update on public.teacher_availability
  for each row execute function public.tg_set_updated_at();

alter table public.teacher_availability enable row level security;
create policy "teacher_availability_public_read" on public.teacher_availability for select using (true);
create policy "teacher_availability_admin_all" on public.teacher_availability for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table public.teacher_slot_overrides (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  date date not null,
  start_time time,
  end_time time,
  is_blocked boolean not null default false,
  reason text,
  created_at timestamptz not null default now()
);
create index teacher_slot_overrides_teacher_date_idx on public.teacher_slot_overrides(teacher_id, date);
alter table public.teacher_slot_overrides enable row level security;
create policy "teacher_slot_overrides_public_read" on public.teacher_slot_overrides for select using (true);
create policy "teacher_slot_overrides_admin_all" on public.teacher_slot_overrides for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
