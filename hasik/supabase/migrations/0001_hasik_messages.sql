create extension if not exists pgcrypto;

create table if not exists public.hasik_messages (
  id uuid primary key default gen_random_uuid(),
  room text not null default 'main-room',
  nickname text not null check (char_length(nickname) between 1 and 12),
  role text not null check (role in ('인턴', '사원', '대리', '과장', '부장')),
  body text not null check (char_length(body) between 1 and 120),
  kind text not null default 'normal' check (kind in ('normal', 'system', 'bell')),
  created_at timestamptz not null default now()
);

create index if not exists hasik_messages_room_created_at_idx
  on public.hasik_messages (room, created_at desc);

alter table public.hasik_messages enable row level security;

drop policy if exists "hasik messages are readable" on public.hasik_messages;
create policy "hasik messages are readable"
  on public.hasik_messages
  for select
  to anon, authenticated
  using (true);

drop policy if exists "anonymous users can write hasik messages" on public.hasik_messages;
create policy "anonymous users can write hasik messages"
  on public.hasik_messages
  for insert
  to anon, authenticated
  with check (
    char_length(room) between 1 and 64
    and char_length(nickname) between 1 and 12
    and char_length(body) between 1 and 120
    and role in ('인턴', '사원', '대리', '과장', '부장')
    and kind in ('normal', 'system', 'bell')
  );

grant select, insert on public.hasik_messages to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.hasik_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
