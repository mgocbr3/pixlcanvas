# PixlCanvas (Pixlland + PlayCanvas Editor)

Local, self-hosted PlayCanvas Editor stack with a Fastify + Supabase backend, ShareDB realtime services, and a bundled PlayCanvas engine/editor workspace.

## What is in this repo

This repository vendors the PlayCanvas ecosystem and adds a minimal backend to run the Editor locally:

- `editor/`: PlayCanvas Editor frontend (served on port 3487 in dev).
- `engine/`: PlayCanvas Engine source and build tooling.
- `pixlland-api/`: Pixlland backend (Fastify + Supabase + ShareDB seed).
- `pcui/`, `pcui-graph/`, `observer/`: UI and data binding libraries used by the Editor.

## Architecture at a glance

- **Editor UI**: `editor/` builds a static frontend served locally.
- **API**: `pixlland-api/` exposes REST endpoints for projects, scenes, assets, and users.
- **Realtime**: `pixlland-api/scripts/ws-servers.mjs` runs ShareDB + relay/messenger websockets.
- **Config**: `GET /editor/config.js` provides runtime config to the Editor.

## Requirements

- Node.js 22.x recommended (Editor dev scripts expect 22.21.1). Node 18+ works for the engine.
- Git LFS (the repo contains large assets tracked via LFS).

## Quick start (local dev)

### 1) Install dependencies

```sh
npm --prefix pixlland-api install
npm --prefix editor install
npm --prefix engine install
```

### 2) Configure Pixlland API

```sh
cp pixlland-api/.env.example pixlland-api/.env
```

Update values in `pixlland-api/.env`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`

### 3) Run the API

```sh
npm --prefix pixlland-api run dev
```

Defaults to `http://localhost:8787`.

### 4) Run realtime servers

```sh
npm --prefix pixlland-api run ws:dev
```

Defaults:
- Realtime: `ws://localhost:3001`
- Relay: `ws://localhost:3002`
- Messenger: `ws://localhost:3003`

### 5) Build engine and publish to editor

The editor expects `playcanvas.js` to be available in its frontend root.

```sh
npm --prefix engine run build
cp engine/build/playcanvas.js editor/dist/playcanvas.js
```

### 6) Run the editor frontend

```sh
npm --prefix editor run develop
```

Editor dev server: `http://localhost:3487`

## Optional: run editor with API proxy

If you want a single origin that serves the editor and proxies `/api` to the Pixlland API:

```sh
PIXLLAND_API_URL=http://localhost:8787 \
EDITOR_PORT=3487 \
npm --prefix pixlland-api run editor:dev
```

This serves static files from `editor/dist` and proxies `http://localhost:3487/api/*` to the API.

## Environment variables (pixlland-api)

From [pixlland-api/.env.example](pixlland-api/.env.example):

