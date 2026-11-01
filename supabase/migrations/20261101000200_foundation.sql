-- Foundation: private helpers, settings, notifications, email outbox, audit log,
-- profile statuses, approval flow and pre-approved invites.

create extension if not exists pg_net;

-- ------------------------------------------------------------------
-- Private schema (not exposed through the REST API)
-- ------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

create table if not exists private.config (
  key text primary key,
  value text not null
);
insert into private.config (key, value) values
  ('functions_url', 'https://trerqtscrsrlcfsnfetn.supabase.co/functions/v1'),
  ('anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyZXJxdHNjcnNybGNmc25mZXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MjYxNTgsImV4cCI6MjA5NjQwMjE1OH0.1h60JDQ6GJ5jRrp-VED_W4aYmZ4TmySz5nn0sr94d8g'),
  ('site_url', 'https://transformwithpratik.github.io')
on conflict (key) do nothing;

-- ------------------------------------------------------------------
-- Profiles: status, contact and coaching fields
-- ------------------------------------------------------------------
alter table public.profiles
  add column if not exists email text,
  add column if not exists status text not null default 'pending',
  add column if not exists target_weight numeric,
  add column if not exists height_cm numeric,
  add column if not exists sex text,
  add column if not exists date_of_birth date,
  add column if not exists city text,
  add column if not exists diet_preference text,
  add column if not exists coach_id uuid references public.profiles(id) on delete set null,
  add column if not exists lead_id uuid,
  add column if not exists plan_name text,
  add column if not exists plan_start date,
  add column if not exists plan_end date,
  add column if not exists checkin_day smallint not null default 0,
  add column if not exists email_notifications boolean not null default true,
  add column if not exists approved_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deletion_requested_at timestamptz;

alter table public.profiles add constraint profiles_status_check
  check (status in ('pending', 'active', 'inactive', 'completed', 'rejected'));
alter table public.profiles add constraint profiles_sex_check
  check (sex is null or sex in ('male', 'female', 'other'));
alter table public.profiles add constraint profiles_checkin_day_check
  check (checkin_day between 0 and 6);
alter table public.profiles add constraint profiles_ranges_check
  check ((target_weight is null or target_weight between 30 and 300)
     and (height_cm is null or height_cm between 100 and 250)
     and (start_weight is null or start_weight between 30 and 300));
alter table public.profiles add constraint profiles_diet_check
  check (diet_preference is null or diet_preference in ('vegetarian', 'eggetarian', 'non_vegetarian', 'vegan', 'jain'));

create index if not exists profiles_role_status_idx on public.profiles (role, status);
create index if not exists profiles_email_idx on public.profiles (lower(email));

-- Backfill: emails, staff active, existing clients with a plan or logs stay active.
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;
update public.profiles set status = 'active', approved_at = coalesce(approved_at, created_at) where role in ('admin', 'coach');
update public.profiles p set status = 'active', approved_at = coalesce(p.approved_at, now())
where p.role = 'client' and (
  exists (select 1 from public.plans x where x.client_id = p.id)
  or exists (select 1 from public.daily_logs x where x.client_id = p.id)
  or exists (select 1 from public.weekly_logs x where x.client_id = p.id)
);

-- ------------------------------------------------------------------
-- Role helpers (security definer so RLS policies can use them)
-- ------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin', 'coach'));
$$;

create or replace function private.is_active_client()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'client' and status = 'active');
$$;

grant execute on function private.is_admin(), private.is_staff(), private.is_active_client() to anon, authenticated;

