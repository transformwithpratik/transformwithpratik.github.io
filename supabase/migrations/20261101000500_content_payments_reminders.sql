-- Content (recipes, exercises, resources), favourites, payments, storage, reminders and admin stats.

create extension if not exists pg_cron;

-- ------------------------------------------------------------------
-- Recipes
-- ------------------------------------------------------------------
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 2 and 120),
  summary text check (summary is null or char_length(summary) <= 500),
  image_url text,
  servings int not null default 1 check (servings between 1 and 20),
  prep_minutes int check (prep_minutes is null or prep_minutes between 0 and 600),
  cook_minutes int check (cook_minutes is null or cook_minutes between 0 and 600),
  calories int check (calories is null or calories between 0 and 3000),
  protein_g numeric check (protein_g is null or protein_g between 0 and 300),
  carbs_g numeric check (carbs_g is null or carbs_g between 0 and 500),
  fat_g numeric check (fat_g is null or fat_g between 0 and 300),
  fiber_g numeric check (fiber_g is null or fiber_g between 0 and 100),
  ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients) = 'array'),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  categories text[] not null default '{}',
  diet_tags text[] not null default '{}',
  tips text check (tips is null or char_length(tips) <= 2000),
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recipes_categories_idx on public.recipes using gin (categories);
alter table public.recipes enable row level security;
create policy recipes_public_read on public.recipes for select to anon, authenticated using (is_published);
create policy recipes_staff_all on public.recipes for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create or replace trigger recipes_touch before update on public.recipes for each row execute function private.touch_updated_at();
create or replace trigger recipes_audit after update or delete on public.recipes for each row execute function private.audit();

-- ------------------------------------------------------------------
-- Exercise library
-- ------------------------------------------------------------------
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique check (char_length(name) between 2 and 80),
  muscle_group text not null check (muscle_group in ('legs', 'glutes', 'chest', 'back', 'shoulders', 'arms', 'core', 'full_body', 'cardio', 'mobility')),
  equipment text not null default 'bodyweight' check (equipment in ('bodyweight', 'dumbbell', 'barbell', 'machine', 'cable', 'kettlebell', 'band', 'other')),
  level text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  summary text check (summary is null or char_length(summary) <= 300),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  cues jsonb not null default '[]'::jsonb check (jsonb_typeof(cues) = 'array'),
  mistakes jsonb not null default '[]'::jsonb check (jsonb_typeof(mistakes) = 'array'),
  substitutions text[] not null default '{}',
  video_url text check (video_url is null or video_url ~* '^https://'),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.exercises enable row level security;
create policy exercises_public_read on public.exercises for select to anon, authenticated using (is_published);
create policy exercises_staff_all on public.exercises for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create or replace trigger exercises_touch before update on public.exercises for each row execute function private.touch_updated_at();

-- ------------------------------------------------------------------
-- Resources (public guides and client-only downloads)
-- ------------------------------------------------------------------
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 2 and 120),
  description text check (description is null or char_length(description) <= 500),
  category text not null check (category in ('nutrition', 'training', 'supplements', 'sleep_recovery', 'busy_professionals', 'office', 'travel', 'recipes', 'other')),
  kind text not null default 'guide' check (kind in ('guide', 'pdf', 'video', 'link')),
  url text,
  file_path text,
  access text not null default 'public' check (access in ('public', 'clients')),
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resources_target check (url is not null or file_path is not null)
);
alter table public.resources enable row level security;
create policy resources_public_read on public.resources for select to anon, authenticated
  using (is_published and access = 'public');
create policy resources_clients_read on public.resources for select to authenticated
  using (is_published and access = 'clients' and (select private.is_active_client()));
create policy resources_staff_all on public.resources for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create or replace trigger resources_touch before update on public.resources for each row execute function private.touch_updated_at();
create or replace trigger resources_audit after insert or update or delete on public.resources for each row execute function private.audit();

-- ------------------------------------------------------------------
-- Favourites (recipes, resources, exercises)
-- ------------------------------------------------------------------
create table if not exists public.favorites (
  client_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('recipe', 'resource', 'exercise')),
  item_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (client_id, item_type, item_id)
);
alter table public.favorites enable row level security;
create policy favorites_own_all on public.favorites for all to authenticated
  using (client_id = (select auth.uid())) with check (client_id = (select auth.uid()));

