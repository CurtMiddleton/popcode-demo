# Phase 1 — Creation / Ingest Pipeline

Seeds an existing collection into the new identification index so we have real
content to test Phase 2 (`/api/identify`) against. **Additive and branch-only:**
it reads the source collection read-only (prod by default) and writes the new
rows + `.mind` copy to the Supabase **branch**. No production table is mutated.

## Files

| File | Role |
|---|---|
| `lib/identification/embed.mjs` | CLIP embedding via Replicate (`krthr/clip-embeddings`, ViT-L/14-class → 768 floats). Shared by this script and the Phase 2 endpoint. |
| `lib/identification/provider.mjs` | `IdentificationProvider` interface + `ReplicateClipProvider` (embedding done; pgvector search lands in Phase 2). |
| `scripts/seed-identification.mjs` | The ingest script — backfills `creators` + `pop_images` and copies the `.mind` into `pop-targets`. |

## Prerequisites

1. **Phase 0 done** in the branch (tables + `pop-targets` bucket exist).
2. A **Replicate** account + API token: https://replicate.com/account/api-tokens
3. The **branch's** Supabase URL + **service_role** key:
   Supabase dashboard → select the `identification` branch → **Project Settings
   → API** → *Project URL* and *service_role* key.
   > The service_role key bypasses RLS (required — `pop_images` has no anon
   > policy). Keep it out of git and out of the browser; it lives only in your
   > shell / Vercel server env.

## Run

From the repo root:

```bash
TARGET_SUPABASE_URL="https://<branch-ref>.supabase.co" \
TARGET_SUPABASE_SERVICE_KEY="<branch service_role key>" \
REPLICATE_API_TOKEN="<your replicate token>" \
node scripts/seed-identification.mjs --slug <existing-slug> --handle <handle> --display-name "Curt Middleton"
```

- `--slug` — an existing project slug (e.g. one from `manage.html`).
- `--handle` — the public handle for the creator (→ `popcode.app/<handle>`).
- `--display-name` — optional; defaults to the project name.

Re-running is safe: the creator is upserted by handle and the collection's
`pop_images` rows are cleared and rebuilt each run.

### Optional env

| Var | Default | Notes |
|---|---|---|
| `SOURCE_SUPABASE_URL` / `SOURCE_SUPABASE_ANON_KEY` | prod (from `public/config.js`) | Where to read the existing collection. Override if reading from the branch instead. |
| `REPLICATE_CLIP_MODEL` | `krthr/clip-embeddings` | Must output a **768-dim** vector or the `vector(768)` column rejects it. |

## Verify

In the branch SQL editor:

```sql
select c.handle, pi.target_ref, pi.image_url, pi.video_url
from pop_images pi join creators c on c.id = pi.creator_id
order by pi.target_ref;
-- one row per scannable image; embeddings populated.

select count(*) from pop_images;   -- == number of images you seeded
```

And confirm the `.mind` landed at `pop-targets/<slug>/target.mind` in Storage.

## Phase 2 — identification endpoint

The "which photo is this?" search. Core logic is in
`lib/identification/identify.mjs` (shared), exposed two ways:

| File | Role |
|---|---|
| `lib/identification/provider.mjs` | `ReplicateClipProvider.identify()` — embed + scoped pgvector cosine search via the `identify_match` RPC. |
| `lib/identification/identify.mjs` | `identifyByHandle()` — handle → creator → match → payload (`.mind` URL + images). |
| `api/identify.js` | `POST /api/identify` HTTP wrapper (Vercel function). |
| `scripts/test-identify.mjs` | CLI to test the match against the branch with no deploy. |

### One-time setup

Run the RPC migration in the **branch** SQL editor:
`supabase/migrations/2026-06-12-phase2-identify-rpc.sql`.

### Test it (no deploy needed)

```bash
TARGET_SUPABASE_URL="https://<branch-ref>.supabase.co" \
TARGET_SUPABASE_SERVICE_KEY="<branch service_role key>" \
REPLICATE_API_TOKEN="<token>" \
node scripts/test-identify.mjs --handle Curt --image <url-or-local-path> [--threshold 0.6]
```

- **Sanity check:** pass a seeded photo URL (from `pop_images.image_url`) — it
  should match its own page at ~100% confidence.
- **Real test:** a phone photo of the printed page — lower confidence; that's
  the number Phase 4 uses to set the production threshold.

### Live endpoint (later)

`POST /api/identify` `{ handle, frame }` (frame = image URL/data-URI) or
`{ handle, embedding }`. Returns `{ matched, collectionId, mind_file_url,
images, confidence }` or `{ matched:false, reason }`. Point it at the branch by
setting `IDENTIFY_SUPABASE_URL` / `IDENTIFY_SUPABASE_SERVICE_KEY` /
`REPLICATE_API_TOKEN` in Vercel.

