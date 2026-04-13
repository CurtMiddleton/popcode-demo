# Popcode — Session Context

## What this app is
Popcode is an AR (augmented reality) web app. Creators upload photo+video pairs, which get compiled into a MindAR `.mind` file and stored in Supabase. A shareable link is generated (popcode.app short URL). Viewers open the link, point their camera at one of the photos, and the matching video plays fullscreen.

## Pages
- `public/index.html` — Landing page with Create / My Projects CTAs
- `public/create.html` — Create a project: upload photo+video pairs, compile, upload to Supabase, get short URL
- `public/manage.html` — List user's projects: view, copy link, rename, delete
- `public/view.html` — Viewer: loads project from Supabase by slug, scans photos, plays videos
- `public/auth.html` — Sign in / create account (email + password)
- `public/reset.html` — Password reset

## Terminology
User-facing copy calls them **"Projects"** (renamed from "Collections" on 2026-04-13). However, the Supabase schema and internal JavaScript still use the old name — tables are `collections` / `collection_items`, functions are `loadCollection()` / `loadCollections()`, CSS classes are `.collections-list`, etc. When editing code: **change user-visible strings to "Project"; do NOT rename DB tables, columns, JS identifiers, or CSS classes** (would break the app and require a migration).

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

## Debugging iOS issues
When anything AR-, video-, or MindAR-related misbehaves on iPhone/iPad, **push the user to plug the device into a Mac and use Safari Web Inspector** before trying anything else. Remote on-page diagnostics waste time. Workflow:
1. iPhone: `Settings → Safari → Advanced → Web Inspector → ON`
2. Mac Safari: `Settings → Advanced → Show features for web developers`
3. Plug in, unlock, trust computer
4. Mac Safari → Develop menu → `[iPhone name]` → page name
5. Check Console for errors, Network for hung/failed requests. **Note**: Safari doesn't replay errors from before the inspector was attached — always Cmd+R in the inspector once it's open.

A common gotcha: the console will appear empty if the page hit a parse-time SyntaxError, because nothing ran. `typeof someKnownTopLevelFunction` returning `"undefined"` is a quick test for "the inline `<script>` failed to parse at all".

## Session workflow
At the end of each session where code was changed, **append a brief entry to `## Session history` below** with: date, PRs opened/merged, what was fixed, and any surprises or lessons. Read `## Session history` at the start of each session for continuity — that's how context persists across sessions.

## Session history

### 2026-04-12 / 2026-04-13 — The "iPhone loading spinner" marathon
**Opened PRs #1–#16. Merged: #1, #2, #3, #4, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15. #16 pending.**

**Original ticket**: loading spinner hangs forever on iPhone XR (iOS 16). Turned out to also affect iPhone 17 (iOS 18.7) — but this wasn't visible at first.

**Actual root cause (found via Safari Web Inspector, PR #13)**: `view.html:370` had an orphaned `.then().catch()` chain left over from a previous muted-attribute edit — a standalone `.then()` after a semicolon is a `SyntaxError`, which silently prevented the entire inline `<script>` from parsing. No hoisting, no `loadCollection` defined, infinite spinner. The Web Inspector Console was initially empty because Safari doesn't replay errors from before the inspector was attached — had to reload the page with the inspector already open to see it. Fix was **deleting 2 lines**.

**Secondary bug (PR #14)**: on iPhone XR / iOS 16, MindAR's camera (`getUserMedia`) and HTML `<video>` playback can't share the media session. Video froze on the first frame with a red camera indicator visible in the URL bar. Fix: stop the `mindar-image-system` before `fullVid.play()`, restart it in `returnToScanner()`. iOS 18 handles the conflict transparently which is why iPhone 17 didn't need this fix after PR #13.

**Rabbit holes I chased for hours before finding the real cause** (avoid next time):
- Switched `autoStart: true` → `autoStart: false` (PR #12) — didn't help because the script never ran at all
- Added `defer` to head scripts + `DOMContentLoaded` wait (PR #6) — same reason
- Tried upgrading A-Frame and MindAR versions
- Built 4 diagnostic pages to test CDN / WebGL / `.mind` file / scene creation in isolation (PRs #8, #9, #10, #11) — all of which passed green while `view.html` still hung, because they used different inline scripts that didn't have the syntax error

**Lesson that should have been applied from turn 1**: for a mobile browser hang, push the user to Safari Web Inspector **first**, before writing a single diagnostic page. `typeof loadCollection === "undefined"` would have revealed the issue in 60 seconds.

**Other work done in the same session**:
- PR #15: deleted the 4 diagnostic pages (`diag.html`, `upgrade-test.html`, `version-probe.html`, `scene-test.html`) once the root cause was fixed
- PR #16: renamed every user-facing "Collection" → "Project" across 11 HTML files (nav links, headings, buttons, labels, error messages, How It Works copy). DB tables + JS identifiers intentionally NOT renamed — see `## Terminology` above.
