-- Run once in the Supabase SQL Editor. No service-role key belongs in the frontend.
begin;
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admin_users enable row level security;
create policy admin_self on public.admin_users for select to authenticated using (user_id = (select auth.uid()));
grant select on public.admin_users to authenticated;

create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 10 and 160),
  description text not null check (length(description) between 10 and 350),
  category text not null check (category in ('Politik','Ekonomi','Sosial','Lingkungan','Hukum')),
  illustration text not null default 'building' check (illustration in ('meal','chart','building','energy','phone','scales')),
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.topics enable row level security;
create policy topics_read on public.topics for select to anon, authenticated using (active or public.is_admin());
create policy topics_admin_insert on public.topics for insert to authenticated with check (public.is_admin());
create policy topics_admin_update on public.topics for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy topics_admin_delete on public.topics for delete to authenticated using (public.is_admin());
grant select on public.topics to anon, authenticated;
grant insert, update, delete on public.topics to authenticated;

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.topics(id) on delete set null,
  pro_user uuid not null references auth.users(id) on delete cascade,
  kontra_user uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','ended')),
  pro_seen timestamptz not null default now(),
  kontra_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (pro_user <> kontra_user)
);
create index matches_pro on public.matches(pro_user, status);
create index matches_kontra on public.matches(kontra_user, status);
alter table public.matches enable row level security;
create policy matches_participant on public.matches for select to authenticated using ((select auth.uid()) in (pro_user, kontra_user));
grant select on public.matches to authenticated;

create table public.match_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  side text not null check (side in ('pro','kontra')),
  avoid_user uuid,
  joined_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
create index queue_topic on public.match_queue(topic_id, side, joined_at);
alter table public.match_queue enable row level security;
-- Queue is only accessible via bounded SECURITY DEFINER RPCs below.

create table public.room_messages (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('chat','offer','answer','ice')),
  payload jsonb not null check (octet_length(payload::text) <= 65536),
  created_at timestamptz not null default now(),
  check (kind <> 'chat' or (payload ? 'text' and jsonb_typeof(payload->'text') = 'string' and length(payload->>'text') between 1 and 2000))
);
create index messages_match on public.room_messages(match_id, id);
create index messages_sender_time on public.room_messages(sender_id, created_at);
alter table public.room_messages enable row level security;
create policy messages_read on public.room_messages for select to authenticated using (
  exists(select 1 from public.matches m where m.id = match_id and (select auth.uid()) in (m.pro_user,m.kontra_user))
);
create policy messages_insert on public.room_messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and exists(select 1 from public.matches m where m.id = match_id and m.status = 'active' and (select auth.uid()) in (m.pro_user,m.kontra_user))
);
grant select, insert on public.room_messages to authenticated;
grant usage on sequence public.room_messages_id_seq to authenticated;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete set null,
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('Ujaran kebencian','Pelecehan atau ancaman','Konten tidak pantas','Spam','Lainnya')),
  detail text not null default '' check (length(detail) <= 2000),
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique(match_id, reporter_id)
);
create index reports_pair on public.reports(reporter_id, reported_id);
alter table public.reports enable row level security;
create policy reports_admin_read on public.reports for select to authenticated using (public.is_admin());
create policy reports_admin_update on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy reports_submit on public.reports for insert to authenticated with check (
  reporter_id = (select auth.uid()) and not resolved and exists(
    select 1 from public.matches m where m.id = match_id and
      ((m.pro_user = auth.uid() and m.kontra_user = reported_id) or (m.kontra_user = auth.uid() and m.pro_user = reported_id))
  )
);
grant select, insert on public.reports to authenticated;
grant update(resolved) on public.reports to authenticated;

create function public.leave_session() returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  delete from public.match_queue where user_id = auth.uid();
  update public.matches set status = 'ended' where status = 'active' and auth.uid() in (pro_user, kontra_user);
end;
$$;