## Phase 3 — scan frontend (`popcode.app/{handle}`)

`public/scan.html` — the one-URL camera experience. Derived from `view.html`
so all the iOS-hardened playback/rescan/tap-to-play machinery is reused
verbatim; only the entry is new.

Flow: start screen → tap → live camera preview (`getUserMedia`) → capture one
640px frame → `POST /api/identify { handle, frame }` → on match, build the
matched collection's MindAR scene (`.mind` from `pop-targets`) → **tap "bring it
to life"** (second tap = iOS needs `getUserMedia` inside a gesture) → track +
play. After a video closes, re-scanning the same book is local (no server call)
— identification is a one-time bootstrap per book.

### Testing (needs a deploy + a real phone)

Unlike Phases 1–2, this can't be tested from a terminal — camera + HTTPS +
mobile Safari. Use a Vercel **preview** deploy of this branch:

1. In Vercel → Project → Settings → Environment Variables, add for **Preview**:
   - `IDENTIFY_SUPABASE_URL` = the branch URL (`https://<branch-ref>.supabase.co`)
   - `IDENTIFY_SUPABASE_SERVICE_KEY` = the branch service_role key
   - `REPLICATE_API_TOKEN` = your token
2. Push the branch (Vercel auto-builds a preview URL).
3. On a phone, open `<preview-url>/scan.html?handle=Curt`, allow the camera,
   point at a printed "Max - Chapter One" page.

Routing: testing uses `?handle=Curt`. The pretty `/{handle}` rewrite (and the
handle-vs-slug routing precedence) is deferred to cutover.

### Known limits (v1)
- **Video only.** `pop_images` stores `video_url` + `audio_first`, not audio/
  transcript, so audio-first projects aren't played yet (Max is all video).
- Analytics (`logEvent`) is a no-op on `scan.html` so a branch test never writes
  to prod `scan_events`; Phase 4 logs to `identify_events` server-side instead.

## Phase 4 — shadow logging + threshold tuning

Every `/api/identify` call now logs one row to `identify_events` (scores +
threshold + the page it chose). After tracking starts, `scan.html` reports which
page MindAR actually locked via `POST /api/identify-feedback`, which sets
`agreed` — a real accuracy signal with no prod changes and no labeled data.

Adapted from the brief: instead of shadowing legacy `view.html` on prod (the new
index lives in the branch, prod has ~no traffic, and `view.html` is fragile), we
instrument the **new path** to measure itself as it's used.

### One-time setup
Run `supabase/migrations/2026-06-13-phase4-identify-events-cols.sql` in the
branch SQL editor, then redeploy the preview (it picks up the existing env vars).

### Tuning queries (branch SQL editor)

```sql
-- Overall score distribution + average margin over the runner-up.
select reason, count(*),
       round(avg(confidence)::numeric, 3)            as avg_conf,
       round(min(confidence)::numeric, 3)            as min_conf,
       round(max(confidence)::numeric, 3)            as max_conf,
       round(avg(confidence - runner_up_confidence)::numeric, 3) as avg_margin
from identify_events
group by reason;

-- The money query: confidence split by whether identify agreed with what
-- MindAR actually tracked. Pick a threshold ABOVE the disagree band and BELOW
-- the agree band.
select agreed,
       count(*),
       round(min(confidence)::numeric, 3) as min_conf,
       round(avg(confidence)::numeric, 3) as avg_conf,
       round(max(confidence)::numeric, 3) as max_conf
from identify_events
where confidence is not null
group by agreed;   -- agreed=true (real hits) vs false (misses) vs null (no track yet)
```

Collect a few dozen real scans, then set the production threshold (the
`ReplicateClipProvider` default / `IDENTIFY_THRESHOLD`) from the gap between the
agree and disagree confidence bands.

## Notes / decisions

- **Embeddings come from the photo URLs already stored on `collection_items`.**
  Replicate fetches those public URLs server-side, so the branch doesn't need a
  copy of the source images.
- **The `.mind` is copied, not recompiled.** Every project already has a
  browser-compiled `.mind` (`create.html`); we just place it in the new bucket.
  The target order is preserved, so `target_ref` == the original `target_index`.
- **`collections.mind_file_url` is left pointing at the `experiences` bucket.**
  The new path resolves its `.mind` by convention at
  `pop-targets/<slug>/target.mind` (Phase 2 returns this URL), so prod's column
  meaning is untouched.
- **Same embedding code on both sides.** Index-time (this script) and query-time
  (Phase 2 `/api/identify`) both call `embedImageFromUrl`, so vectors are
  comparable.
