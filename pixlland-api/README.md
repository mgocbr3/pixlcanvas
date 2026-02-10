# Pixlland API

Minimal Fastify + Supabase backend to power a PlayCanvas-based editor.

## Quick start
1) Copy .env.example to .env and fill Supabase settings.
2) Install deps: `npm install`
3) Run dev server: `npm run dev`

## Endpoints (MVP skeleton)
- GET /health
- GET /projects
- POST /projects
- GET /scenes
- POST /scenes
- GET /assets
- POST /assets

Most endpoints require a Bearer token (Supabase JWT).
