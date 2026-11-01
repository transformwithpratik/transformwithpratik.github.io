-- Applied 2026-11-01. Closes two privilege-escalation holes in the v2 schema:
-- 1. handle_new_user() copied `role` from user-supplied signup metadata, so
--    anyone could sign up as admin with supabase.auth.signUp({options:{data:{role:'admin'}}}).
-- 2. profiles_self_update let a signed-in client set role = 'admin' on their own row.

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
    'client'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only an admin can change roles' using errcode = '42501';
    end if;
    if new.id is distinct from old.id then
      raise exception 'Profile id cannot change' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- Clients may read their own plan PDFs but not overwrite or delete them.
alter policy "client_plans_admin" on storage.objects
  using (bucket_id = 'client-plans' and public.is_admin())
  with check (bucket_id = 'client-plans' and public.is_admin());
create policy "client_plans_owner_read" on storage.objects
  for select using (bucket_id = 'client-plans' and auth.uid()::text = (storage.foldername(name))[1]);

-- Allow a coach role alongside client and admin.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('client', 'coach', 'admin'));
