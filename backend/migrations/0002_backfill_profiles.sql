-- FindingFounders — 0002: backfill profiles for users created before migration 0001
--
-- The handle_new_user trigger only fires on NEW sign-ups. Anyone who signed
-- up before the trigger existed has no profile row. This script:
--   1. Inserts a profile row for every existing auth.users row that's missing one.
--   2. Syncs the latest brain card / founder signal / GitHub / LinkedIn from
--      vault_uploads → profiles, so you don't have to re-upload your vault.
--
-- Idempotent — safe to re-run. Run in Supabase Dashboard → SQL Editor → New query.

-- Step 1 — create profile rows for any existing auth users that lack one.
insert into public.profiles (id, email, full_name)
select
    u.id,
    u.email,
    coalesce(u.raw_user_meta_data->>'full_name', u.email)
from auth.users u
on conflict (id) do nothing;

-- Step 2 — copy the most recent vault_uploads row into the corresponding profile.
-- Uses distinct on (user_id) ordered by uploaded_at desc to grab the latest analysis.
update public.profiles p
set
    brain_card        = latest.brain_card,
    founder_signal    = latest.founder_signal,
    brain_confidence  = latest.quality_score,
    -- Only overwrite github/linkedin if the user hasn't already set them manually
    github            = coalesce(p.github, latest.github_username),
    linkedin          = coalesce(p.linkedin, latest.linkedin_url)
from (
    select distinct on (user_id)
        user_id,
        brain_card,
        founder_signal,
        quality_score,
        github_username,
        linkedin_url
    from public.vault_uploads
    order by user_id, uploaded_at desc
) latest
where p.id = latest.user_id;
