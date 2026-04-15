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
**Trigger phrase: "save notes"** — when the user says this (or any close variant like "save session notes", "wrap the session", "save the notes"), treat it as an explicit instruction to append a new dated entry to `## Session history` below. Do not wait to be asked twice.

The entry should include:
- Date (use today's date from the environment info, not a guess)
- PRs opened and their merge status
- What was actually fixed / built / changed, at a level of detail useful to a fresh Claude session tomorrow
- Any surprises, rabbit holes, or lessons worth warning future-Claude about
- If helpful: file paths with line numbers in the `path:line` format

After writing the entry, commit CLAUDE.md with a message like `Add session notes for YYYY-MM-DD` and push to the current branch. Do not open a PR just for session notes unless the user asks.

**At the start of every session**, read `## Session history` (at least the most recent 2–3 entries) before doing anything else — that's how context persists across sessions in this repo.

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

### 2026-04-14 — Manage page polish + beta tooling + rescan fix

**All changes committed directly to `main` (no PRs this session).**

**manage.html — many small improvements:**
- Image count was wrong (e.g. 35 instead of 22) — was counting all `collection_items` rows including duplicates. Fixed by deduplicating on `target_index` before counting (same fix already applied to download modal).
- Replaced "Copy Link" button with a share icon (custom `share.svg` from Dropbox) next to the ID. Clicking opens a NYT-style popup with Copy Link / Email / Message options. Email uses `mailto:`, Message uses `sms:` with pre-filled body.
- Download Image/Images button now matches the same gray style as View and Order Badges.
- Order Badges modal descriptions updated: ¾" = "Great for small prints, cards and albums"; 1½" = "Great for large prints and posters".
- Share icon size bumped 15→20px.
- Nav "My Collections" → "My Projects" across all pages.
- Nav external link corrected to `href="https://popcodeapp.com"` displaying `popcodeapp.com ↗` (was variously `www.popcodeapp.com` or `popcode.app`).

**Beta feedback widget (`public/beta-feedback.js`):**
- New shared JS file injected into all main pages (manage, create, edit, account, analytics, views, howto, index, auth, reset) — NOT view.html (viewers aren't testers).
- Floating purple "Beta Feedback" pill in bottom-left corner.
- Modal: description (required) + email (optional). Submits to Supabase `beta_feedback` table via REST API. Shows ✓ success state then auto-closes.
- Requires this table in Supabase (SQL to create it was given to user and confirmed created):
  ```sql
  create table beta_feedback (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), page_url text, description text not null, email text, user_agent text, user_id uuid);
  ```
- Beta feedback reports appear in a new "Beta Feedback" section at the bottom of `analytics.html` (admin-only page), showing time / report / email / page / device.

**OG image (`public/assets/og_image.png`):**
- Regenerated as 600×300 (was 300×300 square). Wider aspect ratio gives a shorter, more compact iMessage/social preview card.

**view.html — rescan after manual close (the big one):**
- **Root cause**: MindAR 1.2.2's `stop()`/`start()` cycle is broken — after the first stop, `targetFound` events never fire again on restart. No amount of tuning fixes this.
- **Fix**: Extracted scene creation into `buildScene(mindUrl, videoMap)` function. `savedMindUrl` / `savedVideoMap` stored at module scope after first DB fetch. `sceneWasStopped` flag set when `mindar.stop()` is called in `triggerVideo()`.
- **Close flow**: `returnToScanner()` shows the **regular start screen** (unchanged — logo, tagline, "Tap to Scan", CTAs). No special "Tap to Scan Again" text.
- **Rescan flow**: when user taps "Tap to Scan" and `sceneWasStopped` is true: 500ms timeout (lets iOS fully release the video camera), then `buildScene()` tears down old `a-scene` and creates a fresh one, waits for A-Frame's `loaded` event (when `mindar-image-system` is actually registered), then calls `mindar.start()`. Works for same image or any different image.
- **Why 500ms**: if you rebuild immediately after `fullVid.src = ''`, iOS hasn't released the camera stream yet and `getUserMedia` fails.
- **Why `loaded` event**: if you call `mindar.start()` synchronously right after `document.body.appendChild(scene)`, A-Frame systems aren't registered yet → `systems['mindar-image-system']` is null → camera never starts → black screen.
- Key files: `public/view.html` — `buildScene()` ~line 290, `returnToScanner()` ~line 510, start-btn handler ~line 385.

**Rabbit holes this session (avoid next time):**
- Tried `mindar.stop()`/`start()` directly — broken in MindAR 1.2.2, don't bother.
- Tried calling `buildScene()` inside `returnToScanner()` and immediately calling `start()` — black screen because A-Frame systems not yet registered.
- Tried rebuilding inside close-btn click (user gesture) without delay — iOS camera not released fast enough.
- The working solution requires ALL THREE: rebuild + 500ms delay + `loaded` event.

### 2026-04-15 — Marketing site launch + analytics polish + beta prep

**All changes committed directly to `main` (no PRs this session).**

**Marketing site (`marketing/index.html`) — launched to popcodeapp.com:**
- Hero text absolutely positioned, aligned with logo edge using `left: max(24px, calc((100vw - 1100px) / 2 + 24px))`. Tagline 56px CooperBT, "Brought to life." on one line.
- Step icons replaced with big CooperBT gradient numbers (120px, `.step-icon { display:none }`).
- Footer logo doubled to 60px height.
- Email corrected: `hello@` → `info@popcodeapp.com`.
- How It Works link fixed to `https://popcode.app/howto.html`.
- Deployed as separate Vercel project (`popcode-marketing`). DNS via Squarespace: A record `216.198.79.1`, CNAME, TXT verification for popcodeapp.com → Vercel. Site live at popcodeapp.com.

**howto.html — accordion + badge FAQ:**
- All 5 sections (What is Popcode, How to Create, Badge FAQ, How to Scan, Troubleshooting) converted to CSS grid accordion. Click to expand/collapse, only one open at a time.
- CSS: `grid-template-rows: 0fr → 1fr` transition, `.section.open` class toggle via JS.
- Contact note added below accordion: "Still have questions? Email us at info@popcodeapp.com"

**OG image (`public/assets/og_image.png`):**
- Regenerated 1200×400, full gradient background (no white fade), white Popcode logo centered at 180px tall.
- Generated via Python PIL — forced all logo pixels white by replacing via alpha channel (avoid `ImageOps.invert()` which corrupts gradient colors).
- iMessage bottom bar color is sampled from the image by iOS — shows purple with this image. Gray bar requires a gray/white region at bottom of image; left as-is for now.

**manage.html:**
- Share message updated: `'Your Popcode project "X" is ready to scan!'` for both email and SMS.
- "My Collections" → "My Projects" (h1 + title).

**Nav drawer (all 7 app pages):**
- Slide-in from left, 300px wide, gradient background, overlay behind.
- Font sizes: links 20px bold, external URL 16px 0.7 opacity.
- Labels: "Create a Project", "My Projects", "Past Views", "My Account", "How It Works", "popcodeapp.com ↗"
- Close button inside `#nav-drawer`. JS uses `classList.add/remove('open')`, click-outside on `#nav-drawer-bg`.

**analytics.html:**
- "Detection Rate" → "Scan Rate" in 3 places with tooltip explaining low % = user opened scanner without pointing at photo.
- Phone Model column added. `parseModel(ua)` maps iOS version → iPhone generation (iOS 18+ = iPhone 16+, etc.), Android device name, iPad, Windows PC, Mac.
- Beta feedback 🔴🟡🟢 status buttons — urgent/not_urgent/completed. Row background colors: `#fff5f5` / `#fffbe6` / `#f0fff4`. Updates via `db.from('beta_feedback').update({ status }).eq('id', id)`.

**beta-feedback.js:** pill color confirmed purple (`#7657FC`), opacity 0.75.

**Supabase changes made this session (user confirmed all ran):**
- `alter table scan_events add column if not exists user_agent text;`
- `alter table beta_feedback add column if not exists status text default 'new';`
- `drop function get_events_with_users(integer,integer)` + recreate with `user_agent` in return type and SELECT.

**Key lesson — RPC functions don't auto-update:**
When a new column is added to a Supabase table, any RPC function that `select *`s or lists columns explicitly will NOT return the new column until the function is dropped and recreated with the new column in its `returns table(...)` definition. This is what caused "phone model not showing" even after adding the column and deploying code. Always check if data is coming through an RPC (look for `db.rpc(...)` in analytics.html ~line 445) and update the function definition when adding columns to `scan_events`.

### 2026-04-15 (later) — Session persistence walkthrough (no code changes)

**No code changed. No PRs. Branch: `claude/sync-cli-sessions-mbvBB`.** This session was entirely about helping the user understand how Claude Code sessions are stored and how project context persists across sessions — written down here so future-Claude (and future-user) don't have to re-derive it.

**User's concern:** they thought their previous Popcode chats had been "lost" because the Claude Code desktop/web app showed 0 prior sessions for this repo.

**What's actually going on:**
- Claude Code CLI transcripts are stored **locally on the machine that ran them**, at `~/.claude/projects/<flattened-path>/*.jsonl`. Each `.jsonl` is one session; each line is a user/assistant turn or tool call.
- The CLI and the desktop/web Claude Code app **do not share session storage.** So sessions run in Terminal on the Mac will never show up in the desktop app, and vice versa. Nothing was lost — the files are still on the user's Mac under `~/.claude/projects/` with a folder name like `-Users-<name>-…-popcode-demo/`.
- To find/search them on the Mac:
  ```bash
  ls ~/.claude/projects/ | grep -i popcode
  ls -lt ~/.claude/projects/*popcode*/
  grep -l "spinner" ~/.claude/projects/*popcode*/*.jsonl
  ```
- Pretty-printing one is doable with `jq -r 'select(.type=="user" or .type=="assistant") | "\(.type): \(.message.content // .content)"' <file>.jsonl | less`.

**The real persistence mechanism for this repo is `CLAUDE.md` itself, specifically the `## Session history` section.** Raw transcripts are noisy, machine-specific, and not version-controlled; CLAUDE.md is in git, pushed to GitHub, and auto-loaded by every new Claude Code session in this repo. That's why the 04-12 through 04-15 entries above have been the de-facto memory all along.

**The `save notes` flow (documented in `## Session workflow` above) is the intended way to keep this working.** When the user says "save notes" (or a close variant), Claude appends a dated entry here, `git add CLAUDE.md && git commit -m "Add session notes for YYYY-MM-DD" && git push` to the current branch. This very entry is the proof-of-concept run the user asked for.

**Manual fallback if the user edits CLAUDE.md directly on their Mac:**
```bash
cd ~/…/popcode-demo
git add CLAUDE.md
git commit -m "Update session notes"
git push                                   # or `git push -u origin <branch>` on first push
```
Verify on github.com/CurtMiddleton/popcode-demo → click `CLAUDE.md` → scroll to bottom → check History.

**Things worth remembering for next time:**
- If a user says "my previous chats are gone," don't panic — check CLAUDE.md → `## Session history` first (it's probably all there in curated form), then point them at `~/.claude/projects/` on their Mac for the raw transcripts.
- Session storage is per-machine. If the user works on two laptops, each has its own `~/.claude/projects/`. CLAUDE.md in git is the only cross-machine memory.
- The `save notes` trigger phrase is case-insensitive and forgiving of variants ("save session notes", "wrap the session", "save the notes"). Honor it the first time it's said — don't wait for a second request.
- Two entries on the same day is fine; mark the second one with "(later)" or a descriptive suffix so they're distinguishable.
