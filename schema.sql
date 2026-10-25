-- Health & Wealth Academy schema (Postgres). Paste into the Neon SQL editor and run once.
create table if not exists members (
  member_id   text primary key,
  name        text not null default '',
  upline_id   text,
  role        text not null default 'distributor',
  drill       integer not null default 0,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index if not exists members_upline_idx on members (upline_id);

create table if not exists lesson_progress (
  member_id    text not null references members(member_id) on delete cascade,
  lesson_id    text not null,
  score        integer not null,
  completed_at timestamptz not null default now(),
  primary key (member_id, lesson_id)
);

create table if not exists roleplay_attempts (
  id          bigserial primary key,
  member_id   text not null references members(member_id) on delete cascade,
  persona     text not null,
  total       integer not null,
  pass        boolean not null,
  red_flags   jsonb not null default '[]',
  created_at  timestamptz not null default now()
);
create index if not exists roleplay_member_idx on roleplay_attempts (member_id, created_at desc);
