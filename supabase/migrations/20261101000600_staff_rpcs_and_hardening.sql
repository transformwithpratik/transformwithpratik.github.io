-- Staff RPCs, permission hardening and privacy-safe auditing of deletes. Applied 2026-11-01.

-- Coach-only helpers called from the dashboard.
create or replace function public.notify_client(p_client uuid, p_title text, p_link text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'Not allowed' using errcode = '42501'; end if;
  perform private.notify(p_client, 'file', left(p_title, 200), null, p_link);
end;
$$;

create or replace function public.admin_send_test_email()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'Not allowed' using errcode = '42501'; end if;
  perform private.enqueue_email(private.coach_email(), 'test', 'Test email from your coaching platform',
    jsonb_build_object('sent_by', (select full_name from public.profiles where id = auth.uid())), 'test:' || extract(epoch from now())::bigint);
end;
$$;

-- Only signed-in users can call the dashboard RPCs; the functions check the role themselves.
revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.convert_lead(uuid, text) from public, anon;
revoke execute on function public.notify_client(uuid, text, text) from public, anon;
revoke execute on function public.admin_send_test_email() from public, anon;
grant execute on function public.admin_overview(), public.convert_lead(uuid, text), public.notify_client(uuid, text, text), public.admin_send_test_email() to authenticated;

-- Trigger functions do not need to be callable through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.profiles_guard() from public, anon, authenticated;

-- Coaches manage client profiles only; admins manage everyone.
alter policy profiles_staff_update on public.profiles
  using ((select private.is_staff()) and role = 'client')
  with check ((select private.is_staff()) and role = 'client');

-- Auditing deletes: keep what was deleted and when, not the personal data itself.
create or replace function private.audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_old jsonb; v_new jsonb; v_changes jsonb := '{}'::jsonb; k text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_changes := v_new - 'medical_notes' - 'notes' - 'admin_notes';
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old); v_new := to_jsonb(new);
    for k in select jsonb_object_keys(v_new) loop
      if k <> 'updated_at' and (v_new -> k) is distinct from (v_old -> k) then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('from', v_old -> k, 'to', v_new -> k));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then return new; end if;
  else
    v_old := to_jsonb(old);
    v_changes := jsonb_strip_nulls(jsonb_build_object('client_id', v_old -> 'client_id', 'role', v_old -> 'role', 'status', v_old -> 'status', 'title', v_old -> 'title'));
  end if;
  insert into public.audit_log (actor_id, action, table_name, record_id, changes)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'key', v_old ->> 'key'), v_changes);
  return coalesce(new, old);
end;
$$;
