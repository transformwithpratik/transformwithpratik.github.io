-- OPTIONAL, NOT APPLIED. Decide on retention before running this in the SQL editor.
-- Deletes old audit entries (2 years), read notifications (180 days), the email log (180 days)
-- and enquiries that never became clients after 12 months without activity.
-- If you run it, update the "How long it is kept" section of /privacy to match.

-- Retention: keep tables small and personal data no longer than needed.
create or replace function private.run_retention()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.audit_log where at < now() - interval '2 years';
  delete from public.notifications where read_at is not null and created_at < now() - interval '180 days';
  delete from public.email_outbox where created_at < now() - interval '180 days';
  delete from public.leads where status in ('not_a_fit', 'lost', 'new', 'contacted') and converted_profile_id is null
    and updated_at < now() - interval '12 months';
end;
$$;
select cron.schedule('weekly-retention', '0 21 * * 0', 'select private.run_retention()');
