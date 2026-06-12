# Phase 0 — Identification System Safety Scaffold

Setup steps for the Single-Handle Identification System (build brief, Phase 0).
**Everything here is additive and staged.** No existing production table is
altered. Build it in a Supabase **branch**, run the new path in shadow mode,
measure, then flip a feature flag — production keeps working untouched the whole
time.

> **Operator runs all DB/dashboard steps below.** Claude does not run the SQL or
> create the bucket. The migration file is committed to git for review; you run
> it against the branch.

---

## Decisions locked (2026-06-12)

| Decision | Choice |
|---|---|
| Embedding model | **CLIP ViT-B/32** → `vector(512)` |
| Creator model | **New `creators` table** (`user_id → auth.users`, unique `handle`) |
| Shadow log table | **`identify_events`** (renamed from the brief's `scan_events`, which already exists as the live analytics table) |
| Embedding compute | **Hosted inference API** (Replicate / HF / Modal), called from `/api/identify` |

---

## Step 1 — Create a Supabase branch

Do this in the dashboard (or CLI) so all Phase 0–4 work is isolated from prod:

- **Dashboard:** Project → top-left branch dropdown → **Create branch** (e.g.
  `identification`). Branches get their own Postgres + Storage; nothing leaks
  into production.
- **CLI:** `supabase branches create identification`

You'll run every SQL/bucket step below **against the branch**, never prod.

## Step 2 — Run the migration (in the branch)

Open the branch's SQL editor and run:

```
supabase/migrations/2026-06-12-phase0-identification.sql
```

It creates: the `vector` extension, `creators`, `pop_images` (with the ivfflat
cosine index), and `identify_events`, plus RLS. It touches **zero** existing
tables. Re-runnable (`if not exists` throughout).

Verify afterward:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('creators','pop_images','identify_events');   -- expect 3 rows

select extname from pg_extension where extname = 'vector';          -- expect 1 row
```

## Step 3 — Create the new Storage bucket (in the branch)

A **separate** bucket for the new per-collection `.mind` files — keep it apart
from the existing `experiences` bucket so the new path can't disturb prod media.

- **Dashboard:** Storage → **New bucket** → name **`pop-targets`**. Public read
  is fine for `.mind` files (they're not secret); writes restricted to the
  service role / project owner.
- **CLI/SQL equivalent:**

  ```sql
  insert into storage.buckets (id, name, public)
  values ('pop-targets', 'pop-targets', true)
  on conflict (id) do nothing;
  ```

RLS for writes will mirror the `experiences` bucket's existing policies when the
Phase 1 ingest pipeline starts writing to it — not needed until then.

## Step 4 — Add the feature flag (default OFF)

`USE_NEW_IDENTIFICATION` gates the entire new path. Default **off** — nothing
reads it until Phase 3+.

- **Server side (`/api/identify` and friends):** add a Vercel env var
  `USE_NEW_IDENTIFICATION=false` (Project → Settings → Environment Variables).
  Later this becomes **per-handle** for the Phase 5 measured cutover.
- **Client side (`view.html`):** add a mirror to `public/config.js` so the
  viewer can branch without a round-trip:

  ```js
  // Phase 0 identification feature flag. OFF until shadow data says otherwise.
  const USE_NEW_IDENTIFICATION = false;
  ```

  (Added in a later phase when the client actually branches on it — listed here
  so the flag's two homes are documented together.)

---

## What this scaffold maps to in the existing app

- `creators` is **new** — today identity is `auth.users` and the public URL is
  per-project (`popcode.app/{slug}`), not per-creator.
- `pop_images` is the **new server-side search index**. It does not replace
  `collection_items` (the existing per-image media table) — it sits alongside it
  and adds the `embedding` + `creator_id` + `target_ref` the matcher needs.
- `collections` already exists and is the "book/exhibit" concept. Phase 0 leaves
  it untouched; a `creator_id` link is added in a later phase.
- The on-device tracking side already matches the target architecture: one
  `.mind` per project, compiled client-side in `create.html` and tracked in
  `view.html`. Phase 0 adds only the *identification* layer in front of it.

## Index tuning note

`pop_images_embedding_idx` uses `ivfflat (lists = 100)`, a fine starting point
for small data. ivfflat trains on existing rows, so after the table has real
volume, either rebuild it or switch to `hnsw` for better recall:

```sql
-- option: rebuild ivfflat after data is loaded
reindex index pop_images_embedding_idx;

-- option: switch to hnsw (better recall, slower build)
-- drop index pop_images_embedding_idx;
-- create index pop_images_embedding_idx on pop_images
--   using hnsw (embedding vector_cosine_ops);
```

## Privacy invariant (carry into every later phase)

Identification search is **always** scoped: `WHERE creator_id = $1`. Never a
global search. One creator's images can never surface in another's results.
Enforce it in code on every query, not just by RLS.
