-- BrainScan — drop the social/matching layer (single-player pivot).
-- Run in Supabase SQL Editor.
--
-- Removes the people-matching + connections/messaging feature entirely.
-- `messages` references `matches`, so drop it first. CASCADE clears policies +
-- the realtime publication membership.

drop table if exists public.messages cascade;
drop table if exists public.matches cascade;

-- The matching opt-out column on profiles is no longer used (privacy now =
-- profile_public + hidden_sections). Safe to drop.
alter table public.profiles drop column if exists matching_enabled;
