-- Optional operational setup: run AFTER 001_callbate.sql.
-- Enable pg_cron in Supabase Database > Extensions first.
-- Install this schedule before launching publicly to enforce the documented retention.
create or replace function public.cleanup_callbate() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.match_queue where seen_at < now() - interval '90 seconds';
  update public.matches set status = 'ended' where status = 'active' and least(pro_seen,kontra_seen) < now() - interval '90 seconds';
  delete from public.room_messages where created_at < now() - interval '24 hours';
  delete from public.reports where created_at < now() - interval '90 days';
  delete from public.matches m where m.status = 'ended' and m.created_at < now() - interval '7 days'
    and not exists(select 1 from public.reports r where r.match_id = m.id);
end;
$$;
revoke all on function public.cleanup_callbate() from public, anon, authenticated;

select cron.schedule('callbate-retention', '*/15 * * * *', 'select public.cleanup_callbate()');
