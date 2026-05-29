-- FindingFounders — Phase 3.5: opt-in connections + in-app messaging
-- Run this whole file as one query in the Supabase SQL Editor.
--
-- Adds:
--   1. A unique constraint on matches(user_a, user_b) so the backend can
--      upsert a single canonical row per pair (user_a < user_b is already
--      enforced by the 0001 canonical_order check).
--   2. A messages table for Hinge-style chat — readable/writable only once
--      BOTH participants have accepted the match (RLS-enforced).
--   3. messages added to the supabase_realtime publication so the frontend
--      gets live INSERTs over Realtime (free tier).

-- =========================================================
-- 1. One canonical match row per pair
-- =========================================================
do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'uq_matches_pair'
    ) then
        alter table public.matches
            add constraint uq_matches_pair unique (user_a, user_b);
    end if;
end $$;

-- =========================================================
-- 2. messages
-- =========================================================
create table if not exists public.messages (
    id          uuid primary key default gen_random_uuid(),
    match_id    uuid not null references public.matches on delete cascade,
    sender      uuid not null references auth.users on delete cascade,
    body        text not null check (char_length(body) between 1 and 4000),
    created_at  timestamptz default now()
);

create index if not exists messages_match_idx on public.messages(match_id, created_at);

alter table public.messages enable row level security;

-- A match is "connected" only when both sides have accepted. Messaging is
-- gated on that, so the RLS policies double as the unlock check.
drop policy if exists "messages_select_connected" on public.messages;
create policy "messages_select_connected"
    on public.messages for select
    using (
        exists (
            select 1 from public.matches m
            where m.id = messages.match_id
              and (auth.uid() = m.user_a or auth.uid() = m.user_b)
              and coalesce(m.user_a_accepted, false)
              and coalesce(m.user_b_accepted, false)
        )
    );

drop policy if exists "messages_insert_connected" on public.messages;
create policy "messages_insert_connected"
    on public.messages for insert
    with check (
        sender = auth.uid()
        and exists (
            select 1 from public.matches m
            where m.id = messages.match_id
              and (auth.uid() = m.user_a or auth.uid() = m.user_b)
              and coalesce(m.user_a_accepted, false)
              and coalesce(m.user_b_accepted, false)
        )
    );

-- =========================================================
-- 3. Realtime — live message delivery
-- =========================================================
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'messages'
    ) then
        alter publication supabase_realtime add table public.messages;
    end if;
end $$;

-- Done.
