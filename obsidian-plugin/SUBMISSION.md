# Submitting BrainScan to the Obsidian community plugin store

Obsidian wants **one public GitHub repo per plugin**, with the built files in a
**release**, then a PR to [`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases).

## 1. Stand up a dedicated repo

The plugin currently lives inside the BrainScan monorepo. Obsidian's tooling
expects a standalone repo whose root contains `manifest.json`, `main.js`, etc.

```bash
# from the monorepo root
cd obsidian-plugin
gh repo create Taran132g/brainscan-obsidian --public --source=. --remote=plugin --push
```

(or create the repo in the GitHub UI and push this folder to it.)

## 2. Build + cut a release

The release tag **must equal `manifest.json` → version** (no `v` prefix), and
`main.js` + `manifest.json` must be attached as **release assets** (not just in
the source tree).

```bash
npm install
npm run build           # produces main.js
gh release create 0.1.0 main.js manifest.json \
  --repo Taran132g/brainscan-obsidian \
  --title "0.1.0" --notes "Initial release."
```

## 3. Pre-submission checklist (Obsidian guidelines)

- [x] `manifest.json` has `id`, `name`, `version`, `minAppVersion`, `description`, `author`, `isDesktopOnly`
- [x] `id` is unique + lowercase (`brainscan`) and **not** prefixed with "obsidian"
- [x] `versions.json` maps `version → minAppVersion`
- [x] MIT `LICENSE` present
- [x] Network use is disclosed (the plugin uploads notes to a server — the in-app consent modal already shows file count + bytes + destination before sending)
- [ ] README explains what data leaves the vault and where (done) — keep it accurate
- [ ] No telemetry/analytics beyond the disclosed upload
- [ ] Tested on a clean vault

## 4. Submit the PR

Fork `obsidianmd/obsidian-releases`, add this entry to the **end** of
`community-plugins.json`, and open a PR:

```json
{
  "id": "brainscan",
  "name": "BrainScan",
  "author": "BrainScan",
  "description": "Scan your vault into a BrainScan Brain Card — an AI read of how you think, what drives you, and how you connect, from your own notes.",
  "repo": "Taran132g/brainscan-obsidian"
}
```

```bash
gh repo fork obsidianmd/obsidian-releases --clone --remote
# edit community-plugins.json, commit, push to your fork, then:
gh pr create --repo obsidianmd/obsidian-releases --title "Add plugin: BrainScan" \
  --body "Adds BrainScan — scans an Obsidian vault into an AI Brain Card."
```

A bot validates the manifest/release, then a maintainer reviews (days–weeks).
While it's in review, users can install via **BRAT** by pointing at
`Taran132g/brainscan-obsidian`.
