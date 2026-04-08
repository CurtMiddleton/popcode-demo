# Popcode — Session Context

## What this app is
Popcode is an AR (augmented reality) web app. Creators upload photo+video pairs, which get compiled into a MindAR `.mind` file and stored in Supabase. A shareable link (and QR code) is generated. Viewers open the link, point their camera at one of the photos, and the matching video plays fullscreen.

## Pages
- `public/index.html` — Static demo scanner (hardcoded local assets, disconnected from real product)
- `public/create.html` — Create a collection: upload photo+video pairs, compile, upload to Supabase, get link+QR
- `public/manage.html` — List all collections: view, copy link, delete
- `public/view.html` — Viewer: loads collection from Supabase by slug, scans photos, plays videos

## Stack
- Frontend: Vanilla HTML/CSS/JS (no framework)
- AR: MindAR (`mind-ar@1.2.2`) + A-Frame (`1.4.2`)
- Backend/DB/Storage: Supabase (anon key, no auth currently)
- Hosting: Vercel (static, `public/` folder)

## Supabase schema
- `collections` table: `id`, `slug`, `name`, `mind_file_url`, `created_at`
- `collection_items` table: `id`, `collection_id`, `target_index`, `video_url`
- `experiences` table: legacy single-target format (still supported in view.html fallback)
- Storage bucket: `experiences` — files stored as `{slug}/target.mind` and `{slug}/video_N.mp4`

## Top 10 improvements (priority order)

1. **User authentication** — No auth exists. `manage.html` loads ALL collections from all users. Anyone can delete anyone's collection. Need Supabase Auth + `creator_id` on collections + RLS policies.

2. **Fix `index.html`** — Dead demo page hardcoded to local static assets. Should be a proper landing page with CTAs to Create or View a collection.

3. **Add page deletion on Create screen** — Once a page is added, it can't be removed. Wrong upload = reload and start over.

4. **Re-share / QR code from Manage page** — QR code only shows right after creation. Manage cards need a "Get QR" button.

5. **Handle `targetLost` on `view.html`** — When camera moves away from image, the scanner never reappears. `targetLost` event is unhandled; users get stuck.

6. **Scanning instructions on `view.html`** — After "Tap to Start" there's no hint about what photo to point at. Need an instruction overlay.

7. **Centralize Supabase config** — The URL and anon key are copy-pasted into `create.html`, `manage.html`, and `view.html`. Should live in one place.

8. **Collection rename / edit** — Delete is the only action on Manage. Can't rename or add pages to an existing collection.

9. **Photo thumbnails on Manage cards** — Cards show name + page count only. Storing a thumbnail of the first photo would help users identify collections visually.

10. **Re-scan fix after manual close on `view.html`** — Pressing ✕ closes the video but `targetFound` won't re-fire for the same target until MindAR detects lost+found again. Needs a proper reset.

## Development notes
- Branch for new work: `claude/investigate-missing-work-1G11w` (tracks `main`)
- No build step — files are served directly from `public/`
- Supabase anon key is public (by design for client-side apps) but RLS policies must be tight once auth is added
