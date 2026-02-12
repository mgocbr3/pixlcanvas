# Engine hosting (engine.pixlland.com)

This repo already contains built engine artifacts under `engine/build/`.

## Goal
Serve the engine as a static site so this URL works:

- `https://engine.pixlland.com/playcanvas.js`

## Prepare static output
From the repo root:

- `node scripts/prepare-engine-hosting.mjs`

This generates `engine-hosting/` with:
- `playcanvas.js` (minified)
- `playcanvas.min.js`
- `playcanvas.min.mjs`
- `_headers` (cache control)

## Recommended provider: Cloudflare Pages
1) Create a new Cloudflare Pages project connected to this GitHub repo
2) Set build command:
   - `node scripts/prepare-engine-hosting.mjs`
3) Set output directory:
   - `engine-hosting`
4) Add custom domain:
   - `engine.pixlland.com`

## DNS (Hostinger)
Create a record:
- Type: `CNAME`
- Name/Host: `engine`
- Target: the value Cloudflare Pages shows for your project (usually `<project>.pages.dev`)
- TTL: `300`

## Point Pixlland to the hosted engine
In `pixlland-api/.env` (or production env):
- `PIXLLAND_ENGINE_URL=https://engine.pixlland.com/playcanvas.js`
