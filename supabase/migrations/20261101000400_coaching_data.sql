-- Coaching data: plans, logs, progress, weekly check-ins, coach feedback and notes.

-- ------------------------------------------------------------------
-- Targets (existing `plans` table) and structured plans
-- ------------------------------------------------------------------
alter table public.plans
  add column if not exists water_ml_target int,
  add column if not exists sleep_hours_target numeric,
  add column if not exists fiber_g int,
  add column if not exists coach_notes text,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.plans add constraint plans_ranges_check check (
  (daily_calories is null or daily_calories between 800 and 6000)
  and (protein_g is null or protein_g between 0 and 400)
  and (carbs_g is null or carbs_g between 0 and 900)
  and (fat_g is null or fat_g between 0 and 300)
  and (steps_target is null or steps_target between 0 and 50000)
  and (water_ml_target is null or water_ml_target between 0 and 8000)
  and (sleep_hours_target is null or sleep_hours_target between 4 and 12)
);
create unique index if not exists plans_one_active on public.plans (client_id) where is_active;
alter policy "plans_admin_all" on public.plans
  using ((select private.is_staff())) with check ((select private.is_staff()));

create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Training plan' check (char_length(title) <= 120),
  notes text check (notes is null or char_length(notes) <= 4000),
  days jsonb not null default '[]'::jsonb check (jsonb_typeof(days) = 'array'),
  is_active boolean not null default true,
  starts_on date,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists workout_plans_one_active on public.workout_plans (client_id) where is_active;
alter table public.workout_plans enable row level security;
create policy workout_plans_own_read on public.workout_plans for select to authenticated using (client_id = (select auth.uid()));
create policy workout_plans_staff_all on public.workout_plans for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create table if not exists public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Nutrition plan' check (char_length(title) <= 120),
  notes text check (notes is null or char_length(notes) <= 4000),
  restrictions text check (restrictions is null or char_length(restrictions) <= 1000),
  meals jsonb not null default '[]'::jsonb check (jsonb_typeof(meals) = 'array'),
  substitutions jsonb not null default '[]'::jsonb check (jsonb_typeof(substitutions) = 'array'),
  is_active boolean not null default true,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists nutrition_plans_one_active on public.nutrition_plans (client_id) where is_active;
alter table public.nutrition_plans enable row level security;
create policy nutrition_plans_own_read on public.nutrition_plans for select to authenticated using (client_id = (select auth.uid()));
create policy nutrition_plans_staff_all on public.nutrition_plans for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create or replace function private.on_plan_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_what text;
begin
  new.updated_at := now();
  if auth.uid() is not null and private.is_staff() then
    v_what := case tg_table_name when 'workout_plans' then 'training plan' when 'nutrition_plans' then 'nutrition plan' else 'targets' end;
    perform private.notify(new.client_id, 'plan', 'Your ' || v_what || ' was updated', null, '/portal/plan');
    perform private.email_client(new.client_id, 'client_plan_updated', 'Your plan has been updated',
      jsonb_build_object('what', v_what), 'plan:' || new.client_id || ':' || to_char(now(), 'YYYYMMDDHH24'));
    if private.setting_bool('notifications', 'copy_coach_on_own_actions', true) then
      perform private.enqueue_email(private.coach_email(), 'coach_plan_updated',
        'Plan updated: ' || coalesce((select full_name from public.profiles where id = new.client_id), 'client'),
        jsonb_build_object('what', v_what, 'client_id', new.client_id,
          'name', (select full_name from public.profiles where id = new.client_id)),
        'plan-coach:' || new.client_id || ':' || to_char(now(), 'YYYYMMDDHH24'));
    end if;
  end if;
  return new;
end;
$$;
create or replace trigger plans_changed before insert or update on public.plans
  for each row execute function private.on_plan_change();
create or replace trigger workout_plans_changed before insert or update on public.workout_plans
  for each row execute function private.on_plan_change();
create or replace trigger nutrition_plans_changed before insert or update on public.nutrition_plans
  for each row execute function private.on_plan_change();
create or replace trigger plans_audit after insert or update or delete on public.plans
  for each row execute function private.audit();
create or replace trigger workout_plans_audit after insert or update or delete on public.workout_plans
  for each row execute function private.audit();