-- ------------------------------------------------------------------
-- Public site settings (contact details, coach bio, plans, FAQ)
-- ------------------------------------------------------------------
create table if not exists public.site_settings (
  key text primary key check (key ~ '^[a-z_]+$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.site_settings enable row level security;
create policy site_settings_public_read on public.site_settings for select to anon, authenticated using (true);
create policy site_settings_admin_write on public.site_settings for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

insert into public.site_settings (key, value) values
('contact', jsonb_build_object(
  'email', 'transformwithpratik@gmail.com',
  'whatsapp', '',
  'instagram', 'https://www.instagram.com/transform.withpratik/',
  'instagram_handle', '@transform.withpratik',
  'youtube', '',
  'city', 'Bengaluru',
  'response_time', 'Replies within 24 hours'
)),
('coach', jsonb_build_object(
  'name', 'Pratik Jain',
  'title', 'Software engineer and certified fitness coach',
  'photo_url', '',
  'story', jsonb_build_array(
    'I spend my days as a software engineer and the rest of my time training and coaching. That shapes how I coach: a plan has to survive a full workday, a deadline week and a business trip, or it doesn''t count.',
    'My coaching is built on the basics that hold up in research: enough protein, progressive strength training, daily movement, sleep, and a calorie target that matches your goal. We track them simply and review them every week.',
    'Most of my clients are busy professionals who have tried to get fit before. We don''t start over. We look at what got in the way, and build a routine that fits your actual week.'
  ),
  'credentials', jsonb_build_array('Certified fitness coach'),
  'stats', jsonb_build_array()
)),
('plans', jsonb_build_array(
  jsonb_build_object('name', '1-Month Trial', 'duration', '4 weeks', 'price', '', 'summary', 'Try coaching with a full plan and weekly check-ins before committing longer.', 'features', jsonb_build_array('Personal training plan', 'Calorie and protein targets', 'Weekly check-in and review', 'Client portal for daily logs'), 'highlight', false),
  jsonb_build_object('name', '3-Month Standard', 'duration', '12 weeks', 'price', '', 'summary', 'Enough time to build the habits and see measurable change.', 'features', jsonb_build_array('Everything in the trial', 'Meal plan with Indian vegetarian options', 'Plan adjustments every 4 to 6 weeks', 'WhatsApp support'), 'highlight', true),
  jsonb_build_object('name', '6-Month Deep Transformation', 'duration', '24 weeks', 'price', '', 'summary', 'For bigger goals, where consistency over months does the work.', 'features', jsonb_build_array('Everything in Standard', 'Progress reports each month', 'Travel and festival-season planning', 'Priority replies'), 'highlight', false)
)),
('faq', jsonb_build_array(
  jsonb_build_object('q', 'Who is this coaching for?', 'a', 'Working professionals who want to lose fat, build muscle or get fitter without living in the gym. If your week is full, the plan is built around it.'),
  jsonb_build_object('q', 'Do I need a gym?', 'a', 'No. Plans can be written for a gym, a home setup with a few dumbbells, or bodyweight only. We decide on your consult call.'),
  jsonb_build_object('q', 'I''m vegetarian. Can I still hit my protein?', 'a', 'Yes. Meal plans are vegetarian-first, built from dal, paneer, curd, soy, sprouts and other foods you already eat, with eggs or whey if you choose.'),
  jsonb_build_object('q', 'How do check-ins work?', 'a', 'Once a week you submit your weight, measurements, photos if you want, and how training, food, sleep and stress went. I review it and reply with feedback and any changes to your plan.'),
  jsonb_build_object('q', 'What happens after I submit the form?', 'a', 'I read every enquiry personally and reply on WhatsApp or email to set up a short call. If coaching is a good fit, you get access to the client portal and your plan.'),
  jsonb_build_object('q', 'I have a medical condition. Can I join?', 'a', 'Tell me about it in the form. For conditions like diabetes, heart disease, recent surgery or pregnancy, I''ll ask you to get clearance from your doctor first, and I work alongside their advice, not instead of it.')
)),
('notifications', jsonb_build_object('copy_coach_on_own_actions', true))
on conflict (key) do nothing;

create or replace function private.coach_email()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(nullif((select value->>'email' from public.site_settings where key = 'contact'), ''), 'transformwithpratik@gmail.com');
$$;

create or replace function private.setting_bool(p_key text, p_field text, p_default boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (value->>p_field)::boolean from public.site_settings where key = p_key), p_default);
$$;

-- ------------------------------------------------------------------
-- In-app notifications
-- ------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_own_read on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_own_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- Users may only mark notifications read; everything else stays as written.
create or replace function private.notifications_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.id := old.id; new.user_id := old.user_id; new.kind := old.kind; new.title := old.title;
  new.body := old.body; new.link := old.link; new.created_at := old.created_at;
  return new;
end;
$$;
create or replace trigger notifications_guard before update on public.notifications
  for each row execute function private.notifications_guard();

create or replace function private.notify(p_user uuid, p_kind text, p_title text, p_body text default null, p_link text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select p_user, p_kind, p_title, p_body, p_link where p_user is not null;
$$;

create or replace function private.notify_staff(p_kind text, p_title text, p_body text default null, p_link text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select id, p_kind, p_title, p_body, p_link from public.profiles where role in ('admin', 'coach');
$$;

-- ------------------------------------------------------------------
-- Email outbox (sent by the send-email edge function through Resend)
-- ------------------------------------------------------------------
create table if not exists public.email_outbox (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  to_email text not null,
  template text not null,
  subject text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  provider_id text,
  sent_at timestamptz,
  dedupe_key text unique
);
create index if not exists email_outbox_queue_idx on public.email_outbox (status, next_attempt_at);
alter table public.email_outbox enable row level security;
create policy email_outbox_admin_read on public.email_outbox for select to authenticated
  using ((select private.is_admin()));
create policy email_outbox_admin_update on public.email_outbox for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create or replace function private.kick_mailer()
returns void language plpgsql security definer set search_path = '' as $$
declare v_url text; v_key text;
begin
  select value into v_url from private.config where key = 'functions_url';
  select value into v_key from private.config where key = 'anon_key';
  if v_url is null or v_key is null then return; end if;
  perform net.http_post(
    url := v_url || '/send-email',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    timeout_milliseconds := 10000
  );
exception when others then
  raise warning 'kick_mailer failed: %', sqlerrm;
end;
$$;

create or replace function private.enqueue_email(p_to text, p_template text, p_subject text, p_data jsonb default '{}'::jsonb, p_dedupe text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_to is null or p_to !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return; end if;
  insert into public.email_outbox (to_email, template, subject, data, dedupe_key)
  values (lower(trim(p_to)), p_template, left(p_subject, 200), coalesce(p_data, '{}'::jsonb), p_dedupe)
  on conflict (dedupe_key) do nothing;
  perform private.kick_mailer();
end;
$$;

-- Email a client only if they haven't switched email notifications off.
create or replace function private.email_client(p_user uuid, p_template text, p_subject text, p_data jsonb default '{}'::jsonb, p_dedupe text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_email text; v_name text; v_ok boolean;
begin
  select email, full_name, email_notifications into v_email, v_name, v_ok from public.profiles where id = p_user;
  if v_email is null or not coalesce(v_ok, true) then return; end if;
  perform private.enqueue_email(v_email, p_template, p_subject, jsonb_build_object('name', v_name) || coalesce(p_data, '{}'::jsonb), p_dedupe);
end;
$$;

-- ------------------------------------------------------------------
-- Audit log
-- ------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  changes jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_record_idx on public.audit_log (table_name, record_id);
alter table public.audit_log enable row level security;
create policy audit_log_admin_read on public.audit_log for select to authenticated
  using ((select private.is_admin()));

create or replace function private.audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_old jsonb; v_new jsonb; v_changes jsonb := '{}'::jsonb; k text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new); v_changes := v_new;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old); v_new := to_jsonb(new);
    for k in select jsonb_object_keys(v_new) loop
      if k <> 'updated_at' and (v_new -> k) is distinct from (v_old -> k) then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('from', v_old -> k, 'to', v_new -> k));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then return new; end if;
  else
    v_old := to_jsonb(old); v_changes := v_old;
  end if;
  insert into public.audit_log (actor_id, action, table_name, record_id, changes)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'key', v_old ->> 'key'), v_changes);
  return coalesce(new, old);
