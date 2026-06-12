-- Phase 0 — Single-Handle Identification System: additive safety scaffold.
--
-- GOLDEN RULE: everything here is ADDITIVE. This migration creates NEW tables
-- only. It does NOT alter, migrate, or drop any existing production table
-- (collections, collection_items, experiences, scan_events, beta_feedback, …).
--
-- RUN THIS AGAINST A SUPABASE *BRANCH*, NOT PRODUCTION.
-- See PHASE0-README.md in this folder for the branch + bucket + feature-flag
-- setup steps. Claude does not run this — the human operator runs it in the
-- branch's SQL editor and reviews the result before any cutover.
--
-- Decisions locked 2026-06-12:
--   * Embedding model .... CLIP ViT-B/32  -> vector(512)
--   * Creator model ...... new `creators` table mapping to auth.users + handle
--   * Shadow log name .... `identify_events`  (the brief called this
--                          "scan_events", but that name already belongs to the
--                          live analytics table — DO NOT collide with it)
--   * Embed compute ...... hosted inference API, called from /api/identify

-- pgvector: required for embedding storage + cosine search.
create extension if not exists vector;


-- ─────────────────────────────────────────────────────────────────────────
-- creators — a creator's public namespace.  popcode.app/{handle}
--
-- Today identity is Supabase auth.users and the public URL is per-PROJECT
-- (popcode.app/{slug}). This table introduces the per-CREATOR handle the new
-- model needs, mapped 1:1 to an auth user. We do NOT add a column to
-- auth.users (Supabase-managed; can't cleanly carry a unique handle).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists creators (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  handle       text unique not null,            -- public namespace: popcode.app/{handle}
  display_name text,
  created_at   timestamptz default now()
);
create index if not exists creators_user_idx on creators (user_id);


-- ─────────────────────────────────────────────────────────────────────────
-- pop_images — server-side identification index, one row per scannable image.
--
-- This is the NEW search table. It mirrors the media that today lives in
-- collection_items, but it is SEPARATE and additive — we do not add a vector
-- column to the production collection_items table. `creator_id` is denormalized
-- so identification queries can scope cheaply (the privacy wall).
--
-- `target_ref` records this image's slot within its collection's compiled
-- .mind set (today that's collection_items.target_index) so the client knows
-- which MindAR target to track once the collection is loaded.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists pop_images (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid references collections(id) on delete cascade,
  creator_id    uuid references creators(id) on delete cascade,   -- denormalized for scoped search
  image_url     text,                       -- source / registration image
  video_url     text,
  audio_first   boolean default true,       -- fire audio immediately on play
  embedding     vector(512),                -- CLIP ViT-B/32; revisit dim if model changes
  target_ref    text,                       -- slot within the collection .mind (e.g. target_index)
  created_at    timestamptz default now()
);

-- btree on creator_id: every identification query is `WHERE creator_id = $1`.
create index if not exists pop_images_creator_idx on pop_images (creator_id);

-- ivfflat cosine index for nearest-neighbour search over embeddings.
-- NOTE: ivfflat needs rows present to train well; `lists = 100` is a starting
-- point for small data. Rebuild/retune (or switch to hnsw) once the table has
-- real volume — see PHASE0-README.md.
create index if not exists pop_images_embedding_idx
  on pop_images using ivfflat (embedding vector_cosine_ops) with (lists = 100);


-- ─────────────────────────────────────────────────────────────────────────
-- identify_events — shadow-mode + accuracy log. Powers the Phase 4 comparison.
--
-- ⚠️ The build brief named this "scan_events", but a production table of that
-- name ALREADY EXISTS (the analytics table written by api/log-event.js and read
-- by analytics.html). Reusing the name would collide. This is the deliberate,
-- documented rename. Nothing here touches the existing scan_events table.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists identify_events (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid,
  matched_image uuid,                        -- pop_images.id of the chosen match (nullable)
  collection_id uuid,
  confidence    float,
  matched_by    text,                        -- 'legacy' | 'new' | 'shadow'
  agreed        boolean,                     -- did the new path agree with legacy on this scan?
  created_at    timestamptz default now()
);
create index if not exists identify_events_created_idx on identify_events (created_at desc);
create index if not exists identify_events_creator_idx on identify_events (creator_id);


-- ─────────────────────────────────────────────────────────────────────────
-- Row-Level Security
--
-- Mirror the conservative posture of the rest of the app. Lock these down by
-- default in the branch; loosen deliberately as each later phase needs access.
-- The public anon key is used by the browser, so anything readable by `anon`
-- is world-readable — keep embeddings and the shadow log server-only.
-- ─────────────────────────────────────────────────────────────────────────
alter table creators        enable row level security;
alter table pop_images      enable row level security;
alter table identify_events enable row level security;

-- creators: a signed-in user can read/insert/update only their own row.
-- (Public handle resolution at scan time is done server-side via the service
--  role in /api/identify, so no anon SELECT policy is granted here.)
drop policy if exists creators_self_select on creators;
create policy creators_self_select on creators
  for select to authenticated using (user_id = auth.uid());

drop policy if exists creators_self_insert on creators;
create policy creators_self_insert on creators
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists creators_self_update on creators;
create policy creators_self_update on creators
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- pop_images: NO anon/authenticated policies on purpose. Embeddings and the
-- identification index are server-only — reads/writes go through the service
-- role in the Phase 1 ingest + Phase 2 /api/identify functions. With RLS on
-- and no policy, the anon key sees nothing here.

-- identify_events: server-only as well (service role writes the shadow log).
-- No anon/authenticated policies granted.
