# Pixlland API

Minimal Fastify + Supabase backend to power a PlayCanvas-based editor.

## Quick start
1) Copy .env.example to .env and fill Supabase settings.
2) Install deps: `npm install`
3) Run dev server: `npm run dev`

## Local dev without pasting tokens
If you just want to run the editor locally without adding `?access_token=...` every time, you can enable a dev-only auth bypass:

- In `pixlland-api/.env` set `PIXLLAND_DEV_AUTH_BYPASS=1`
- Set `PIXLLAND_DEV_USER_ID=<your supabase auth.users.id>`

Do not enable this in production.

## Endpoints (MVP skeleton)
- GET /health
- GET /projects
- POST /projects
- GET /scenes
- POST /scenes
- GET /assets
- POST /assets

Most endpoints require a Bearer token (Supabase JWT).
