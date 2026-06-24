create table if not exists public.hasik_reports (
  id uuid primary key default gen_random_uuid(),
  room text not null default 'main-room',
  message_id text not null,
  reported_nickname text not null,
  reported_role text not null check (reported_role in ('인턴', '사원', '대리', '과장', '부장')),
  message_body text not null,
  reporter_session_id text not null,
  reason text not null default 'profile-report',
  created_at timestamptz not null default now()
);

create index if not exists hasik_reports_room_created_at_idx
  on public.hasik_reports (room, created_at desc);

alter table public.hasik_reports enable row level security;

drop policy if exists "anonymous users can create hasik reports" on public.hasik_reports;
create policy "anonymous users can create hasik reports"
  on public.hasik_reports
  for insert
  to anon, authenticated
  with check (
    char_length(room) between 1 and 64
    and char_length(message_id) between 1 and 128
    and char_length(reported_nickname) between 1 and 12
    and reported_role in ('인턴', '사원', '대리', '과장', '부장')
    and char_length(message_body) between 1 and 120
    and char_length(reporter_session_id) between 1 and 128
    and reason = 'profile-report'
  );

grant insert on public.hasik_reports to anon, authenticated;
