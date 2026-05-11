-- Supabase Schema fuer Durak Multiplayer
-- Einfuegen via SQL Editor in Supabase Dashboard

create table if not exists games (
  code text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Realtime aktivieren
alter publication supabase_realtime add table games;

-- Row Level Security (offen, da wir mit anon key arbeiten)
alter table games enable row level security;

create policy "anyone can read games"
  on games for select
  using (true);

create policy "anyone can insert games"
  on games for insert
  with check (true);

create policy "anyone can update games"
  on games for update
  using (true)
  with check (true);

-- Auto cleanup: Spiele aelter als 24h loeschen
create or replace function cleanup_old_games() returns void as $$
begin
  delete from games where updated_at < now() - interval '24 hours';
end;
$$ language plpgsql;
