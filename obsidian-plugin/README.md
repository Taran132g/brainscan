# BrainScan for Obsidian

Scan your vault into a BrainScan brain card without leaving Obsidian. The plugin
zips your notes and uploads them to BrainScan; you view the resulting card (and
opt into people-matching) on the BrainScan site.

> The plugin **ingests**; the **platform reveals** the card. It deliberately does
> not render results in Obsidian — your account, card, and matching live on the site.

## Install (dev / beta)

```bash
cd obsidian-plugin
npm install
npm run build        # produces main.js
```

Copy `manifest.json` + `main.js` (+ `styles.css` if added) into
`<your-vault>/.obsidian/plugins/brainscan/`, then enable **BrainScan** in
Settings → Community plugins. (Or distribute via BRAT pointing at this repo.)

## Connect your account

1. Open BrainScan on the web → **Settings → Connect Obsidian** → copy the token
   (calls `POST /api/plugin/token`, shown once).
2. Obsidian → Settings → **BrainScan** → paste the token.
3. Optionally set **Exclude folders** (e.g. `Private/, Journal/`).

## Use

Command palette → **BrainScan: Scan my brain** (or the brain ribbon icon).
You'll see a confirmation of how many notes are about to be sent, then the
plugin uploads and opens your card on the site.

## How it works

- Collects markdown via the vault API (minus excluded folders), zips in-memory.
- `POST {apiBaseUrl}/api/plugin/scan` with `Authorization: Bearer <token>`
  (uses Obsidian `requestUrl` so renderer CORS doesn't apply).
- Same backend pipeline as the web upload (`services/ingest.py`): parse → quality
  gate → chunk → embed → generate the whole-person Brain Card → store → make
  matchable. Returns a `view_url` the plugin opens.

## Privacy

Your notes are sent to BrainScan's servers to generate the card. Use **Exclude
folders** to keep anything private out, and review the count in the confirmation
dialog before each scan.
