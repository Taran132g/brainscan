-- FindingFounders — Phase 2 initial schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- Tables:
--   profiles       — one row per user; profile fields + founder rank cache + Stripe state
--   vault_uploads  — append-only history of every vault analysis
--   matches        — Phase 3 placeholder (cross-user match records)
--
-- Row-level security is enabled on all tables. Users can read/write only their
-- own rows; the backend uses the service-role key to bypass RLS where needed.

-- =========================================================
-- profiles
-- =========================================================
create table if not exists public.profiles (
    id                      uuid primary key references auth.users on delete cascade,
    email                   text,
    full_name               text,
    age                     int,
    city                    text,
    willing_to_relocate     text check (willing_to_relocate in ('yes', 'no', 'maybe')),
    work_authorization      text check (work_authorization in ('us_citizen', 'us_permanent_resident', 'us_visa', 'non_us')),
    school                  text,
    github                  text,
    linkedin                text,
    twitter                 text,
    website                 text,
    gender                  text,
    race                    text,
    languages               text,

    -- Founder ranking (cached — recomputed when upload happens)
    founder_score           int check (founder_score between 0 and 100),
    founder_rank            int check (founder_rank between 1 and 10),
    founder_tier            text check (founder_tier in ('Visionary','Builder','Operator','Explorer','Newcomer')),

    -- Brain card snapshot (mirrors the last upload's brain card)
    brain_confidence        int,
    brain_card              jsonb,
    founder_signal          jsonb,

    -- Subscription state (Stripe wires into this next)
    subscription_tier       text default 'free' check (subscription_tier in ('free', 'brain_card', 'full')),
    subscription_status     text default 'inactive',
    stripe_customer_id      text,
    stripe_subscription_id  text,

    created_at              timestamptz default now(),
    updated_at              timestamptz default now()
);

create index if not exists profiles_tier_idx     on public.profiles(founder_tier);
create index if not exists profiles_city_idx     on public.profiles(city);
create index if not exists profiles_updated_idx  on public.profiles(updated_at desc);

-- Auto-update updated_at on every change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

-- Auto-insert a profile row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
    insert into public.profiles (id, email, full_name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- =========================================================
-- vault_uploads
-- =========================================================
create table if not exists public.vault_uploads (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references auth.users on delete cascade,
    uploaded_at         timestamptz default now(),
    note_count          int,
    total_words         int,
    avg_words_per_note  numeric(10, 2),
    quality_score       int check (quality_score between 0 and 100),
    chunks_indexed      int,
    brain_card          jsonb,
    founder_signal      jsonb,
    github_username     text,
    linkedin_url        text
);

create index if not exists vault_uploads_user_idx       on public.vault_uploads(user_id, uploaded_at desc);
create index if not exists vault_uploads_uploaded_idx   on public.vault_uploads(uploaded_at desc);

-- =========================================================
-- matches  (Phase 3 placeholder — schema is forward-compatible)
-- =========================================================
create table if not exists public.matches (
    id                  uuid primary key default gen_random_uuid(),
    user_a              uuid not null references auth.users on delete cascade,
    user_b              uuid not null references auth.users on delete cascade,
    similarity_score    numeric(5, 4) check (similarity_score between 0 and 1),
    ai_summary          text,
    ai_build_idea       text,
    user_a_accepted     boolean,
    user_b_accepted     boolean,
    user_a_decision_at  timestamptz,
    user_b_decision_at  timestamptz,
    created_at          timestamptz default now(),
    constraint different_users check (user_a <> user_b),
    constraint canonical_order check (user_a < user_b)
);

create index if not exists matches_user_a_idx on public.matches(user_a);
create index if not exists matches_user_b_idx on public.matches(user_b);

-- =========================================================
-- Row-level security
-- =========================================================
alter table public.profiles      enable row level security;
alter table public.vault_uploads enable row level security;
alter table public.matches       enable row level security;

-- profiles: a user can read and modify only their own row.
-- (Public read of selected fields will come in Phase 3 via a view.)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
    on public.profiles for select
    using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
    on public.profiles for insert
    with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
    on public.profiles for update
    using (auth.uid() = id);

-- vault_uploads: users can read their own uploads (write happens server-side
-- with the service role key, bypassing RLS).
drop policy if exists "vault_uploads_select_own" on public.vault_uploads;
create policy "vault_uploads_select_own"
    on public.vault_uploads for select
    using (auth.uid() = user_id);

-- matches: visible to either participant.
drop policy if exists "matches_select_participant" on public.matches;
create policy "matches_select_participant"
    on public.matches for select
    using (auth.uid() = user_a or auth.uid() = user_b);

-- Allow either participant to mark their own accept/decline.
drop policy if exists "matches_update_participant" on public.matches;
create policy "matches_update_participant"
    on public.matches for update
    using (auth.uid() = user_a or auth.uid() = user_b);

-- Done. Run this whole file as one query in the SQL Editor.