-- ------------------------------------------------------------------
-- Payments and renewals
-- ------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  paid_on date not null,
  method text check (method is null or method in ('upi', 'bank_transfer', 'card', 'cash', 'other')),
  reference text check (reference is null or char_length(reference) <= 120),
  plan_name text check (plan_name is null or char_length(plan_name) <= 80),
  period_start date,
  period_end date,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint payments_period check (period_end is null or period_start is null or period_end >= period_start)
);
create index if not exists payments_client_idx on public.payments (client_id, paid_on desc);
alter table public.payments enable row level security;
create policy payments_own_read on public.payments for select to authenticated using (client_id = (select auth.uid()));
create policy payments_staff_read on public.payments for select to authenticated using ((select private.is_staff()));
create policy payments_admin_all on public.payments for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create or replace trigger payments_audit after insert or update or delete on public.payments for each row execute function private.audit();

create or replace function private.on_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_client uuid := coalesce(new.client_id, old.client_id);
begin
  update public.profiles p set
    plan_end = x.max_end,
    plan_start = coalesce(x.cur_start, p.plan_start),
    plan_name = coalesce(x.cur_plan, p.plan_name)
  from (
    select max(period_end) as max_end,
      (array_agg(period_start order by period_end desc nulls last))[1] as cur_start,
      (array_agg(plan_name order by period_end desc nulls last))[1] as cur_plan
    from public.payments where client_id = v_client
  ) x
  where p.id = v_client and x.max_end is not null;
  return coalesce(new, old);
end;
$$;
create or replace trigger payments_sync_profile after insert or update or delete on public.payments
  for each row execute function private.on_payment();

-- ------------------------------------------------------------------
-- Storage buckets
-- ------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('site-media', 'site-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('resources', 'resources', false, 26214400, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
update storage.buckets set file_size_limit = 15728640, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  where id = 'client-photos';
update storage.buckets set file_size_limit = 26214400 where id = 'client-plans';
update storage.buckets set file_size_limit = 8388608, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  where id = 'transformations';

create policy site_media_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'site-media');
create policy site_media_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'site-media' and (select private.is_staff()));
create policy site_media_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'site-media' and (select private.is_staff())) with check (bucket_id = 'site-media' and (select private.is_staff()));
create policy site_media_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'site-media' and (select private.is_staff()));

create policy resources_files_read on storage.objects for select to authenticated
  using (bucket_id = 'resources' and ((select private.is_active_client()) or (select private.is_staff())));
create policy resources_files_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'resources' and (select private.is_staff()));
create policy resources_files_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'resources' and (select private.is_staff())) with check (bucket_id = 'resources' and (select private.is_staff()));
create policy resources_files_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'resources' and (select private.is_staff()));

create policy client_plans_staff_all on storage.objects for all to authenticated
  using (bucket_id = 'client-plans' and (select private.is_staff()))
  with check (bucket_id = 'client-plans' and (select private.is_staff()));
create policy client_photos_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'client-photos' and (select private.is_admin()));

-- ------------------------------------------------------------------
-- Admin overview numbers in one call
-- ------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not private.is_staff() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'leads_total', (select count(*) from public.leads),
    'leads_new', (select count(*) from public.leads where status = 'new'),
    'leads_open', (select count(*) from public.leads where status in ('new', 'contacted', 'consult_booked')),
    'leads_this_month', (select count(*) from public.leads where created_at >= date_trunc('month', now())),
    'clients_active', (select count(*) from public.profiles where role = 'client' and status = 'active'),
    'clients_pending', (select count(*) from public.profiles where role = 'client' and status = 'pending'),
    'clients_completed', (select count(*) from public.profiles where role = 'client' and status = 'completed'),
    'clients_inactive', (select count(*) from public.profiles where role = 'client' and status = 'inactive'),
    'renewals_due', (select count(*) from public.profiles where role = 'client' and status = 'active' and plan_end between v_today and v_today + 14),
    'plans_expired', (select count(*) from public.profiles where role = 'client' and status = 'active' and plan_end < v_today),
    'checkins_pending', (select count(*) from public.weekly_checkins where status = 'pending_review'),
    'reviews_pending', (select count(*) from public.feedback where status = 'pending'),
    'emails_queued', (select count(*) from public.email_outbox where status = 'queued'),
    'emails_failed', (select count(*) from public.email_outbox where status = 'failed'),
    'revenue_this_month', (select coalesce(sum(amount), 0) from public.payments where paid_on >= date_trunc('month', v_today)),
    'revenue_last_month', (select coalesce(sum(amount), 0) from public.payments
                            where paid_on >= date_trunc('month', v_today) - interval '1 month' and paid_on < date_trunc('month', v_today))
  );
