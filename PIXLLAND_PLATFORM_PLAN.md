# Pixlland Platform Plan (PlayCanvas-based)

This plan maps the Editor expectations to a Pixlland-owned backend and Supabase stack. It focuses on an MVP that can open projects, load scenes, sync edits, and manage assets.

## Goal
Create a commercial Pixlland platform with its own auth, database, storage, and build pipeline, while reusing the PlayCanvas Editor and Engine.

## Recommended Stack (low cost / easy)
- Auth: Supabase Auth
- DB: Supabase Postgres
- Storage: Supabase Storage
- API: Node.js + Fastify (TypeScript)
- Realtime docs: ShareDB (OT) over WebSocket
- Relay/Messenger: WebSocket server (lightweight, rooms + broadcast)
- Queue for builds: BullMQ + Upstash Redis (free tier)
- Hosting: Render/Fly/Railway for API + Realtime; Vercel/Netlify for Editor static

## Editor Runtime Config
The Editor expects a global `config` object injected at runtime (not in repo). We will serve a small bootstrap script that sets:
- `config.url.api`, `config.url.home`, `config.url.frontend`, `config.url.realtime.http`, `config.url.relay.ws`, `config.url.messenger.ws`, `config.url.static`, `config.url.images`, `config.url.engine`
- `config.accessToken`, `config.project`, `config.scene`, `config.self`, `config.owner`, etc.

This is the main integration point between Pixlland backend and the Editor UI.

## Core API Areas (from editor-api)
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

Non-MVP but present:
- Apps (builds), Jobs, Merge/Diff, Conflicts, Invitations, Watch, Store, Payment

## MVP Scope (phase 1)
1. Auth + profile
2. Projects CRUD
3. Scenes CRUD + open scene in Editor
4. Assets list + upload + download + update name
5. Realtime scene sync (ShareDB)
6. Simple relay for chat/typing and selection

## Data Model (Supabase)
Minimal tables:
- users_profile (id uuid, username, full_name, avatar_url, flags jsonb)
- projects (id bigint, owner_id uuid, name, description, private, settings jsonb, created_at)
- project_collaborators (project_id, user_id, access_level)
- branches (id uuid, project_id, name, is_master, created_by)
- scenes (id bigint, project_id, branch_id, name, unique_id uuid, created_by)
- assets (id bigint, project_id, branch_id, name, type, file jsonb, data jsonb, created_by)
- jobs (id bigint, project_id, type, status, logs)

Storage:
- bucket: `assets` (project/branch/asset files)
- bucket: `projects` (thumbnails, exports)

## First Implementation Steps
1. Build API skeleton (Fastify + TS)
2. Implement auth guard via Supabase JWT
3. Implement Projects + Scenes endpoints
4. Implement Assets list + upload (signed URLs) + download
5. Add ShareDB server + minimal OT docs for scenes
6. Serve Editor config bootstrap script

## Open Decisions
- Domain and product name to embed in UI
- Pricing/plan logic (seats, storage limits)
- Build/export pipeline (PlayCanvas build format vs custom)

---
If you want, I can start by generating the backend skeleton and Supabase schema/migrations next.
