-- FindingFounders — 0004: GitHub OAuth integration columns
-- Idempotent.

alter table public.profiles add column if not exists github_connected      boolean default false;
alter table public.profiles add column if not exists github_access_token   text;  -- TODO: encrypt at rest
alter table public.profiles add column if not exists github_username       text;  -- canonical handle from OAuth
alter table public.profiles add column if not exists github_data           jsonb;
alter table public.profiles add column if not exists github_quality        text check (github_quality in ('low', 'medium', 'high'));
alter table public.profiles add column if not exists github_connected_at   timestamptz;

create index if not exists profiles_github_quality_idx on public.profiles(github_quality);
create index if not exists profiles_github_connected_idx on public.profiles(github_connected) where github_connected = true;