create or replace trigger nutrition_plans_audit after insert or update or delete on public.nutrition_plans
  for each row execute function private.audit();

alter policy "files_admin_all" on public.client_files
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- ------------------------------------------------------------------
-- Daily checklist (existing `daily_logs`)
-- ------------------------------------------------------------------
alter table public.daily_logs
  add column if not exists water_ml int,
  add column if not exists sleep_hours numeric,
  add column if not exists updated_at timestamptz not null default now();
alter table public.daily_logs add constraint daily_logs_ranges_check check (
  (calories is null or calories between 0 and 10000) and (protein_g is null or protein_g between 0 and 600)
  and (carbs_g is null or carbs_g between 0 and 1500) and (fat_g is null or fat_g between 0 and 500)
  and (steps is null or steps between 0 and 100000) and (water_ml is null or water_ml between 0 and 10000)
  and (sleep_hours is null or sleep_hours between 0 and 24)
);
alter policy "daily_logs_client_write" on public.daily_logs
  with check (client_id = (select auth.uid()) and (select private.is_active_client()));
alter policy "daily_logs_client_update" on public.daily_logs
  using (client_id = (select auth.uid()) and (select private.is_active_client()))
  with check (client_id = (select auth.uid()) and (select private.is_active_client()));
alter policy "daily_logs_admin_all" on public.daily_logs
  using ((select private.is_staff())) with check ((select private.is_staff()));
create or replace trigger daily_logs_touch before update on public.daily_logs
  for each row execute function private.touch_updated_at();

-- ------------------------------------------------------------------
-- Food logs, saved foods and a reference food list
-- ------------------------------------------------------------------
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  log_date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout')),
  food_name text not null check (char_length(food_name) between 1 and 120),
  quantity numeric check (quantity is null or quantity > 0 and quantity <= 5000),
  unit text check (unit is null or char_length(unit) <= 20),
  calories numeric check (calories is null or calories between 0 and 5000),
  protein_g numeric check (protein_g is null or protein_g between 0 and 500),
  carbs_g numeric check (carbs_g is null or carbs_g between 0 and 1000),
  fat_g numeric check (fat_g is null or fat_g between 0 and 500),
  fiber_g numeric check (fiber_g is null or fiber_g between 0 and 200),
  notes text check (notes is null or char_length(notes) <= 500),
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists food_logs_client_date_idx on public.food_logs (client_id, log_date desc);

