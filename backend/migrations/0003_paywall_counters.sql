-- FindingFounders — 0003: paywall counters
--
-- Adds the counters and credits needed to enforce the pricing model:
--   Free tier         — first brain card free (or $0.99 if not subscribed at all)
--   brain_card tier   — got the one-time $0.99; can re-upload at $0.99 each
--   full tier         — $3.99/mo with 2 free uploads/month, $0.99 per extra
--   extra_upload      — one-time purchases credit a single upload
--
-- Idempotent.

-- Track when the current monthly cycle resets and how many uploads consumed it.
alter table public.profiles add column if not exists uploads_in_cycle int not null default 0;
alter table public.profiles add column if not exists cycle_started_at timestamptz default now();

-- One-time credits — created when a user buys extra_upload or brain_card.
-- Consumed by the upload route. Soft-delete by setting consumed_at.
create table if not exists public.upload_credits (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users on delete cascade,
    source          text not null check (source in ('brain_card', 'extra_upload', 'admin')),
    granted_at      timestamptz default now(),
    consumed_at     timestamptz,
    stripe_session_id text
);

create index if not exists upload_credits_user_idx
    on public.upload_credits(user_id, consumed_at);

alter table public.upload_credits enable row level security;

drop policy if exists "upload_credits_select_own" on public.upload_credits;
create policy "upload_credits_select_own"
    on public.upload_credits for select
    using (auth.uid() = user_id);
-- Inserts and updates are server-side only via service-role key (RLS bypassed).
