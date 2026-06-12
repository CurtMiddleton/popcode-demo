# Phase 1 — Creation / Ingest Pipeline

Seeds an existing collection into the new identification index so we have real
content to test Phase 2 (`/api/identify`) against. **Additive and branch-only:**
it reads the source collection read-only (prod by default) and writes the new
rows + `.mind` copy to the Supabase **branch**. No production table is mutated.

## Files

| File | Role |
|---|---|
| `lib/identification/embed.mjs` | CLIP embedding via Replicate (ViT-B/32 → 512 floats). Shared by this script and the Phase 2 endpoint. |
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
| `REPLICATE_CLIP_MODEL` | `krthr/clip-embeddings` | Must output a **512-dim** vector or the `vector(512)` column rejects it. |

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
