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

