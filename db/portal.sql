-- Run this once in Supabase (SQL Editor -> New query -> paste -> Run), AFTER db/setup.sql.
create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null unique,
  description text not null default ''
);
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  student_code text not null unique,
  name text not null,
  batch_id uuid references batches(id) on delete set null,
  password_hash text not null,
  active boolean not null default true
);
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  student_id uuid not null references students(id) on delete cascade,
  week_start date not null,
  score numeric(5,2) check (score between 0 and 100),
  attendance numeric(5,2) check (attendance between 0 and 100),
  remarks text not null default '',
  unique (student_id, week_start)
);
create index if not exists reports_student_week on reports (student_id, week_start);
create index if not exists students_batch on students (batch_id);
-- Lock all three tables: only your Vercel functions (service key) can read or write them.
alter table batches enable row level security;
alter table students enable row level security;
alter table reports enable row level security;
