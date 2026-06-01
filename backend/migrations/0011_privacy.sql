-- BrainScan — privacy & matching controls
-- Run in Supabase SQL Editor.
--
-- Three independent, user-managed controls (all default to today's behavior:
-- public + matchable + nothing hidden, so existing users are unchanged):
--   profile_public   — is the shareable /profile/[id] page viewable by others?
--   hidden_sections  — Brain Card section titles to omit from what others see
--   matching_enabled — appear in the People pool / matching?

alter table public.profiles
    add column if not exists profile_public   boolean not null default true,
    add column if not exists hidden_sections  jsonb   not null default '[]'::jsonb,
    add column if not exists matching_enabled boolean not null default true;
