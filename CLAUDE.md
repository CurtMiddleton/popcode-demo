# Popcode — Session Context

## What this app is
Popcode is an AR (augmented reality) web app. Creators upload photo+video pairs, which get compiled into a MindAR `.mind` file and stored in Supabase. A shareable link is generated (popcode.app short URL). Viewers open the link, point their camera at one of the photos, and the matching video plays fullscreen.

## Pages
- `public/index.html` — Landing page with Create / My Collections CTAs
- `public/create.html` — Create a collection: upload photo+video pairs, compile, upload to Supabase, get short URL
- `public/manage.html` — List user's collections: view, copy link, rename, delete
- `public/view.html` — Viewer: loads collection from Supabase by slug, scans photos, plays videos
- `public/auth.html` — Sign in / create account (email + password)
- `public/reset.html` — Password reset

## Stack
- Frontend: Vanilla HTML/CSS/JS (no framework)
- AR: MindAR (`mind-ar@1.2.2`) + A-Frame (`1.4.2`)
- Backend/DB/Storage: Supabase (anon key, no auth currently)
- Hosting: Vercel (static, `public/` folder)
- Short URLs: popcode.app

## Supabase schema
- `collections` table: `id`, `slug`, `name`, `mind_file_url`, `created_at`, `user_id`
- `collection_items` table: `id`, `collection_id`, `target_index`, `video_url`
- `experiences` table: legacy single-target format (still supported in view.html fallback)
- Storage bucket: `experiences` — files stored as `{slug}/target.mind` and `{slug}/video_N.mp4`

## Sharing model
- Creators share a `popcode.app/{slug}` short URL (NO QR code — removed)
- Example: `https://popcode.app/my972d7m`

## Completed improvements
1. ✅ User authentication — auth.html (email+password), password reset, login gates, per-user collections
2. ✅ Short URL routing — popcode.app domain
3. ✅ Unique marker per collection — target index 0, triggers welcome animation
4. ✅ Mobile polish — loading spinner, gradient splash, SVG logo
5. ✅ QR code removed — sharing is short URL only
6. ✅ Page deletion on Create screen — × button on each page
7. ✅ targetLost handling on view.html — cancels pending trigger, resets corners
8. ✅ Scanning instructions on view.html — hint pill shown after Tap to Start
9. ✅ Landing page — index.html replaced with proper CTAs
10. ✅ Collection rename on Manage page — inline form saves to Supabase

## Remaining improvements
1. Centralize Supabase config — URL+key copy-pasted in every HTML file
2. Photo thumbnails on Manage cards
3. Re-scan fix after manual close on view.html

## Development notes
- Branch for new work: `claude/investigate-missing-work-1G11w` (tracks `main`)
- No build step — files are served directly from `public/`
- Supabase anon key is public by design; RLS policies handle access control
