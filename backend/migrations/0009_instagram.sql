-- BrainScan — Instagram handle (weights the relationship/social side of the card)
-- Run in the Supabase SQL Editor.

alter table public.profiles add column if not exists instagram text;

-- Done.