end;
$$;
grant execute on function public.admin_overview() to authenticated;

-- ------------------------------------------------------------------
-- Daily reminders (09:00 IST): check-in due, missed check-in, renewals
-- ------------------------------------------------------------------
create or replace function private.run_daily_reminders()
returns void language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_week date := date_trunc('week', v_today)::date;
  v_offset int;
  v_missed text := '';
begin
  for r in
    select p.id, coalesce(p.full_name, p.email) as name, p.checkin_day
    from public.profiles p where p.role = 'client' and p.status = 'active'
  loop
    v_offset := (r.checkin_day + 6) % 7;  -- days after Monday; Sunday (0) -> 6
    if exists (select 1 from public.weekly_checkins c where c.client_id = r.id and c.week_of = v_week) then
      continue;
    end if;
    if v_today = v_week + v_offset then
      perform private.notify(r.id, 'checkin_reminder', 'Your weekly check-in is due today', null, '/portal/checkins');
      perform private.email_client(r.id, 'client_checkin_reminder', 'Your weekly check-in is due today', '{}'::jsonb,
        'ci-due:' || r.id || ':' || v_week);
    elsif v_today = v_week + v_offset + 2 then
      perform private.notify(r.id, 'checkin_missed', 'You missed this week''s check-in', 'It only takes a few minutes.', '/portal/checkins');
      perform private.email_client(r.id, 'client_checkin_missed', 'We missed your check-in this week', '{}'::jsonb,
        'ci-missed:' || r.id || ':' || v_week);
      v_missed := v_missed || r.name || E'\n';
    end if;
  end loop;

  if v_missed <> '' then
    perform private.notify_staff('checkin_missed', 'Missed check-ins this week', v_missed, '/admin/#clients');
    perform private.enqueue_email(private.coach_email(), 'coach_missed_checkins', 'Missed check-ins: ' || to_char(v_today, 'DD Mon'),
      jsonb_build_object('names', v_missed), 'ci-missed-coach:' || v_today);
  end if;

  for r in
    select p.id, coalesce(p.full_name, p.email) as name, p.plan_end, p.plan_name, (p.plan_end - v_today) as days_left
    from public.profiles p
    where p.role = 'client' and p.status = 'active' and p.plan_end is not null and (p.plan_end - v_today) in (7, 1)
  loop
    perform private.notify(r.id, 'renewal', 'Your plan ends in ' || r.days_left || case when r.days_left = 1 then ' day' else ' days' end, null, '/portal/profile');
    perform private.email_client(r.id, 'client_renewal_reminder', 'Your coaching plan ends on ' || to_char(r.plan_end, 'DD Mon'),
      jsonb_build_object('plan_end', r.plan_end, 'plan_name', r.plan_name, 'days_left', r.days_left), 'renew:' || r.id || ':' || r.plan_end || ':' || r.days_left);
    perform private.notify_staff('renewal', r.name || '''s plan ends ' || to_char(r.plan_end, 'DD Mon'), null, '/admin/#client/' || r.id);
    perform private.enqueue_email(private.coach_email(), 'coach_renewal_due', 'Renewal due: ' || r.name,
      jsonb_build_object('name', r.name, 'plan_end', r.plan_end, 'plan_name', r.plan_name, 'days_left', r.days_left, 'client_id', r.id),
      'renew-coach:' || r.id || ':' || r.plan_end || ':' || r.days_left);
  end loop;
end;
$$;

create or replace function private.kick_mailer_if_queued()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.email_outbox where status = 'queued' and next_attempt_at <= now()) then
    perform private.kick_mailer();
  end if;
end;
$$;

select cron.schedule('daily-reminders', '30 3 * * *', 'select private.run_daily_reminders()');
select cron.schedule('mailer-retry', '*/10 * * * *', 'select private.kick_mailer_if_queued()');
