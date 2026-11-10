-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null check (type in ('enquiry','review','team')),
  status text not null default 'New',
  published boolean not null default false,
  notes text not null default '',
  data jsonb not null
);
create index if not exists submissions_type_created on submissions (type, created_at desc);

-- Lock the table: nobody can read or write it from the browser.
-- Only your Vercel functions (using the service key) can.
alter table submissions enable row level security;
