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
  - **MindAR is VENDORED** (self-hosted, not CDN) at `public/vendor/mindar/1.2.2/mindar-image-aframe.prod.js`. Loaded by `view.html`, `create.html`, `edit.html`. Pinned to upstream commit `1ad668d` (npm 1.2.2). Rebuild/upgrade/rollback steps + integrity hashes live in `public/vendor/mindar/1.2.2/PROVENANCE.md`. See 2026-06-06 session note.
  - **A-Frame is also VENDORED** at `public/vendor/aframe/1.4.2/aframe.min.js` (loaded by view.html only). Pinned to upstream commit `8692d8a` (npm 1.4.2). Details + the caveat about its optional remote-loading features in `public/vendor/aframe/1.4.2/PROVENANCE.md`.
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

### 2026-04-15 (cost planning) — Supabase video-storage cost model + AWS comparison (no code changes)

**No code changed. No PRs. Branch: `claude/sync-cli-sessions-mbvBB`.** The user — who has been burned by surprise AWS bills in a past life — asked for a back-of-envelope cost forecast for Popcode video storage at scale. Capturing the analysis here so we don't have to re-derive it, and so the architectural escape hatches are documented.

**Working assumptions used in the estimate (adjust when real data exists):**
- Average video = 30 seconds, **~40 MB** (iPhone default 1080p @ ~10–12 Mbps). 4K iPhone recordings are ~170 MB for 30s — big variance risk. Compressed 720p @ 2.5 Mbps = ~10 MB (the target to push toward).
- 2 projects per user, 10 videos per project → **~800 MB / user**.
- ~50 scans per project per month (wild guess — real number lives in `scan_events`).

**Supabase Pro pricing used (VERIFY at supabase.com/pricing before quoting — this is mid-2025 info):**
- Base: **$25/mo**. Includes **100 GB storage** + **250 GB egress**.
- Storage overage: **$0.021/GB/mo**.
- Egress overage: **$0.09/GB** (same as S3 — Supabase is on AWS under the hood).

**Back-of-envelope monthly totals (storage + egress combined):**
| Users | Storage (GB) | Egress (GB) | ~Monthly bill |
|---|---|---|---|
| 100 | 80 | 250 | **~$25** (under included limits) |
| 500 | 400 | 1,250 | **~$120** |
| 1,000 | 800 | 2,500 | **~$240** |
| 5,000 | 4,000 | 10,000 | **~$1,200** |

**The egress line dominates everything past ~500 users.** Storage is cheap; bandwidth from video playback is the killer. Storage at 1,000 users is only ~$40; the other ~$200 is pure egress.

**Why Supabase is meaningfully safer than AWS for this use case (important context — the user is gun-shy about cloud bills):**
- **Supabase has a hard Spend Cap.** Dashboard → Organization → Billing → toggle Spend Cap ON. When enabled, Supabase stops serving requests past the included quotas rather than charging overages. Worst-case bill = exactly $25/mo. AWS has no equivalent — CloudWatch Billing Alerts only notify, they don't stop anything.
- One bill, one product, no forgotten services in another region, no NAT Gateway data-transfer tax, no CloudWatch Logs ingestion fees, no Lambda invocation surprises. The things that typically wreck people on AWS don't exist in Popcode's architecture.
- Per-GB rates are identical to S3 ($0.021 storage, $0.09 egress). No markup — you're getting AWS prices without the assembly-required billing complexity.

**Concrete recommendations made to the user (none implemented yet — user said "save notes" before choosing a, b, or c):**
- **(a) Add a cost dashboard panel to `analytics.html`.** Read current storage size + this month's scan count from Supabase, multiply by $0.021 and $0.09, display "on track for $X this month". Prevents bill surprises. ~30 min of work.
- **(b) Enforce a video upload cap in `create.html`.** Max 50 MB per video, max 30 seconds, reject client-side before upload. Prevents one user from dumping 2 GB of 4K video. Simple File API check.
- **(c) Both.**
- **Also recommended but not offered as an immediate task:** turn on the Spend Cap in Supabase dashboard today (zero-code, user-side action), and eventually compress videos client-side on upload (ffmpeg.wasm or MediaRecorder re-encode to 720p @ 2.5 Mbps — would cut storage+bandwidth costs ~4×, dropping the 1,000-user estimate from ~$240 to ~$60).

**Architectural escape hatch if/when bandwidth becomes the bottleneck:**
- **Cloudflare R2** has **zero egress fees**. Storage is $0.015/GB/mo. For Popcode's workload (big videos, many plays) this fundamentally fixes the economics. Migration path: keep Postgres/auth/`.mind` files in Supabase, move **just the video files** to R2, change `collection_items.video_url` to point at R2 URLs. Straightforward, doesn't require rewriting anything else.
- Also valid: **Bunny.net** (~$0.01–$0.02/GB egress, purpose-built for video CDN) or **Backblaze B2** ($0.01/GB egress via Cloudflare bandwidth alliance).
- Don't migrate now — at hundreds of users, Supabase + Spend Cap is the right answer. Re-evaluate when egress regularly exceeds ~1 TB/month.

**Open question for a future session:** does Supabase's Smart CDN actually cache video responses from the `experiences` storage bucket? If yes, repeat views from the same region are basically free and the egress estimates above are pessimistic. Worth checking in the dashboard before investing in any optimization work.

### 2026-04-17 — Analytics overhaul, badge redesign, manage icons, git auth fix

**All changes committed directly to `main` via sandbox push. Branch: `claude/sync-cli-sessions-mbvBB`.**

