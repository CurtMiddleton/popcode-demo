# Montage maker (memory video maker) — v1

Apple-Photos-style memory video maker built into the Create flow. On any page's
video slot, a creator can tap **✨ Make a montage**, pick a set of photos, order
them, choose motion (Ken Burns / Crossfade), a shape (Portrait / Square /
Landscape), and background music — then Popcode renders an MP4 (via Shotstack)
and links it to that page's photo exactly like an uploaded video.

Nothing downstream changes: the montage output is a normal `{slug}/video_N.mp4`
in the `experiences` bucket, so `view.html` / `scan.html` / AR playback are
untouched.

## Architecture

```
create.html  ──(1) upload source photos──▶  Supabase experiences/montage-src/{uuid}/
   │                                              (public URLs)
   ├──(2) POST /api/create-montage  { images:[{url}], perImageSeconds, transition, musicUrl, aspect }
   │            └─ lib/montage/timeline.mjs builds the Shotstack "edit" JSON
   │            └─ Shotstack render  →  { renderId }
   ├──(3) poll GET /api/montage-status?id=renderId  →  { status, url }
   ├──(4) GET /api/montage-file?url=…  (CORS proxy)  →  MP4 bytes → Blob → File
   └──(5) file dropped into pairs[n].video  →  saved as {slug}/video_N.mp4 on Create
```

- **`lib/montage/timeline.mjs`** — pure builder: montage description → Shotstack edit JSON. Crossfade via 0.5s clip overlap + fade-in; Ken Burns via rotating `zoomIn/zoomOut/slide*` effects; soundtrack with `fadeInFadeOut`.
- **`api/create-montage.js`** — POST, starts a render. Validates 2–40 https image URLs.
- **`api/montage-status.js`** — GET, maps Shotstack lifecycle to `queued|rendering|done|failed`.
- **`api/montage-file.js`** — GET, same-origin proxy that streams the finished MP4 (Shotstack S3 output has no CORS). SSRF-guarded to Shotstack hosts. Lets the browser re-host the MP4 durably in Supabase (Shotstack output URLs are transient).
- **`public/montage-music.js`** — curated track manifest. Files live in `public/assets/music/` (see its README). WE host them → no copyright risk on shared links.
- **`create.html`** — the builder overlay + orchestration (all `mtg*` / `.mtg-*`).

## Environment variables (Vercel)

| Var | Purpose |
|---|---|
| `SHOTSTACK_API_KEY` | Shotstack API key. **If unset → dry-run mode.** |
| `SHOTSTACK_BASE_URL` | `https://api.shotstack.io/edit/stage` (sandbox, default) or `https://api.shotstack.io/edit/v1` (production). |
| `MONTAGE_DRY_RUN` | `true` forces dry-run even if a key is set. |

Scope the sandbox key + `.../stage` to **Preview** first (mirrors the Prodigi
sandbox pattern), verify on a phone, then add the production key + `.../v1` to
**Production**. Vercel env changes apply to the **next** build — redeploy.

## Dry-run / preview mode

With no key (or `MONTAGE_DRY_RUN=true`) the whole builder runs — add photos,
reorder, pick options, upload sources, request a render, poll — and stops at a
**"Preview mode"** banner instead of fabricating a fake MP4. This makes the UI +
upload + polling pipeline testable on a preview deploy before the paid key is
live. No Shotstack call is made and no video is linked in dry-run.

## Before going live

1. Create a Shotstack account, grab the **sandbox** key → set `SHOTSTACK_API_KEY` + `SHOTSTACK_BASE_URL=https://api.shotstack.io/edit/stage` in Vercel **Preview**.
2. Drop the real royalty-free tracks into `public/assets/music/` (see that README) and deploy — the picker's tracks 404 until the files exist.
3. Test on a phone: make a montage on a page, confirm the MP4 links + saves + scans.
4. Flip to the **production** key + `.../edit/v1` in Vercel **Production**.

## Known v1 limits / follow-ups

- **Photos only** — mixing in real video clips is the first v2 item (asset type `video` in the timeline; needs clip upload + trim UI).
- **Reorder is arrow-based** (‹ › on each thumb) — dead-reliable on touch. Drag-to-reorder is a polish follow-up.
- **No inline music preview** — tracks are selectable but don't play in the picker yet.
- **Temp source photos** accumulate under `experiences/montage-src/` — add a cleanup job eventually (harmless, small).
- **Cost** — each render bills per Shotstack pricing (~$0.10–0.30). Consider a per-user montage cap if volume grows.
