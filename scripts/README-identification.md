# Single-Handle Identification — pipeline & runbook

> **Embedding backend (Phase 6): on-device CLIP.** The query embedding is
> computed in the browser with **transformers.js** (`Xenova/clip-vit-base-patch32`,
> 8-bit, **512-dim**) and the vector — not the image — is POSTed to
> `/api/identify`. This replaced the old Replicate (`krthr/clip-embeddings`,
> 768-dim) backend, which serverless-**cold-started** ~5–15s on the first scan
> after idling (fatal for single-image experiences, which are *always* a first
> scan). On-device = no cold-start, no per-call cost, no rate limit, and the
> photo never leaves the phone. The Node seed pipeline embeds with the **same
> model** so index and query vectors are comparable. See
> [Re-seeding for the on-device swap](#phase-6--on-device-embedding-swap-re-seed).

# Phase 1 — Creation / Ingest Pipeline

Seeds an existing collection into the new identification index so we have real
content to test Phase 2 (`/api/identify`) against. **Additive and branch-only:**
it reads the source collection read-only (prod by default) and writes the new
rows + `.mind` copy to the Supabase **branch**. No production table is mutated.

## Files

| File | Role |
|---|---|
| `lib/identification/embed.mjs` | On-device CLIP embedding via transformers.js (`Xenova/clip-vit-base-patch32`, q8 → **512 floats**), for the Node seed path. |
| `public/lib/clip-embed.js` | The **browser** half of the same embedder — `scan.html` computes the query vector on the phone. Must stay identical to `embed.mjs` (same model/dtype). |
| `lib/identification/provider.mjs` | `IdentificationProvider` interface + `ClipProvider` (embed + pgvector cosine search). |
| `scripts/seed-identification.mjs` | The ingest script — backfills `creators` + `pop_images` and copies the `.mind` into `pop-targets`. |

## Prerequisites

1. **Phase 0 done** in the branch (tables + `pop-targets` bucket exist), plus the
   Phase 6 migration `2026-06-15-phase6-clip-512-on-device.sql` so the column is
   `vector(512)`.
2. **`npm install`** (pulls the `@huggingface/transformers` dev dependency). The
   first seed/test run downloads the CLIP weights (~tens of MB) once, then caches
   them — no API token, no rate limit, no per-call cost.
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

> The embedding model is pinned in code (`CLIP_MODEL_ID` / `CLIP_DTYPE` in
> `lib/identification/embed.mjs`). If you change it, change `public/lib/clip-embed.js`
> to match, update the `vector(N)` dimension, and **re-seed** — index and query
> vectors must come from the same model.

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
| `lib/identification/provider.mjs` | `ClipProvider.identify()` — embed + scoped pgvector cosine search via the `identify_match` RPC. |
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
node scripts/test-identify.mjs --handle Curt --image <url-or-local-path> [--threshold 0.6]
```

- **Sanity check:** pass a seeded photo URL (from `pop_images.image_url`) — it
  should match its own page at ~100% confidence.
- **Real test:** a phone photo of the printed page — lower confidence; that's
  the number Phase 4 uses to set the production threshold.

### Live endpoint (later)

`POST /api/identify` `{ handle, embedding }` (the live path — `scan.html` embeds
on-device and sends the 512-float vector) or `{ handle, frame }` (image
URL/data-URI fallback). Returns `{ matched, collectionId, mind_file_url, images,
confidence }` or `{ matched:false, reason }`. Point it at the branch by setting
`IDENTIFY_SUPABASE_URL` / `IDENTIFY_SUPABASE_SERVICE_KEY` in Vercel — no Replicate
token needed (the browser does the embedding).

## Phase 3 — scan frontend (`popcode.app/{handle}`)

`public/scan.html` — the one-URL camera experience. Derived from `view.html`
so all the iOS-hardened playback/rescan/tap-to-play machinery is reused
verbatim; only the entry is new.

Flow: start screen → tap → live camera preview (`getUserMedia`) → capture one
640px frame → **embed it on-device** (`public/lib/clip-embed.js`, warmed while
the user aims) → `POST /api/identify { handle, embedding }` → on match, build the
matched collection's MindAR scene (`.mind` from `pop-targets`) → track + play.
After a video closes, re-scanning the same book is local (no server call) —
identification is a one-time bootstrap per book. (If the on-device model isn't
ready, it falls back to sending the frame for the server to embed.)

### Testing (needs a deploy + a real phone)

Unlike Phases 1–2, this can't be tested from a terminal — camera + HTTPS +
mobile Safari. Use a Vercel **preview** deploy of this branch:

1. In Vercel → Project → Settings → Environment Variables, add for **Preview**:
   - `IDENTIFY_SUPABASE_URL` = the branch URL (`https://<branch-ref>.supabase.co`)
   - `IDENTIFY_SUPABASE_SERVICE_KEY` = the branch service_role key
   - (No `REPLICATE_API_TOKEN` — the browser embeds on-device now.)
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
`ClipProvider` default / `IDENTIFY_THRESHOLD`) from the gap between the agree and
disagree confidence bands. **Re-tune for the on-device model:** the 0.60 default
was measured on the old Replicate 768-dim model; the ViT-B/32 q8 512-dim vectors
have a different score distribution, so collect fresh `identify_events` after the
swap before trusting any cutoff.

## Phase 5 — cutover (bare /{handle}, per-handle flag, audio)

