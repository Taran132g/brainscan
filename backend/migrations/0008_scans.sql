-- BrainScan — append-only multi-domain scans
-- Run this whole file in the Supabase SQL Editor.
--
-- Every scan (founder / career / relationships / …) is appended here, never
-- overwritten. That history is what powers the longitudinal diff —
-- "here's what shifted in how you think since last time" — the retention unlock.

create table if not exists public.scans (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users on delete cascade,
    domain      text not null,
    sections    jsonb,
    signal      jsonb,
    created_at  timestamptz default now()
);

create index if not exists scans_user_domain_idx
    on public.scans(user_id, domain, created_at desc);

alter table public.scans enable row level security;

-- Users can read their own scan history (writes happen server-side with the
-- service-role key, which bypasses RLS).
drop policy if exists "scans_select_own" on public.scans;
create policy "scans_select_own"
    on public.scans for select
    using (auth.uid() = user_id);

-- Done.