create table if not exists public.saved_foods (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  meal text check (meal is null or meal in ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout')),
  quantity numeric, unit text, calories numeric, protein_g numeric, carbs_g numeric, fat_g numeric, fiber_g numeric,
  use_count int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists saved_foods_unique on public.saved_foods (client_id, lower(name));

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  serving_label text not null,
  serving_g numeric not null,
  calories numeric not null, protein_g numeric not null, carbs_g numeric not null, fat_g numeric not null, fiber_g numeric,
  source text
);
alter table public.foods enable row level security;
create policy foods_public_read on public.foods for select to anon, authenticated using (true);
create policy foods_staff_write on public.foods for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- ------------------------------------------------------------------
-- Workout logs (one row per exercise performed)
-- ------------------------------------------------------------------
create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  log_date date not null,
  exercise text not null check (char_length(exercise) between 1 and 120),
  sets int check (sets is null or sets between 1 and 30),
  reps int check (reps is null or reps between 1 and 200),
  weight_kg numeric check (weight_kg is null or weight_kg between 0 and 500),
  duration_min numeric check (duration_min is null or duration_min between 0 and 600),
  notes text check (notes is null or char_length(notes) <= 500),
  est_1rm numeric generated always as (
    case when weight_kg > 0 and reps between 1 and 12 then round(weight_kg * (1 + reps / 30.0), 1) end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workout_logs_client_date_idx on public.workout_logs (client_id, log_date desc);
create index if not exists workout_logs_client_ex_idx on public.workout_logs (client_id, lower(exercise));

-- ------------------------------------------------------------------
-- Progress: measurements and photos
-- ------------------------------------------------------------------
create table if not exists public.progress_records (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  record_date date not null,
  weight_kg numeric check (weight_kg is null or weight_kg between 30 and 300),
  waist_cm numeric check (waist_cm is null or waist_cm between 30 and 250),
  chest_cm numeric check (chest_cm is null or chest_cm between 30 and 250),
  arms_cm numeric check (arms_cm is null or arms_cm between 10 and 100),
  hips_cm numeric check (hips_cm is null or hips_cm between 30 and 250),
  thighs_cm numeric check (thighs_cm is null or thighs_cm between 20 and 150),
  body_fat_pct numeric check (body_fat_pct is null or body_fat_pct between 2 and 70),
  notes text check (notes is null or char_length(notes) <= 1000),
  source text not null default 'manual' check (source in ('manual', 'checkin', 'legacy')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists progress_records_client_idx on public.progress_records (client_id, record_date desc);

create table if not exists public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  week_of date not null default (date_trunc('week', (now() at time zone 'Asia/Kolkata')))::date,
  submitted_at timestamptz not null default now(),
  weight_kg numeric check (weight_kg is null or weight_kg between 30 and 300),
  avg_weight_kg numeric check (avg_weight_kg is null or avg_weight_kg between 30 and 300),
  workout_adherence int check (workout_adherence is null or workout_adherence between 0 and 100),
  nutrition_adherence int check (nutrition_adherence is null or nutrition_adherence between 0 and 100),
  sleep_hours numeric check (sleep_hours is null or sleep_hours between 0 and 14),
  sleep_quality int check (sleep_quality is null or sleep_quality between 1 and 5),
  energy int check (energy is null or energy between 1 and 5),
  hunger int check (hunger is null or hunger between 1 and 5),
  stress int check (stress is null or stress between 1 and 5),
  steps_avg int check (steps_avg is null or steps_avg between 0 and 100000),
  wins text check (wins is null or char_length(wins) <= 2000),
  challenges text check (challenges is null or char_length(challenges) <= 2000),
  coach_message text check (coach_message is null or char_length(coach_message) <= 2000),
  status text not null default 'pending_review' check (status in ('pending_review', 'reviewed')),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  unique (client_id, week_of)
);
create index if not exists weekly_checkins_status_idx on public.weekly_checkins (status, submitted_at desc);

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  taken_on date not null,
  pose text not null default 'front' check (pose in ('front', 'side', 'back', 'other')),
  path text not null,
  checkin_id uuid references public.weekly_checkins(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists progress_photos_client_idx on public.progress_photos (client_id, taken_on desc);

create table if not exists public.coach_feedback (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  checkin_id uuid references public.weekly_checkins(id) on delete cascade,
  author_id uuid default auth.uid() references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists coach_feedback_client_idx on public.coach_feedback (client_id, created_at desc);

create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid default auth.uid() references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists coach_notes_client_idx on public.coach_notes (client_id, created_at desc);

-- ------------------------------------------------------------------
-- Row level security for client-owned tables
-- Clients read their own rows; active clients write their own rows; staff do everything.
-- ------------------------------------------------------------------
alter table public.food_logs enable row level security;
create policy food_logs_own_read on public.food_logs for select to authenticated using (client_id = (select auth.uid()));
create policy food_logs_own_insert on public.food_logs for insert to authenticated
  with check (client_id = (select auth.uid()) and (select private.is_active_client()));
create policy food_logs_own_update on public.food_logs for update to authenticated
  using (client_id = (select auth.uid()) and (select private.is_active_client()))
  with check (client_id = (select auth.uid()) and (select private.is_active_client()));
create policy food_logs_own_delete on public.food_logs for delete to authenticated
  using (client_id = (select auth.uid()) and (select private.is_active_client()));
create policy food_logs_staff_all on public.food_logs for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

alter table public.saved_foods enable row level security;
create policy saved_foods_own_all on public.saved_foods for all to authenticated
  using (client_id = (select auth.uid())) with check (client_id = (select auth.uid()));
create policy saved_foods_staff_read on public.saved_foods for select to authenticated using ((select private.is_staff()));

alter table public.workout_logs enable row level security;
create policy workout_logs_own_read on public.workout_logs for select to authenticated using (client_id = (select auth.uid()));
create policy workout_logs_own_insert on public.workout_logs for insert to authenticated
  with check (client_id = (select auth.uid()) and (select private.is_active_client()));
create policy workout_logs_own_update on public.workout_logs for update to authenticated
  using (client_id = (select auth.uid()) and (select private.is_active_client()))
  with check (client_id = (select auth.uid()) and (select private.is_active_client()));
create policy workout_logs_own_delete on public.workout_logs for delete to authenticated
  using (client_id = (select auth.uid()) and (select private.is_active_client()));
create policy workout_logs_staff_all on public.workout_logs for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

alter table public.progress_records enable row level security;
create policy progress_records_own_read on public.progress_records for select to authenticated using (client_id = (select auth.uid()));
create policy progress_records_own_insert on public.progress_records for insert to authenticated
  with check (client_id = (select auth.uid()) and (select private.is_active_client()));
create policy progress_records_own_update on public.progress_records for update to authenticated
  using (client_id = (select auth.uid()) and (select private.is_active_client()))
  with check (client_id = (select auth.uid()) and (select private.is_active_client()));
create policy progress_records_own_delete on public.progress_records for delete to authenticated
  using (client_id = (select auth.uid()) and (select private.is_active_client()));
create policy progress_records_staff_all on public.progress_records for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

alter table public.progress_photos enable row level security;
create policy progress_photos_own_read on public.progress_photos for select to authenticated using (client_id = (select auth.uid()));
create policy progress_photos_own_insert on public.progress_photos for insert to authenticated
  with check (client_id = (select auth.uid()) and (select private.is_active_client())
              and split_part(path, '/', 1) = (select auth.uid())::text);
create policy progress_photos_own_delete on public.progress_photos for delete to authenticated
  using (client_id = (select auth.uid()) and (select private.is_active_client()));
create policy progress_photos_staff_all on public.progress_photos for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

alter table public.weekly_checkins enable row level security;
create policy weekly_checkins_own_read on public.weekly_checkins for select to authenticated using (client_id = (select auth.uid()));
create policy weekly_checkins_own_insert on public.weekly_checkins for insert to authenticated
  with check (client_id = (select auth.uid()) and (select private.is_active_client()) and status = 'pending_review');
create policy weekly_checkins_own_update on public.weekly_checkins for update to authenticated
  using (client_id = (select auth.uid()) and (select private.is_active_client()) and status = 'pending_review')
  with check (client_id = (select auth.uid()) and status = 'pending_review');
create policy weekly_checkins_staff_all on public.weekly_checkins for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

alter table public.coach_feedback enable row level security;
create policy coach_feedback_own_read on public.coach_feedback for select to authenticated using (client_id = (select auth.uid()));
create policy coach_feedback_own_mark_read on public.coach_feedback for update to authenticated
  using (client_id = (select auth.uid())) with check (client_id = (select auth.uid()));
create policy coach_feedback_staff_all on public.coach_feedback for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

alter table public.coach_notes enable row level security;
create policy coach_notes_staff_all on public.coach_notes for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- Clients may only mark coach feedback as read.
create or replace function private.coach_feedback_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_staff() then
    new.id := old.id; new.client_id := old.client_id; new.checkin_id := old.checkin_id;
    new.author_id := old.author_id; new.body := old.body; new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
create or replace trigger coach_feedback_guard before update on public.coach_feedback
  for each row execute function private.coach_feedback_guard();

create or replace function private.checkin_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_staff() then
    new.status := 'pending_review'; new.reviewed_at := null; new.reviewed_by := null;
    if tg_op = 'UPDATE' then new.client_id := old.client_id; new.week_of := old.week_of; end if;
  elsif tg_op = 'UPDATE' and new.status = 'reviewed' and old.status is distinct from 'reviewed' then
    new.reviewed_at := now(); new.reviewed_by := auth.uid();
  end if;
  return new;
end;
$$;
create or replace trigger weekly_checkins_guard before insert or update on public.weekly_checkins
  for each row execute function private.checkin_guard();

create or replace function private.on_checkin_submitted()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  select coalesce(full_name, email) into v_name from public.profiles where id = new.client_id;
  perform private.notify_staff('checkin', v_name || ' submitted a weekly check-in', null, '/admin/#checkins');
  perform private.enqueue_email(private.coach_email(), 'coach_new_checkin', 'Check-in: ' || v_name,
    jsonb_build_object('name', v_name, 'client_id', new.client_id, 'week_of', new.week_of, 'weight_kg', new.weight_kg,
      'workout_adherence', new.workout_adherence, 'nutrition_adherence', new.nutrition_adherence,
      'energy', new.energy, 'stress', new.stress, 'hunger', new.hunger, 'sleep_hours', new.sleep_hours,
      'challenges', new.challenges, 'coach_message', new.coach_message),
    'checkin-coach:' || new.id);
  if new.weight_kg is not null then
    insert into public.progress_records (client_id, record_date, weight_kg, source)
    values (new.client_id, (new.submitted_at at time zone 'Asia/Kolkata')::date, new.weight_kg, 'checkin');
  end if;
  return new;
end;
$$;
create or replace trigger weekly_checkins_submitted after insert on public.weekly_checkins
  for each row execute function private.on_checkin_submitted();

create or replace function private.on_coach_feedback()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify(new.client_id, 'feedback', 'New feedback from your coach', left(new.body, 140), '/portal/checkins');
  perform private.email_client(new.client_id, 'client_coach_feedback', 'New feedback on your check-in',
    jsonb_build_object('body', new.body), 'feedback:' || new.id);
  if new.checkin_id is not null then
    update public.weekly_checkins set status = 'reviewed' where id = new.checkin_id and status <> 'reviewed';
  end if;
  return new;
end;
$$;
create or replace trigger coach_feedback_created after insert on public.coach_feedback
  for each row execute function private.on_coach_feedback();

create or replace trigger food_logs_touch before update on public.food_logs for each row execute function private.touch_updated_at();
create or replace trigger workout_logs_touch before update on public.workout_logs for each row execute function private.touch_updated_at();
create or replace trigger progress_records_touch before update on public.progress_records for each row execute function private.touch_updated_at();

-- ------------------------------------------------------------------
-- Storage: staff can view client photos; clients keep owner access.
-- ------------------------------------------------------------------
create policy client_photos_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'client-photos' and (select private.is_staff()));

-- ------------------------------------------------------------------
-- Move the legacy weekly log (weight, measurements, photos) into the new tables,
-- and keep mirroring the old portal until the new one is live.
-- ------------------------------------------------------------------
create or replace function private.weekly_log_mirror()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.progress_records (client_id, record_date, weight_kg, waist_cm, chest_cm, hips_cm, notes, source, created_at)
  values (new.client_id, new.log_date,
    case when new.weight between 30 and 300 then new.weight end,
    case when new.waist_cm between 30 and 250 then new.waist_cm end,
    case when new.chest_cm between 30 and 250 then new.chest_cm end,
    case when new.hips_cm between 30 and 250 then new.hips_cm end,
    left(new.notes, 1000), 'legacy', new.created_at);
  insert into public.progress_photos (client_id, taken_on, pose, path, created_at)
  select new.client_id, new.log_date, x.pose, x.path, new.created_at
  from (values ('front', new.photo_front), ('side', new.photo_side), ('back', new.photo_back)) as x(pose, path)
  where x.path is not null;
  return new;
exception when others then
  raise warning 'weekly_log_mirror failed: %', sqlerrm;
  return new;
end;
$$;
create or replace trigger weekly_logs_mirror after insert on public.weekly_logs
  for each row execute function private.weekly_log_mirror();

insert into public.progress_records (client_id, record_date, weight_kg, waist_cm, chest_cm, hips_cm, notes, source, created_at)
select w.client_id, w.log_date,
  case when w.weight between 30 and 300 then w.weight end,
  case when w.waist_cm between 30 and 250 then w.waist_cm end,
  case when w.chest_cm between 30 and 250 then w.chest_cm end,
  case when w.hips_cm between 30 and 250 then w.hips_cm end,
  left(w.notes, 1000), 'legacy', w.created_at
from public.weekly_logs w;
insert into public.progress_photos (client_id, taken_on, pose, path, created_at)
select w.client_id, w.log_date, x.pose, x.path, w.created_at
from public.weekly_logs w
cross join lateral (values ('front', w.photo_front), ('side', w.photo_side), ('back', w.photo_back)) as x(pose, path)
where x.path is not null;