- `PORT` (default 8787)
- `CORS_ORIGIN` (default `http://localhost:3487`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `PIXLLAND_API_URL`
- `PIXLLAND_HOME_URL`
- `PIXLLAND_FRONTEND_URL`
- `PIXLLAND_STATIC_URL`
- `PIXLLAND_IMAGES_URL`
- `PIXLLAND_ENGINE_URL`
- `PIXLLAND_REALTIME_HTTP`
- `PIXLLAND_RELAY_WS`
- `PIXLLAND_MESSENGER_WS`

## Key API endpoints

- `GET /health`
- `GET /projects`, `POST /projects`
- `GET /scenes`, `POST /scenes`
- `GET /assets`, `POST /assets`
- `GET /users`, `POST /users`
- `GET /editor/config.js`

Most endpoints require a Supabase JWT. The config endpoint is public and falls back to an anonymous user for local dev.

## Realtime seed behavior

On startup, `ws:dev` seeds ShareDB docs from Supabase tables:
````
- `scenes` -> ShareDB `scenes` collection
- `assets` -> ShareDB `assets` collection

If Supabase is not configured, the server starts without seeding.

## Working with the Editor locally

Typical local flow:

1. Start `pixlland-api` (`npm --prefix pixlland-api run dev`).
2. Start realtime (`npm --prefix pixlland-api run ws:dev`).
3. Build engine and copy `playcanvas.js` into `editor/dist/`.
4. Run editor dev server (`npm --prefix editor run develop`).

If you want to change engine code, re-run the engine build and copy step.

## Git LFS

This repo tracks large assets with Git LFS (example: `engine/examples/assets/models/pbr-house.glb`).

If you clone without LFS, install it and pull LFS objects:

```sh
git lfs install
git lfs pull
```

## Repo layout

```
./
  editor/
  engine/
  observer/
  pcui/
  pcui-graph/
  pixlland-api/
  .gitattributes
  .gitignore
```

## Troubleshooting

- **API routes return 401**: Ensure `SUPABASE_JWT_SECRET` is set and use a valid Bearer token for protected routes.
- **Editor cannot load `config.js`**: Verify `pixlland-api` is running and `PIXLLAND_FRONTEND_URL` is correct.
- **Realtime not connecting**: Confirm ports 3001-3003 are free and `PIXLLAND_*` websocket URLs match.
- **Large file warnings on push**: Ensure Git LFS is installed and enabled.

## License and upstream

This repository vendors PlayCanvas open-source components. Refer to each subproject for its license:

- [editor/README.md](editor/README.md)
- [engine/README.md](engine/README.md)
- [pcui/README.md](pcui/README.md)
- [pcui-graph/README.md](pcui-graph/README.md)
- [observer/README.md](observer/README.md)

## Pixlland Platform Plan (PlayCanvas-based)

This plan maps the Editor expectations to a Pixlland-owned backend and Supabase stack. It focuses on an MVP that can open projects, load scenes, sync edits, and manage assets.

### Goal

Create a commercial Pixlland platform with its own auth, database, storage, and build pipeline, while reusing the PlayCanvas Editor and Engine.

### Recommended Stack (low cost / easy)

- Auth: Supabase Auth
- DB: Supabase Postgres
- Storage: Supabase Storage
- API: Node.js + Fastify (TypeScript)
- Realtime docs: ShareDB (OT) over WebSocket
- Relay/Messenger: WebSocket server (lightweight, rooms + broadcast)
- Queue for builds: BullMQ + Upstash Redis (free tier)
- Hosting: Render/Fly/Railway for API + Realtime; Vercel/Netlify for Editor static

### Editor Runtime Config

The Editor expects a global config object injected at runtime (not in repo). We will serve a small bootstrap script that sets:

- `config.url.api`, `config.url.home`, `config.url.frontend`, `config.url.realtime.http`, `config.url.relay.ws`, `config.url.messenger.ws`, `config.url.static`, `config.url.images`, `config.url.engine`
- `config.accessToken`, `config.project`, `config.scene`, `config.self`, `config.owner`, etc.

This is the main integration point between Pixlland backend and the Editor UI.

### Core API Areas (from editor-api)

The Editor calls these REST endpoints via `modules/editor-api/src/rest/*`:

- Projects: `POST /projects`, `GET /projects/:id`, `PUT /projects/:id`, `DELETE /projects/:id`, `POST /projects/import`, `POST /projects/:id/export`, `GET /projects/:id/assets`, `GET /projects/:id/scenes`, `GET /projects/:id/branches`, `GET /projects/:id/apps`, `GET /projects/:id/repositories`, `GET/PUT/DELETE collaborators`, `POST /projects/:id/image`
- Scenes: `POST /scenes`, `GET /scenes/:id?branchId=...`, `DELETE /scenes/:id?branchId=...`
- Assets: `GET /assets`, `POST /assets`, `PUT /assets/:id`, `GET /assets/:id`, `DELETE /assets/:id`, `GET /assets/:id/file/:name`, `POST /assets/:id/reimport`, `POST /assets/:id/duplicate`, `POST /assets/paste`
- Branches: `POST /branches`, `POST /branches/:id/checkout`, `POST /branches/:id/open`, `POST /branches/:id/close`, `DELETE /branches/:id`, `GET /branches/:id/checkpoints`
- Upload: `POST /upload/start-upload`, `POST /upload/signed-urls`, `POST /upload/complete-upload`
- Users: `POST /users`, `GET /users/:id`, `DELETE /users/:id`, `GET /users/:id/projects`, `GET /users/:id/collaborators`, `GET /users/:id/usage`
- Realtime/Collab: ShareDB websocket (scenes, assets, selection, chat)
- Relay: project room broadcast (chat typing, misc)
- Messenger: system messages / notifications

Non-MVP but present: Apps (builds), Jobs, Merge/Diff, Conflicts, Invitations, Watch, Store, Payment.

### MVP Scope (phase 1)

- Auth + profile
- Projects CRUD
- Scenes CRUD + open scene in Editor
- Assets list + upload + download + update name
- Realtime scene sync (ShareDB)
- Simple relay for chat/typing and selection

### Data Model (Supabase)

Minimal tables:

- `users_profile` (id uuid, username, full_name, avatar_url, flags jsonb)
- `projects` (id bigint, owner_id uuid, name, description, private, settings jsonb, created_at)
- `project_collaborators` (project_id, user_id, access_level)
- `branches` (id uuid, project_id, name, is_master, created_by)
- `scenes` (id bigint, project_id, branch_id, name, unique_id uuid, created_by)
- `assets` (id bigint, project_id, branch_id, name, type, file jsonb, data jsonb, created_by)
- `jobs` (id bigint, project_id, type, status, logs)

Storage:

- bucket: `assets` (project/branch/asset files)
- bucket: `projects` (thumbnails, exports)

### First Implementation Steps

- Build API skeleton (Fastify + TS)
- Implement auth guard via Supabase JWT
- Implement Projects + Scenes endpoints
- Implement Assets list + upload (signed URLs) + download
- Add ShareDB server + minimal OT docs for scenes
- Serve Editor config bootstrap script

### Open Decisions

- Domain and product name to embed in UI
- Pricing/plan logic (seats, storage limits)
- Build/export pipeline (PlayCanvas build format vs custom)
