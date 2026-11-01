-- Leads pipeline, signup linking, review moderation and the transformation gallery.

create or replace function private.try_numeric(t text)
returns numeric language plpgsql immutable set search_path = '' as $$
begin
  return nullif(trim(t), '')::numeric;
exception when others then
  return null;
end;
$$;

create or replace function private.try_date(t text)
returns date language plpgsql immutable set search_path = '' as $$
begin
  return nullif(trim(t), '')::date;
exception when others then
  return null;
end;
$$;

create or replace function private.short_name(t text)
returns text language sql immutable set search_path = '' as $$
  select case
    when coalesce(trim(t), '') = '' then 'Anonymous'
    when array_length(regexp_split_to_array(trim(t), '\s+'), 1) = 1 then initcap(trim(t))
    else initcap(split_part(trim(t), ' ', 1)) || ' ' || upper(left((regexp_split_to_array(trim(t), '\s+'))[2], 1)) || '.'
  end;
$$;

-- ------------------------------------------------------------------
-- Leads
-- ------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  whatsapp text check (whatsapp is null or char_length(whatsapp) <= 20),
  age int check (age is null or age between 14 and 100),
  height_cm numeric check (height_cm is null or height_cm between 100 and 250),
  weight_kg numeric check (weight_kg is null or weight_kg between 30 and 300),
  goal text,
  target_weight_kg numeric check (target_weight_kg is null or target_weight_kg between 30 and 300),
  experience text,
  workout_location text,
  diet_preference text,
  allergies text check (allergies is null or char_length(allergies) <= 300),
  work_schedule text check (work_schedule is null or char_length(work_schedule) <= 300),
  availability text check (availability is null or char_length(availability) <= 300),
  biggest_challenge text check (biggest_challenge is null or char_length(biggest_challenge) <= 1000),
  plan_interest text check (plan_interest is null or char_length(plan_interest) <= 80),
  start_date date,
  message text check (message is null or char_length(message) <= 2000),
  medical_notes text check (medical_notes is null or char_length(medical_notes) <= 1000),
  source text not null default 'website',
  utm jsonb,
  consent boolean not null default false,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'consult_booked', 'converted', 'not_a_fit', 'lost')),
  next_follow_up date,
  converted_profile_id uuid references public.profiles(id) on delete set null,
  admin_notes text
);
create index if not exists leads_status_idx on public.leads (status, created_at desc);
create index if not exists leads_email_idx on public.leads (lower(email));
alter table public.leads enable row level security;
create policy leads_staff_all on public.leads for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  actor_id uuid default auth.uid() references public.profiles(id) on delete set null,
  kind text not null check (kind in ('created', 'status_changed', 'note', 'converted', 'registered', 'contacted')),
  from_status text,
  to_status text,
  note text check (note is null or char_length(note) <= 2000)
);
create index if not exists lead_events_lead_idx on public.lead_events (lead_id, created_at);
alter table public.lead_events enable row level security;
create policy lead_events_staff_all on public.lead_events for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

alter table public.profiles add constraint profiles_lead_fk foreign key (lead_id) references public.leads(id) on delete set null;
alter table public.client_invites add constraint client_invites_lead_fk foreign key (lead_id) references public.leads(id) on delete set null;

