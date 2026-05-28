-- FindingFounders — 0005: LinkedIn lookup columns + big_tech_employer flag
-- Idempotent.

alter table public.profiles add column if not exists linkedin_quality   text
    check (linkedin_quality in ('low', 'medium', 'high'));
alter table public.profiles add column if not exists linkedin_data      jsonb;
alter table public.profiles add column if not exists linkedin_connected boolean default false;
alter table public.profiles add column if not exists linkedin_connected_at timestamptz;

-- Used by founder_score — set to true if LinkedIn's latest_company matches
-- the big-tech list (Google / Meta / Stripe / OpenAI / etc.). Computed by
-- the LinkedIn lookup route, never user-editable.
alter table public.profiles add column if not exists big_tech_employer  boolean default false;

create index if not exists profiles_linkedin_quality_idx on public.profiles(linkedin_quality);
create index if not exists profiles_linkedin_connected_idx on public.profiles(linkedin_connected)
    where linkedin_connected = true;
