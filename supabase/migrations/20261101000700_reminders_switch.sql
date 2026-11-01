-- Client reminders (check-in due, missed check-in, renewal) only run once switched on in Site settings.
-- Applied 2026-11-01, after the first scheduled run queued reminders before the new portal was live.
update public.site_settings
   set value = value || jsonb_build_object('reminders_enabled', false)
 where key = 'notifications' and not (value ? 'reminders_enabled');

create or replace function private.run_daily_reminders_if_enabled()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if private.setting_bool('notifications', 'reminders_enabled', false) then
    perform private.run_daily_reminders();
  end if;
end;
$$;

select cron.alter_job((select jobid from cron.job where jobname = 'daily-reminders'),
  command := 'select private.run_daily_reminders_if_enabled()');

update public.email_outbox
   set status = 'skipped', last_error = 'Reminders were paused until the new portal launches'
 where status = 'queued' and template = 'client_checkin_reminder';
