-- ============================================================
-- GETFITWITHPRATIK — Supabase Schema
-- Run this entire file in Supabase SQL Editor on first setup.
-- It's idempotent: safe to re-run; uses IF NOT EXISTS where possible.
-- ============================================================

-- ============================================================
-- 1. PROFILES
-- Extends auth.users with role + display info
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'client' check (role in ('client', 'admin')),
  start_weight numeric,
  start_date date default current_date,
  goal text,
  notes text,
  created_at timestamptz default now()
);

-- Auto-create profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'role', 'client')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. PLANS — one active plan per client
-- ============================================================
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Coaching Plan',
  daily_calories integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  steps_target integer default 8000,
  workout_split text,          -- e.g. "Push/Pull/Legs"
  diet_overview text,          -- markdown / freeform
  supplements text,            -- markdown / freeform
  custom_log_fields jsonb default '[]'::jsonb, -- e.g. [{"key":"water","label":"Water (L)","type":"number"}]
  pdf_url text,                -- link to plan PDF in storage
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists plans_client_idx on public.plans(client_id);

-- ============================================================
-- 3. DAILY LOGS — what the client did today
-- ============================================================
create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null default current_date,
  calories integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  steps integer,
  workout_done boolean default false,
  workout_notes text,
  diet_notes text,
  missed_items text,
  custom_data jsonb default '{}'::jsonb,  -- holds custom field values
  notes text,
  created_at timestamptz default now(),
  unique (client_id, log_date)
);

create index if not exists daily_logs_client_date_idx on public.daily_logs(client_id, log_date desc);

-- ============================================================
-- 4. WEEKLY LOGS — weight + photos
-- ============================================================
create table if not exists public.weekly_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null default current_date,
  weight numeric,
  waist_cm numeric,
  chest_cm numeric,
  hips_cm numeric,
  photo_front text,            -- storage path
  photo_side text,
  photo_back text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists weekly_logs_client_idx on public.weekly_logs(client_id, log_date desc);

-- ============================================================
-- 5. FILES — PDFs etc that admin pushes to specific clients
-- ============================================================
create table if not exists public.client_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  file_url text not null,
  file_type text,
  uploaded_at timestamptz default now()
);

create index if not exists client_files_idx on public.client_files(client_id);

-- ============================================================
-- 6. PUBLIC SUBMISSIONS — bookings & feedback from website
-- ============================================================
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  age integer,
  weight numeric,
  goal text,
  experience text,
  location text,
  plan text,
  message text,
  raw_data jsonb,
  created_at timestamptz default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  rating integer,
  relationship text,
  feedback text,
  can_share text,
  raw_data jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- Clients can only see/edit their own data.
-- Admins can see everything.
-- ============================================================

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- PROFILES
alter table public.profiles enable row level security;
drop policy if exists "profiles_self_read" on public.profiles;
drop policy if exists "profiles_self_update" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;

create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin());

-- PLANS
alter table public.plans enable row level security;
drop policy if exists "plans_client_read" on public.plans;
drop policy if exists "plans_admin_all" on public.plans;

create policy "plans_client_read" on public.plans
  for select using (auth.uid() = client_id);
create policy "plans_admin_all" on public.plans
  for all using (public.is_admin());

-- DAILY LOGS
alter table public.daily_logs enable row level security;
drop policy if exists "daily_logs_client_read" on public.daily_logs;
drop policy if exists "daily_logs_client_write" on public.daily_logs;
drop policy if exists "daily_logs_admin_all" on public.daily_logs;

create policy "daily_logs_client_read" on public.daily_logs
  for select using (auth.uid() = client_id);
create policy "daily_logs_client_write" on public.daily_logs
  for insert with check (auth.uid() = client_id);
create policy "daily_logs_client_update" on public.daily_logs
  for update using (auth.uid() = client_id);
create policy "daily_logs_admin_all" on public.daily_logs
  for all using (public.is_admin());

-- WEEKLY LOGS
alter table public.weekly_logs enable row level security;
drop policy if exists "weekly_logs_client_read" on public.weekly_logs;
drop policy if exists "weekly_logs_client_write" on public.weekly_logs;
drop policy if exists "weekly_logs_admin_all" on public.weekly_logs;

create policy "weekly_logs_client_read" on public.weekly_logs
  for select using (auth.uid() = client_id);
create policy "weekly_logs_client_write" on public.weekly_logs
  for insert with check (auth.uid() = client_id);
create policy "weekly_logs_client_update" on public.weekly_logs
  for update using (auth.uid() = client_id);
create policy "weekly_logs_admin_all" on public.weekly_logs
  for all using (public.is_admin());

-- CLIENT FILES
alter table public.client_files enable row level security;
drop policy if exists "files_client_read" on public.client_files;
drop policy if exists "files_admin_all" on public.client_files;

create policy "files_client_read" on public.client_files
  for select using (auth.uid() = client_id);
create policy "files_admin_all" on public.client_files
  for all using (public.is_admin());

-- BOOKINGS & FEEDBACK — anyone can insert (public forms), only admin reads
alter table public.bookings enable row level security;
drop policy if exists "bookings_anon_insert" on public.bookings;
drop policy if exists "bookings_admin_read" on public.bookings;

create policy "bookings_anon_insert" on public.bookings
  for insert with check (true);
create policy "bookings_admin_read" on public.bookings
  for select using (public.is_admin());

alter table public.feedback enable row level security;
drop policy if exists "feedback_anon_insert" on public.feedback;
drop policy if exists "feedback_admin_read" on public.feedback;

create policy "feedback_anon_insert" on public.feedback
  for insert with check (true);
create policy "feedback_admin_read" on public.feedback
  for select using (public.is_admin());

-- ============================================================
-- 8. STORAGE BUCKETS
-- Run these manually in Supabase Dashboard → Storage if SQL fails.
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('client-photos', 'client-photos', false),
  ('client-plans', 'client-plans', false),
  ('transformations', 'transformations', true)
on conflict (id) do nothing;

-- Storage RLS — clients can upload to their own folder
drop policy if exists "client_photos_owner" on storage.objects;
create policy "client_photos_owner" on storage.objects
  for all using (
    bucket_id = 'client-photos'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

drop policy if exists "client_plans_admin" on storage.objects;
create policy "client_plans_admin" on storage.objects
  for all using (
    bucket_id = 'client-plans'
    and (public.is_admin() or auth.uid()::text = (storage.foldername(name))[1])
  );

drop policy if exists "transformations_public_read" on storage.objects;
create policy "transformations_public_read" on storage.objects
  for select using (bucket_id = 'transformations');

drop policy if exists "transformations_admin_write" on storage.objects;
create policy "transformations_admin_write" on storage.objects
  for insert with check (bucket_id = 'transformations' and public.is_admin());
