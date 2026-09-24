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
  - **MindAR is VENDORED** (self-hosted, not CDN) at `public/vendor/mindar/1.2.2/mindar-image-aframe.prod.js`. Loaded by `view.html`, `create.html`, `edit.html`. Pinned to upstream commit `1ad668d` (npm 1.2.2). Rebuild/upgrade/rollback steps + integrity hashes live in `docs/vendor/mindar/1.2.2/PROVENANCE.md` (moved out of `public/` 2026-09-04 so it isn't web-served). See 2026-06-06 session note.
  - **A-Frame is also VENDORED** at `public/vendor/aframe/1.4.2/aframe.min.js` (loaded by view.html only). Pinned to upstream commit `8692d8a` (npm 1.4.2). Details + the caveat about its optional remote-loading features in `docs/vendor/aframe/1.4.2/PROVENANCE.md`.
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
2. ~~Photo thumbnails on Manage cards~~ ✅ done
3. ~~Re-scan fix after manual close on view.html~~ ✅ done

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
**Trigger phrase: "save notes"** — when the user says this (or any close variant like "save session notes", "wrap the session", "save the notes"), treat it as an explicit instruction to append a new dated entry to the **Session history** in `docs/STATUS.md` (newest at the bottom), and to update that file's **Current state** section if what's open or next has changed. Do not wait to be asked twice.

The entry should include:
- Date (use today's date from the environment info, not a guess)
- PRs opened and their merge status
- What was actually fixed / built / changed, at a level of detail useful to a fresh Claude session tomorrow
- Any surprises, rabbit holes, or lessons worth warning future-Claude about
- If helpful: file paths with line numbers in the `path:line` format

After writing the entry, commit `docs/STATUS.md` with a message like `Add session notes for YYYY-MM-DD` and push to the current branch. Do not open a PR just for session notes unless the user asks.

**At the start of every session**, read `docs/STATUS.md`: the **Current state** section at the top, then at least the most recent 2–3 Session history entries at the bottom, before doing anything else — that's how context persists across sessions in this repo. It is NOT auto-loaded like this file, so it has to be read deliberately. (Session history lived in this file until 2026-09-24; it moved because it had grown to ~2,700 lines of context loaded into every session.)

**Then, before saying anything about what the code does or doesn't contain**, run `git fetch origin && git status -sb && git rev-list --count HEAD..origin/main` and report the commit you're on (`git log -1 --oneline`) and how far behind `origin/main` it is. If behind, get current first. Several sessions and two Macs push to this repo; a stale checkout has repeatedly produced confident, wrong claims (2026-09-01: 483 commits behind; 2026-09-24: the user's Mac was 524 behind and another session described code that was never committed). When relaying a claim from another session, verify it against `origin/main` before acting on it.

## Queued briefs

- **`docs/impact-dashboard-handoff.md`** — the nonprofit impact dashboard. Nothing
  built. Phase 1 (event logging, story buttons with UTMs, `?via=org`) is due before
  the Green Empowerment pilot prints (~Nov 3). Check it against the code first:
  `scan_events` + the viewer-insights `progress_pct` already cover part of its
  `events` table, and it assumes an Express backend this repo doesn't have.
- **`docs/nonprofits-landing-handoff.md`** — built: `popcode.app/nonprofits`
  (PR #72, merged 2026-09-24). Placeholders (booking URL, demo video, case study)
  still to fill; the user is iterating on the page.
- **`docs/design-audit-brief.md`** — site-wide visual audit. Item 1 (buttons) is
  done; type scale, card tokens and the "which screens are too noisy" question
  are still open.
- **`docs/postcard-brief.md`** — historical: the companion insert has shipped and
  is enabled (see STATUS.md, 2026-09-15 onward).