create function public.join_queue(p_topic uuid, p_side text, p_avoid uuid default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare opponent public.match_queue; found_match public.matches; me uuid := auth.uid();
begin
  if me is null then raise exception 'Authentication required'; end if;
  if p_side not in ('pro','kontra') or p_side is null then raise exception 'Invalid side'; end if;
  if not exists(select 1 from public.topics where id = p_topic and active) then raise exception 'Topic unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended(me::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_topic::text, 1));
  -- Remove stale presence, including sessions abandoned by a closed browser.
  delete from public.match_queue where topic_id = p_topic and seen_at < now() - interval '90 seconds';
  update public.matches set status = 'ended' where status = 'active' and me in (pro_user,kontra_user)
    and least(pro_seen,kontra_seen) < now() - interval '90 seconds';
  select * into found_match from public.matches where status = 'active' and me in (pro_user,kontra_user) limit 1;
  if found then return to_jsonb(found_match); end if;
  delete from public.match_queue where user_id = me;
  select q.* into opponent from public.match_queue q where q.topic_id = p_topic and q.side <> p_side and q.user_id <> me
    and (p_avoid is null or q.user_id <> p_avoid) and (q.avoid_user is null or q.avoid_user <> me)
    and not exists(select 1 from public.reports r where (r.reporter_id = me and r.reported_id = q.user_id) or (r.reporter_id = q.user_id and r.reported_id = me))
    order by q.joined_at for update skip locked limit 1;
  if found then
    insert into public.matches(topic_id,pro_user,kontra_user)
    values(p_topic,case when p_side = 'pro' then me else opponent.user_id end,case when p_side = 'kontra' then me else opponent.user_id end)
    returning * into found_match;
    delete from public.match_queue where user_id = opponent.user_id;
    return to_jsonb(found_match);
  else
    insert into public.match_queue(user_id,topic_id,side,avoid_user) values(me,p_topic,p_side,p_avoid);
    return null;
  end if;
end;
$$;

create function public.session_status() returns jsonb language plpgsql security definer set search_path = '' as $$
declare found_match public.matches;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.match_queue set seen_at = now() where user_id = auth.uid();
  update public.matches set status = 'ended' where status = 'active' and auth.uid() in (pro_user,kontra_user)
    and least(pro_seen,kontra_seen) < now() - interval '90 seconds';
  update public.matches set pro_seen = case when pro_user = auth.uid() then now() else pro_seen end,
    kontra_seen = case when kontra_user = auth.uid() then now() else kontra_seen end
    where status = 'active' and auth.uid() in (pro_user,kontra_user) returning * into found_match;
  if found then return to_jsonb(found_match); end if;
  return null;
end;
$$;

create function public.topic_activity() returns table(topic_id uuid,waiting bigint) language sql stable security definer set search_path = '' as $$
  select q.topic_id,count(*) from public.match_queue q join public.topics t on t.id = q.topic_id
  where t.active and q.seen_at > now() - interval '90 seconds' group by q.topic_id;
$$;

create function public.throttle_messages() returns trigger language plpgsql security definer set search_path = '' as $$
declare recent_count int;
begin
  new.created_at := now();
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 2));
  select count(*) into recent_count from public.room_messages where sender_id = auth.uid() and created_at > now() - interval '10 seconds' and (kind = 'chat') = (new.kind = 'chat');
  if recent_count >= (case when new.kind = 'chat' then 20 else 180 end) then raise exception 'Terlalu banyak pesan. Tunggu beberapa detik.'; end if;
  return new;
end;
$$;
create trigger room_message_throttle before insert on public.room_messages for each row execute function public.throttle_messages();

create function public.stamp_report_time() returns trigger language plpgsql set search_path = '' as $$
begin
  new.created_at := now();
  return new;
end;
$$;
create trigger report_timestamp before insert on public.reports for each row execute function public.stamp_report_time();
revoke all on function public.stamp_report_time() from public;

revoke all on function public.leave_session(), public.join_queue(uuid,text,uuid), public.session_status(), public.topic_activity(), public.throttle_messages() from public;
grant execute on function public.leave_session(), public.join_queue(uuid,text,uuid), public.session_status() to authenticated;
grant execute on function public.topic_activity() to anon, authenticated;

alter publication supabase_realtime add table public.room_messages;
-- Match status is polled as a fallback even if Realtime is unavailable.

insert into public.topics(id,title,description,category,illustration,featured) values
('a0000000-0000-4000-8000-000000000001','Makan bergizi gratis: investasi atau beban anggaran?','Antara masa depan generasi muda dan prioritas belanja negara. Kamu di sisi mana?','Politik','meal',true),
('a0000000-0000-4000-8000-000000000002','Pajak naik, kesejahteraan ikut naik?','Menimbang kontribusi publik dan dampaknya pada daya beli masyarakat.','Ekonomi','chart',false),
('a0000000-0000-4000-8000-000000000003','Politik dinasti: hak demokrasi atau ancaman?','Setiap warga berhak dipilih. Tapi di mana batas keadilan dalam kompetisi?','Politik','building',true),
('a0000000-0000-4000-8000-000000000004','Transisi energi harus dipercepat, berapa pun biayanya?','Krisis iklim, lapangan kerja, dan harga energi. Mari cari titik temunya.','Lingkungan','energy',false),
('a0000000-0000-4000-8000-000000000005','Media sosial perlu dibatasi untuk anak di bawah 16 tahun?','Melindungi generasi digital tanpa menutup ruang berekspresi.','Sosial','phone',false),
('a0000000-0000-4000-8000-000000000006','Hukuman koruptor sudah cukup memberi efek jera?','Membicarakan keadilan, pemulihan aset, dan kepercayaan kepada hukum.','Hukum','scales',false);
commit;