**analytics.html — hosting cost estimate panel (commit `748a690`):**
- New "Hosting Cost Estimate" section at the top of the page, above the range buttons (calendar-month scoped, doesn't respond to the date-range selector).
- Reads real storage size by walking the `experiences` bucket via `db.storage.from('experiences').list()` — lists slug folders in parallel, sums `metadata.size` across all files.
- Estimates egress from `scan_events`: `(video_play count × avg video size) + (scan_open count × ~5 MB .mind file)`.
- Three big numbers: Storage Used (GB / 100 included), Egress Est. (GB / 250 included), Projected Monthly Bill ($).
- Color-coded bars: green < 70%, yellow 70–100%, red > 100% of included quota.
- Footnote links to supabase.com/pricing and Spend Cap docs.
- Pro-rates egress to end of month for the "on track for" projection.

**analytics.html — beta feedback status persistence fix (commit `f9bc566`):**
- **Root cause**: `setFeedbackStatus()` called `db.from('beta_feedback').update({status}).eq('id', id)` without chaining `.select()`. Supabase's default update returns 204 No Content with no error, so if an RLS policy silently blocked the write, the code had no idea — it updated the UI as if the write succeeded. On another machine, the DB still had the old value.
- **Fix**: chained `.select()` and explicitly check both `error` and `data.length > 0`. If either check fails, shows a clear browser `alert()` + `console.error()` pointing at the most likely cause (RLS UPDATE policy missing on `beta_feedback`).
- **RLS policy added by user**: `create policy "Admin can update beta_feedback" on beta_feedback for update to authenticated using ((auth.jwt() ->> 'email') = 'curtmid@gmail.com') with check (...)`. This is a server-side change living in Supabase, NOT in git — remember to re-apply if the DB is ever recreated.
- Status indicators redesigned: emoji 🔴🟡🟢 replaced with flat 10px CSS circles (`.status-dot-urgent` red, `.status-dot-not_urgent` amber, `.status-dot-completed` green). Opacity toggle for active/inactive. Cleaner cross-platform rendering.

**analytics.html — Accounts section (commit `59563db`):**
- New section above "By Project" showing user accounts: Created, Name, Email, Projects (count).
- Fetched via new RPC `get_all_users(max_rows)` — `security definer`, admin-gated by `auth.jwt() ->> 'email'`, reads from `auth.users` joined with `collections` count.
- Cached client-side in `cachedAccounts` so the date-range rebuild doesn't re-query.
- Shows most recent 10 by default. "Show N more ▼" accordion button expands to show all 35. Toggle collapses back.
- **SQL the user ran in Supabase to create the RPC:**
  ```sql
  create or replace function get_all_users(max_rows integer default 100)
  returns table (id uuid, email text, full_name text, created_at timestamptz, project_count integer)
  language plpgsql security definer set search_path = public, auth
  as $$ begin
    if (auth.jwt() ->> 'email') <> 'curtmid@gmail.com' then raise exception 'Unauthorized'; end if;
    return query select u.id, u.email::text,
      coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')::text,
      u.created_at, (select count(*)::integer from collections c where c.user_id = u.id)
    from auth.users u order by u.created_at desc limit max_rows;
  end; $$;
  grant execute on function get_all_users(integer) to authenticated;
  ```

**analytics.html — Activity log 25/50/100 toggle + Load more (commits `59563db`, `ebace31`):**
- Pill buttons "Show 25 / 50 / 100" next to the search field. Default 25. Controls chunk size.
- `activityLimit` = chunk size, `activityShown` = total currently visible. Slice is on sessions (not individual events).
- "Load N more ▼ (X of Y shown)" row appears at bottom of activity table when more sessions exist. Clicking increments `activityShown += activityLimit` and re-renders.
- "All N sessions shown" quiet confirmation when everything is visible.
- `activityShown` resets when: chunk-size pill changes, date-range changes. Search does NOT reset (filters within the currently-shown window).
- Fixed stale `colspan="11"` → `colspan="12"` on the empty-state row (table has 12 columns after the Model/Scan Rate/Comp. Rate additions).

**Badge redesign — solid-dot conversion (commits `4018dd1`, `9f905ee`):**
- User designed a new badge in Illustrator with fewer dots (252 vs old design's many hundreds). Exported as `popcode_badge.svg` (gradient version, single `<path>` with radial gradient fill).
- I wrote `/tmp/convert_badge.py` which: parses each sub-path (split at `M` boundaries), extracts the 4 cubic Bezier endpoints per dot, computes center (average of endpoints) + radius (avg distance), samples the radial gradient at the center point, emits a `<circle>` with solid hex fill.
- Gradient: radial at (399.8, 401.7) r=298.9, stops `#2dc0f7` (cyan, center) → `#5f8dfa` (blue, 60%) → `#8131fe` (purple, edge). 15 unique ring colors in the output, 18 dots per ring.
- Converted output overwrites `public/assets/popcode_icon.svg` — used by: favicon (all 11 pages), Order Badges modal previews (manage.html), composited badge on downloaded photos (manage.html `compositeImage()`).
- `popcode_badge.svg` kept in repo as the gradient design source-of-truth.

**manage.html — icon circle buttons (commits `a4a2dc8`, `503c8bc`, `3b71d6e`):**
- Card-actions row: text pill buttons replaced with 36px gray circle `.icon-btn` elements.
- Icons (Feather-style inline SVGs): eye (View), pencil (Edit), upload-arrow (Share), download-arrow (Download), dots-in-circle (Order Badges), trash (Delete, kept as dark circle).
- Share trigger button moved from the card-id area into card-actions. Share popup stays in card-id (positioned relative to slug area) — same mechanism, just different trigger location.
- Order Badges icon evolved: first used `popcode_icon.svg` <img> (too dense at 18px, looked like a black blob) → then 6 dots in outer ring (looked like a cookie) → final: 6 outer dots + 3 inner dots (rotated 60°) + center dot = concentric rings pattern. Matches the other icons' line-art weight.
- Each icon has `title` attribute for native hover tooltip.

**manage.html — Order Badges modal fix (commit `a88c0ad`):**
- Sticker Mule links were swapped: ¾" linked to the 1.5" product and vice versa. Fixed by swapping the href URLs.
- Preview images switched from `popcode_icon.svg` (solid-dot, too dense at 36/56px) to `popcode_badge.svg` (gradient, renders smoothly at preview sizes).

**Git auth fixed on user's Mac:**
- GitHub had been rejecting pushes with "Invalid username or token. Password authentication is not supported."
- Fix: generated a Personal Access Token (classic, `repo` scope) on github.com/settings/tokens/new, set `git config --global credential.helper osxkeychain`, and used the PAT as the password on next `git push`. Keychain now stores it permanently.
- User's local `main` was diverged from `origin/main` (1 local commit `a9458cd "Fix video autoplay on iOS"` based on old parent `78add04`). Backed up to `backup-autoplay-fix` branch, then `git reset --hard origin/main`. The autoplay fix (adding `muted` to `<video>`) was already in origin/main from a prior session.

**Two copies of popcode-demo discovered on user's Mac:**
- `/Users/curtmiddleton/popcode-demo` — the real git repo, connected to github.com
- `/Users/curtmiddleton/Dropbox/Popcode X/popcode-demo` — a second copy in Dropbox
- User saved `popcode_badge.svg` to the Dropbox copy, which is why `git status` showed "clean" in the real repo. Copied the file over with `cp`. **This needs to be consolidated in a future session** — maintaining two copies is a recipe for confusion and lost work.

**Supabase Spend Cap confirmed ON:**
- User verified in dashboard: "Spend cap is enabled. You won't be charged any extra for usage."
- Worst-case monthly bill is now hard-capped at the Pro base (~$25). Supabase will pause/degrade the project rather than charge overages.

**Key lessons and gotchas from this session:**
- **RLS silent failures**: Supabase's PostgREST returns 204 No Content for an update that matches 0 rows (RLS-filtered). Always chain `.select()` and check `data.length` when the write matters. This is how the beta-feedback persistence bug hid for days.
- **Server-side state not in git**: the `beta_feedback` UPDATE policy and the `get_all_users` RPC are server-side SQL in Supabase. If the DB is ever recreated, these need to be re-applied. Consider adding a `supabase/migrations/` folder or a setup SQL file to the repo for documentation.
- **Sandbox ↔ GitHub sync is real**: the Claude Code sandbox's localhost git mirror (`http://127.0.0.1:PORT/git/...`) DOES sync bidirectionally with real github.com. Pushes from the sandbox land on github.com and Vercel deploys them. User's `git fetch` confirmed receiving sandbox commits.
- **SVG dots-as-path parsing**: Adobe Illustrator exports circles as cubic-Bezier sub-paths inside one big `<path>`. Each sub-path has 4 segments (3 `c` + 1 `s`, or 4 `c`). The 4 Bezier endpoints are on the circle — average gives center, avg distance gives radius. Number regex needs to handle `.5` (no leading zero) and `-` as separator (no comma).
- **Dense SVGs as icons**: popcode_icon.svg (252 circles) is unreadable below ~36px. For icon-scale usage, create a simplified line-art version (stroked circle + a few filled dots). The full SVG works fine for favicon (browsers smooth it) and composited-photo badges (large enough to resolve).
- **Two-repo confusion**: if a user has multiple local copies of a repo, `git status` will report based on whichever folder they're `cd`ed into. Always confirm `pwd` and `git remote -v` before diagnosing "file not found" issues.

### 2026-04-17 — Audio feature planning session

**No code changes this session — planning only.**

**Audio recording feature designed in detail.** The user wants creators to be able to record audio (not just upload video) for each page in a project. Use cases: grandma narrating a photo album, spoken grocery list on a fridge magnet. Plan also includes speech-to-text transcription so viewers see text alongside audio playback.

**Implementation plan produced (3 phases):**

1. **Phase 1 — Audio recording & upload (create.html + edit.html):**
   - DB migration: add `media_type` (text, default 'video'), `audio_url` (text), `transcript` (text) columns to `collection_items`
   - Per-page "Video | Audio" toggle in the create/edit UI
   - In-browser audio recorder using `getUserMedia({ audio: true })` + `MediaRecorder`
   - Audio stored at `{slug}/audio_{N}.webm` (Chrome) or `.mp4` (Safari)
   - Codec detection pattern mirrors existing `compressVideo()` at create.html:297

2. **Phase 2 — Audio playback (view.html):**
   - Refactor `videoMap` → `mediaMap` carrying `{ type, videoUrl, audioUrl, transcript }` per target
   - `targetFound` branches to `triggerAudio()` or `triggerVideo()` based on `media.type`
   - Audio player UI: scanned photo displayed prominently + custom audio controls + transcript panel
   - Same MindAR stop + 500ms delay + scene rebuild pattern for rescan
   - If iOS `play()` rejects (gesture chain broken by setTimeout), show "Tap to Listen" fallback

3. **Phase 3 — Transcription (Supabase Edge Function):**
   - New Edge Function `transcribe-audio` calls OpenAI Whisper API (~$0.006/min)
   - Fire-and-forget from create/edit after upload — transcript appears on next viewer load
   - Stored directly on `collection_items.transcript` column

**Key risks identified:**
- MediaRecorder codec differences (WebM vs MP4) — mitigated by storing native format; `<audio>` plays both
- iOS autoplay after setTimeout may break gesture chain — mitigated with "Tap to Listen" fallback
- RPC functions will need drop/recreate if they select from `collection_items` (lesson from 2026-04-15)

**Full plan saved at:** `.claude/plans/graceful-twirling-dream.md`

### 2026-04-17 (evening) — SMS wording tweak + AWS cancellation pre-flight audit

**Code changes:**
- **SMS share text updated** on `manage.html`: `'Your Popcode project "X" is ready to scan!' → '"X" is ready to scan with Popcode!'` (commits `5ceee10` on main). User mentioned it felt more natural phrased as the project speaking rather than "Your Popcode project". Only affects the Message share option — Email subject/body unchanged.

**Git gotcha — parallel pushes from two machines:**
- While I was writing session notes and pushing from the sandbox, a different Claude Code session running on the user's **iMac** (`CURTs-iMac`, not the usual `CURTs-MBP`) also pushed to `main` at the same time with its own session notes (`37c26ca`, the audio feature planning entry above).
- My push to main was rejected as non-fast-forward. Resolution: `git fetch origin main && git rebase origin/main` on the feature branch, then force-push the branch and fast-forward main. Clean because the two commits touched different sections of CLAUDE.md.
- **Lesson:** the user has Claude Code on multiple machines (Mac + iMac). Parallel sessions can both push. Always `git fetch` before push when starting a new working session. Also: it's possible to have two separate "2026-04-17 session notes" commits in history — that's not a bug, it's two separate sessions on two machines the same day.

**AWS cancellation conversation — user is planning to close their AWS account, wanted a pre-flight audit:**

Context: user has been paying exorbitant AWS fees from prior unrelated work (not Popcode — Popcode is fully on Supabase + Vercel). Asked what could break before closing. After the conversation they wisely decided to **keep the account open another month** until they're certain nothing breaks. Key findings captured here so we don't have to re-derive them.

**Five risk buckets to check before closing any AWS account:**

1. **Domains registered in Route53** — THE critical one. If `popcode.app` or `popcodeapp.com` is registered through AWS Route53, closing the account kills the domain for 60–90 days. Must check `Route53 → Registered domains` in AWS Console and **transfer out** (to Squarespace, Namecheap, Cloudflare, etc.) BEFORE closing. Transfers take 5–7 days. Per CLAUDE.md the marketing site DNS is via Squarespace, so `popcodeapp.com` is probably there, but **verify** — I can't check this from the sandbox.
2. **S3 URL references in codebase** — if any code or external link references `amazonaws.com` URLs, those break on closure AND the bucket namespace becomes publicly available, which means a malicious actor could claim the old bucket name and serve whatever they want at those URLs (known attack pattern: "S3 bucket takeover").
3. **Local IAM credentials** — `~/.aws/credentials` on any machine using AWS SDK/CLI. Check on every Mac/iMac separately.
4. **Active billing charges** — run `Billing → Cost Explorer → Group by Service` to see what's actually running. Common silent money-sinks: NAT Gateway ($32/mo baseline), unattached Elastic IPs ($3.60/mo each), stopped RDS instances (still charge for storage), forgotten Route53 hosted zones ($0.50/mo each), CloudWatch Logs accumulation, old EBS/RDS snapshots.
5. **CloudFront distributions / SES / Lambda** — anything still serving or running counts. Check regions you don't usually look in.

**Safety net:** AWS has a **90-day grace period** after account closure during which you can reactivate. Past 90 days, everything is permanently deleted.

**Also recommended:** set a **Billing → Budgets** alert (e.g. $10/month email notification) as an early warning against any future surprise charges. AWS does NOT have a hard Spend Cap like Supabase — CloudWatch Billing Alerts only notify, they don't stop charges.

**Results of the audit I could run from the sandbox:**

- ✅ **Zero AWS URLs in the Popcode codebase.** Searched `public/`, `marketing/`, `CLAUDE.md`, `package.json` for `amazonaws.com`, `cloudfront.net`, `s3.*`, S3 URL patterns. No hits. The Popcode codebase has no AWS dependencies — only Supabase + Vercel.
- ✅ **No AWS credential patterns in source.** Clean on `aws_access_key`, `AWS_SECRET`, `accessKeyId`, `secretAccessKey`, `AWS_REGION`. (Beware: `grep -iE 'AKIA[A-Z0-9]{16}'` will hit false positives in base64-encoded font data in `marketing/index.html`. Use specific variable-name patterns instead.)
- ✅ **No `~/.aws/credentials` file on the user's MBP.** `ls ~/.aws/` returned "No such file or directory". No local AWS SDK/CLI is authenticated on this Mac.

**Still to verify (user must log into AWS Console for these):**
- Route53 domain check for `popcode.app` and `popcodeapp.com`
- `~/.aws/credentials` check on the iMac (since the MBP is clean, but parallel work happens on the iMac too)
- Cost Explorer audit to identify what's actually running

**Lesson for future-Claude:** whenever a user mentions closing AWS (or any cloud account), the **Route53-hosted-domain risk is the one that can break production**. Everything else costs money or inconveniences you. The domain one silently breaks every user-facing short URL. Check it FIRST.

**Also relevant: base64 grep false positives** — if you grep a repo for short uppercase-letter patterns like AWS access keys (`AKIA[A-Z0-9]{16}`) across all files, you'll hit base64-encoded assets (fonts, images) by sheer coincidence. Limit those greps to source-code file types (`.js`, `.py`, `.env*`, `.json`, `.yaml`) and exclude assets. Or verify hits visually aren't inside a `data:font/` URL.

### 2026-04-22 — Branded transactional email end-to-end + auth UX fixes

**PR #26 merged.** Branch: `claude/brand-email-communications-NbgMk`. All changes shipped to main.

Kicked off when the user showed a screenshot of Supabase's default "Confirm your signup" email — bare, unbranded, ugly. Ended the session with the whole transactional-email surface branded, custom SMTP delivering via Resend, a buttoned-up forgot-password UX, and the canonical-domain ambiguity resolved.

**What shipped (in git):**

- **`supabase/email-templates/*.html`** — 5 branded HTML templates for Supabase Auth (confirm-signup, reset-password, magic-link, change-email, invite) + `beta-feedback-thanks.html` for the feedback-widget auto-reply + `reply-signature.html` for manual info@popcodeapp.com replies.
- **`supabase/email-templates/README.md`** — comprehensive paste-into-dashboard instructions, Resend + custom SMTP setup, suggested subjects, template variables reference, cross-client test checklist.
- **`supabase/functions/send-beta-feedback-thanks/`** — Deno Edge Function (index.ts + template.ts). Receives `{email, description, page_url}`, escapes HTML, substitutes placeholders, sends via Resend. Deploy with `--no-verify-jwt`. **NOT YET DEPLOYED** — user deferred this step; the CLI work can resume in a future session.
- **`public/beta-feedback.js`** — wired to POST to the edge function fire-and-forget after a successful DB insert. Failure is silent so the widget UI is unaffected if the function isn't deployed.
- **`public/assets/Popcode_logo.rev.png`** — 400px-wide white PNG, generated from `Popcode_logo.rev.svg` using `cairosvg` in Python. Email templates hotlink this at the absolute URL `https://popcode.app/assets/Popcode_logo.rev.png` and keep the old styled text wordmark as the `<img>` alt/fallback styling.
- **`public/auth.html`** — Forgot Password is now a proper mode in a `mode` state machine (`signin` | `signup` | `forgot`). Switching to `forgot` hides the password field, swaps the button to "Send Reset Link", and replaces the toggle with "← Back to sign in". Also fixed `redirectTo` — was hardcoded to `https://popcode-demo.vercel.app/reset.html` (stale Vercel preview URL); now `window.location.origin + '/reset.html'`.

**What shipped (in external services, not in git — record for next session):**

- **Resend**: user already had an account from Tek Folio; `popcode.app` was already verified there, DNS records in place in Squarespace. A pre-existing "Supabase SMTP" API key (Full access, `re_be9sJ1xL…`) was already in use — didn't rotate it.
- **Supabase → Authentication → SMTP Settings**: custom SMTP was already configured pointing at `smtp.resend.com:465`, sender `info@popcodeapp.com`, name `Popcode`. Nothing to change there.
- **Supabase → Authentication → Email Templates**: user pasted all 5 templates into the tabs, then had to re-paste once after the logo `<img>` swap. Subjects set per the README's suggestion table.
- **Supabase → Authentication → URL Configuration**: Site URL flipped from `http://localhost:3000` (Supabase default, untouched since project creation) to `https://popcode.app`. Redirect URLs now include `https://popcode.app/**` (the wildcard covers `/reset.html` and any future reset-flow paths).
- **Vercel → Domains**: flipped the redirect direction. `popcode.app` now "Connect to an environment → Production" (serves directly), `www.popcode.app` now "Redirect to Another Domain → popcode.app" (307). Previously backwards — was redirecting the short URL to www.

**The three surprises that ate most of the time:**

1. **Vercel had the redirect backwards.** The Domains page showed `popcode.app → 307 → www.popcode.app`. User wanted the short URL canonical. Fix was to edit both domain entries and reverse the radio-button selection (Connect-to-environment vs Redirect-to-Another-Domain). Lesson: on the Domains list, the arrow direction tells you which is redirecting to which. Follow the arrow — if it points AWAY from your preferred canonical, you have it flipped.

2. **Supabase Site URL was still `http://localhost:3000`.** This is Supabase's default when you create a new project for local dev. Nobody ever updated it when Popcode went to prod. Symptom: reset emails landed at `localhost:3000/#error=otp_expired&…` — Safari couldn't connect. When the Supabase `redirectTo` argument isn't in the Redirect URLs allow list, Supabase silently falls back to the Site URL. Lesson: for ANY bug of the form "my auth/reset email went to the wrong domain", check Supabase Dashboard → Authentication → URL Configuration BEFORE looking at client code.

3. **`popcode.app` vs `www.popcode.app` are different origins to Supabase.** Even after setting Site URL correctly, the reset email landed at `www.popcode.app/#...` — because the user's browser was on www when they triggered the reset, so `window.location.origin` resolved to `https://www.popcode.app`, which wasn't in the allow list. Fixed by flipping Vercel's redirect direction (see #1) so there's only ever one canonical origin. Short-term workaround: add both `https://popcode.app/**` and `https://www.popcode.app/**` to the allow list.

**Smaller but useful:**

- **Forgot Password UX bug**: original auth.html kept the password field visible after clicking "Forgot password?", and the Sign In button's validator yelled "Please enter your email and password" when users tried to reset without a password. Refactored to a mode state machine — `setMode('forgot')` now hides password, changes the button, and swaps the toggle text. File: `public/auth.html` ~line 146 (state machine) and ~line 191 (submit handler branches on `mode`).
- **SVG-to-PNG for email**: Gmail doesn't render SVG in email bodies, period. Had to generate a white PNG from the existing `.rev.svg`. Python one-liner with `cairosvg`: `cairosvg.svg2png(url='...svg', write_to='...png', output_width=400)`. White logo on transparent background works cleanly on the brand gradient.
- **Alt-text styling trick**: putting `color:#ffffff; font-family:…; font-weight:700; font-size:40px; letter-spacing:-0.02em` as inline style on the `<img>` tag means when images are blocked (Gmail default on desktop, many corporate clients), the alt text renders with those styles as a best-effort fallback. Some clients honor it fully, some partially — good degradation either way.
- **`re_pasting Supabase templates after HTML edits`** is a manual step that will trip us up every time the template design changes. No auto-sync. The README calls this out.
- **Parallel-Macs problem recurred**: iMac's local `main` was stale after the user's MBP (and this session's sandbox) merged PR #26. `git push` rejected non-fast-forward. Fix: `cd ~/popcode-demo && git pull origin main && git push`. Same pattern as 2026-04-17.

**User-side gotcha to remember**: the user's default terminal on iMac opens in `~`, not the project dir. When giving Bash commands, always start with `cd ~/popcode-demo` (or verify `pwd` first). Lost ~2 minutes when `git pull origin main` failed with "not a git repository" in a fresh tab.

**Naming decisions worth keeping:**

- Sender email: `info@popcodeapp.com` (both `from` and `reply-to`). Considered `hello@popcodeapp.com` but user didn't want to set up a second mailbox or alias. Since Resend sends on behalf of the whole domain (DKIM/SPF cover any address), any `from` address works without a real mailbox behind it. Info@ is the one address they already monitor.
- Logo file: `public/assets/Popcode_logo.rev.png` — matches existing `.rev.svg` convention (`.rev` = reversed / white).

**Remaining work deferred to future sessions:**

- Deploy the `send-beta-feedback-thanks` Edge Function. Needs Supabase CLI on the iMac: `brew install supabase/tap/supabase`, `supabase login`, `supabase link --project-ref <ref>`, `supabase secrets set RESEND_API_KEY=re_…`, then `supabase functions deploy send-beta-feedback-thanks --no-verify-jwt`. The function is already written and committed; just needs deployment.
- Install `reply-signature.html` as an email signature in Apple Mail or Gmail for info@popcodeapp.com. Instructions are at the top of that file.

**Next session topic teed up by user:** design a beta-gating system — invite-only signup for ~10 close friends and family. User does NOT want random people creating accounts. Options worth considering:
1. Email allow-list table + RLS policy that blocks signup unless email is on the list (cleanest, fully Supabase-native).
2. Invite codes table — user must enter a code during signup. More clicks, less friendly.
3. Pre-provisioned accounts — admin creates accounts and sends the password reset link. Simplest, no client-side changes, but every new invitee is manual work.
4. Middleware in `auth.html` that validates email against a hard-coded (or DB-fetched) allow list before calling `signUp`. Easy to bypass via Supabase API directly — not secure, needs RLS backing anyway.
5. Turn off signup at the Supabase level entirely and invite each person via the existing "Invite user" template + admin dashboard.

Option 1 (RLS-enforced email allow-list) is probably the right answer — secure, scales, and the branded invite.html template is already in place to welcome them once they're added. Option 5 is the MVP if the user wants to move fast (no code at all, just invite 10 people from the dashboard). Leave the design decision to the next session.

### 2026-04-29 — White-label custom cover (admin-only) — first version

**Branch: `claude/white-label-customization-Rm3nU`. Not yet merged. No PR opened — user-facing build for review/QA first.**

**Feature scope (v1, agreed with user):**
- Admin-only (`curtmid@gmail.com`) per-project custom cover that replaces the default scan start screen on `view.html`.
- Fields: cover image (uploaded), eyebrow (small caps line), title (big italic serif), subtitle/date.
- The decorative top border (kente cloth in the Ghana mockup) is **baked into the uploaded image** — no separate asset, no preset library in v1.
- "Tap to scan" is the only CTA mode for v1. The "Have a code? Enter it here." mockup variant is a follow-on for `index.html` (popcode.app root) and is NOT part of this feature.
- Per-project only. Per-account / multi-project branding is deferred (user wants it later).

**Fonts used:** Cormorant Garamond (serif italic, for the title) + DM Sans (sans, for eyebrow/subtitle/CTAs). Both loaded from Google Fonts CDN — no font upload UI, no Trek Folio repo access needed. Existing FilsonPro stays as the rest-of-app font.

**Files changed:**
- `public/view.html` — added `#wl-cover` markup + styles (full-bleed image, 4-stop top+bottom darkening gradient, eyebrow/title/subtitle text, `Tap to scan` white pill, outlined `Create your own Popcode`, `Sign in` link, Popcode logo at bottom). Refactored `start-screen` toggling into `showStartScreen()` / `hideStartScreen()` / `applyCoverConfig()` helpers and extracted the start-tap behavior into `handleStartTap()` so both the default and white-label scan buttons go through the same flow (including the post-close rebuild + 500ms delay + `loaded`-event dance from the 2026-04-14 fix). Cover only renders when `col.cover_config.enabled === true && image_url` is set; otherwise the existing gradient start screen still shows.
- `public/edit.html` — added admin-only "White Label Cover" section (purple `Admin` pill, hidden unless `currentUser.email === curtmid@gmail.com`). Lets admin upload an image (8 MB cap), set the three text fields, toggle Enable, and save. Preview pane shows live overlay text on the chosen image at 9:19 aspect. Saves go to a separate "Save Cover" button that updates `collections.cover_config` only — does NOT touch the heavy compile-and-upload `Save Changes` flow. Image stored at `{slug}/cover.{ext}` in the existing `experiences` storage bucket. Save uses the post-2026-04-17 lesson — chains `.select()` after `update()` and treats `data.length === 0` as a likely RLS / trigger block.

**Required Supabase changes (USER MUST RUN — not in git):**

```sql
-- 1. Add the column
alter table collections add column if not exists cover_config jsonb;

-- 2. Restrict cover_config writes to admin only.
-- PostgreSQL has no column-level UPDATE policies via RLS, so use a trigger.
create or replace function enforce_cover_config_admin()
returns trigger language plpgsql as $$
begin
  if new.cover_config is distinct from old.cover_config then
    if coalesce(auth.jwt() ->> 'email', '') <> 'curtmid@gmail.com' then
      raise exception 'Only admin can modify cover_config';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_cover_config_admin on collections;
create trigger trg_cover_config_admin
  before update on collections
  for each row execute function enforce_cover_config_admin();
```

Without the trigger the column still works but ANY signed-in user could set their own project's cover via the API (they can't see the editor UI but the anon key is public). Trigger is the belt-and-suspenders backstop. The editor's save handler already detects this case and surfaces a friendly error.

**Cover_config jsonb shape:**
```json
{
  "enabled": true,
  "image_url": "https://<supabase>/.../experiences/{slug}/cover.jpg?v=<ts>",
  "eyebrow": "MISSION TO",
  "title": "Ghana",
  "subtitle": "March 1 – 9, 2026"
}
```
Cache-busting `?v=<timestamp>` is appended on save so a re-uploaded image immediately replaces the cached one in viewers' browsers.

**Test plan:**
1. Sign in as `curtmid@gmail.com`, open `edit.html?id={slug}`, the White Label Cover section should be visible.
2. Upload an image (the Ghana mockup is a good test asset), fill eyebrow/title/subtitle, check Enable, click Save Cover.
3. Open `popcode.app/{slug}` in a private window — should show the cover, not the default gradient start screen.
4. Tap "Tap to scan" — should enter the AR scanner like normal. Close the video and tap again — should rescan (regression test for the 2026-04-14 work).
5. Sign in as a non-admin account, confirm the section is hidden in `edit.html`.

**Open follow-ups for future sessions:**
- **Mockup 2 ("Have a code? Enter it here.")** — separate feature for `index.html` root. Add a small input + Go button that routes to `/{code}`. Doesn't render the project's cover (popcode.app root has no slug yet).
- **Per-account branding** — when ready to support multiple white-label customers, introduce a `white_label_profiles` table keyed by user_id and let collections inherit from it. Per-project override stays for one-off campaigns.
- **Font picker** — user mentioned eventually wanting "a handful of different fonts." Trivial to add a dropdown that maps to Google Fonts URL parameters once we know the curated list.
- **Preview-on-the-real-device** button in the editor that opens `view.html?id={slug}` in a new tab so admin doesn't have to navigate manually.

**Non-obvious decisions worth keeping:**
- Image uploaded to `experiences/{slug}/cover.{ext}` rather than a separate bucket — reuses the existing storage RLS policies that already let creators write to their own slug folder. The trigger above is what actually gates the *publishing* (setting `cover_config`) to admin-only; the upload alone does nothing if the row isn't updated.
- All admin gating is "UI hide + DB trigger." Email comparison is lower-cased on the client; the trigger uses `auth.jwt() ->> 'email'` directly. If a second admin is ever added, both the client constant `ADMIN_EMAIL` in edit.html and the trigger function need to change in lockstep — consider a dedicated `admins` table at that point.
- All user-controlled cover text is rendered via `textContent` (never `innerHTML`) on both the editor preview and the public viewer, so there's no XSS surface even though admin-only writes mostly mitigate it anyway.
- The cover does NOT replace `index.html` or `manage.html` — strictly per-project, applies only when someone hits `popcode.app/{slug}` for a project where `cover_config.enabled` is true.

### 2026-04-29 (later) — White-label cover, iterated and shipped to prod

**Continuation of the earlier 2026-04-29 session notes. All commits on `main` (user said "push to prod and we can tweak" — no preview deploy, no PR).**

**The feature is live in prod** as of `cee3015`. Mission to Ghana cover is enabled on at least two real projects (the original demo + slug `em6no1gm`). User confirmed it's working on iPhone.

**Commit-by-commit (oldest → newest):**

1. `beaf21e` — initial build (see earlier 2026-04-29 entry).
2. `8fc89cf` — Title 76px italic → **122px regular** (small-screen breakpoint 64 → 104). User said italic was wrong and 122pt was the spec.
3. `7215000` — Cover image `object-position: center` → **`top center`**. The kente-cloth pattern at the top of the uploaded image was getting cropped on tall phones because `object-fit: cover` distributes the crop top+bottom evenly. Anchoring to the top guarantees the kente always shows; bottom of the image gets cropped instead, but that's where the dark-bottom gradient + buttons sit so it's invisible. Same fix applied to the editor preview pane.
4. `9cfaef3` — Share message in `manage.html` now uses **`col.cover_config.title`** when enabled, falling back to `col.name`. So Mission to Ghana now SMSes as `"Ghana" is ready to scan with Popcode!` instead of the project's internal name. One-line fix at `manage.html:454`.
5. `e4b7332` — Title 122px → **112px** (small breakpoint 104 → 94). User wanted it dialed back 10pt.
6. `749cc11` — **Save-guard**: `saveWhiteLabel()` now refuses to save if "Enable cover" is checked and no image is set, surfacing `"Pick a cover image before enabling the cover."` This was caught after the user toggled Enable on the demo project but the image picker didn't have a file selected — save succeeded silently with `image_url: null` and the cover never rendered (the viewer falls back to the default start screen when `image_url` is missing). Could've gone either way (loud client error vs. silent fail) but the user's first reaction was "looks broken" so the guard is the better default.
7. `903a75e` — Popcode logo at the bottom of the cover doubled from **26px → 52px** tall.
8. `51d487d` then `cee3015` — Iterated on the **Tap to scan button**: I first made it turquoise-bg + white-text + bigger (22px). User pushed back: "button should be white like before, the **text** should be turquoise, and make smaller." Final state: white background, **turquoise text `#2dc0c5`**, 18px font, 18×24 padding. Also dropped the CTA column `max-width` from 360 → **300px** so the buttons don't stretch edge-to-edge.

**Brand turquoise**: settled on `#2dc0c5` for the text. This pairs with the existing Popcode brand cyan `#2dc0f7` (which is already used in the badge gradient and elsewhere) — `c5` is more green-leaning, closer to a kente turquoise. If we ever do a global "Popcode turquoise" color token, it should be one of these two; document which when it happens.

**UX gotcha worth keeping (the silent-cover bug)**: the editor has TWO things that have to be set to render the cover — `enabled === true` AND a non-null `image_url`. If only Enable is checked, the save still goes through and the row gets `enabled: true, image_url: null`, which `applyCoverConfig()` in `view.html:524` treats as "no cover" and falls back to the default start screen. The `749cc11` guard prevents this on save, but if anyone ever queries the DB and sees `cover_config: { enabled: true, image_url: null }`, that's a left-over from before the guard.

**SMS bounce mystery (not a Popcode bug)**: user reported getting "Undelivered Mail Returned to Sender" texts in Messages after using the Message share button. Source was Verizon's MMS-to-email gateway (`twbgohaavzwvmta-c-rh-cmta-01-mms-00.vtext.com`) trying to deliver to `curtmid@gmail.com` and being rejected by Gmail spam (550-5.7.1). Cause: the user (or iOS) picked the email address `curtmid@gmail.com` as the message recipient instead of a phone number, so Verizon converted the SMS to email-via-MMS-gateway, and Gmail blocked it. Nothing for us to fix — it's a recipient-routing thing in iOS Messages. Bounces should taper off in a day or two as Verizon's queue gives up.

**iMessage link preview discrepancy (also not a bug)**: user noticed the Popcode logo card preview shows up on Mac Messages but is blank/gray on iPhone Messages for green (SMS) bubbles. Explanation: Mac Messages does its own URL fetch + OG-tag render via WebKit even for green bubbles, so it always unfurls. iPhone Messages does NOT auto-render link previews for SMS bubbles (only iMessage). This is iOS behavior, not a code issue — the OG tags in `view.html:8-12` are correct (since desktop unfurls them).

**The follow-on the user explicitly tabled**: per-slug **dynamic OG image** so a Mission to Ghana iMessage preview shows the Ghana photo instead of the generic gradient Popcode logo. Implementation sketch when we pick this up:
- Add a Vercel serverless function or rewrite that intercepts `popcode.app/{slug}` requests with the `User-Agent` of a link-preview crawler (Apple-Messages, facebookexternalhit, Twitterbot, Slackbot, etc.) OR for ALL `/{slug}` requests, server-render the HTML with `og:image` set to `cover_config.image_url` when present, falling back to `og_image.png` when not.
- Cleanest: a thin Next-style edge function or `vercel.json` rewrite that fetches the cover_config from Supabase server-side and injects the right meta tag before sending the HTML. Static `view.html` can't do this because the meta tags are read from the initial HTML response — JS-injected `<meta>` tags don't get picked up by link-preview crawlers (they don't run JS).
- Alternative without a function: pre-generate per-slug HTML files at build time. Won't work because slugs are user-created at runtime, not build time.
- Same fix would also benefit Slack/Discord/iMessage/WhatsApp/Twitter/Facebook unfurling — currently all see the same generic Popcode card.

**Other follow-ons still queued (from earlier 2026-04-29 entry):**
- Mockup 2 ("Have a code? Enter it here.") on `index.html` root — small input + Go button that routes to `/{code}`. Still pending.
- Per-account branding (a `white_label_profiles` table) when going beyond demo.
- Font picker (curated Google Fonts dropdown).
- "Preview on device" button in editor.

**Lessons / things future-Claude should not relearn:**
- **`object-fit: cover` + `object-position: center`** crops the top of the image. Anchor to `top center` for any layout where the top of the source image is meaningful (logos, decorative borders, faces near the top). The user immediately noticed when it was wrong.
- **The "save succeeds, viewer falls back to default" failure mode** for jsonb config columns is sneakier than a hard error. Always guard at save time when there are AND-conditions on the render side.
- **"X pt"** in this user's vocabulary = **`px`** in CSS. They said 122pt and 112pt; we set those literal numbers as `font-size: 122px` and it matched what they wanted. Don't try to convert pt→px (1.333× multiplier) when chatting with this user.
- **Don't over-narrate iterative styling work** — quick edit, push, ask "look right?" and tweak. The user iterated 3× on the Tap to scan button (size, color, narrower) and the cycle was tight. Each round = one Edit + one push.
- **iOS Messages link preview** is rendered by the displaying device, not the sending device. Mac Messages and iPhone Messages can show the same conversation completely differently. Not something to debug as a server-side issue.
- **Push to prod was authorized** for this branch — "not able to preview, just push to prod and we can tweak." This was a one-shot authorization for the white-label feature. Going forward, do NOT take that as standing approval to skip preview/PR for other branches; ask each time.

### 2026-06-06 — Vendored MindAR 1.2.2 (dependency ownership)

**Branch: `claude/upbeat-mendel-YhE4V`. No PR opened (task didn't ask for one). Changes pushed to the branch.**

Scope was deliberately the **high-priority, low-effort half** of the MindAR brief: *own the dependency* (vendor it locally so a CDN change or upstream/iOS/Chrome regression can't strand the scan flow). The brief explicitly de-prioritized the second half (patching the `stop()`/`start()` lifecycle bug at source) — it has a working prod workaround and patching someone else's CV library is open-ended. **Left the workaround untouched.**

**Step 0 — state of the world before this session (verified against repo):**
- MindAR was **NOT vendored** — all three consumers loaded it from `cdn.jsdelivr.net/npm/mind-ar@1.2.2/...`: `create.html:29`, `edit.html:32`, `view.html:20`.
- The archival fork `curtmid/mind-ar-js` **does NOT exist** (GitHub returns 404). Still needs creating by the user — see "Fork still TODO" below.
- A-Frame **still CDN** (`aframe.io/releases/1.4.2/aframe.min.js`, view.html:19). Lower-priority follow-up, not done.
- Rescan workaround **still in place** in `view.html`: `buildScene()` ~line 554 + `handleStartTap()` ~line 653 (tear down a-scene, 500ms delay, wait for A-Frame `loaded` event, then `mindar.start()`). The `sceneWasStopped` flag is set by the iOS-16 media-session `mindar.stop()` calls at view.html:821 (video) and :875 (audio). All intact.

**What shipped (in git):**
- `public/vendor/mindar/1.2.2/mindar-image-aframe.prod.js` — the vendored build. **sha256 `db00b657…3032`**, 1,733,822 bytes.
- `public/vendor/mindar/1.2.2/PROVENANCE.md` — full provenance + rebuild/upgrade/rollback runbook + integrity hashes + the fork-build procedure.
- `create.html` / `edit.html` / `view.html` — `<script src>` swapped from the CDN URL to `/vendor/mindar/1.2.2/mindar-image-aframe.prod.js` (absolute path; Vercel serves `public/` as web root, so it maps to the vendored file — same convention as `/assets/…`, `/config.js`).

**How the file was obtained / why it's trustworthy:**
- The CDNs (jsdelivr, unpkg) **return 403 from this sandbox's egress** — but `registry.npmjs.org` is allowed, and it's the authoritative source the CDNs merely mirror. Pulled `mind-ar-1.2.2.tgz` from npm; its sha512 matched npm's published integrity (`sha512-bp3FOKpG…K7FA==`) exactly. Extracted `dist/mindar-image-aframe.prod.js` byte-for-byte.
- Confirmed the bundle is **self-contained**: Web Workers are inlined as `data:application/javascript;base64` URIs, no runtime CDN/wasm/`importScripts` fetches. The only http(s) strings in it are license/docstring comments. So this one file fully replaces the CDN — nothing else to vendor for the runtime.
- **Pinned upstream commit: `1ad668d0ba2c0cb9f57a208eede73ea43abf4972`** (npm `gitHead` for 1.2.2). Upstream is now at 1.2.5 — we are intentionally staying on 1.2.2.
- Smoke-tested locally with `python3 -m http.server` over `public/`: `/vendor/mindar/1.2.2/mindar-image-aframe.prod.js` → 200, 1,733,822 bytes, `text/javascript`; view.html serves and its script tag points at the local path. **Not yet tested on real iOS hardware** — should be sanity-checked on an iPhone after deploy (the bytes are identical to the CDN's, so risk is low, but the scan flow's worst bugs are iOS-Safari-specific).

**Fork still TODO (couldn't do from here):** the brief wants a patchable fork at `curtmid/mind-ar-js`. I can't create it from this sandbox — GitHub MCP scope is restricted to `curtmiddleton/popcode-demo`, and it's a different account anyway. The vendored file IS the shipping artifact and is the thing that actually protects prod; the fork only matters when we need to *patch* MindAR. PROVENANCE.md documents the full fork-and-build procedure for when the user creates it. **Action for user:** fork `hiukim/mind-ar-js` → `curtmid/mind-ar-js`, then `git checkout 1ad668d` to pin it to our exact source.

**Explicitly NOT done (and why):**
- The `stop()`/`start()` source fix — de-prioritized by the brief; workaround works; needs real-iPhone iteration I can't do in a sandbox.
- Removing/simplifying the rescan workaround — depends on the source fix, which we didn't pursue. iOS-16 media-session handling left fully intact.

**Follow-up done same session (A-Frame vendored too):** after the user approved it, also vendored A-Frame 1.4.2 the same way — `public/vendor/aframe/1.4.2/aframe.min.js`, pinned to commit `8692d8a`, integrity-verified from the npm tarball, view.html points at the local copy. PROVENANCE.md notes that A-Frame's min.js *does* reference a few remote URLs (VR cardboard DB, the inspector via unpkg, Draco glTF decoders, Google Fonts) — but all are optional features Popcode never triggers, so the scan flow makes no external A-Frame calls. view.html now loads **zero** AR libraries from a CDN. A PR was opened this session at the user's request.

**Lesson for future-Claude:** when a CDN is 403 from the sandbox, don't assume the dep is unreachable — `registry.npmjs.org/<pkg>/-/<pkg>-<ver>.tgz` is usually allowed and is the canonical source (CDNs mirror it). Verify the tarball against npm's published `integrity` sha512 and you've got a provably-authentic copy without trusting any CDN.


### 2026-06-10 — Patched MindAR: the stop()/start() source fix (the second half of the brief)

**Branch: `claude/upbeat-mendel-YhE4V` (same as the vendoring work, now PR #48). Not yet hardware-verified.**

The brief de-prioritized the `stop()`/`start()` source fix — but the user then confirmed it's **visibly hurting them** ("create a new Popcode, sometimes have to restart the scanner and bounce to the home screen, works the second time"), which is exactly the trigger the brief named for pursuing it. So we did. It turned out to be a small, well-understood bug, **not** the open-ended CV rabbit hole that was feared.

**Root cause (in `src/image-target/aframe.js`):** `mindar-image-target`'s `updateWorldMatrix` only emits `targetFound` on a *not-visible → visible* transition (`if (!object3D.visible && worldMatrix !== null) emit('targetFound')`). Popcode calls `mindar.stop()` the instant a photo is found (to release the camera before video playback — the iOS-16 media-session fix), so the anchor's `object3D.visible` is left `true`. The system's `stop()` tears down camera/video/controller but **never resets that flag**. On the next `start()`, the same photo is re-detected, `!visible` is now `false`, and `targetFound` is permanently suppressed — recognition silently "works" but the event Popcode listens on never fires. This is the whole reason the historical workaround had to rebuild the entire A-Frame scene (fresh entities start invisible) instead of a clean `stop()`/`start()`.

**The fix:** ~4 lines at the top of `start()` that reset every anchor's `object3D.visible = false` (and matrix to `invisibleMatrix`) so the transition can re-fire. No computer-vision code touched. It's a no-op on first scan (anchors already invisible), so it can't regress the normal flow.

**How it was built (reproducible — full runbook in the patched dir's PROVENANCE.md):**
- GitHub IS reachable from the sandbox (`codeload.github.com` tarball at the pinned commit `1ad668d` worked; jsdelivr/unpkg are 403 but github/npm are fine).
- `npm install` fails on the `canvas` native dep (needs Cairo, node-gyp errors) — but `canvas` is node-only (offline compiler), never in the browser bundle. **`npm install --ignore-scripts` then `npm run build`** (vite 4) produces `dist/mindar-image-aframe.prod.js` cleanly in ~9s.
- Verified the patch landed in the minified bundle by property-name counts (`invisibleMatrix` 3→5, `anchorEntities` 8→10, `visible=!1` 1→2) and that `start()` now opens with the anchor-reset loop. Byte delta is exactly +191 vs stock; nothing else changed.

**What shipped (in git, on the branch / PR #48):**
- `public/vendor/mindar/1.2.2-popcode.1/` — patched build (**sha256 `2470e4fb…fea3`**, 1,734,013 bytes) + `PROVENANCE.md` + `stop-start-fix.patch` (the source diff) + `LICENSE`. The pristine `1.2.2/` dir is kept untouched as the audited baseline.
- `public/view.html` — now loads the **patched** build (safe as default; the reset is a no-op until a stop/start happens). create.html / edit.html stay on pristine 1.2.2 (compiler only, patch irrelevant).
- `public/view.html` — clean `stop()`/`start()` rescan path added in `handleStartTap`, **gated behind `?rescan=clean`** (`CLEAN_RESCAN` const). Default is still the proven scene-rebuild workaround. When the flag is on, rescan just calls `mindar.start()` — no scene teardown, no 500ms delay, no `loaded`-event wait.

**Why flag-gated and not default:** I can't test on a real iPhone from the sandbox, and the scan flow's worst bugs are iOS-Safari-specific. The brief explicitly says keep the workaround as a fallback until the fix is confirmed on hardware. So this is opt-in for now.

**HOW THE USER TESTS (next action):** open a scanned project on a real iPhone with `?rescan=clean` appended (e.g. `popcode.app/{slug}?rescan=clean`, or the PR-preview equivalent). Scan a photo → play & close its video → scan again. It should restart recognition **without** bouncing to the home screen or rebuilding the scene. Test on a modern iPhone and, if available, an iPhone XR / iOS 16. If solid, **flip the default** (drop the `CLEAN_RESCAN` gate and delete the rebuild branch in `handleStartTap`) — but do NOT touch the iOS-16 `mindar.stop()`-before-playback calls (separate, still-needed fix).

**Caveat on the user's specific symptom:** their wording sounds like it might be *first-scan* flakiness on a freshly created project, which could be a different cause (a start()/A-Frame-system-registration race) than the stop/start bug this fixes. If the friction persists on the very first scan after this lands, get the exact repro steps and chase that separately.

**Worth upstreaming:** the patch is generic (`hiukim/mind-ar-js`) once hardware-verified — fixes stop/start for everyone. First real use of the fork to *patch* rather than just mirror.

**UPDATE (same day, after hardware confirmation):** User tested `?rescan=clean` on a real iPhone by creating a brand-new Popcode — worked beautifully, including the first-scan case they were worried about. So we **flipped the clean path to the default** and **merged PR #48 to prod**. Implementation now in `handleStartTap` (view.html): clean `mindar.start()` is the default, with an **automatic fallback** to the scene-rebuild path if the camera fails to re-acquire (listens for `arError`; `cleanRescanActive` guard stops `buildScene`'s arError handler from flashing the error screen during the attempt; 8s safety timeout clears the guard). `?rescan=legacy` forces the old rebuild path as a debug/escape hatch. The old workaround is therefore **kept as a live fallback, not deleted** — revisit deleting it only after it's run as default across real users and ideally an iPhone XR / iOS 16 check. iOS-16 `mindar.stop()`-before-playback calls still untouched. Next: test on an older device when one's available; consider upstreaming the patch to `hiukim/mind-ar-js`.

### 2026-06-10 (known issue) — iPhone XR / A12: video freezes on frame 1 (first play), recovers on refresh

**Status: KNOWN ISSUE, not blocking. Logged for a future polish pass. No code change yet.**

After PR #49 shipped the MindAR stop/start fix, hardware testing showed:
- **iPhone 17 (modern):** clean scanning + rescan, works great.
- **iPhone XR (A12, ~2018):** the photo *scans* fine, but the linked video **freezes on the first frame** on first play. **Refreshing the page makes it work.** Intermittent.

**This is NOT a regression from the rescan work** — the freeze is on the *first* video play, and `triggerVideo`'s stop-before-play code (view.html ~line 821) was untouched. It's the **same iOS-16 / A12 media-session conflict** documented in the 2026-04-12 notes (PR #14): on old Safari, `getUserMedia` (MindAR camera) and `<video>` playback can't share the media session, so the camera must be stopped before `fullVid.play()`. That fix is in place, but on a slow A12 the camera doesn't always release in time before `play()` fires → occasional frame-1 freeze, which a refresh clears once state settles.

**Decision (with user):** don't invest now. iPhone XR is ~7–8 yrs old, share is small/shrinking, it's the worst-case device for this quirk, and the experience is *degraded, not broken* (scans fine, recovers on refresh). Popcode has zero paying customers; Liftworks is the revenue priority. **The trigger to actually fix this = an imminent demo on phones we don't control** (a frozen video is an ugly first impression for a "point and it plays" product).

**Queued follow-up when it's worth it (time-boxed, ~30 min, needs a real XR to verify — none in sandbox):**
1. **"Tap to play" graceful degradation (preferred).** Detect the frozen-frame case (video element reports `playing` but `currentTime` isn't advancing after N ms) and surface a **"Tap to play"** button instead of a dead frame. Turns "looks broken" into one tap, and helps *any* device that ever hits an autoplay/media-session hiccup — not just the XR.
2. **Alternative / complementary:** add a short settle delay between `mindar.stop()` and `fullVid.play()` in `triggerVideo` (mirror the 500ms rescan trick) to give the A12 time to release the media session before playback starts.

Do NOT remove the existing iOS-16 `mindar.stop()`-before-playback calls while doing this — that's the load-bearing part of the current fix.

**UPDATE 2026-06-10 (later) — fix implemented (Tap-to-play), pending hardware verification.** User hit the freeze on a real 9-page board book: the *first* scan triggered but froze on frame 1; reload fixed it and the other 8 were perfect. First scan = most important, so we built the queued fix in `view.html` (NOT yet merged — on branch `claude/upbeat-mendel-YhE4V` for device testing first):
- `triggerVideo` now waits **250ms after `mindar.stop()`** before play (settle delay, lets iOS release the camera's media session), then calls new `startVideoPlayback()`.
- **Frozen-frame watchdog** `armFrozenFrameWatch()`: 1200ms after play, if the element is `!paused && !ended && readyState>=2` but `currentTime` hasn't advanced, it's the media-session freeze → reveal a **`#tap-to-play`** overlay button. Tapping it plays in a user gesture (which reliably grabs the session) — one tap instead of a full page reload.
- Conservative checks (readyState + not-advancing) mean working devices (iPhone 17) never see the button — verify this in testing (no false positives). Also wired `play().catch()` → showTapToPlay, and `hideTapToPlay()` on close/ended.
- Audio path left unchanged (scope = video). iOS-16 `mindar.stop()`-before-playback calls untouched.
- **TEST:** board book on iPhone XR (does the first-scan freeze now self-rescue / show Tap to play?) AND iPhone 17 (regression: video still autoplays, Tap-to-play never wrongly appears). If good, merge to prod. If the button shows on healthy playback, loosen the watchdog threshold.

### 2026-06-12 — Single-handle identification system: Phases 0–2 built, working, validated

**Branch: `claude/lucid-archimedes-n1hymd`. No PR yet (staged feature work). All on the branch.** This is the start of the big "one handle per creator" rebuild from the build brief (`popcodeidentificationbuildbrief.md`): replace per-asset slugs with `popcode.app/{handle}`, split **identification** (server, whole library, scoped by creator) from **tracking** (on-device, one collection's `.mind`). Got Phases 0, 1, and 2 done and **validated end-to-end with real data + a real printed photo.** Phases 3–5 (scan frontend, shadow mode, cutover) still ahead.

**Golden rule being followed:** everything additive + in an isolated Supabase **branch** called `identification`. Zero production tables touched. Prod Popcode keeps working untouched.

#### The Supabase branch (important — it's a separate DB)
- Branch name: **`identification`** (PREVIEW). Its own Postgres + Storage, created from prod schema. **Data is NOT copied** — branch starts schema-only (this bit us; see below).
- Branch Project URL: **`https://uvnnhnbttfbycsgxfxzn.supabase.co`** (prod is `mrwpkhsluzokytpvmwqk` — totally different ref; don't mix them up).
- Branch is **MICRO compute, costs extra**, and the org showed an "EXCEEDING USAGE LIMITS" pill (Spend Cap is ON, so it'll pause not charge). **Delete the branch when Phases 0–5 testing is done** to stop the cost.

#### Phase 0 (done) — schema scaffold
Migrations added to repo (operator runs them in the branch SQL editor; Claude never runs DB writes):
- `supabase/migrations/2026-06-12-phase0-identification.sql` — `creators`, `pop_images`, `identify_events` + RLS (pop_images/identify_events are server-only, no anon policy). **`identify_events` is the brief's "scan_events" RENAMED** — prod already has a `scan_events` analytics table; reusing the name would collide.
- `pop-targets` Storage bucket (separate from `experiences`) for the new per-collection `.mind` files.
- Vercel env `USE_NEW_IDENTIFICATION=false` (kill switch, nothing reads it yet; set non-sensitive).
- **Locked decisions:** new `creators` table (maps `user_id`→auth.users + unique `handle`); embedding model below; threshold below.

#### Phase 1 (done) — creation/ingest pipeline
- `lib/identification/embed.mjs` — CLIP embedding via **Replicate**. `embedImageFromUrl(url)`. Shared by seed + endpoint so index/query vectors match.
- `lib/identification/provider.mjs` — `ReplicateClipProvider` implementing the brief's pluggable `IdentificationProvider` (embed + pgvector search). Default threshold **0.60**.
- `scripts/seed-identification.mjs` — backfills ONE collection by slug. Reads source collection **read-only from prod** (anon), writes new-index rows to the **branch** (service role). Upserts `creators` + `collections` (FK target) + copies `.mind` to pop-targets + embeds each photo → `pop_images`. **Resumable** (skip target_refs already present; `--fresh` to wipe), skip-on-error, upsert on `(collection_id, target_ref)`.
- `scripts/README-identification.md` — run instructions.
- **Seeded project: slug `9xyx1ryb` = "Max - Chapter One", as creator `@Curt`.** 21 unique pages (the project has 78 `collection_items` rows but lots are DUPLICATE target_index — known prod data issue; deduped to 21). One page (`photo_15.jpeg`) is a broken/missing image in prod storage (Replicate 400) — skipped, not fatal.

**Embedding model reality:** brief said CLIP ViT-B/32 (512-dim) but the chosen Replicate model **`krthr/clip-embeddings` returns 768-dim** (ViT-L/14-class, the brief's higher-accuracy option). So **`pop_images.embedding` is `vector(768)`**, EMBEDDING_DIM=768. Migration `2026-06-12-phase0b-embedding-768.sql` retypes the column; `2026-06-12-phase1-dedupe-pop-images.sql` dedupes + adds unique `(collection_id, target_ref)`.

#### Phase 2 (done + VALIDATED) — `/api/identify`
- `supabase/migrations/2026-06-12-phase2-identify-rpc.sql` — `identify_match(creator_id, embedding, limit)` RPC: scoped pgvector cosine search (`1 - (embedding <=> q)` = confidence), `where creator_id = $1` (the privacy wall, in SQL).
- `lib/identification/identify.mjs` — `identifyByHandle()`: handle→creator→match→payload (`.mind` URL by convention `pop-targets/{slug}/target.mind` + images list).
- `api/identify.js` — `POST /api/identify` Vercel function (thin wrapper). Reads `IDENTIFY_SUPABASE_URL`/`IDENTIFY_SUPABASE_SERVICE_KEY` (point at branch for testing, prod at cutover) + `REPLICATE_API_TOKEN` + optional `IDENTIFY_THRESHOLD`.
- `scripts/test-identify.mjs` — **no-deploy CLI test** against the branch. Shows raw top-K candidate scores.

**Validation results (real, on a real printed photo of Max page 0 — dad+baby on beach):**
- **Exact seeded image → 100%** confidence, correct page. Pipeline works.
- **Phone photo of the print** (bad sunset light, steep angle, shadow across it) → **correct page 0 at 69.3%**, clean 13-pt margin over the ~56% runner-up. CLIP global embeddings ARE good enough — no need to swap the matcher.
- **Stranger photo (different project)** → best 49.6%, all clustered 42–50%, no margin → correctly **rejected**.
- → **Threshold 0.60** sits cleanly between the ~50% noise floor and ~69% real matches. (Final value still gets tuned from Phase 4 shadow data.)

#### Hard-won gotchas (don't relearn these)
- **Supabase branch has schema but NOT data, and NOT auth.users rows.** FK from `creators`/`collections` → `auth.users(id)` fails for prod user ids that don't exist in the branch. Fix: seed with `user_id = null` (identity for identification is the handle/creator_id, not user_id). Set real user_id only at a prod cutover.
- **Replicate `/v1/models/{owner}/{name}/predictions` is OFFICIAL-models only** — community models (krthr/...) 404 there. Must resolve `latest_version` via `GET /v1/models/{owner}/{name}` then `POST /v1/predictions` with the version id (cached). `Prefer: wait` avoids polling.
- **Replicate throttles to ~6 req/min (burst 1) while account credit < $5.** Bought $10 → throttle lifts once it registers (can lag a few min via Cloudflare). Cost is pennies ($0.01 for ~15 embeds); the pain is the rate *limit*, not price. embed.mjs now backs off on 429. A real scan = ONE call, so throttle never affects the live product.
- **pgvector via PostgREST:** pass the embedding as the text form `'[0.1,0.2,...]'` (see `toPgVector`), supabase-js sends it through and PG casts to vector.
- **node_modules IS tracked in this repo** (odd, pre-existing, no .gitignore). `npm install @supabase/supabase-js` for the scripts adds untracked dirs + bumps package.json — the stop-hook flags untracked files. Keep install artifacts OUT of commits (revert package.json/lock, rm the new node_modules dirs) — the user `npm install`s locally to run scripts.
- **Terminal quoting hell on the user's iMac (zsh):** multi-line backslash pastes and quoted values kept leaving `quote>`/`dquote>` continuation prompts. Fix that worked: `export VAR=value` one per line with **no quotes** (the URL/JWT/`r8_` token/photo-URL values have no shell-special chars), then run the `node ...` line with the image URL **unquoted**. Ctrl+C to escape a stuck `quote>`.
- User runs everything on **`CURTs-iMac`** at `/Users/curtmiddleton/popcode-demo`. Had to `git fetch origin <branch> && git checkout <branch>` to get the new files (was on a different branch). Default terminal opens in `~`.

#### What the user did (operator steps, all confirmed working)
Created the branch; ran phase0 + phase0b + phase1-dedupe + phase2 SQL in the branch editor; created `pop-targets` bucket; added `USE_NEW_IDENTIFICATION=false` to Vercel; bought $10 Replicate credit (declined auto-reload, good for cost-control); seeded `9xyx1ryb` as `@Curt`; ran the identify tests.

#### NEXT: Phase 3 — scan frontend (the big one, NOT started)
Build `popcode.app/{handle}` camera screen as a **new `public/scan.html`** (keep prod `view.html` untouched). Flow: pre-framed permission → open plain getUserMedia → capture ONE low-res frame → `POST /api/identify {handle, frame}` → on match, **stop capture stream, 500ms release, build MindAR scene with the matched collection's `.mind`** (reuse view.html's `buildScene`/`triggerMedia`/rescan/tap-to-play machinery verbatim — those iOS media-session fixes are load-bearing) → track + play, audio-first → cache collection so same-book pages track locally with no further server calls → "Having trouble? Tap to play" fallback. Key insight: identify is a **one-time bootstrap** per book; once the collection's `.mind` is loaded, MindAR tracks all its pages on-device (the whole point of the split). Subsequent taps after a video close = view.html-style rescan (savedMindUrl already set, skip re-identify).
**Phase 3 can't be tested from a terminal** — needs a Vercel **preview deploy** (with `/api/identify` env pointed at the branch + Replicate token) + a **real phone** (camera/HTTPS/mobile Safari). Routing: for testing use `scan.html?handle=Curt`; add the pretty `/{handle}` Vercel rewrite at cutover (mind handle-vs-slug routing collision).
Then Phase 4 (shadow mode, log to `identify_events`, tune threshold from real scans) and Phase 5 (per-handle flip of `USE_NEW_IDENTIFICATION`).

### 2026-06-12 (later) — Phase 3 built + VALIDATED ON A REAL IPHONE 🎉

Continuation of the same-day identification work (branch `claude/lucid-archimedes-n1hymd`). **Phase 3 is done and the whole system works end-to-end on a real phone:** point camera at a printed "Max - Chapter One" photo → `/api/identify` figures out which page/book → loads that book's `.mind` → video plays locked on the photo, and other pages of the book then track on-device with no further server call. The brief's core thesis (split server-identification from on-device-tracking, scoped per creator) is now demonstrated.

**What shipped (on the branch):**
- `public/scan.html` — the `popcode.app/{handle}` camera experience. **Derived from `view.html`** (via `cp` + surgical edits) so ALL the iOS-hardened playback/rescan/tap-to-play/audio machinery is byte-identical; only the entry is new. Flow: start screen → tap → plain `getUserMedia` preview with a frame reticle → tap "Scan" → grab one 640px JPEG frame → `POST /api/identify {handle, frame}` → on match, `buildScene(mind_file_url, mediaMap)` (autoStart:false) → **tap "Tap to bring it to life"** → `mindar.start()` → track + play. **Two taps on purpose:** iOS requires `getUserMedia` inside a user gesture, and we open the camera twice (capture frame, then MindAR), so the second open is gated behind a tap. Identify is a one-time bootstrap per book; later rescans (savedMindUrl set) reuse view.html's rescan path with no server call.
- `api/identify.js` — `POST /api/identify` Vercel function. Reads `IDENTIFY_SUPABASE_URL` / `IDENTIFY_SUPABASE_SERVICE_KEY` (point at branch for testing) + `REPLICATE_API_TOKEN` + optional `IDENTIFY_THRESHOLD`.
- `scripts/README-identification.md` — added Phase 3 + deploy/test section.

**THREE bugs hit on the way (all fixed — don't relearn):**
1. **`ERR_REQUIRE_ESM` on `/api/identify` (500).** Vercel bundles `api/*.js` as **CommonJS**, so a *static* `import` of our ESM `lib/identification/*.mjs` became a `require()` of an ES module → crash. Fix: load it via **dynamic `import()` inside the handler** (`const { identifyByHandle } = await import('../lib/identification/identify.mjs')`). The runtime error literally recommends this. (The npm `import { createClient }` static import is fine — only local `.mjs` imports break.) This is THE pattern for any future api function that needs the lib.
2. **TDZ: "Cannot access uninitialized variable" → blank/black scan page.** My `bootstrap()` ran synchronously at parse time and called `showStartScreen()`, which reads `coverConfig` — a `let` declared *later* in the script. `view.html` dodged this because its loader was `async` and `await`ed a DB call first (letting the rest of the script finish). Fix: **defer the bootstrap dispatch to `DOMContentLoaded`**. Lesson: when porting from view.html, anything that runs synchronously at top level can hit TDZ on `let/const` declared further down.
3. **Camera/identify returned "no match" for everything** — was actually masking bug #1 (my client shows the same nomatch screen on a fetch error as on a real low-confidence result). Once the 500 was fixed, real matches came through.

**Vercel testing gotchas (for next time):**
- **Preview deployments are private by default** (Vercel Authentication / Deployment Protection). The phone showed blank until the user turned it OFF (Settings → Deployment Protection). **Re-enable it after testing** — preview URLs are public while off. (Reminded the user.)
- **Redeploy the BRANCH preview, not prod.** User accidentally redeployed `main`/Production first (harmless — prod has none of this branch's code). The branch's row in Deployments → Preview is the one.
- Env vars added to **Preview** scope apply to the next branch build automatically (no manual redeploy needed if you push after adding them).
- Every push = a new `…-<hash>-…vercel.app` URL. Use the **stable `popcode-demo-git-<branch>-…` alias** (in the deployment's Domains list) to stop chasing hashes.
- Test URL during dev: `<preview>/scan.html?handle=Curt` (the pretty `/{handle}` rewrite is a Phase 5 thing).
- "Turn phone upright to scan" overlay shows on the **Mac** because `#orientation-lock` triggers in landscape — not a bug; test on the phone in portrait.

**Env vars set in Vercel (Preview scope):** `IDENTIFY_SUPABASE_URL` = branch URL, `IDENTIFY_SUPABASE_SERVICE_KEY` = branch service_role, `REPLICATE_API_TOKEN`. (Production scope deliberately NOT set — keeps the new endpoint off prod.)

**v1 limitations / follow-ups:** video-only (pop_images has no audio/transcript columns yet); analytics no-op'd on scan.html (don't write to prod scan_events from a branch test); `?handle=` query param routing (pretty `/{handle}` deferred to cutover). Re-enable Vercel Deployment Protection; delete the Supabase branch when done iterating.

**NEXT: Phase 4** — shadow mode: on real (legacy) scans, also run the new identify silently and log both + agreement to `identify_events`; collect a few hundred; tune the 0.60 threshold from real data. Then **Phase 5** — per-handle flip of `USE_NEW_IDENTIFICATION`, pretty `/{handle}` Vercel rewrite, audio support.

### 2026-06-13 — Phase 4 (shadow logging + threshold tuning) done & validated; cross-book accuracy proven

Branch `claude/lucid-archimedes-n1hymd` (same identification feature). Phase 4 built, deployed to the preview, and validated with ~17 real phone scans across TWO books. Threshold locked at **0.60**, now evidence-backed. Cross-book routing proven. Ready for Phase 5 (cutover) — which is the first phase that touches prod, so it needs deliberate decisions (see end).

**What shipped (Phase 4):**
- `supabase/migrations/2026-06-13-phase4-identify-events-cols.sql` — additive columns on `identify_events`: `handle`, `reason`, `matched_target_ref`, `tracked_target_ref`, `runner_up_confidence`, `threshold`. (Operator ran it in the branch.)
- `lib/identification/provider.mjs` — added `search()` (raw top-K, no threshold); `identify()` now wraps it.
- `lib/identification/identify.mjs` — logs every call to `identify_events` (top-1 + runner-up scores + threshold + chosen page), best-effort (never blocks identify), returns an `event_id`.
- `api/identify-feedback.js` — NEW endpoint. scan.html reports which page MindAR actually locked (`tracked_target_ref`); sets `agreed` = did identify's page guess match what MindAR tracked. The real accuracy signal, no prod changes / no labeled data.
- `public/scan.html` — stores `event_id` from identify, fires `/api/identify-feedback` on the first `targetFound` (fire-and-forget, keepalive).
- README — threshold-tuning queries.

**Why this instead of the brief's literal shadow-on-legacy:** legacy `view.html` runs on prod; the new index is branch-only with one project seeded; prod has ~no traffic; view.html is fragile. So we instrument the NEW path to measure itself as it's used. Same intent (tune threshold from real data), feasible now.

**Second book seeded for cross-book test:** `egrbne2j` = "Addie Chapter One", 22 unique pages, under the SAME creator `@Curt` (creator_id `53ada50d-4aad-4eed-8aca-2eaf6b25817d`). Max = collection `a87f5275-fca1-4623-93e6-6ff96744e03d`; Addie = collection `7575d5c5-b278-4d5e-833c-38943c927b88`. `@Curt` library is now 43 pop_images rows across 2 collections. (Seeded from the **MBP** this time — had to `git fetch origin <branch> && git checkout <branch>` + `npm install` since that machine was on a different branch with no scripts/.)

**Real-data threshold results (~17 scans):**
- agreed=true (correct page, MindAR-confirmed): **0.665–0.723**
- agreed=false (matched & loaded the RIGHT BOOK, but identify's page guess ≠ the page MindAR tracked): **0.620–0.629**
- agreed=null (rejected, below 0.60 — these were UNRELATED/other-project images): **0.508–0.595**
- → real pages **≥0.62**, noise **≤0.595**, **0.60 sits cleanly in the gap.** Placeholder validated.

**Cross-book test result (the key one):** every Addie scan → Addie collection (7575d5c5); every Max scan → Max collection (a87f5275); zero wrong-book matches. With 2 books in one creator's library, identify routes each scan to the correct book. The privacy/accuracy premise holds at multi-book scale.

**KEY INTERPRETATION (the confidence number is NOT an accuracy %):** it's **cosine similarity** between CLIP embeddings, read RELATIVELY. Scale for CLIP image↔image: ~1.0 = exact same digital file (our first test hit 1.00); **0.62–0.75 = same photo via a real print+camera capture (a STRONG match)**; ~0.45–0.55 = unrelated real images (the floor — never ~0). So 0.62 "looks low" only if you mistake it for a grade. The actual accuracy = "did the top match point to the right book, above threshold" = **100% across all tests**. What matters is the SEPARATION between match and noise bands, not the absolute value.

**Honest caveat:** the gap is clean but NARROW (lowest match 0.620 vs highest noise 0.595 ≈ 0.025). Worked perfectly so far, but watch it as the library grows (more candidates can nudge the noise floor up). Levers if margin degrades: better capture UX (closer/steadier/fill-frame raises real-match scores) or swap in a stronger matcher (that's exactly why `IdentificationProvider` is pluggable).

**Phase 4 cost note:** Replicate credit was registered by now → embeddings fast, no throttle.

#### NEXT: Phase 5 — measured cutover (FIRST phase that touches prod; do deliberately)
Still all on the branch; prod untouched until we merge to main. The cutover involves real decisions that were NOT yet made (flagged for the next working session):
1. **Handle routing.** Today `vercel.json` rewrites `/:slug([a-z0-9]{6,10})` → view.html. Bare `popcode.app/{handle}` (e.g. `/Curt`) needs a scheme that won't collide with legacy slugs. Options: a resolver (look up handle vs slug, route accordingly), or a distinct prefix (`/u/{handle}` or `/@{handle}`), or keep `?handle=` for now. NOT decided.
2. **Per-handle flag.** `USE_NEW_IDENTIFICATION` should be per-handle (e.g. a `new_identification_enabled` boolean on `creators`) so cutover is one creator at a time, legacy as fallback.
3. **Prod data migration.** pop_images/creators + embeddings + pop-targets `.mind` currently exist ONLY in the branch. Going live means seeding the same into PROD Supabase and pointing `/api/identify` env at prod (service key), not the branch.
4. **Audio support (still v1 gap).** pop_images has no audio_url/media_type/transcript, so audio-first projects don't play via the new path yet. Additive: extend pop_images + seed + identify response + scan.html playback. Max & Addie are video so it didn't block testing.

Recommended Phase 5 sequencing: build routing + per-handle flag + audio on the BRANCH (testable on preview, prod untouched), then do the deliberate prod go-live (seed prod, point env at prod, merge the vercel.json rewrite, flip the flag for @Curt) as a final explicit step. Don't flip prod without explicit go-ahead — routing changes are outward-facing.

**Housekeeping still pending:** re-enable Vercel Deployment Protection after testing (preview URLs public while off); delete the `identification` Supabase branch when done (MICRO compute cost).

### 2026-06-13 (later) — Phase 5 SHIPPED TO PROD: popcode.app/{handle} is live 🚀

Continuation of the same-day identification work. Phase 5 built on the branch, then **merged to `main` and live in production**. `popcode.app/Curt` now works on a real phone (identifies Max & Addie, plays video), and legacy `popcode.app/{slug}` is verified untouched. The whole build brief (Phases 0–5) is done and in prod.

**What shipped (branch work, all in `claude/lucid-archimedes-n1hymd`, then merged):**
- `vercel.json` — added `{ "source": "/:handle([A-Za-z][A-Za-z0-9_-]{0,29})", "destination": "/scan.html" }` AFTER the existing slug rewrite. Disambiguation by pattern + order: lowercase 6–10 chars = slug → view.html; anything else (mixed case / short / long) = handle → scan.html. Collision caveat: an all-lowercase 6–10 handle would be caught by the slug rule (pick handles that aren't that shape; `Curt` is fine). Extensionless page paths (`/create`) would route to scan.html, but real links use `.html` so it's moot.
- `creators.new_identification_enabled` (bool, default false) — per-handle cutover gate. `/api/identify` (in `identify.mjs`) returns `handle_not_enabled` unless true. Cutover one creator at a time; legacy is the untouched fallback.
- Audio support plumbed through (pop_images `media_type`/`audio_url`/`transcript`; seed, identify payload, scan.html mediaMap) — but UNTESTED (Max & Addie are video; needs an audio project).
- **Prod-safety fix in the seed (`0434fb6`):** when seeding prod (source==target), the script must NOT upsert the `collections` row (that would null the real owner's `user_id`). Now it inserts the FK row only if missing (branch case) and leaves existing rows (prod) untouched. CRITICAL — without this, prod collection ownership breaks.

**Bare-URL routing decision:** chose bare `popcode.app/{handle}` (not `/u/` prefix). Implemented as a static rewrite to scan.html (which reads the handle from `location.pathname`) + server-side flag enforcement in `/api/identify` — no dedicated resolver function, legacy slugs keep their fast static route.

**Prod go-live runbook (all done this session):**
1. Ran migrations in PROD Supabase (production selected, ref `mrwpkhsluzokytpvmwqk`): phase0, phase1-dedupe, phase2, phase4, phase5 (skipped phase0b — phase0 already creates `embedding vector(768)`). Verified 3 tables.
2. Created `pop-targets` bucket in prod (public).
3. Vercel **Production**-scope env vars → prod: `IDENTIFY_SUPABASE_URL=https://mrwpkhsluzokytpvmwqk.supabase.co`, `IDENTIFY_SUPABASE_SERVICE_KEY` = **prod** service_role (Sensitive), `REPLICATE_API_TOKEN`. (Preview-scope ones still point at the branch.)
4. Seeded both books into PROD (TARGET = prod URL + prod service key): `9xyx1ryb` (Max) + `egrbne2j` (Addie), `--handle Curt`. **Prod creator_id = `a995560f-d944-41f0-9f3b-5854ac169fb3`** (fresh row; different from the branch's `53ada50d…`). pop_images count in prod = **43**.
5. `update creators set new_identification_enabled = true where handle = 'Curt';` in prod.
6. Merged branch → `main` (`--no-ff`, merge commit `a653bf0`) and pushed. Clean merge — main had 2 unrelated commits touching only `public/create.html` (a parallel session's gutter fix); our branch is additive and doesn't touch create.html. No conflicts.
7. Verified live: `popcode.app/Curt` works on phone; `popcode.app/9xyx1ryb` still loads the old viewer.

**Go-live gotchas (don't relearn):**
- **Vercel env-var scope mixups are the #1 hazard.** A var's value differs per environment (Preview→branch URL `uvnnhnbttfbycsgxfxzn`, Production→prod URL `mrwpkhsluzokytpvmwqk`). The user nearly saved the **branch** service key into the Production slot. **A Supabase key's project ref is embedded in the JWT** — decode the middle segment (`"ref":"…"`) to verify which project a `service_role`/`anon` key belongs to. To grab the prod key: Supabase dashboard → switch the top-left branch dropdown from `identification` back to **production/main** → Project Settings → **API Keys → Legacy anon, service_role** → `service_role` secret. The Project URL on that page (`mrwpkhsluzokytpvmwqk…`) confirms you're on prod.
- **No manual redeploy needed before merge** — env var changes apply to the next build, and the merge-to-main IS that build.
- **Vercel "Sensitive" is one-way** — once saved sensitive, the toggle is locked (can't un-sensitive). Fine for keys.
- A separate pre-existing `SUPABASE_SERVICE_ROLE_KEY` (all envs, used by delete-account.js) shows "Needs Attention" because it's non-sensitive — pre-existing, not our concern; optionally mark Sensitive later, don't rotate mid-launch.

**Reversibility (told the user):** it's additive — legacy untouched, only `@Curt` flag-enabled. Roll back by flipping the flag off (`new_identification_enabled=false`) or reverting the merge commit.

**The UX question the user raised (next refinement, NOT done):** `/Curt` is currently a TWO-TAP flow (tap "Scan" → identify → tap "Tap to bring it to life" → track). User wants it to feel like the legacy scanner (one tap, point, play). Path to streamline ("Phase 6 / polish"):
1. Drop the "Scan" button → auto-capture a frame after a brief aim/steady.
2. Drop "Tap to bring it to life" → on modern iOS the 2nd camera open likely doesn't need a fresh gesture once permission's granted (gated for safety; test to confirm removable).
3. Fully seamless = patch the vendored MindAR to reuse ONE camera stream (capture the identify frame from MindAR's own feed) — one camera open total, like legacy. We have the fork setup for this.
**Unavoidable difference from legacy:** the FIRST photo always has a brief one-time "identifying…" server round-trip (a beat, not a tap) because `/Curt` doesn't know the book in advance; after that, all pages track instantly on-device like legacy.

**Known issue still open:** intermittent iOS video freeze on first play — and it hit an **iPhone 17** (modern!) in the scan flow, not just old devices. Likely because the scan flow opens the camera twice (capture + MindAR), stressing the media session more than legacy. Tap-to-play watchdog fired (good) but the tap itself failed once, recovered on retry. Optional hardening: bump the post-stop settle delay in scan.html's triggerVideo (currently 250ms) and make the Tap-to-play handler self-heal (retry the camera-release) instead of dropping to the scanner.

**HOUSEKEEPING NOW DUE (post-merge):**
- **Re-enable Vercel Deployment Protection** on previews (was turned OFF for phone testing — preview URLs are public while off).
- **Delete the `identification` Supabase branch** — it's merged/shipped; the branch keeps costing MICRO compute ("EXCEEDING USAGE LIMITS" pill). Prod now has all the tables/data, so the branch is no longer needed (keep it only if you want a staging env for the Phase 6 UX work).
- **`USE_NEW_IDENTIFICATION` Vercel env var** (the original Phase 0 kill-switch, default false) is now effectively superseded by the per-handle `creators.new_identification_enabled` flag. Nothing reads `USE_NEW_IDENTIFICATION`; can be removed or left.

**NEXT (optional, when wanted):** Phase 6 UX streamlining (above); audio-project support testing; the auto-re-identify-on-miss so switching books doesn't need a page reload (currently identify is a one-time bootstrap per page-load); per-account branding / more handles (flip `new_identification_enabled` per creator after seeding their books into prod).

### 2026-06-13 (later still) — Phase 6 UX streamlining (one-tap auto-scan) + cold-start diagnosis

Branch `claude/lucid-archimedes-n1hymd` (NOT merged — Phase 6 lives on the branch; prod stays on the merged 2-tap version from earlier today). Goal: make `popcode.app/{handle}` feel like the legacy scanner (tap once, point, it plays) instead of the 3-tap "Tap to Scan → Scan → Tap to bring it to life." Got the UX much closer, then hit a wall on first-scan latency that needs an embedding-backend change next session.

**What shipped on the branch (all in `public/scan.html` unless noted):**
- **Continuous auto-scan** (commit `38045f8`): on the single "Tap to Scan", open the camera and loop capture+identify (up to 10 attempts, ~every 0.9–1.4s) until a match, then **auto-start MindAR** (no "Scan"/"bring it to life" taps). Modern iOS reuses the granted camera permission for the 2nd (MindAR) open — **confirmed: video auto-starts on its own on iPhone 17**. Manual "Tap to bring it to life" kept ONLY as a fallback if auto-start can't acquire the camera (older iOS). "Scan now" button kept as an optional immediate trigger; no-match after max attempts → retry screen.
- **Capture screen restyled to match legacy** (`c39dc9a`): dropped the big framing box + "Scan now" prominence; now just fullscreen camera + a small bottom hint pill (same style as legacy `#scan-hint`). Feels continuous with the rest of the app.
- **Hardened frozen-frame recovery — "Part A"** (`04c5d90`): replaced the single-shot freeze check with a **poll** (catches stalls even if the video advanced a hair first); on a stall, **auto-retry playback once** (pause+`load()`+replay — clears the media-session freeze the same way a page reload did) before showing the rescue; the "Tap to play" button now `load()`s the element so the tap reliably replays. Result: the intermittent first-frame freeze went from "needs page reload" to **self-healing / one-tap** — user couldn't reproduce a stuck freeze after this.
- **Trimmed delays** (`20d80b3`): 900ms hold-to-confirm → 300ms in both video & audio paths (legacy uses the long hold to avoid firing on a glance; in the scan flow the user is already aiming, so it's pure lag). First-scan look delay 800→450ms, retries 1400→900ms, post-stop video settle 250→500ms (freeze mitigation).

**THE WALL — first-scan latency is Replicate cold-start (diagnosed, not yet fixed):**
- Symptom: ~5–6s from "Tap to Scan" to video on the **first** scan; **subsequent scans are fast (legacy-like)**. Classic cold-start signature.
- **It is NOT the <$5 burst-1 throttle** — user has $9.98 credit, usage $0.02. Latency only.
- Replicate spins the model down when idle and **cold-boots it (~5–15s) on the first call**. Inherent to its serverless model.
- **Pre-warm attempt FAILED and made it WORSE (~15s)** — fired `/api/identify-warm` (a throwaway embed) on page load to boot the model during aim time. On a cold model, the real scan call arrived mid-boot and Replicate spun a **second** cold instance for the concurrent call → paid the boot twice. **Reverted** (`2059a38`, deleted `api/identify-warm.js`). Lesson: a separate warm-up call is the wrong mechanism for Replicate cold-start.
- **B (single-stream MindAR patch) was investigated and SKIPPED**: the diagnosis showed the structural double-camera cost is only on the (already-fast) warm scans, so B wouldn't fix the first-scan complaint. Don't build it for speed; not worth the MindAR rebuild.

**Why this matters most for SINGLE-IMAGE experiences:** a greeting card / single print is *always* a first scan, so it always eats the cold-start. Making the first scan fast is essential, not optional.

#### NEXT SESSION: switch the embedding backend to kill cold-start (the real fix)
The `IdentificationProvider` abstraction was built for exactly this. Options:
- **Cloudflare Workers AI CLIP** (e.g. `@cf/openai/clip-vit-base-patch32`) — serverless, **no cold-start**, fast, ~free, no throttle. Best fit. 512-dim (ViT-B/32).
- **On-device** (transformers.js CLIP) — no network/cold-start/per-call cost; ~one-time model download (~40MB quantized).
- Either requires a **one-time re-index**: re-run `scripts/seed-identification.mjs` with the new model so `pop_images.embedding` is recomputed with the SAME model used at query time (current vectors are krthr/clip-embeddings 768-dim — a different model won't be comparable). Re-seed handles it; just point `lib/identification/embed.mjs` at the new provider, adjust `EMBEDDING_DIM`/`vector(N)` if the dim changes, and re-seed both books (prod + branch).
- After the backend swap, re-test first-scan speed on a real (cold) phone; if fast, the one-tap auto-scan flow is ready to **merge Phase 6 to prod** (same additive merge as before; prod currently on the 2-tap version).

**Other Phase 6 follow-ups noted:** the auto-scan loop fires multiple Replicate calls per scan (fine when warm/serverless-no-coldstart, but worth keeping call count low); occasional no-sound/freeze reports during the bad pre-warm run were likely calls queuing behind the cold boot — re-evaluate after the backend swap.

**STILL-PENDING HOUSEKEEPING (unchanged from earlier today):**
- Re-enable Vercel Deployment Protection on previews (turned OFF for phone testing — preview URLs public while off).
- Delete the `identification` Supabase branch (merged/shipped; costs MICRO compute). Prod has all tables/data.
- Phase 6 (one-tap auto-scan + hardened recovery + restyle) is **on the branch, NOT merged** — merge only after the cold-start backend fix is verified on a phone.

### 2026-06-22 — Sentry error monitoring added (errors-only), live in prod

**PR #51 merged to `main` (merge commit `2d7a7e3`). Branch: `claude/stoic-bardeen-d3bsud`. Verified end-to-end on preview AND production.**

Task was "add Sentry like we just did for Bashō (a Next.js 14 app)." **Popcode is NOT Next.js** — it's a no-build static site (`public/` served as-is, `vercel.json` `framework: null`, no build step) plus a few Vercel serverless functions in `api/`. So the entire Bashō `@sentry/nextjs` mechanism (`instrumentation.ts`, `global-error.tsx`, `withSentryConfig`, `experimental.instrumentationHook`) **does not apply**. Mirrored the *intent* (errors-only, no Replay, dev-silent, env-tagged) with the right tools for each half. **Always check the framework before copying another app's setup** — the prompt itself warned this.

**Sentry org/project (NEW, separate from the CMD-LLC org):** org `popcode-inc`, project **`popcode-web`** (platform "Browser JavaScript" → "Nope, Vanilla"; one project, one DSN serves BOTH browser + server). Project ID `4511610890485760`. Org ingest host `o4511610871611392.ingest.us.sentry.io`. The DSN is **public/send-only** (safe to commit + expose, like the Supabase anon key in `config.js`).

**What shipped (all errors-only: `tracesSampleRate: 0`, no Session Replay):**
- **Browser** — `public/sentry-init.js`: explicit `Sentry.init`, `environment` = production|preview|development derived from `window.location.hostname` (`*.vercel.app` = preview, localhost = development → `enabled:false`, else production). **DSN is HARDCODED in this file** (`https://659c1936…@o4511610871611392.ingest.us.sentry.io/4511610890485760`) because a no-build static site can't inline `NEXT_PUBLIC_*` env at runtime. Loaded via the `@sentry/browser` **CDN bundle** `https://browser.sentry-cdn.com/10.59.0/bundle.min.js` (the errors-only build — no tracing/replay) with **SRI** `sha384-V80tE+22zYqM17YuWTi3GmAl/uJSKuAi5ov4G1Y6Zyw9wvVwwv9zree5oYNbB5Rn` + `crossorigin`. Inserted into the `<head>` (right after the viewport meta) of **all 14 user-facing pages** (index, auth, view, scan, create, edit, manage, analytics, account, reset, views, howto, privacy, terms). Skipped scratch pages (marker-test, qr-test, mockup-a/b/c). Browser global handlers auto-capture uncaught errors + unhandled rejections — covers the historically-buggy view.html/scan.html AR paths.
- **Server** — `@sentry/node@^10` added to `package.json` deps. `api/_sentry.js` = shared init (errors-only, `environment` from `VERCEL_ENV`, `enabled: NODE_ENV==='production' && !!process.env.SENTRY_DSN` → reports on Vercel preview+prod, silent locally, no-op until DSN set). `Sentry.captureException(e)` + `await Sentry.flush(2000)` added to the swallowed `catch` blocks of `api/identify.js`, `api/identify-feedback.js`, `api/delete-account.js`, `api/log-event.js` (the analog of Bashō's payment/webhook paths). **Flush before returning** — serverless freezes after the response or events get dropped.
- **`.gitignore`** created (repo never had one): `node_modules` (going forward), `.env.sentry-build-plugin`, `.sentryclirc`, `.env*`, `.DS_Store`.

**Vercel env (set by user):** `SENTRY_DSN` = the DSN, scoped to **Production + Preview** (NOT sensitive — it's public; and Vercel's Sensitive toggle is one-way). That's the ONLY var needed. `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` from the Bashō plan are for build-time source-map upload via `withSentryConfig` — **no build step here, so they have no consumer; left unset.** HTML/JS is served unminified so browser stack traces are already readable. (If function source-maps are ever wanted, add a `sentry-cli` upload step — then those three matter.)

**Verification (temp route, now deleted):** `api/sentry-test.js` returned JSON diagnostics (`sdkInitialized`, `dsnConfigured`, `enabled`, `environment`, parsed `dsnTarget{host,projectId}`, boolean-only `envSeen`; `?throw=1` sent a server event). Confirmed on the **preview** deploy, then a **prod** browser test (`Sentry.captureException(new Error('popcode PROD test'))` in console on popcode.app) — both browser (POPCODE-WEB-2/3) and server (POPCODE-WEB-1) events landed in `popcode-web` tagged correctly preview/production. **Deleted `api/sentry-test.js`** before final merge (commit `12869fa`).

**Gotchas hit / lessons:**
- **Vercel env vars apply to the NEXT build, not existing deployments.** First `/api/sentry-test` on preview showed `envSeen.SENTRY_DSN:false` because the preview predated saving the var — a redeploy fixed it. (This is the recurring CLAUDE.md Vercel gotcha.)
- After saving the var to Production scope, Vercel popped a **"Redeploy" dialog targeting the current prod (`main`, pre-Sentry code)** — told user to **Cancel**: merging PR #51 is what triggers the prod build that has both the code AND the var. Don't redeploy stale code just to pick up an env var when a merge is imminent.
- `node_modules` IS partially tracked here (pre-existing accident). `npm install @sentry/node` added ~28 untracked dirs; kept them OUT of the commit (committed only `package.json` + `package-lock.json`; Vercel runs its own install at deploy) and added `node_modules` to the new `.gitignore` so future installs don't get flagged.
- `@sentry/node` static `import` is fine in the api functions (ships CJS; Vercel's CJS transpile of these ESM `.js` files require()s it OK) — unlike the `.mjs` lib files which must be dynamic-`import()`ed (the existing ERR_REQUIRE_ESM note in identify.js).
- An event ID return / `flushed:true` only proves the request LEFT the SDK — always confirm the issue actually appears in **Sentry → Issues** (and in the RIGHT project — check `dsnTarget.projectId`).

**Follow-ups (optional):** resolve the 3 test issues in Sentry; consider targeted `captureException` in specific browser silent-catch blocks (currently relying on global handlers); add `sentry-cli` source-map upload for the bundled functions if traces are hard to read.

### 2026-06-25 — AWS cancellation pre-flight: re-audited post-identification, FULLY CLEARED

**No code changes (CLAUDE.md session note only). Branch: `claude/nifty-ptolemy-7j2uzi`.** The user is finally closing the old AWS account and wanted dependency-certainty given how much new infra landed since the last audit (2026-04-17 evening). Re-ran the whole audit against the *current* architecture — clean across the board. **Verdict: safe to close the AWS account; nothing in the new Popcode (or its domains) depends on it.**

**What was re-checked this time (the 2026-04-17 audit predates ALL the identification + Sentry work, so it had to be redone):**
- **Codebase grep — zero AWS.** No `amazonaws.com` / `cloudfront.net` / S3 URLs / `route53` / `aws_access` / `AWS_SECRET` / `accessKeyId` / `AWS_REGION` anywhere in code. The only hits are inside CLAUDE.md itself (documenting the prior audit).
- **Every external endpoint the new code actually calls, and who bills it** (none = the user's AWS account):
  - Supabase `mrwpkhsluzokytpvmwqk.supabase.co` (DB/storage/auth) — billed by Supabase.
  - Replicate `api.replicate.com` (CLIP embeddings, `lib/identification/embed.mjs:13`) — billed by Replicate.
  - Sentry `…ingest.us.sentry.io` (`public/sentry-init.js`, project `popcode-web`) — billed by Sentry.
  - Vercel (hosting; `vercel.json` `framework:null`, static `public/` + `api/` functions) — billed by Vercel.
  - `package.json` deps are only `@sentry/node`, `@supabase/supabase-js`, `express` — **no `aws-sdk`**.
  - Key subtlety told to user: Supabase/Vercel/Replicate/Sentry *run on* AWS under the hood, but that's *their* AWS accounts on *their* invoices — closing the user's personal account has zero effect.
- **Route53 — the production-breaking risk — CONFIRMED CLEAR by the user in the AWS console:**
  - **Registered domains: "No domains to display."** Neither `popcode.app` nor `popcodeapp.com` is registered through AWS. (Domains are at Squarespace, matching all prior notes.)
  - **Hosted zones: "There are no hosted zones created for this account."**
  - So AWS has *zero* involvement in Popcode DNS/domains — closing the account can't break short URLs. This was the one item from the 2026-04-17 audit that was still unverified; it is now verified.
  - Aside: the AWS account is *named* "popcodeapp.com (account 938904815040)" in the console, but that's just a label — no actual domain is registered in it.

**Still nominally open but NOT blockers:**
- `~/.aws/credentials` on the **iMac** — never checked (MBP was clean in 2026-04-17). Pure tidiness: `ls -la ~/.aws/`; if keys exist, `rm -rf ~/.aws` (they die on account closure anyway). Doesn't affect production.
- Old S3 video data: per the grep no live short URL references S3, so nothing live needs it — but grab any old data worth keeping before closing.

**How-to-cancel given to the user (close the whole account):** root-user login required (not IAM) → top-right account name → **Account** → scroll to **Close Account** at the bottom → tick the acknowledgements → **Close Account**. Recommended pre-flight: glance at **Billing → Cost Explorer → Group by Service** first to see what's actually running (this account historically carried *non-Popcode* charges from prior unrelated work — make sure nothing in there is still wanted). **90-day grace period** after closure allows reactivation if something surfaces.

**Lesson reaffirmed:** when a user closes a cloud account, the Route53 *registered-domain* check is THE one that can silently break prod — check it first, in the console, don't infer from `whois`. Everything else is money/tidiness. This time it was clean, so the close is low-risk.
