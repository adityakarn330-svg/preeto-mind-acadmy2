-- PreetoMind Academy student portal migration.
-- Run once in Supabase SQL Editor after db/setup.sql.
create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  subjects text not null default '',
  start_date date,
  end_date date,
  status text not null default 'Active' check (status in ('Active','Paused','Completed','Archived')),
  created_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  student_id text not null unique,
  full_name text not null,
  email text not null default '',
  phone text not null default '',
  batch_id uuid references batches(id) on delete set null,
  password_hash text not null,
  password_salt text not null,
  payment_method text not null default 'UPI' check (payment_method in ('UPI','Bank Transfer','Other')),
  payment_reference text not null default '',
  paid_amount numeric(12,2),
  paid_at date,
  status text not null default 'Active' check (status in ('Active','Paused','Completed','Inactive')),
  joined_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists weekly_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  week_start date not null,
  week_end date,
  attendance numeric(5,2) not null default 0 check (attendance >= 0 and attendance <= 100),
  score numeric(5,2) not null default 0 check (score >= 0 and score <= 100),
  topics text not null default '',
  assignments text not null default '',
  remarks text not null default '',
  strengths text not null default '',
  improvement_areas text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, week_start)
);

create index if not exists students_batch_idx on students(batch_id);
create index if not exists students_status_idx on students(status);
create index if not exists reports_student_week_idx on weekly_reports(student_id, week_start desc);

alter table batches enable row level security;
alter table students enable row level security;
alter table weekly_reports enable row level security;