end;
$$;

-- ------------------------------------------------------------------
-- Pre-approved invites ("Add client" / "Convert lead")
-- ------------------------------------------------------------------
create table if not exists public.client_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name text,
  plan_name text,
  lead_id uuid,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists client_invites_open_email on public.client_invites (lower(email)) where used_at is null;
alter table public.client_invites enable row level security;
create policy client_invites_staff_all on public.client_invites for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- ------------------------------------------------------------------
-- Profiles: policies, guard, signup, approval
-- ------------------------------------------------------------------
alter policy "profiles_admin_all" on public.profiles
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy profiles_staff_read on public.profiles for select to authenticated
  using ((select private.is_staff()));
create policy profiles_staff_update on public.profiles for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    if new.id is distinct from old.id then
      raise exception 'Profile id cannot change' using errcode = '42501';
    end if;
    if new.role is distinct from old.role and not private.is_admin() then
      raise exception 'Only an admin can change roles' using errcode = '42501';
    end if;
    if not private.is_staff() and
       (new.status, new.approved_at, new.coach_id, new.plan_name, new.plan_start, new.plan_end, new.email, new.notes, new.lead_id)
       is distinct from
       (old.status, old.approved_at, old.coach_id, old.plan_name, old.plan_start, old.plan_end, old.email, old.notes, old.lead_id) then
      raise exception 'Only your coach can change this' using errcode = '42501';
    end if;
  end if;
  if new.status = 'active' and old.status is distinct from 'active' then
    new.approved_at := coalesce(new.approved_at, now());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Approval and status emails
create or replace function private.on_profile_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'client' and new.status = 'active' and old.status is distinct from 'active' then
    perform private.notify(new.id, 'approved', 'Your coaching account is active', 'Your plan and logs are ready in the portal.', '/portal/dashboard');
    perform private.email_client(new.id, 'client_approved', 'Your coaching account is active', '{}'::jsonb, 'approved:' || new.id || ':' || to_char(now(), 'YYYYMMDDHH24'));
    if private.setting_bool('notifications', 'copy_coach_on_own_actions', true) then
      perform private.enqueue_email(private.coach_email(), 'coach_client_approved', 'Approved: ' || coalesce(new.full_name, new.email),
        jsonb_build_object('name', new.full_name, 'email', new.email), 'approved-coach:' || new.id || ':' || to_char(now(), 'YYYYMMDDHH24'));
    end if;
  end if;
  return new;
end;
$$;
create or replace trigger profiles_status_notify after update of status on public.profiles
  for each row execute function private.on_profile_status();

create or replace trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function private.audit();

-- Keep profile email in sync with the auth account
create or replace function private.sync_profile_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id and email is distinct from new.email;
  return new;
end;
$$;
create or replace trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function private.sync_profile_email();
