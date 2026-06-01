-- BrainScan — Obsidian plugin personal access token
-- Run in Supabase SQL Editor.
--
-- The Obsidian plugin authenticates with a per-user personal token (not a
-- Supabase session). We store only the SHA-256 hash; the plaintext is shown
-- to the user exactly once when they connect the plugin.

alter table public.profiles
    add column if not exists plugin_token_hash    text,
    add column if not exists plugin_token_created_at timestamptz;

-- Lookups during plugin auth hit this hash directly.
create index if not exists profiles_plugin_token_idx
    on public.profiles(plugin_token_hash);
