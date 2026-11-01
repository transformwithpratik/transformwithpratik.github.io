-- Performance only: evaluate auth.uid() once per query instead of once per row in the
-- policies inherited from the v2 schema. Same rules as before.
alter policy profiles_self_read on public.profiles using ((select auth.uid()) = id);
alter policy profiles_self_update on public.profiles using ((select auth.uid()) = id);
alter policy plans_client_read on public.plans using ((select auth.uid()) = client_id);
alter policy daily_logs_client_read on public.daily_logs using ((select auth.uid()) = client_id);
alter policy weekly_logs_client_read on public.weekly_logs using ((select auth.uid()) = client_id);
alter policy weekly_logs_client_update on public.weekly_logs using ((select auth.uid()) = client_id);
alter policy weekly_logs_client_write on public.weekly_logs with check ((select auth.uid()) = client_id);
alter policy files_client_read on public.client_files using ((select auth.uid()) = client_id);