create or replace function private.leads_touch()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    insert into public.lead_events (lead_id, kind, from_status, to_status, actor_id)
    values (new.id, 'status_changed', old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;
create or replace trigger leads_touch before update on public.leads
  for each row execute function private.leads_touch();
create or replace trigger leads_audit after update or delete on public.leads
  for each row execute function private.audit();

-- Shared by the website form and the legacy booking bridge.
create or replace function private.after_new_lead(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.leads;
begin
  select * into l from public.leads where id = p_id;
  insert into public.lead_events (lead_id, kind, to_status, actor_id) values (l.id, 'created', l.status, null);
  perform private.notify_staff('lead', 'New enquiry from ' || l.name, coalesce(l.goal, ''), '/admin/#lead/' || l.id);
  perform private.enqueue_email(private.coach_email(), 'coach_new_lead', 'New enquiry: ' || l.name,
    to_jsonb(l) - 'admin_notes' - 'utm', 'lead-coach:' || l.id);
  perform private.enqueue_email(l.email, 'lead_ack', 'Got your details, ' || split_part(l.name, ' ', 1),
    jsonb_build_object('name', l.name, 'goal', l.goal), 'lead-ack:' || l.id);
end;
$$;

-- Public form endpoint: validates everything server-side, rate-limits, returns field errors.
create or replace function public.submit_lead(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e jsonb := '{}'::jsonb;
  v_name text := left(trim(coalesce(p->>'name', '')), 200);
  v_email text := lower(trim(coalesce(p->>'email', '')));
  v_phone text := regexp_replace(coalesce(p->>'whatsapp', ''), '[^0-9+]', '', 'g');
  v_age numeric := private.try_numeric(p->>'age');
  v_height numeric := private.try_numeric(p->>'height_cm');
  v_weight numeric := private.try_numeric(p->>'weight_kg');
  v_target numeric := private.try_numeric(p->>'target_weight_kg');
  v_goal text := nullif(p->>'goal', '');
  v_exp text := nullif(p->>'experience', '');
  v_loc text := nullif(p->>'workout_location', '');
  v_diet text := nullif(p->>'diet_preference', '');
  v_start date := private.try_date(p->>'start_date');
  v_id uuid;
begin
  -- Honeypot: bots fill the hidden "website" field. Pretend success, store nothing.
  if coalesce(p->>'website', '') <> '' then
    return jsonb_build_object('ok', true);
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 100 then e := e || '{"name":"Enter your full name."}'; end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then e := e || '{"email":"Enter a valid email address."}'; end if;
  if char_length(regexp_replace(v_phone, '\D', '', 'g')) not between 10 and 15 then e := e || '{"whatsapp":"Enter a WhatsApp number with 10 to 15 digits, including country code if outside India."}'; end if;
  if v_age is null or v_age < 16 or v_age > 90 then e := e || '{"age":"Age must be between 16 and 90."}'; end if;
  if v_height is null or v_height < 120 or v_height > 230 then e := e || '{"height_cm":"Height must be between 120 and 230 cm."}'; end if;
  if v_weight is null or v_weight < 30 or v_weight > 300 then e := e || '{"weight_kg":"Weight must be between 30 and 300 kg."}'; end if;
  if v_goal is null or v_goal not in ('fat_loss', 'muscle_gain', 'recomposition', 'strength', 'general_fitness') then e := e || '{"goal":"Choose a goal."}'; end if;
  if v_target is not null and (v_target < 30 or v_target > 300) then e := e || '{"target_weight_kg":"Target weight must be between 30 and 300 kg."}'; end if;
  if v_exp is not null and v_exp not in ('beginner', 'intermediate', 'advanced') then e := e || '{"experience":"Choose your training experience."}'; end if;
  if v_loc is not null and v_loc not in ('gym', 'home', 'both', 'outdoors') then e := e || '{"workout_location":"Choose where you will train."}'; end if;
  if v_diet is not null and v_diet not in ('vegetarian', 'eggetarian', 'non_vegetarian', 'vegan', 'jain') then e := e || '{"diet_preference":"Choose a diet preference."}'; end if;
  if nullif(p->>'start_date', '') is not null and (v_start is null or v_start < current_date - 1 or v_start > current_date + 365) then e := e || '{"start_date":"Pick a start date within the next year."}'; end if;
  if char_length(coalesce(p->>'allergies', '')) > 300 then e := e || '{"allergies":"Keep this under 300 characters."}'; end if;
  if char_length(coalesce(p->>'work_schedule', '')) > 300 then e := e || '{"work_schedule":"Keep this under 300 characters."}'; end if;
  if char_length(coalesce(p->>'availability', '')) > 300 then e := e || '{"availability":"Keep this under 300 characters."}'; end if;
  if char_length(coalesce(p->>'biggest_challenge', '')) > 1000 then e := e || '{"biggest_challenge":"Keep this under 1000 characters."}'; end if;
  if char_length(coalesce(p->>'medical_notes', '')) > 1000 then e := e || '{"medical_notes":"Keep this under 1000 characters."}'; end if;
  if char_length(coalesce(p->>'message', '')) > 2000 then e := e || '{"message":"Keep this under 2000 characters."}'; end if;
  if coalesce((p->>'consent')::boolean, false) is not true then e := e || '{"consent":"Please agree so I can contact you about coaching."}'; end if;

  if e <> '{}'::jsonb then
    return jsonb_build_object('ok', false, 'errors', e);
  end if;

  if (select count(*) from public.leads where lower(email) = v_email and created_at > now() - interval '10 minutes') >= 2
     or (select count(*) from public.leads where created_at > now() - interval '1 minute') >= 20 then
    return jsonb_build_object('ok', false, 'errors', '{"form":"We just received this enquiry. Please wait a few minutes before sending another."}'::jsonb);
  end if;

  insert into public.leads (name, email, whatsapp, age, height_cm, weight_kg, goal, target_weight_kg, experience,
    workout_location, diet_preference, allergies, work_schedule, availability, biggest_challenge, plan_interest,
    start_date, message, medical_notes, source, utm, consent)
  values (v_name, v_email, v_phone, v_age::int, v_height, v_weight, v_goal, v_target, v_exp, v_loc, v_diet,
    nullif(trim(p->>'allergies'), ''), nullif(trim(p->>'work_schedule'), ''), nullif(trim(p->>'availability'), ''),
    nullif(trim(p->>'biggest_challenge'), ''), left(nullif(trim(p->>'plan_interest'), ''), 80), v_start,
    nullif(trim(p->>'message'), ''), nullif(trim(p->>'medical_notes'), ''), 'website',
    case when jsonb_typeof(p->'utm') = 'object' then p->'utm' end, true)
  returning id into v_id;

  perform private.after_new_lead(v_id);
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
grant execute on function public.submit_lead(jsonb) to anon, authenticated;

-- The current live booking form still writes to `bookings`; mirror those rows into leads.
create or replace function private.booking_to_lead()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  begin
    insert into public.leads (created_at, name, email, whatsapp, age, weight_kg, goal, experience, workout_location,
      plan_interest, message, source, consent)
    values (new.created_at, coalesce(nullif(trim(new.name), ''), 'Unknown'),
      case when new.email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then lower(trim(new.email)) end,
      left(regexp_replace(coalesce(new.phone, ''), '[^0-9+]', '', 'g'), 20),
      case when new.age between 14 and 100 then new.age end,
      case when new.weight between 30 and 300 then new.weight end,
      case lower(coalesce(new.goal, ''))
        when 'fat loss' then 'fat_loss' when 'muscle gain' then 'muscle_gain'
        when 'recomposition' then 'recomposition' when 'general fitness' then 'general_fitness' end,
      case lower(coalesce(new.experience, '')) when 'beginner' then 'beginner' when 'intermediate' then 'intermediate' when 'advanced' then 'advanced' end,
      case lower(coalesce(new.location, '')) when 'gym' then 'gym' when 'home' then 'home' when 'both' then 'both' end,
      left(new.plan, 80), left(new.message, 2000), 'website_v1', true)
    returning id into v_id;
    perform private.after_new_lead(v_id);
  exception when others then
    raise warning 'booking_to_lead failed: %', sqlerrm;
  end;
  return new;
end;
$$;
create or replace trigger bookings_to_leads after insert on public.bookings
  for each row execute function private.booking_to_lead();

-- Backfill earlier bookings (no emails for these).
insert into public.leads (created_at, name, email, whatsapp, age, weight_kg, goal, experience, workout_location, plan_interest, message, source, consent)
select b.created_at, coalesce(nullif(trim(b.name), ''), 'Unknown'),
  case when b.email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then lower(trim(b.email)) end,
  left(regexp_replace(coalesce(b.phone, ''), '[^0-9+]', '', 'g'), 20),
  case when b.age between 14 and 100 then b.age end,
  case when b.weight between 30 and 300 then b.weight end,
  case lower(coalesce(b.goal, ''))
    when 'fat loss' then 'fat_loss' when 'muscle gain' then 'muscle_gain'
    when 'recomposition' then 'recomposition' when 'general fitness' then 'general_fitness' end,
  case lower(coalesce(b.experience, '')) when 'beginner' then 'beginner' when 'intermediate' then 'intermediate' when 'advanced' then 'advanced' end,
  case lower(coalesce(b.location, '')) when 'gym' then 'gym' when 'home' then 'home' when 'both' then 'both' end,
  left(b.plan, 80), left(b.message, 2000), 'website_v1', true
from public.bookings b;
insert into public.lead_events (lead_id, created_at, kind, to_status)
select id, created_at, 'created', 'new' from public.leads where source = 'website_v1';

-- Staff: convert a lead into a client (activates an existing account, or pre-approves the email).
create or replace function public.convert_lead(p_lead uuid, p_plan text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare l public.leads; v_profile uuid; v_mode text;
begin
  if not private.is_staff() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into l from public.leads where id = p_lead;
  if not found then raise exception 'Lead not found'; end if;
  if l.email is null then raise exception 'This lead has no email address. Add one first.'; end if;

  select id into v_profile from public.profiles where lower(email) = lower(l.email) limit 1;
  if v_profile is not null then
    update public.profiles set status = 'active', lead_id = l.id,
      plan_name = coalesce(nullif(p_plan, ''), plan_name, l.plan_interest),
      full_name = coalesce(full_name, l.name), phone = coalesce(phone, l.whatsapp),
      start_weight = coalesce(start_weight, l.weight_kg), target_weight = coalesce(target_weight, l.target_weight_kg),
      height_cm = coalesce(height_cm, l.height_cm), goal = coalesce(goal, l.goal), diet_preference = coalesce(diet_preference, l.diet_preference)
    where id = v_profile;
    v_mode := 'activated';
  else
    insert into public.client_invites (email, full_name, plan_name, lead_id)
    values (lower(l.email), l.name, coalesce(nullif(p_plan, ''), l.plan_interest), l.id)
    on conflict do nothing;
    v_mode := 'invited';
  end if;

  update public.leads set status = 'converted', converted_profile_id = coalesce(v_profile, converted_profile_id) where id = l.id;
  insert into public.lead_events (lead_id, kind, note) values (l.id, 'converted',
    case when v_mode = 'activated' then 'Existing account activated' else 'Email pre-approved; account activates on sign-up' end);
  return jsonb_build_object('mode', v_mode, 'profile_id', v_profile, 'email', l.email);
end;
$$;
grant execute on function public.convert_lead(uuid, text) to authenticated;

-- ------------------------------------------------------------------
-- Signup: link leads and invites, notify coach and client
-- ------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(trim(new.raw_user_meta_data->>'name'), ''));
  v_invite public.client_invites;
  v_lead public.leads;
  v_status text := 'pending';
begin
  select * into v_invite from public.client_invites
    where lower(email) = lower(new.email) and used_at is null order by created_at desc limit 1;
  if v_invite.id is not null then v_status := 'active'; end if;
  select * into v_lead from public.leads where lower(email) = lower(new.email) order by created_at desc limit 1;

  insert into public.profiles (id, email, full_name, phone, role, status, approved_at, plan_name, lead_id,
    start_weight, target_weight, height_cm, goal, diet_preference)
  values (new.id, new.email, coalesce(v_name, v_invite.full_name, v_lead.name),
    coalesce(nullif(trim(new.raw_user_meta_data->>'phone'), ''), v_lead.whatsapp), 'client', v_status,
    case when v_status = 'active' then now() end, coalesce(v_invite.plan_name, v_lead.plan_interest), v_lead.id,
    v_lead.weight_kg, v_lead.target_weight_kg, v_lead.height_cm, v_lead.goal, v_lead.diet_preference)
  on conflict (id) do nothing;

  begin
    if v_invite.id is not null then
      update public.client_invites set used_at = now(), used_by = new.id where id = v_invite.id;
    end if;
    if v_lead.id is not null then
      insert into public.lead_events (lead_id, kind, note) values (v_lead.id, 'registered', 'Created a portal account');
      update public.leads set converted_profile_id = new.id where id = v_lead.id and converted_profile_id is null;
    end if;
    perform private.notify_staff('registration',
      coalesce(v_name, new.email) || case when v_status = 'active' then ' joined (pre-approved)' else ' is waiting for approval' end,
      new.email, '/admin/#client/' || new.id);
    perform private.enqueue_email(private.coach_email(), 'coach_new_registration', 'New account: ' || coalesce(v_name, new.email),
      jsonb_build_object('name', v_name, 'email', new.email, 'status', v_status, 'id', new.id), 'reg-coach:' || new.id);
    perform private.enqueue_email(new.email,
      case when v_status = 'active' then 'client_welcome_active' else 'client_registration' end,
      case when v_status = 'active' then 'Welcome, your coaching account is ready' else 'Thanks for signing up' end,
      jsonb_build_object('name', v_name), 'reg-client:' || new.id);
  exception when others then
    raise warning 'handle_new_user follow-up failed: %', sqlerrm;
  end;
  return new;
end;
$$;

-- ------------------------------------------------------------------
-- Feedback and reviews (moderated before anything is public)
-- ------------------------------------------------------------------
alter table public.feedback
  add column if not exists status text not null default 'pending',
  add column if not exists is_anonymous boolean not null default false,
  add column if not exists consent_public boolean not null default false,
  add column if not exists display_name text,
  add column if not exists client_id uuid references public.profiles(id) on delete set null,
  add column if not exists featured boolean not null default false,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.feedback add constraint feedback_status_check check (status in ('pending', 'approved', 'rejected'));
alter table public.feedback add constraint feedback_rating_check check (rating is null or rating between 1 and 5);
alter table public.feedback add constraint feedback_publish_needs_consent check (status <> 'approved' or consent_public or not featured);
create index if not exists feedback_status_idx on public.feedback (status, created_at desc);

create policy feedback_staff_update on public.feedback for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy feedback_staff_delete on public.feedback for delete to authenticated
  using ((select private.is_admin()));
alter policy "feedback_admin_read" on public.feedback using ((select private.is_staff()));

create or replace function private.feedback_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and not private.is_staff() then
    new.status := 'pending'; new.featured := false; new.reviewed_at := null; new.reviewed_by := null;
    new.consent_public := coalesce(new.consent_public, false) or lower(coalesce(new.can_share, '')) in ('yes', 'true');
    new.client_id := auth.uid();
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.reviewed_at := now(); new.reviewed_by := auth.uid();
  end if;
  return new;
end;
$$;
create or replace trigger feedback_guard before insert or update on public.feedback
  for each row execute function private.feedback_guard();

create or replace function private.feedback_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_staff('feedback', 'New feedback (' || coalesce(new.rating::text, '?') || '/5)',
    left(new.feedback, 140), '/admin/#reviews');
  return new;
end;
$$;
create or replace trigger feedback_notify after insert on public.feedback
  for each row execute function private.feedback_notify();
create or replace trigger feedback_audit after update or delete on public.feedback
  for each row execute function private.audit();

create or replace function public.submit_feedback(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e jsonb := '{}'::jsonb;
  v_rating int;
  v_body text := trim(coalesce(p->>'feedback', ''));
  v_email text := lower(trim(coalesce(p->>'email', '')));
  v_anon boolean := coalesce((p->>'is_anonymous')::boolean, false);
  v_rel text := nullif(p->>'relationship', '');
begin
  if coalesce(p->>'website', '') <> '' then return jsonb_build_object('ok', true); end if;
  begin v_rating := (p->>'rating')::int; exception when others then v_rating := null; end;
  if v_rating is null or v_rating not between 1 and 5 then e := e || '{"rating":"Choose a rating from 1 to 5."}'; end if;
  if char_length(v_body) < 10 then e := e || '{"feedback":"Write at least a sentence (10 characters)."}'; end if;
  if char_length(v_body) > 2000 then e := e || '{"feedback":"Keep this under 2000 characters."}'; end if;
  if v_email <> '' and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then e := e || '{"email":"Enter a valid email or leave it blank."}'; end if;
  if char_length(coalesce(p->>'name', '')) > 80 then e := e || '{"name":"Keep your name under 80 characters."}'; end if;
  if v_rel is not null and v_rel not in ('current_client', 'past_client', 'follower', 'friend_family') then e := e || '{"relationship":"Choose how you know me."}'; end if;
  if e <> '{}'::jsonb then return jsonb_build_object('ok', false, 'errors', e); end if;
  if (select count(*) from public.feedback where created_at > now() - interval '1 minute') >= 10 then
    return jsonb_build_object('ok', false, 'errors', '{"form":"Too many submissions right now. Try again in a minute."}'::jsonb);
  end if;

  insert into public.feedback (name, email, rating, relationship, feedback, can_share, is_anonymous, consent_public, raw_data, client_id)
  values (case when v_anon then null else nullif(trim(p->>'name'), '') end, nullif(v_email, ''), v_rating, v_rel, v_body,
    case when coalesce((p->>'consent_public')::boolean, false) then 'Yes' else 'No' end,
    v_anon, coalesce((p->>'consent_public')::boolean, false), null, auth.uid());
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.submit_feedback(jsonb) to anon, authenticated;

create or replace function public.get_public_reviews(p_limit int default 12)
returns table (id uuid, display_name text, rating int, relationship text, body text, created_at timestamptz, featured boolean)
language sql stable security definer set search_path = '' as $$
  select f.id,
    case when f.is_anonymous then 'Anonymous' else coalesce(nullif(trim(f.display_name), ''), private.short_name(f.name)) end,
    f.rating, f.relationship, f.feedback, f.created_at, f.featured
  from public.feedback f
  where f.status = 'approved' and f.consent_public
  order by f.featured desc, f.created_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;
grant execute on function public.get_public_reviews(int) to anon, authenticated;

-- ------------------------------------------------------------------
-- Transformations gallery
-- ------------------------------------------------------------------
create table if not exists public.transformations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  client_display_name text not null check (char_length(client_display_name) between 1 and 60),
  client_id uuid references public.profiles(id) on delete set null,
  goal_category text not null check (goal_category in ('fat_loss', 'muscle_gain', 'recomposition')),
  duration_weeks int check (duration_weeks is null or duration_weeks between 1 and 260),
  start_weight_kg numeric check (start_weight_kg is null or start_weight_kg between 30 and 300),
  end_weight_kg numeric check (end_weight_kg is null or end_weight_kg between 30 and 300),
  headline text check (headline is null or char_length(headline) <= 120),
  goal text check (goal is null or char_length(goal) <= 300),
  summary text check (summary is null or char_length(summary) <= 3000),
  testimonial text check (testimonial is null or char_length(testimonial) <= 2000),
  before_image_url text,
  after_image_url text,
  consent_confirmed boolean not null default false,
  consent_note text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transformations_publish_needs_consent check (status <> 'published' or consent_confirmed)
);
create index if not exists transformations_public_idx on public.transformations (status, sort_order, published_at desc);
alter table public.transformations enable row level security;
create policy transformations_public_read on public.transformations for select to anon, authenticated
  using (status = 'published');
create policy transformations_staff_all on public.transformations for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.transformations_publish()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;
create or replace trigger transformations_publish before insert or update on public.transformations
  for each row execute function private.transformations_publish();
create or replace trigger transformations_audit after insert or update or delete on public.transformations
  for each row execute function private.audit();

-- Storage: staff manage the public transformations bucket.
create policy transformations_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'transformations' and (select private.is_staff()))
  with check (bucket_id = 'transformations' and (select private.is_staff()));
create policy transformations_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'transformations' and (select private.is_staff()));
create policy transformations_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'transformations' and (select private.is_staff()));