Built on the branch; **prod is untouched until `main` is merged** (the deliberate
go-live). Three pieces:

1. **Bare `/{handle}` routing.** `vercel.json` rewrites `/{handle}` → `scan.html`
   (which reads the handle from the path). Legacy slugs keep their existing
   `/{slug}` → `view.html` rewrite (evaluated first). Disambiguation is by
   pattern + order: a lowercase 6–10 char string is treated as a **slug**;
   anything else (mixed case, short, long) is a **handle**. So an all-lowercase
   6–10 char handle would collide with the slug space — pick handles that aren't
   that shape (a capital or a natural name avoids it; `Curt` is fine). Extension-
   less page paths like `/create` would also route to scan.html, but real links
   use `.html`, so it's a non-issue (revisit with an exclude-list at go-live if needed).
2. **Per-handle flag.** `creators.new_identification_enabled` (default false).
   `/api/identify` returns `handle_not_enabled` unless it's true — so the new
   experience goes live one creator at a time, legacy untouched as fallback.
3. **Audio support.** `pop_images` gained `media_type` / `audio_url` /
   `transcript`; the seed script, identify payload, and `scan.html` mediaMap now
   carry them (scan.html reuses view.html's audio player). Untested end-to-end
   (Max & Addie are video) — needs an audio project to verify.

### Branch test (preview)
1. Run `supabase/migrations/2026-06-13-phase5-flag-and-audio.sql` in the branch.
2. Enable the creator: `update creators set new_identification_enabled = true where handle = 'Curt';`
3. Redeploy the preview. Now `<preview>/Curt` (bare, no `?handle=`) loads scan.
   (Set the flag false → `/Curt` still loads scan.html but identify returns
   `handle_not_enabled` → "couldn't find it".)

### Go-live (prod — deliberate, do last, with explicit OK)
- Run all identification migrations (phase0 → phase5) in **prod** Supabase.
- Seed prod: re-run the seed script with TARGET pointed at **prod** (its URL +
  service key) for each book to go live; enable each creator's flag.
- Create the `pop-targets` bucket in prod.
- Point `/api/identify` + `/api/identify-feedback` env (`IDENTIFY_SUPABASE_URL` /
  `IDENTIFY_SUPABASE_SERVICE_KEY`) at **prod**, in the **Production** scope.
- Merge the branch to `main` (ships the `vercel.json` handle rewrite + scan.html).
- Verify `popcode.app/{handle}` on a real device; legacy `popcode.app/{slug}`
  must still work unchanged.

## Phase 6 — on-device embedding swap (re-seed)

The embedding model changed (Replicate 768-dim → on-device transformers.js CLIP
512-dim), so the existing index is obsolete and must be rebuilt. The vectors are
**derived data** — `pop_images` rows are regenerated by re-seeding — so this is a
clean, additive swap.

1. **Migrate the dimension.** Run
   `supabase/migrations/2026-06-15-phase6-clip-512-on-device.sql` in the branch
   (and in prod at cutover). It clears `pop_images`, retypes `embedding` to
   `vector(512)`, rebuilds the index, and recreates the `identify_match` RPC.
2. **`npm install`** to get `@huggingface/transformers`.
3. **Re-seed every book** with the new model (no token now):
   ```bash
   TARGET_SUPABASE_URL="https://<ref>.supabase.co" \
   TARGET_SUPABASE_SERVICE_KEY="<service_role>" \
   node scripts/seed-identification.mjs --slug <slug> --handle Curt
   ```
   (For prod, point TARGET at prod's URL + service key — same as the Phase 5 go-live.)
4. **Verify** with `scripts/test-identify.mjs` — a seeded photo URL should match
   its own page at ~100%; a phone photo of the print should land well above the
   noise floor. Drop a Vercel preview and re-tune the threshold from fresh
   `identify_events` (the on-device model's scores differ from Replicate's).

**Vercel:** remove the now-unused `REPLICATE_API_TOKEN` from the function's env
once the swap is verified. `IDENTIFY_SUPABASE_URL` / `IDENTIFY_SUPABASE_SERVICE_KEY`
stay.

**Follow-up:** the browser loads transformers.js + weights from the jsDelivr / HF
CDNs. Vendoring them into `public/vendor` (to match the AR libraries' self-hosted
policy) is deferred — the weights are tens of MB, so it's a deliberate separate step.

## Notes / decisions

- **Embeddings come from the photo URLs already stored on `collection_items`.**
  The Node seed reads those public URLs directly (transformers.js `RawImage.read`),
  so the branch doesn't need a copy of the source images.
- **The `.mind` is copied, not recompiled.** Every project already has a
  browser-compiled `.mind` (`create.html`); we just place it in the new bucket.
  The target order is preserved, so `target_ref` == the original `target_index`.
- **`collections.mind_file_url` is left pointing at the `experiences` bucket.**
  The new path resolves its `.mind` by convention at
  `pop-targets/<slug>/target.mind` (Phase 2 returns this URL), so prod's column
  meaning is untouched.
- **Same model on both sides.** Index-time (the Node seed, `embed.mjs`) and
  query-time (the browser, `public/lib/clip-embed.js`) use the same CLIP model +
  q8 dtype + L2-normalized 512-dim `image_embeds`, so vectors are comparable.
  Keep `CLIP_MODEL_ID` / `CLIP_DTYPE` in lockstep across both files.
