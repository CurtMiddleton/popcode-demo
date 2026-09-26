# Popcode — Status

Where the project stands, and the running session history. Read the **Current
state** section first, then the most recent Session history entries at the
bottom. `CLAUDE.md` holds the standing rules and context; this file holds what
happened and what's open. (Session history moved here from CLAUDE.md on
2026-09-24 — entries are unchanged, oldest first.)

## Current state (updated 2026-09-26)

**Live and recent**
- `popcode.app/nonprofits` — the Popcode for Nonprofits page. Not linked from the
  home page, **on purpose**: the user sends people there directly and wants the
  home page to stay about the consumer product (a home-page panel was built and
  held back — closed PR #92, commit `f4f1183`, revivable). Booking buttons go to
  Calendly (`BOOKING_URL`); the hero phone plays the real `popcode.app/commontide`
  experience (cover → Meg's video → After the Video buttons); `?tweak` opens a
  drag-and-slider layout panel for the hero. `SHOW_CASE_STUDY` still off.
- **After the Video** (admin-only, PR #85): up to three buttons when a video
  plays to the end, set in edit.html's *After video* tab, stored as
  `collections.cover_config.end` (no migration; the cover_config admin trigger
  guards it). Taps log `cta_shown` / `cta_tap_1..3` / `cta_replay`; outbound
  links get `utm_source=popcode&utm_medium=print&utm_campaign={slug}`.
- **Common Tide** is the fictional demo org: `popcode.app/commontide` (cover +
  end screen configured by the user), demo pages at
  `/demo/commontide/{give,marisol,monthly}.html`, printable card at
  `/assets/common-tide-postcard.pdf`.
- Adobe Fonts kit `hdk3gwt` (The Seasons) is loaded on the Common Tide demo pages
  and on `/nonprofits` (for the type printed on the sample pieces).
- Mugs live on the shop. Ornaments live via Printify (blueprint 1747). Shop order
  (2026-09-26): Photo Book, Calendar, Board Book, **Ornaments, Photo Mugs**, then
  Framed Prints and the rest.
- **Home-page holiday panel** (seasonal — `#holiday` in `index.html`, remove after
  the holidays): "Give the gift of memories this holiday season", Scout's ornament
  on a branch, gift chips, and *Try it yourself* with `/assets/scout-ornament.pdf`
  (scans via `popcode.app/scout`). Phones get a *Scan Scout's ornament* button.
- **Montage maker** (still admin-gated): photos **and short video clips** (up to
  100 items), **saved montages** (storage `montage-drafts/{user}/{id}/`),
  **framing** per photo/clip, **time on screen** per photo, and the last photo
  rests 1.5s longer. Shotstack is still on the **sandbox** key (watermarked).

**Next**
1. **Calendly:** the demo is 15 minutes and the hero button now says so (the
   booking URL's slug is still `/30min`; it works, rename it in Calendly only
   with a matching `BOOKING_URL` change). Rename the Calendly profile from
   "Curt Middleton" to "Popcode" if the user doesn't want their name on it.
2. **Pricing kit contents are a draft** (up to 3 / up to 8 stories, January board
   report, "Your whole year" tag) — user to confirm.
3. Impact dashboard phase 1, due before ~Nov 3 (`docs/impact-dashboard-handoff.md`).
   Story buttons + tap logging + UTMs are now done (After the Video). Still to
   build: `?via=org`, and the dashboard itself.
4. `PRINTIFY_DRY_RUN` is still `true` — one real test ornament order, then flip it
   in Production scope and redeploy.
5. Carried over: let `curt@theworkshop.works` open `analytics.html`; ST-120
   resale certificate for Prodigi; shipping options as cards.
6. **Montage, real-phone checks still owed:** a render with a framed *video* clip
   (moved with Shotstack `offset`/`scale` — never seen rendered), and a render
   where the last photo has its own longer time. Then drop the admin gate and
   move Shotstack to the production key (`.../edit/v1`).
7. **Set up a `hello@` address (user asked, 2026-09-26, "tomorrow").** The site
   uses `info@popcodeapp.com` 20 times across `index.html`, `howto.html`
   (support: "Still having trouble?"), `nonprofits.html`, `auth.html`,
   `privacy.html`, `terms.html`, `countries.js` and `lib/print/destinations.mjs`.
   Decide the domain (popcodeapp.com vs popcode.app), create the mailbox or
   alias at the mail provider (the user does that part), then decide which of
   those uses switch — privacy/terms and order-destination notices may need
   to stay on info@. Tours and Studio now book via Calendly, not email.
8. **Scout's ornament:** scan `/assets/scout-ornament.pdf` and the home-page
   ornament off a screen to confirm both trigger `popcode.app/scout`. The symbol
   is lower **left** on Scout's (the user's call); real ornament orders print it
   lower **right** — decide whether they should match.

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

### 2026-06-27 — Prodigi print ordering + Stripe checkout (built, tested end-to-end in dry-run; NOT merged)

**Branch `claude/kind-babbage-mpmxr8`, PR #53 (open, NOT merged to main).** Built a full print-on-demand ordering flow: a creator opens a project, picks a product + size + photo, enters a shipping address, sees a live price, pays via Stripe, and the order is submitted to Prodigi with the Popcode scan badge baked into the photo. **Validated end-to-end on the Vercel preview** (Stripe test mode + Prodigi DRY-RUN) — got all the way to "Submitted to print" with a real composited print asset.

**Product decisions (from user):** Stripe Checkout + configurable markup (`PRINT_MARKUP_MULTIPLIER`, default 1.4 = 40% over Prodigi cost incl. shipping); v1 = single-image products only (flat prints + photo tiles); books/calendars deferred (schema/catalog designed to extend without migration); badge baked into every photo so prints stay scannable.

**Files (all on the branch):**
- `lib/print/catalog.mjs` — server-authoritative SKU catalog + `findVariant` + `buildProdigiItems` (has a `forQuote` flag — see SKU gotchas) + `priceFromQuote`/`sumQuoteMinor`. Client never trusted for SKU/price.
- `api/prodigi-quote.js` — live price for the UI (display only).
- `api/create-checkout.js` — authed (Bearer, like delete-account.js); validates owner + SKU + asset URL prefix; **re-quotes Prodigi server-side** (client price is advisory); inserts `print_orders` row; opens Stripe Checkout Session; returns `{url}`.
- `api/stripe-webhook.js` — raw-body (`export const config = { api:{ bodyParser:false } }`) signature verify; idempotent; submits to Prodigi on `checkout.session.completed`. **Honors `PRODIGI_DRY_RUN`.** Kept as a BACKUP (see below).
- `api/finalize-order.js` — **the thing that actually finalizes in practice.** Called by the success page directly (Stripe's fulfill-on-redirect-AND-webhook pattern). Verifies the session is paid via Stripe, then submits to Prodigi (or dry-run) and advances status. Idempotent, shares the guard with the webhook. Added because webhook delivery was too fragile to configure (URL/secret/sandbox/deployment-protection) — this removed that whole dependency.
- `public/order.html` — order UI. **Compositor is INLINED** (don't reintroduce a dependency on `/composite.js` — it 404'd/cached-flaked and broke the page; inlining fixed it). Dedupes `collection_items` by target_index. Uploads to the **`experiences`** bucket (see RLS gotcha), not a new bucket.
- `public/order-success.html` — calls `/api/finalize-order` then shows status.
- `public/composite.js` — shared compositor (created but order.html no longer uses it; harmless).
- `supabase/migrations/2026-06-27-print-orders.sql` — `print_orders` table + RLS (owner-read, server-only writes) + storage INSERT/UPDATE policies.
- `manage.html` — "Order prints" shopping-bag icon on each card → `/order.html?id={slug}`.
- `docs/print-ordering.md` — setup + env + test plan. `package.json` — added `stripe`.

**Env vars (Vercel, Preview scope) set during testing:** `PRODIGI_API_KEY` (user's LIVE Prodigi key), `PRODIGI_BASE_URL=https://api.prodigi.com` (LIVE — sandbox login never worked, see below), `PRINT_MARKUP_MULTIPLIER=1.4`, `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET=whsec_…`, `PRODIGI_DRY_RUN=true`, plus the pre-existing `SUPABASE_SERVICE_ROLE_KEY`. **`PRODIGI_DRY_RUN=true` is the safety that prevents real Prodigi orders while pointed at the LIVE endpoint — do NOT remove it until intentionally going live.**

**Current state:** works end-to-end on the preview in dry-run. A 10×10 fine-art print quoted **$34.79** (Prodigi ~$24.85 × 1.4). The composited print asset (Max beach photo + badge bottom-right) is real and viewable. `print_orders` has the submitted row (`prodigi_order_id = DRYRUN-…`, `prodigi_response.wouldSend` = exact Prodigi payload). No real Prodigi order placed (dry-run). Migrations were run on PROD Supabase (`mrwpkhsluzokytpvmwqk`).

**The debugging saga — every blocker we hit, in order (so future-Claude doesn't relive it):**
1. **"Prodigi not configured"** = env var missing/not redeployed. Vercel env changes need a redeploy.
2. **Wrong value in `PRODIGI_API_KEY`** — user pasted a Stripe `sk_live_…` key into it, and later pasted the **base URL** into the key slot. Key prefixes `sk_test_`/`sk_live_` are STRIPE; Prodigi keys are NOT `sk_`. The long secret goes in `PRODIGI_API_KEY`; the `https://…` goes in `PRODIGI_BASE_URL`.
3. **401 NotAuthenticated** = key rejected. Prodigi **sandbox and live use different keys**; a key only works against its matching `PRODIGI_BASE_URL`. Added `.trim()` to the key/base-URL reads (stray newline in pasted env vars breaks the X-API-Key header). Sandbox dashboard is `sandbox-beta-dashboard.pwinty.com` (NOT sandbox-dashboard.prodigi.com) — **user could never log into sandbox**, so we used the LIVE endpoint + key + dry-run instead.
4. **400 ModelBindingFailed (items[0].sizing UnknownField)** — Prodigi's **quote** item schema rejects `sizing`. Added `forQuote` to `buildProdigiItems`: quotes send only sku/copies/attributes(+printArea asset); orders add sizing + asset URLs.
5. **400 SkuNotFound** — placeholder SKUs were fake. Real verified SKUs: prints `GLOBAL-FAP-10x10`, `GLOBAL-FAP-16x24`; framed photo tiles `PHOTIL-FRA-0507`, `PHOTIL-FRA-0808`, `PHOTIL-FRA-0810`. (More FAP sizes exist but verify each via `GET /v4.0/products/{sku}` before adding.)
6. **400 MissingRequiredAssets** — quote items still need `assets:[{printArea:'default'}]` (printArea only, no URL, no sizing).
7. **Identical traceParent on a repeat error** = a STALE/cached page, not a new failure. Hard-refresh (Cmd+Shift+R); confirm you're on the newest preview build, not a redeploy of an older commit.
8. **"new row violates row-level security policy"** on upload — the new `print-assets` bucket had no INSERT policy. **Fix that actually worked: upload to the existing `experiences` bucket** under `{slug}/print-…png` (reuses the owner-write policy create.html already relies on). `create-checkout` asset-URL prefix check points at the `experiences` public prefix accordingly.
9. **`window.compositeBadgedImage is not a function`** — `/composite.js` failed to load. Fix: inlined the compositor into order.html.
10. **"Checkout backend not configured"** = `STRIPE_SECRET_KEY` (or service key) missing from the deployment.
11. **Stuck on "Finalizing payment…"** = the webhook never advanced the row (delivery never reached the function — no `checkout.session.completed` showed in Stripe's events for the right sandbox/endpoint). **Fix: `/api/finalize-order` driven by the success page** made it work without the webhook.

**Lessons worth keeping:**
- **Vercel env vars apply to the NEXT build only.** Every value change needs a redeploy; test on the newest preview at the top of Deployments, never a redeploy of an older commit. Stable preview alias was `popcode-demo-git-claude-kind-bab-a691b9-curtmiddletons-projects.vercel.app` (Vercel truncated the long branch name + hash — don't construct preview URLs by hand).
- **Don't trust webhooks as the only fulfillment path** — finalize on the success redirect too (idempotent), webhook as backup. Saved the integration.
- **Reuse the proven `experiences` bucket** for any new authenticated client upload rather than fighting a new bucket's storage RLS.
- **Verify Prodigi SKUs against the catalogue** (`GET /v4.0/products/{sku}`) — never guess. Quote vs order item schemas differ (quote rejects `sizing`, needs printArea-only assets).
- Money in integer minor units; `priceFromQuote` rounds once.
- **Proof of print:** the composited asset is a public URL on the row (`asset_urls` / `prodigi_response.wouldSend...assets[].url`) — open it to see the badge baked in. Prodigi's true rendered proof (with the product crop applied) only exists for a REAL order.

**~~KNOWN ISSUE — square-print crop~~ → FIXED (commit `6285e48`):** previously the badge was composited onto the full photo and Prodigi cropped to the product shape via `fillPrintArea`, clipping the corner badge on square sizes. Now `order.html`'s compositor **center-crops each photo to the selected product's aspect ratio FIRST, then places the badge in the corner of that crop** — so the badge is always correctly positioned in what actually prints, and the matching-aspect asset isn't cropped further by Prodigi. Each catalog variant carries an `aspect` (w/h): prints 10×10=1, 16×24=2/3; tiles 5×7, 8×8=1, 8×10. Previews re-render on size/type change. Verified: a 10×10 dry-run asset came out a clean square with the badge safely in the corner. Trade-off: center-crop trims the sides of a landscape photo forced into a tall/square product (unavoidable when reshaping); a future "drag to reposition the crop" UI could let creators choose what's kept.

**Adding more products/sizes:** trivial — edit `PRODUCTS` in `lib/print/catalog.mjs` AND the client mirror in `order.html` (keep ids + `aspect` in sync). But **verify each new SKU against `GET /v4.0/products/{sku}` before adding** (guessed SKUs return SkuNotFound). Recommendation: don't expand the catalog until ONE real (non-dry-run) order has confirmed the live path works — no point stacking unverified SKUs on an unproven flow.

**TO GO FULLY LIVE (not done; deliberate steps):**
1. Get a working **Prodigi sandbox** key (or accept live orders) so real submits are free during testing.
2. Remove/disable **`PRODIGI_DRY_RUN`** to place real Prodigi orders.
3. Add all env vars to **Production** scope (incl. `PRODIGI_DRY_RUN=true` first if you want prod dry-run), merge PR #53 to `main`.
4. Switch Stripe to **live** keys + a live webhook for real payments; tune markup.
5. ~~Decide the square-crop handling~~ — DONE (aspect-crop fix above).
6. Recommended sequencing: real test order first → then expand the product catalog → then full public launch.

**Housekeeping done/queued this session:** user deleting the leftover **`identification` Supabase branch** (merged to prod in June, safe to delete — it was driving the "EXCEEDING USAGE LIMITS" MICRO-compute pill). **Re-enable Vercel Deployment Protection** on previews if it was turned off for testing (it had to be off so Stripe/phone could reach the preview). The `print-assets` bucket + its policies in the migration are now unused (we upload to `experiences`) — harmless, can drop later.

**UPDATE — FIRST REAL SANDBOX ORDER SUCCEEDED (Prodigi #1161509):** got the integration fully working against the Prodigi **sandbox** (real order, free, nothing prints). Sequence of what it took:
- **Prodigi sandbox needs its OWN key** — the live key returns 401 against `api.sandbox.prodigi.com`. Got the sandbox key from **`sandbox-beta-dashboard.pwinty.com`** (signed in there; sandbox key is prefixed **`test_`**, shown under "API authentication → X-API-Key"). The live dashboard only shows the one live key.
- Switched Preview env to sandbox: `PRODIGI_API_KEY=test_…`, `PRODIGI_BASE_URL=https://api.sandbox.prodigi.com`, **`PRODIGI_DRY_RUN=false`** (safe on sandbox — orders process but never print). **All print/Stripe vars kept Preview-only** so Production (no print code yet) stays clean until deliberate go-live.
- **Last bug: Prodigi ORDER endpoint rejects an empty `line2`** (`ValidationFailed` / `MustNotBeEmptyOrWhitespace`). Added `cleanRecipient()` in `lib/print/catalog.mjs` (trims + DROPS empty/whitespace address fields), applied in both `finalize-order.js` and `stripe-webhook.js` before building the order body. (Quote didn't care; order does.)
- Result: order **#1161509** in the sandbox dashboard, **In production**, via API, SKU `GLOBAL-FAP-10x10`, **Order reference = our `print_orders.id`** (the `merchantReference`). Proof image shows "Image pending" for a minute while Prodigi fetches the asset URL, then renders the badged square-cropped proof. **Note: finalize-order's idempotency treats `prodigi_failed` as terminal — a failed order won't auto-retry; place a NEW order after a fix.**
- **Path is now proven end-to-end.** Cleared to (a) add more single-image products/sizes (verify each SKU first) and (b) go live (production-scoped env with live key/URL + live Stripe + merge PR #53).

**Catalog expansion (done this session):** prints went 2 → 7 GLOBAL-FAP sizes (8x10, 10x10, 11x14, 12x16, 16x24, 20x28, 24x36); 11x14/12x16/16x24/20x28/24x36 verified on Prodigi's Enhanced Matte Art page, 10x10/16x24 already proven, 8x10 added to spot-check. Each variant carries its `aspect` for the crop+badge. Tiles unchanged (PHOTIL-FRA 5x7/8x8/8x10). To add more: edit `PRODUCTS` in `lib/print/catalog.mjs` + the client mirror in `order.html` (keep id/aspect in sync), verify each SKU (selecting a size auto-quotes; SkuNotFound surfaces instantly).

**ROADMAP — product-first ("commerce-first") ordering funnel (user idea, 2026-06-27):** today's flow is creation-first (build Popcode project → Manage → "Order prints"). User wants a buyer-led funnel: **pick product (e.g. framed print) → choose photo → link a video → create the Popcode behind the scenes → pay.** Better sales funnel (product intent leads). Good news: it REUSES existing building blocks — `create.html`'s compile/upload `.mind`, and `order.html`'s badge-composite + quote + Stripe checkout + `finalize-order`. The new work is mainly: (1) a **combined guided wizard** UI (product→photo→video→auto-create→pay); (2) **auth/guest handling** — a commerce-first buyer may not have an account, but a project currently requires a logged-in user (RLS), so either sign-up inline or guest checkout that provisions a lightweight account (the biggest design question); (3) the Popcode must still be really created (collection + collection_item + `.mind`) so the printed photo stays scannable via view/scan. **Additive — doesn't replace the current flow. Bigger UX project; do it AFTER the current single-image ordering ships, don't block go-live on it.**

### 2026-06-28 — Print ordering WENT LIVE in production (real Stripe + real Prodigi) 🎉

**Branch `claude/kind-babbage-mpmxr8`. PR #53 merged (Prodigi+Stripe ordering), PR #54 merged (whole-dollar rounding). Print ordering is now LIVE on `popcode.app` for all users.** A real end-to-end order was placed and confirmed: **Prodigi live order `ord_14214447`** ($42.77 charged via live Stripe, "In production" in the live Prodigi dashboard, shipping to New Rochelle).

**Mockup polish shipped this session (all in `public/order.html`):**
- **Print drop shadow** — borderless print template (`print.jpg`) is a near-white wall that washed out on the white storefront card. Added a per-mockup `shadow:true` flag → `renderProductMockup` casts a real drop shadow (shadowed white rect under the art) so the print reads as a physical object.
- **Category cards now use the real photoreal mockups** — they were still rendering the old CSS frame whose `box-shadow:9px 9px 0 #d9d4ca` hard offset block looked like a "bad drop shadow" (esp. canvas). Cards now call `renderProductMockup` and drop the `frame-*` class when a mockup exists; added `.cat-thumb.mockup canvas{max-width/height:98%}`.
- **Framed mockup art-rect height fix** — the frame opening's true bottom is ~0.888 of the template, but the rect stopped at 0.855 → a band of the template's stock leopard photo showed at the bottom of the frame. Measured all 4 openings with a Python PIL outside-in scan (center-line scans get fooled by dark photo content; scan from the page edge inward through the solid frame). Framed rect h 0.744 → 0.778. Tile verified already-correct.
- **Landscape toggle now updates the preview** — it always *worked functionally* (checkout crops the asset to `currentAspect()` and Prodigi auto-orients), but `renderProductMockup` always cropped to the portrait opening so the preview never changed → looked broken. Fix: when `opts.aspect > 1`, rotate the template 90° CW (a portrait frame turned 90° IS its landscape counterpart), remap the opening rect (`{x:th-r.y-r.h, y:r.x, w:r.h, h:r.w}`), and place an upright landscape-cropped photo. Square sizes (8×8, canvas) correctly hide the toggle.

**Pre-launch code review (one real bug fixed):** the checkout/order code is solid (server-authoritative pricing, ownership checks, asset-URL prefix validation, raw-body webhook signature verify, idempotency). **The one real risk found + fixed: concurrent double-submit.** `finalize-order` (success page) and `stripe-webhook` can both fire and both clear the idempotency guard before either writes `prodigi_order_id` → TWO Prodigi orders (double print + double charge; `merchantReference` is NOT a Prodigi-side uniqueness guarantee). Fix: both now do an **atomic claim** — `update ... set status='submitting' where id=X and prodigi_order_id is null and status in ('pending','paid') .select()`; only the winner (non-empty result) submits, the loser returns the current state. (`status` column is free-text, no CHECK constraint, so adding `submitting` needed no migration.) Caveat: a winner that crashes mid-submit leaves the row stuck in `submitting` (manual retry needed) — same operational model as the existing terminal `prodigi_failed`; Sentry flags the crash.

**Whole-dollar pricing (PR #54):** `priceFromQuote` now `Math.ceil((cost*markup)/100)*100` — rounds the customer price UP to a whole dollar so display and charge are clean whole numbers (`$41.37 → $42`) and margin is never rounded below the marked-up cost. It's the single source for both the quote display and the checkout charge so they always match. `order.html formatMoney` drops `.00` on whole amounts. Markup unchanged (1.4×).

**Pricing decision (user, shoestring budget):** **keep the all-in 1.4×-(product+shipping) model as-is.** It's the safest because marking up everything (incl. shipping) means you can NEVER lose money on an order regardless of shipping weight/distance. The downside is conversion, not margin — small items look pricey (a $9 tile + $21.55 UPS Ground × 1.4 = $42 to the customer; the $33.10 you saw in Prodigi is *your* cost, incl. $2.55 tax that isn't in the quote so real margin is a bit under 40%). The fix that still NEVER eats cost, if conversion suffers later: mark up product only, pass shipping at exact cost (`1.4×item + shipping` → ~$34 instead of $42). Options that DO risk eating cost (free shipping baked in / flat fee) were rejected. How POD peers handle it: most (Popsa, Artifact Uprising) bake shipping in and show "free shipping" or a flat fee, never raw carrier rates — but those absorb shipping variance, which the shoestring budget can't.

**GO-LIVE RUNBOOK (what we actually did — for repeating with future creators/products):**
1. **Stripe → live.** Account is on the newer **Sandboxes** UI (no "Test mode" toggle) — switch the environment via the top-left dropdown out of the sandbox to the live account. Account status (Settings→Business→Account status) = "No active tasks" = activated for live charges.
2. **Stripe key — used a RESTRICTED key, not the standard secret.** The account's standard Secret key is shared/legacy (other keys `prod`, `stg_apple_test` exist) and its full value can't be re-revealed; rotating it could break other integrations. So created a **restricted key** (Developers→API keys→Create restricted key → "Powering an integration you built" → template **"One-time payments"** which pre-sets the perms; confirmed **Checkout Sessions = Write**). Value is `rk_live_…` and works fine as `STRIPE_SECRET_KEY` (our code only does checkout.sessions create/retrieve; webhook verify uses the signing secret). **Gotcha:** the "⋯ → Copy API key ID" menu copies the key *ID* (`mk_…`), NOT the secret — must Reveal+copy the actual `sk_/rk_live_` value.
3. **Stripe webhook** (Developers→Webhooks→Add destination): URL `https://popcode.app/api/stripe-webhook`, event `checkout.session.completed` → copy signing secret `whsec_…`.
4. **Prodigi → live key** from the live dashboard (`dashboard.prodigi.com`), NOT the sandbox `test_` key. Base URL `https://api.prodigi.com`.
5. **Vercel Production-scope env vars** (Vercel uses the same var name once *per environment* — the existing entries were **Preview-only**/sandbox, so ADD new **Production-only** entries, don't edit the Preview ones): `STRIPE_SECRET_KEY=rk_live_…` (Sensitive), `STRIPE_WEBHOOK_SECRET=whsec_…` (Sensitive), `PRODIGI_API_KEY=`live (Sensitive), `PRODIGI_BASE_URL=https://api.prodigi.com` (not sensitive), `PRINT_MARKUP_MULTIPLIER=1.4` (not sensitive). **Do NOT set `PRODIGI_DRY_RUN` in Production** (unset = real orders). `SUPABASE_SERVICE_ROLE_KEY` must ALSO be Production-scoped (see gotcha).
6. Merge PR #53 → `main` (deploys to popcode.app).

**THE GOTCHA THAT COST US 20 MIN — `SUPABASE_SERVICE_ROLE_KEY` was Preview-only.** `create-checkout`/`finalize-order` need all three of `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `PRODIGI_API_KEY` or they 500 `"Checkout backend not configured"`. `SUPABASE_SERVICE_ROLE_KEY` was scoped **Preview only** (delete-account.js apparently never exercised it in prod), so prod checkout failed even after Stripe/Prodigi were set. **Diagnosis trick that nailed it fast:** curl the endpoints unauthenticated — `POST /api/create-checkout {}` → "Checkout backend not configured" means a var is missing; `POST /api/prodigi-quote {}` → "Missing productType…" (400, not "Prodigi not configured") proved `PRODIGI_API_KEY` WAS present, isolating it to Stripe-or-Supabase. Fix: add a Production-only `SUPABASE_SERVICE_ROLE_KEY` (its value is the **prod** project's service_role secret, ref `mrwpkhsluzokytpvmwqk` — a JWT's middle segment encodes the project ref; don't use a branch key). **Then the recurring Vercel lesson bit again: env vars apply to the NEXT build only.** The merge deployment was built *before* the Supabase var was added, so it stayed broken until a **Redeploy** (Deployments → ⋯ → Redeploy, "Use existing Build Cache" UNCHECKED). After the redeploy, `cs_live_` sessions and real Prodigi orders flowed.

**Confused-row gotcha during verification:** the Table Editor showed an OLD row first (`cs_test_…`, `prodigi_order_id=ord_1161509` = the June 27 sandbox order, `created_at=06/27`). The real live order is a separate newer row (`cs_live_…`, `ord_14214447`, `created_at=06/28`, `quote_cost_minor 3055 × 1.4 = total_charged_minor 4277`). When verifying live orders, sort by `created_at desc` and check the `stripe_session_id` prefix: `cs_live_` = real, `cs_test_` = sandbox leftover.

**STILL PENDING / NEXT:**
- **Re-enable Vercel Deployment Protection** on previews (turned OFF earlier so Stripe/phone could reach preview deploys — preview URLs are public while off). Vercel → project → Settings → Deployment Protection → set Vercel Authentication back to On (Standard Protection) for Preview.
- **No admin gate on the Shop button** — ordering is open to ALL signed-in users now. Fine at ~zero traffic; an admin-only lock (white-label-style email check) is available if wanted.
- When the real print arrives in a few days, **scan it with the Popcode app** to confirm the badged photo still triggers AR.
- Roadmap unchanged: commerce-first funnel; multi-tile bundle to compete with Mixtiles' "$16/tile" (their model = 3-tile min, peel-stick frames, shipping amortized); more SKUs (verify each via `GET /v4.0/products/{sku}`).
- The `print-assets` bucket + its storage policies in the migration are unused (uploads go to the existing `experiences` bucket) — harmless, can drop later.

### 2026-07-06 — Book maker v1 (Popsa-style multi-Popcode photo book builder) — built, tested, on branch

**Branch `claude/nifty-wozniak-x5x1mr`. Committed + pushed (`6570462`). No PR opened, prod untouched.** First Popcode product with **more than one Popcode integrated**. New standalone builder page; kicks off the "books, then calendars" roadmap.

**Scope locked with user: v1 = Builder + AR (option 1a), only linked photos are scannable (option 2a).** Physical print-book (Prodigi book SKU) explicitly deferred to next phase; book editing (reopen a saved book) NOT built yet (create-only).

**What shipped (all on the branch):**
- **`public/book.html`** — the whole builder, self-contained, vanilla JS, matches app design (gradient header, CooperBT/Inter, bottom-sheet modals). Features: photo tray + **Auto-fill**; 6 layout templates (`full`, `two-v`, `two-h`, `three-l` [1 tall + 2], `three-r`, `four`, default `four`); **tap-to-place / tap-to-swap** as the reliable primary interaction plus **pointer-based drag** to reorder pages (grip) and move photos between slots; delete page/photo (photos return to tray); per-photo **Popcode editor** (video upload reusing create.html's compress path, OR in-browser `MediaRecorder` audio) with a gradient Video/Audio tag on popcoded slots. Save pipeline mirrors create.html: upload all placed photos to `{slug}/book/{photoId}.ext`, compile ONLY popcoded photos into `{slug}/target.mind` (target_index = order across pages), upload each popcode's media as `video_{i}.mp4` / `audio_{i}.ext`, insert the `collections` row (`kind='book'`, `book_layout` jsonb) + popcoded `collection_items`. **Requires ≥1 Popcode to create** (else `/{slug}` has nothing to scan — guarded with a friendly alert).
- **Migration `supabase/migrations/2026-07-06-book-maker.sql`** (ADDITIVE, operator must run in Supabase SQL editor): `alter table collections add column kind text default 'standard', add column book_layout jsonb`. No new RLS (ordinary columns on the owner's row; the cover_config admin trigger only fires on cover_config change). Existing "standard" collections unaffected.
- **`public/manage.html`** — now selects `kind`; book collections render a **"Book" pill** and expose only **View / Share / Delete** (Edit→edit.html, Download, and Shop→order.html are single-image flows that would mangle/mislead on a book, so hidden for `kind==='book'`). Guarded the `.btn-download` listener (absent on book cards → was `null.addEventListener`). Added **"Make a Book"** to the top bar + nav drawer.
- **`public/create.html`** — "Make a Book" nav-drawer link.

**Data model / how it reuses the existing stack (important for future sessions):**
- A book IS a `collections` row (so viewer/download/delete/print "just work"). `book_layout` jsonb = `{ size, pages:[{ id, layout, slots:[ {photo_url, target_index|null} | null ] }] }`. `target_index` non-null on a slot = that photo is popcoded (has a matching `collection_items` row + is in the `.mind`); null = plain book photo; slot `null` = empty.
- **Only popcoded photos become `collection_items`** → small `.mind`, fast compile, badge only where it matters. Non-popcoded book photos live only in Storage + `book_layout`. `view.html`/`scan.html` need NO changes — a book with popcodes is just a collection with items + a `.mind`.

**Testing (headless Chromium via playwright-core in scratchpad — book.html is auth-gated + loads supabase-js/Sentry from CDN which are 403 in-sandbox, so I stubbed `window.supabase` by fulfilling the CDN request, and let the vendored MindAR load from a local `python3 -m http.server`):**
- Builder: add 6 photos → tray; Auto-fill → 2 pages (4-up), 6 filled + 2 empty, tray emptied; slot menu → Popcode sheet (video drop zone + audio record both present); layout picker shows 6, choosing Full collapses page to 1 slot. ✓
- Full save path: popcode a photo with a fake video File → Save enabled → tag shows → click Create → **real MindAR compile runs** → stubbed uploads/inserts → **result screen reached with a generated slug, 0 page errors**. ✓
- manage.html: book card = pill + View/Delete only (no edit/shop/download); standard card unchanged; "Make a Book" entry present. ✓
- **Bug caught by testing:** on narrow screens the create-summary is `display:none`, so the flex Create button slid LEFT and the **Beta Feedback FAB (fixed bottom:20/left:20, z-index 9000) intercepted its clicks**. Fixed with `margin-left:auto` on `.create-btn` (pins it right regardless of summary). Also hid the summary <620px so it never sits under the FAB.

**Gotchas / lessons for next time:**
- **The bottom-left Beta Feedback FAB (z-index 9000) overlaps ANY bottom-fixed bar.** Keep interactive controls out of the bottom-left ~150px, or pin them right. This will bite any future sticky-bottom UI.
- Testing book.html in-sandbox needs the supabase-js CDN stub trick (fulfill `**/@supabase/supabase-js@2`) + local http.server for the vendored MindAR; the Sentry SRI `integrity` attr will (correctly) block a stubbed sentry bundle — those console errors are test-only, ignore them.
- `node_modules` is tracked in this repo; I installed `playwright-core` ONLY in the scratchpad (outside the repo) so nothing leaked into git — verify `git status` shows just the 4 intended files.

**NEXT (queued, user said "let's continue"):**
1. **Book editing** — `book.html?id={slug}` loads `book_layout` + existing items back into the builder (the obvious missing half; makes it create-AND-edit). Needs: rebuild photos Map from `book_layout` slot URLs, re-hydrate popcodes from `collection_items`, diff on save (re-upload changed, recompile if popcode set changed).
2. **Physical print book** — new Prodigi book SKU (verify via `GET /v4.0/products/{sku}`) + multi-asset builder; slots into `lib/print/catalog.mjs` (already flagged there as a later phase) + a book-aware order flow. Popsa endgame.
3. **Calendars** — user's stated follow-up after books; same page-by-page engine, different product/output.
4. Optional: a dedicated book "cover" page, richer layouts, drag polish, book thumbnail on manage cards (currently uses first `collection_items.photo_url` = first popcoded photo).

### 2026-07-07 — Book maker UX polish marathon (dock, rearrange, drag-fill, inline cover, Edit Photo)

**Branch `claude/nifty-wozniak-x5x1mr` (PR #60, still open — NOT merged). ~14 commits `7e7fd37`→`a949e45`, all in `public/book.html` (plus a site-wide cream tweak across 13 pages).** Continuation of the 2026-07-06 book-maker v1. Pure UX/polish pass turning the builder into a Popsa-grade editor. Prod untouched (book maker only reachable via nav; migration below already run in prod).

**Migration status: the `kind` + `book_layout` columns migration WAS RUN in PROD this session** (user ran `alter table collections add column if not exists kind text default 'standard', add column if not exists book_layout jsonb;` in the Supabase SQL editor; confirmed both columns exist). So book saves work in prod now. NOTE: a Supabase "snippet not found" error the user hit was just the SQL-editor trying to reopen a deleted saved-snippet — nothing to do with the SQL; fix = paste into a fresh query. No further migration needed for any of today's work (everything persists inside the existing `book_layout` jsonb — no schema change).

**What shipped (in order):**
1. **Cover sizing + palette** (`7e7fd37`): standalone Front Cover was rendering ~half interior-page size (flex mismatch: empty left half was `page-half single`=basis 50% vs cover half `page-half`=basis 0). Fixed both to plain `page-half` → cover == interior page. Cover jacket bg `#1A1814`→gray `#605d58`. Lightened the cream page bg `#f2f0eb`→`#f7f6f2` across ALL 13 app pages (book/manage/create/edit/auth/reset/account/analytics/views/howto/privacy/terms/order-success) + book.html create-bar/progress tints.
2. **Floating dock** (`255c7f0`): Popsa-style pill above the create bar — **Photos** (add / auto-fill / tap-a-photo-to-place), **Pages** (add spread / add single / rearrange), **Options** (edit title / edit cover). Centered so it never hits the bottom-left Beta Feedback FAB (z-index 9000). Reuses the bottom-sheet + `.menu-row` mechanism.
3. **Rearrange Pages** (`8afdabb`, then reworked in `e9baeec`): full-screen drag-to-reorder view (X / "Rearrange Pages" / Save). First version was a flat tile grid; **reworked to connected spreads matching a real book** — Front Cover standalone on the right of row 1, `[Blank Page | Page 1]` beside it, then `[Page 2|3] [Page 4|5]` two-spreads-per-row, each spread joined by a center fold with ONE drop shadow around the pair. Drag is **render-based** (hover reorders `rpPages` + re-renders so spreads re-pair; blank inside-cover stays index 0). Includes an auto-fading instructional tip (`.rp-tip`, shows on open, fades after 5s — user liked this pattern). `b5dada3`: hover **move icon** (translucent dark disc + white 4-arrow glyph — legible on any photo, better than solid black) on draggable pages only. `b664288`: odd trailing page labels "Blank Page"; rearrange labels lightened 700→Inter 600.
4. **Popcode pill → lower-right** (`b451910`): the Video/Audio tag on a popcoded slot moved top-left → bottom-right to preview where the scan badge composites onto the print.
5. **Drag-and-drop flourish** (`93b773d`, `64d62e1`, `a4f354d`): the big one. A **circular photo chip** follows the pointer during a drag; on drop the photo fills the slot with an **expanding-circle reveal** (`clip-path: circle()` from the drop point). Works dragging from the **tray** AND the **Photos sheet** (drag from sheet auto-closes it so pages behind become droppable) AND onto the **front cover** (shared-reference photo so the source isn't consumed / blob not revoked). The **circle appears immediately on mouse press** (press-to-pick-up), not after the drag threshold; touch still waits for movement so tray/sheet keep scrolling; a tap (no drag) still selects/opens. Unified into `enablePhotoDrag(el, photo, {onTap, onDragStart})`.
6. **Inline cover text** (`761a098`): replaced the eyebrow/title/date input fields with **contenteditable typed directly on the cover preview** (placeholders via CSS when empty, plaintext-only, Enter blocked, title auto-resizes, vertical spine kept in sync without moving the caret). Also nudged the Overlay-style text block down-and-left per the user's mockup (`.cv-overlay-text` left 16.1%→8.5%, bottom 14.1%→8.5%).
7. **Popsa-style Edit Photo modal** (`403d21c`, `1d79f3d`): per-photo crop/zoom/pan/rotate. Slots now render an `<img class="slot-img">` with a CSS transform instead of a background. Modal = wide sheet (`openSheet(html, true)` → `.sheet-wide`) with Print Quality (1–10 heuristic from px/zoom), Scale %, Dimensions (source px), Source, and Fill/Fit/Grid/Rotate/Replace/Remove/Zoom In/Zoom Out + drag-to-pan + Cancel/Save. `optimizePhoto` now returns `{file, ow, oh}` (original dims) — updated its 3 callers. Adjust model `{fit,scale,ox,oy,rot}` persists per slot in `book_layout` and restores on edit. **Cover photo is editable too** (`1d79f3d`) — refactored the editor to a generic target via a `ctx` ({save, remove, replace, back}); cover adjust persists in `book_layout.cover.photo_adjust`. Also `1d79f3d`: `enableSlotDrag` (moving an already-placed photo) got the same immediate-circle-on-mouse-press.
8. **Cover photo picker fix** (`a949e45`): the "Choose cover photo" hint was buried under the tint/text overlay layers so its click never landed. Reworked into a **top-layer button** (`.cv-pick` wrapper `pointer-events:none` + `.cv-pick-btn` `pointer-events:auto`, z-index 6) — only the pill is clickable, the rest of the cover still opens the editor / accepts drops. Per user request it's now **on the cover itself** in the main builder (tap = pick a photo directly, no popup; tap the cover text/elsewhere = open editor). `chooseCoverPhoto(after)` gained an after-callback + sets dims/source/adjust.

**Key data-model note (persistence is all additive inside book_layout jsonb, NO migration):**
- Slot object grew: `{ photo_url, target_index, adjust:{fit,scale,ox,oy,rot} }`.
- `book_layout.cover` grew: `photo_adjust`.
- Restored in `loadBookForEdit` via `normalizeAdjust()`; photos carry `ow/oh/source/adjust`.

**Gotchas / lessons (don't relearn):**
- **z-index stacking inside the cover face**: a child of `.cv-photo` can't sit above sibling `.cv-tint`/`.cv-overlay-text` no matter its own z-index (parent's stacking context wins). Fix = render the interactive thing (pick button) as a face-level sibling with high z-index. And to keep the rest of the cover clickable, wrapper `pointer-events:none` + inner button `pointer-events:auto` (events still bubble from the auto child through the none parent to the parent's listener).
- **Playwright `page.mouse` + `touch-action: pan-x`**: synthetic mouse drags mysteriously don't engage pointer handlers on pan-x elements (tray thumbs). Real mouse/touch are fine. Test drags by **dispatching PointerEvents manually** (`el.dispatchEvent(new PointerEvent('pointerdown', {pointerType:'mouse',...}))` + document-level move/up) — that faithfully mimics real input and works. Elements with `touch-action:none` (slots, rp-halves) work with `page.mouse` directly.
- **contenteditable**: use `plaintext-only`; block Enter (`e.preventDefault(); blur()`); clear `innerHTML` when text becomes empty so `:empty::before` placeholder shows again; DON'T re-render the editable node on input (caret jumps) — update siblings (spine) in place instead.
- **Immediate-circle drag pattern**: create the ghost on pointerdown only when `pointerType==='mouse'` (instant press-to-pickup); on touch keep the movement threshold (so scrolling still works). Track a `moved` flag; on pointerup with `!moved` treat as a tap (run onTap / let the click open the menu), never set `justDragged`.
- **Slot rendering switched from background-image to `<img>`** to support transforms — the reveal overlay (`.slot-fill`), place-target outline, drag ghost (reads `photo.url`), and rearrange (pointer-events:none page-canvas) all still work; slot-tag stays z-index 2 above the img (z-index 0).
- Existing test scripts in scratchpad get stale when field IDs change (e.g. `test-cover.mjs` broke when cover fields → inline editing) — that's the test, not the product; re-verify with a fresh targeted script.

**Still open / next:**
- **PR #60 not merged** — the whole book maker (v1 + today's polish) is on the branch awaiting the user's merge.
- Physical print book (Prodigi book SKU) and calendars remain the roadmap (per 2026-07-06 notes).
- Honest caveat surfaced to user: Edit Photo's Print Quality/Dimensions show the **original** source resolution, but uploads are downscaled to `MAX_PHOTO_DIM` for storage — so a "10/10" prints from the optimized copy. Fine for book sizes; raise the cap if true full-res printing is ever wanted. Rotate at 90° can leave small edge gaps when photo aspect ≠ slot aspect (Fill + zoom closes them) — could add auto-cover-scaling for rotation later.

### 2026-07-09 — Book maker MERGED to prod (PR #60) + proof-PDF fixes, layouts, endpapers, drag UX

**Branch `claude/nifty-wozniak-x5x1mr`. PR #60 (the whole book maker v1 + all polish) was MERGED to `main` this session — book maker is LIVE in prod.** Several follow-up commits landed on the branch AFTER the merge and are NOT yet merged (see "post-merge" below). All book-maker work is in `public/book.html` (self-contained). The `kind` + `book_layout` migration was already run in prod in a prior session, so the merge needed no DB step.

**Merge mechanics / gotcha for next time:** PR #60 merged via a `merge` commit (not squash), so `main` now contains all 40 branch commits + the merge commit `2865686`. Per the workflow rule "a merged PR can't take new work," the post-merge follow-ups were rebased onto the fresh `origin/main` (`git fetch origin main && git rebase origin/main` — the already-merged commits drop out cleanly as duplicates, leaving only the new ones; then `git push --force-with-lease`). **When the user is happy with the post-merge commits, open a NEW PR for them — do not reuse #60.**

**PROOF PDF — root-caused and fixed 4 issues (all were html2canvas 1.4.1 limitations, plus one parity bug).** The admin "Proof PDF" (Options → admin-only, gated on `['curtmid@gmail.com','curt@theworkshop.works']`) downloads a real `.pdf` via html2canvas + jsPDF (lazy-loaded from cdnjs). The user sent a broken export; I reproduced it by rendering the PDF with **PyMuPDF** (`pip install pymupdf`; `fitz.open(...).get_pixmap()` → PNG — poppler/pdftoppm is NOT installed in the sandbox, pymupdf is the way to inspect PDFs). Fixes, all in `buildProof`'s pre-capture pass in book.html (~line 1990):
  1. **Photos stretched** → html2canvas mishandles `object-fit: cover` on a **transformed** `<img>` (it stretches to fill). Fix: in the proof, swap every photo `<img class="slot-img|cv-photo-img|bc-img">` for a `<div>` with `background-size:cover|contain` + the same crop/zoom `transform`. html2canvas renders background-size faithfully. (NOTE: html2canvas DOES handle object-fit fine on a NON-transformed img — the transform is what breaks it. Verified empirically.)
  2. **Cover spine crammed/garbled** → html2canvas can't render `writing-mode: vertical-rl`. Fix: for capture, re-lay the spine as a horizontal block `transform: rotate(90deg)` sized to the spine height.
  3. **`aspect-ratio` slots wrong size** → html2canvas 1.4.1 predates CSS `aspect-ratio`. Fix: before capture, pin each `.slot`/`.bc-inset` to its browser-computed px `width`/`height` (read via getBoundingClientRect off-screen, which IS correct) and set `aspect-ratio:auto`.
  4. **Empty-slot "+" placeholder + popcode media tags printed into the PDF.** Fix: proof CSS hides `.proof-canvas .slot.empty` (outline/bg/`::after` none) and `.proof-canvas .slot-tag`.
  Proof sizes: pages = 11.7×8.3in, spreads = 23.4×8.3in (72pt/in). **Sandbox speed trap:** html2canvas hangs ~13s/page because the sandbox BLOCKS Google Fonts and it re-fetches the stylesheet; stub `fonts.googleapis.com`/`fonts.gstatic.com` in the test route and it's ~0.2s/page. In prod (fonts load) a big book renders in seconds. **The proof is a ~120 DPI review tool, NOT a print-grade file** — a real Prodigi book needs 300 DPI + cover-wrap + bleed via a server-side render (separate future build).

**LAYOUTS added/fixed:**
  - New **`l1s`** ("Landscape wide") — a 1-photo layout with a smaller margin (sz:94) than the generous `l1` (sz:82). Added to `LAYOUTS` + `LAYOUT_GROUPS['1 Photo']`.
  - **`l3lr`** (the 3-photo "big + two", last tile in 3 Photos) was rendering as "1 image" — its stacked column had no definite height, so the two right slots' `height:%` collapsed to 0 and only the hero showed. Fixed: hero is now **portrait (3/4)**, and the column gets an **explicit definite height (88%)** with the two slots at `height:45%` (percentage-of-DEFINITE, which resolves in BOTH Chromium and Safari). **Do NOT use `align-self:stretch` + `height:%` (collapses/overlaps in Safari) or `flex:1` + `aspect-ratio` (overflows/overlaps in Chromium)** — both were tried and broke; percentage-of-definite-height is the robust answer. The user hit the overlap on **iPad Safari** specifically.

**ENDPAPERS — settled after several flip-flops (READ THIS before touching `ensureBookEndpapers`, book.html ~line 1055).** Physical books need an EVEN total page count, and with BOTH a blank inside-front and inside-back cover, that forces content to be even — an odd content count can't have both clean endpapers without a stray blank (mathematically proven in-session, don't re-derive). The user's final decision after iterating: **always show BOTH endpapers.** Current logic: `pages = [IFC-blank] + content + [IBC-blank]` always. Rendering: even content → inside-back pairs with the last page `[last | blank]`; **odd** content → the lone trailing inside-back blank is drawn on the **RIGHT** of an empty final spread (`[empty | blank]`) via a special case in `renderPages` (`if (!right && left.layout==='blank')` → placeholder-left, blank-right). So the inside-back endpaper is ALWAYS on the right. `pageLabel`/`rpLabel` count only non-blank pages so interleaved blanks don't create "Page 2 → Page 4" gaps. History of the flip-flops (so you don't undo a deliberate choice): first shipped conditional-front (drop front blank for odd → user wanted front always) → flipped to conditional-back (drop back blank for odd → user wanted back too) → landed on always-both with odd's back-blank rendered on the right. Open nicety: an odd book's inside-back blank has an EMPTY left half (last photo doesn't face it); could auto-balance odd → even later, but user accepted the parity for now.

**DRAG vs CLICK (the "circle" UX) — book.html `enableSlotDrag` ~2700 + `enablePhotoDrag` ~2765.** The circular drag chip appeared **instantly** on mouse press, so clicking a photo to open its editor kept picking it up. Fixed: a mouse drag is now armed only after a **200ms press-and-hold** (`setTimeout` → `startDrag`, cleared on pointerup/move) OR an actual move; a quick click falls through to the tap handler (opens the slot editor / selects a tray photo). **Touch is unchanged** (move-to-drag, so the tray still scrolls — do NOT add a hold-timer on touch, it fights scrolling). User confirmed "circle drag is good - works."

**Also this session:** back-cover inset sized to ~3.5" via `42cqh` (needs `container-type: size` on `.backcover`, not `inline-size`, so `cqh` works). Discussed porting the book builder to **Bashō (trek-folio, Next.js)** — feasible (data model/CSS/layout-math port cleanly; Bashō already renders PDFs server-side which is better than this html2canvas proof; the imperative DOM code becomes React) but **I can't see the trek-folio repo from this session** (scoped to popcode-demo) — would need it added via `add_repo`, plus a decision on whether Bashō adopts the AR/Popcode layer.

**Testing:** headless Chromium via `playwright-core` in the scratchpad, chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, stub `window.supabase`/Sentry via `page.route`, serve `public/` at `python3 -m http.server 8099`. `page.mouse` doesn't engage pointer handlers on `touch-action:pan-x` elements — dispatch manual `PointerEvent`s. For click-vs-hold timing, dispatch pointerdown, `waitForTimeout(<200 for click, >200 for hold)`, then pointerup. Regression scripts: `test-create.mjs`, `test-edit.mjs` (both must show 0 ERRORS).

**NEXT (queued):**
- Open a NEW PR for the post-merge branch commits (endpapers-both, l3lr Safari fix, l1s layout, click-vs-hold drag) once the user's happy; merge it.
- Book **editing** (`book.html?id={slug}` reopens a saved book).
- Physical **print book** → Prodigi (book SKU + 300 DPI server-side render/cover-wrap/bleed).
- **Calendars** (same page engine, different product).
- Optional: auto-balance odd-content books to even so the inside-back blank always faces the last photo.

### 2026-07-15 — Montage maker (Apple-Photos-style memory video) shipped end-to-end + a pile of create/manage/book polish

**Branch `claude/popcode-memory-video-maker-7ybxh7`. Everything merged to `main` incrementally (no single PR) — ~18 commits. All live in prod.** Long, iterative session driven by the user watching it on a real iPhone and firing rapid feedback. The headline is the **montage maker**; the rest is polish that piled up alongside.

#### THE MONTAGE MAKER (the big feature) — DONE + validated on a real phone with real music
Apple-Photos-style memory video maker built into the Create flow. On a page's video slot, a creator picks photos, orders them, chooses motion + shape + music, we render an MP4 via **Shotstack**, they preview it, and it links to the page's photo exactly like an uploaded video. **Nothing downstream changed** — output is a normal `{slug}/video_N.mp4` in `experiences`, so view/scan/AR are untouched. No DB migration.

**Architecture (files):**
- `lib/montage/timeline.mjs` — montage description → Shotstack "edit" JSON. Crossfade via 0.5s clip overlap + fade-in; Ken Burns via `zoomInSlow`/`zoomOutSlow` (see gotcha); soundtrack `fadeInFadeOut`; output sizes portrait/landscape/square. Dynamic-`import()`ed by the api fn (ERR_REQUIRE_ESM if static-imported).
- `api/create-montage.js` — POST, starts a render (2–40 https image URLs). **HEAD-checks the music URL and drops it (renders silent) if unreachable** rather than letting Shotstack fail the whole render; returns `musicSkipped`. Dry-run when `SHOTSTACK_API_KEY` unset (mirrors PRODIGI_DRY_RUN).
- `api/montage-status.js` — GET poll; maps Shotstack lifecycle → `queued|rendering|done|failed`. Terminal status is **`done`** (not "completed" — the doc summarizer lied).
- `api/montage-file.js` — same-origin CORS proxy to pull the finished MP4 into the browser (Shotstack S3 output has no CORS), SSRF-guarded to shotstack hosts. Lets the client blob it → re-host durably in Supabase on save.
- `public/montage-music.js` — curated track manifest (5 moods). Files live in `public/assets/music/*.mp3`.
- `public/create.html` — the builder overlay + orchestration (all `mtg*` / `.mtg-*`) + the video-source dropdown.

**Env (Vercel, all envs as needed):** `SHOTSTACK_API_KEY`, `SHOTSTACK_BASE_URL` (sandbox `https://api.shotstack.io/edit/stage`, prod `.../edit/v1`), `MONTAGE_DRY_RUN`. **Currently set to SANDBOX** (watermarked output). User created a Shotstack account; key is in Vercel. Endpoint verified: `POST {base}/render`, header `x-api-key`, `response.id` / `response.status` / `response.url`.

**The iterative journey (each shipped):** initial build (admin-gated, dry-run) → **fit `cover`→`crop`** (cover STRETCHES/distorts; crop preserves aspect — this was the "squooshed images") → **photo compression** (ported book maker's `optimizePhoto` into create.html: the montage picker downscales to 1920px, and the main "Photo to scan" picker now downscales oversized photos to 2560px instead of the old size-limit rejection) → **preview-before-commit** (render plays in the overlay with Use / Start over; **closing with a rendered montage KEEPS it** — applies to the page — so a missed "Use" doesn't lose it; only Start over discards) → **book-maker redesign** (black/white/warm-gray, no purple, CooperBT 32px title, generous spacing, clean line icons) → **seconds slider → number stepper (− value +)** → **photo-tray grid** (wrap, all thumbnails visible, arrows removed, **drag-to-reorder mouse+touch** via ghost + hover-reorder + re-render; touch works because grid has `touch-action:none`, no scroll conflict) → **calmer Ken Burns** (slow zooms only) → **real CC0 music** → **video-source dropdown** (see below).

**Music:** the sandbox blocks Pixabay/FMA (403) and archive.org (503); only GitHub raw is reachable, and no license-verifiable CC0 music set was findable there; the bundled ffmpeg is stripped (no lavfi/mp3, can't synthesize). So **I could NOT auto-source CC0 audio.** The **user downloaded 5 tracks themselves** (uplifting/sentimental/cinematic/playful/calm.mp3, ~3–4 MB each) and pushed them to `public/assets/music/` from their MBP. Verified live (all 200 `audio/mpeg`) and a **real prod render WITH music succeeded** (`musicSkipped:false`, output MP4 has an `mp4a` audio track — confirmed via atom scan since bundled ffmpeg can't demux).

**Video-source dropdown (the "montage as a choice, not a button" fix):** the montage was a tile/button under "Plays on scan"; user wanted it as a choice in the video dropdown. **iOS owns the Photo Library / Take Video / Choose File native picker — you cannot add a 4th item to Apple's menu.** So: tapping the video tile (admin only) opens a small **Popcode** menu (`#video-src-menu`) — "Upload a video" (→ triggers the native input, which shows Apple's 3 options) and "Make a montage" (→ builder). Implemented as a **capture-phase click interceptor** on `.video-slot .upload-btn input[type=file]` with a `vsmBypass` dataset flag so the programmatic upload click passes through. Non-admins are unaffected (tile → native picker directly), so it's ready for all users the moment the gate drops.

**Admin gate:** the "Make a montage" affordance is gated to `curtmid@gmail.com` / `curt@theworkshop.works` via `body.mtg-admin` (set in the auth callback). **Still gated — drop it (remove the gate) once the user's happy after real-phone testing** so all users get the montage maker.

**Dry-run:** with no key (or `MONTAGE_DRY_RUN=true`) the whole builder runs but stops at a "Preview mode" banner instead of a real MP4.

#### Other create.html polish (all shipped to prod)
- **Form centering:** `.form-col` → `align-items:center`. Everything (fields, labels, tile block, both buttons) centers on the page; the h1 "New Popcode" + subtitle stay left (they live in `.page-top-bar`/`.subtitle`, outside `.form-col`). User asked for exactly this.
- Earlier the tile block was centered on the page too (via `.pages{align-self:center}`) — the montage button was NOT the cause of the off-center (verified with/without).

#### manage.html
- **"+ New Popcode" button** now sits beside the "My Popcodes" heading (one `.top-bar-head` flex row: title left, button right; subtitle below). Was a flex sibling of the whole text block with `flex-wrap:wrap`, so it wrapped under the subtitle on narrow screens.

#### book.html
- **Last spread is always `[numbered page | blank]`, same size.** `ensureBookEndpapers` was always adding the inside-front blank → odd content made the total odd → the inside-back blank was orphaned as a mis-sized `[empty | blank]`. Fix: add the inside-front blank **only when content count is even** (keeps total even). Trade-off: odd-content books open directly on Page 1 (no blank inside-front cover). Verified odd (Page 3) + even (Page 4) both end `[Page N | Blank Page]`, both halves 491px.

#### order.html
- **Badge wording fix:** "…print it with a scannable Popcode badge" → "…print it with a small Popcode badge so people know they can scan the photo to bring it to life." (The badge only *indicates* scannability; you scan the photo, not the badge.)

#### QUEUED / NOT DONE (next session)
- **Book-editor Popsa-style redesign (3 parts, user speced, NOT started):** (1) Header = book title + pencil-edit + "Hardcover Photo Book · last edited {date}" subtext, replacing "Make a Book" + the Book-title input (keep `#title-input` hidden — ~10 refs read it). (2) Cover editing via the existing **"Edit title" popup** (eyebrow/title/date), remove the on-cover contenteditable. (3) **Front + back covers get the interior-page layout picker** (1/2/3/4-photo layouts) with the title overlay on top — the big one; turns covers into layout-driven pages (touches cover renderer, proof/print output, save shape). Do on a preview.
- **edit.html eye-preview** (still queued from the book sessions): eye icon on each media tile (opposite the pencil) to preview the photo / play the video. Audio already has a play button, so it's really photo + video.
- **Drop the montage admin gate** after real-phone sign-off.
- **Shotstack → production** key + `.../edit/v1` (currently sandbox = watermarked).

#### Gotchas / lessons (don't relearn)
- **Shotstack `fit`:** `crop` (default) preserves aspect + crops to fill; **`cover` STRETCHES/distorts**; `contain` letterboxes. (The docs auto-summarizer had crop/cover backwards — trust the user's observed behavior.) Motion effects support `Slow`/`Fast` suffixes; base `zoomIn` etc. are the calmer ones.
- **iOS owns the native file-picker menu** (Photo Library/Take Video/Choose File) — can't inject items. Wrap it in your own menu if you need more choices.
- **Sandbox network:** Pixabay/FMA/jsdelivr = 403, archive.org = 503; **GitHub raw + npm registry = reachable.** Bundled ffmpeg at `/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux` is **stripped** (no lavfi, no libmp3lame — can't synthesize or encode audio).
- **zsh interactive doesn't treat `#` as a comment** — pasting command blocks with inline `#` comments breaks on any apostrophe ("sandbox's" → "missing end of string"). Give the user comment-free command blocks.
- **Headless testing create/book.html:** `playwright-core` in scratchpad, chromium `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, stub `window.supabase` + abort sentry via `page.route`, serve `public/` at `python3 -m http.server 8099` **(cd into public/ FIRST — a repo-root server 404s /create.html)**. Elements with `touch-action:none/pan-x` need dispatched `PointerEvent`s, not `page.mouse`. Test scripts live in scratchpad (`test-montage2/3`, `test-vsm`, `test-center2`, `test-book`, etc.).
- **Vercel env changes apply to the NEXT build only** (recurring). Parallel-Macs: the user pushes from their MBP too — `git pull` before push; I `git fetch origin main && git checkout -B main origin/main && merge --no-ff && push` each time, and re-sync the feature branch after.


### 2026-07-17 — Shop/order product-preview overhaul + My Designs polish (+ Stripe webhook triage)

**Branch `claude/stripe-error-einvkj`, merged to `main`/prod. All in `public/order.html`, `public/book.html`, `public/manage.html` + 2 new sample assets.** Long tight-iteration session (~8 review rounds on the Vercel preview). Started as a Stripe email triage, became a full rebuild of the print-shop product preview.

**Stripe "webhook failing" email (NO code change):** User forwarded a Stripe live-mode email about `https://api.popcodeapp.com/api/v1/checkout/webhook` failing (10x "could not connect"). That URL is NOT anywhere in the repo — it's from the OLD pre-static Popcode backend (`api.popcodeapp.com`) that no longer exists. Current prod webhook is `popcode.app/api/stripe-webhook` (Vercel fn, and only a BACKUP — `api/finalize-order.js` is the real fulfillment path). Action = user deletes the orphaned endpoint in Stripe Dashboard -> Developers -> Webhooks (live mode). Confirmed with user it's leftover from an old version they haven't touched.

**order.html product preview — fully reworked.** Context: commit `9f630f7` (a parallel session) had reverted `renderDetailPreview` back to the old drawn "scenes" (in-situ/lifestyle room mockups + a thumbnail strip). User wanted those gone. Final structure now, mirroring the storefront `shop.html` cards:
- **Detail preview AND Review preview** = **white tile (`.detail-preview`, #fff + subtle shadow) -> inset gray rounded stage (`.detail-stage`, #f2f2f2) -> product drawn on a TRANSPARENT canvas via `renderProductOnly()` with a drop shadow.** Only the product reshapes (to the selected size's aspect ratio + portrait/landscape; photo cropped via `getArtImage`->`compositeBadgedImage`). The white tile + gray stage never move or resize.
- `renderProductOnly(cv, art, aspect)` (~line 1020): 900x900 transparent canvas, product sized to `maxW/maxH = 0.62*S`, drawn with `placeProduct(...,'plain',...)`. **Tune the `0.62`** if the product looks too big/small in the gray box.
- `renderScene`/`paintScenes`/`buildGalleryStrip`/`applySizeScale` + the `SCENES`/`SCENE_BACKDROPS` machinery are now DEAD (unreferenced). Left in the file (not deleted) to keep diffs tight; a future cleanup can remove them.
- **Photo Tiles frame is now BLACK** (`placeProduct` fill: `framed || tile` -> #141414). The real Prodigi PHOTIL-FRA product is a black frame (confirmed by reading `assets/mockups/prodigi-photo-tile-framed-5x7-black-frame.png`).
- **Sample photo in every preview before the user picks one:** `SAMPLE_PHOTO = '/assets/sample-leopard.jpg'` (983x1400, cropped OUT of the framed-tile mockup with PIL so it's a clean frame-free leopard). `getArtImage` falls back to it. It reshapes/crops with size+orientation like a real photo. Follow-up the user wants eventually: a different sample shot per product (all use the leopard now).
- **`#change-photo-btn`** on the detail step, shown only when a photo is selected -> reopens the photo picker (`openPhotoStep`).
- **Save to My Designs fix:** the insert omitted `mind_file_url` which is NOT NULL in the `collections` schema -> "null value violates not-null constraint". Now stores `mind_file_url: ''` for saved (non-scannable) print designs.

**book.html Photo Book:**
- **"Design a Book" CTA (`.bi-cta`) -> solid black #1a1a1a** (was purple gradient) to match the other product CTAs / order.html `#create-btn`.
- **Intro preview matches the others** (white tile -> gray stage -> book with shadow). Gotcha: `book.jpg` has a baked-in #f2f2f2 background (SAME as the stage), so rounding+shadowing the whole `<img>` made a box-in-box. Fixed by cropping the cover to a TRANSPARENT PNG (`/assets/sample-book.png`, 746x538, PIL color-key #f2f2f2->alpha, spine preserved) + CSS `filter: drop-shadow(...)` so the book sits directly on the gray. NOTE: storefront `shop.html` still uses `book.jpg` (fine, different treatment) — do not change that.

**manage.html My Designs cards:**
- **Print card text split:** saved `collections.name` for prints is `"Prints · 10x10\" — {photoName}"` (separator is space + em-dash U+2014 + space). Card now shows the `Prints · 10x10\"` part as the small gray `.design-kind` label and `{photoName}` (e.g. "Addie Chapter One") as the Cooper `.design-title`. Split on `' — '` (verified the em-dash codepoint matches order.html's save string exactly). Books unaffected (they use the cover title).
- **Uniform tile height:** `.design-title` clamped to ONE line (`white-space:nowrap; overflow:hidden; text-overflow:ellipsis`) so cards don't vary by title length. Mats are already fixed `aspect-ratio:3/2`. Long names truncate with an ellipsis (accepted trade-off; alternative = reserve a fixed 2-line block).
- **"Edit This Print" now actually edits** (was `?design={slug}` -> read-only review). Now `?design={slug}&edit=1` -> `loadSavedDesign(slug, edit)` lands on the editable DETAIL screen (size / orientation / Change-photo) pre-filled instead of `goReview()`. AND `saveDesign()` now UPDATES the existing design in place when `editingDesign` is set (no duplicate); fresh shop saves still INSERT. Books route Edit to `book.html?id=` (their real editor) — unchanged. "Order This Print" still deep-links straight to review for a quick reorder.

**New assets:** `public/assets/sample-leopard.jpg`, `public/assets/sample-book.png` (both cropped with PIL+numpy, which were pip-installed in the sandbox this session).

**Testing reality:** order.html / book.html / manage.html are auth-gated and load supabase-js + Sentry from CDNs that are 403 in this sandbox, so I could NOT drive the live pages here. Verified via `node --check` on the extracted inline scripts (guards against the parse-error white-screen failure mode) + PIL image inspection of the crops. The USER did all live verification on the Vercel preview for the branch and iterated. When touching these files, keep syntax-checking the inline `<script>` — a single stray syntax error white-screens the whole page (see 2026-04-12 note).

**Queued follow-ups:** per-product sample shots; delete the dead scene code in order.html in a cleanup pass; confirm the one-off "black bars on a canvas review preview" (old render path) is gone with `renderProductOnly` (if it recurs it's a crop-vs-letterbox thing in `compositeBadgedImage`).

**UPDATE — superseded by later same-day parallel sessions:** the `sample-leopard.jpg` / `SAMPLE_PHOTO` mechanism described above was retired shortly after — parallel sessions swapped to a curated Unsplash sample pool (commits `e0f2b0e`, `11f9da0`, `3f1f1f1`) and evolved the shop further (new products: mounted framed prints / framed canvas / acrylic; frame-colour options; square tiles; calendars). Trust the current `public/order.html` / `public/shop.html` over the leopard-sample details in this entry.

### 2026-08-18 — Analytics "Library" tab: actually view customer projects + videos (shipped to prod)

**Branch `claude/customer-projects-visibility-hbmfe7` (commit `dfed14f`), merged to `main` as `a52a94e` and pushed — live in prod. One file: `public/analytics.html`.** No PR (user said "push to prod"). No schema, RLS, or env change.

**The question that started it:** *"How can I view projects/videos of customers? I only see tiny thumbnails in the projects tab of the dashboard."* Answer at the time: **you couldn't.** Two separate limits, worth remembering because they're easy to mistake for a bug:
1. The **Projects tab is scan analytics, not a browser.** Its "By Photo" cards come from the `get_target_scan_counts` RPC, so a project only appears if it was **scanned inside the selected date range** — a customer's project with zero scans is invisible there, by design.
2. The 40px `.bv-thumb` was a dead end: hovering played a *muted* preview, clicking just toggled that preview. No way to reach the real photo or the video a viewer gets.

**What shipped — new admin-only "Library" tab** (tab bar order: Activity Log / Overview / Projects / **Library** / Accounts / Prints / Feedback / Cost):
- Lists **every** row in `collections`, scanned or not, newest first: cover photo, owner email, created date, photo count, video/audio breakdown, purple **Book** badge for `kind==='book'`, and a search box filtering on project name / owner email / slug.
- Its markup (`#library-section`) is **static, outside `#main-content`** — same trick as `#cost-section` / `#prints-section` — so the range-button rebuild of `main-content` doesn't blow it away and its listeners survive. It is NOT in `RANGE_TABS`, so the date-range bar hides on it (the Library is not range-scoped; that's the whole point).
- Loads lazily: `showTab()` calls `loadLibrary()` when `name === 'library'`.

**New lightbox (`#lb`, z-index 9500)** — click a project card to page through its photos full-size with the linked **video or audio playing with sound**:
- Video item → `<video controls autoplay playsinline>` with the photo as `poster`. Audio item → photo + `<audio controls autoplay>`. Neither → the photo alone. Nothing → a "Nothing stored for this photo" line.
- Filmstrip of every photo along the bottom (click to jump, current one outlined), `‹ ›` buttons, **←/→ arrow keys, Esc to close**, click-the-backdrop to close, counter reading `{label} · {video|audio|photo only} · N of M`, and an **"Open viewer ↗"** link to the public `/{slug}`.
- `lbStopMedia()` pauses + `removeAttribute('src')` + `load()`s on every navigate/close, so audio can't keep playing behind a closed overlay. `document.body.style.overflow` is locked while open.
- **z-index 9500 is deliberate** — the Beta Feedback FAB is 9000 (see the 2026-07-06 note). Anything full-screen has to clear it.
- The **tiny By Photo thumbnails now open this same lightbox on click** (hover still previews muted video) — the click-to-toggle-preview handler was replaced with a `.bv-thumb-wrap` click that skips `.bv-audio-btn`. `.bv-thumb-wrap` now carries `data-slug` / `data-ti`.

**Two pre-existing bugs fixed in `loadThumbs()` while in there (both silent, both would have grown teeth):**
1. **PostgREST `max-rows` truncation.** It did a plain `db.from('collections').select(...)` / `collection_items` with no paging. Supabase caps a single select at the project's `max-rows` (**default 1000**) and returns the truncated set with **no error** — so past ~1000 items the caches would quietly go incomplete (wrong thumbnails, missing projects) with nothing to notice. Added `fetchAllRows(table, cols)` that loops `.range(from, from+999)` until a short page comes back. **Use this helper for any future all-rows read.**
2. **Cache-guard race.** The old guard flipped `cachedThumbs` from `null` to `{}` *synchronously* before the awaits, so a second caller during the in-flight fetch (Library tab clicked while `loadByVideo()`'s fetch was still running) returned instantly against **empty** caches and rendered an empty grid with no retry. Now `loadThumbs()` returns a **shared in-flight promise** (`thumbsPromise`), and clears it on error so a later click retries. `ensureUsers()` got the same treatment (`usersPromise`).

`loadThumbs` also now caches `cachedCols` (the full `id, slug, name, user_id, created_at, kind` rows), not just `cachedSlugId`. Owner emails come from the existing admin `get_all_users` RPC at `max_rows: 1000` (the Accounts section still asks for 35 separately); if that RPC is missing the library degrades to showing a user-id prefix rather than breaking.

**Testing — headless Chromium with a stubbed Supabase (this pattern works, reuse it):**
`playwright-core` installed **in the scratchpad only** (never in the repo — `node_modules` is tracked here), chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `cd public && python3 -m http.server 8099`. Then `page.route` to: abort `browser.sentry-cdn.com`, stub `/sentry-init.js` + `/beta-feedback.js` as empty, and **fulfill `**/@supabase/supabase-js@2` with a fake `window.supabase.createClient`** returning `{auth.getSession → admin session, from() → chainable thenable stub, rpc(), storage.from().list()}`. The chainable stub is the trick: every builder method (`select/order/gte/limit/eq/range`) returns the same object and `then` resolves `{data, error}`. Verified all 4 stub projects listed (incl. a never-scanned one and a book), search, video/audio/photo-only rendering, media teardown on navigate, By Photo → lightbox, empty-project guard, keyboard nav — **0 page errors**.

**GOTCHA that cost a few minutes and WILL recur: the sandbox's Chromium has no H.264 decoder.** `video.canPlayType('video/mp4; codecs="avc1.42E01E"')` returns `""` and the element reports `error.code === 4` (SRC_NOT_SUPPORTED), `readyState 0`. So an mp4 will **never** play in headless testing here — that is not a code bug. Check `canPlayType` before concluding anything about playback. The only unverified thing in this feature is therefore actual video playback; told the user to eyeball it on prod.

Also worth knowing: the two console errors that always show in these headless runs are `browser.sentry-cdn.com` (aborted by my own route) and `fonts.googleapis.com` (blocked in-sandbox) — both harmless, not from page code. And `/assets/photo.png` is a 512×512 *photo-placeholder icon*, not a photograph — it renders looking like a broken image in a thumbnail strip. Don't chase it.

**Known limits / follow-ups:**
- **`analytics.html` is still gated to `curtmid@gmail.com` only** (`ADMIN_EMAIL`, ~line 328) — signing in as `curt@theworkshop.works` bounces to manage.html. Offered to widen it to both admin emails (the way `edit.html` does with a 2-entry list); user hasn't said yet.
- Library reads `collection_items`, so for **book** projects it only shows the **popcoded** photos (plain book photos live in `book_layout` jsonb + Storage and never become items — see 2026-07-06). Fine for "what does a viewer get", incomplete as a book preview.
- Autoplay-with-sound can be refused in Safari because `openLightbox` awaits the data fetch before rendering, which breaks the user-gesture chain. `controls` are always present so it's one tap; only worth fixing if it annoys in practice.
- The lightbox is desktop-first; it works on a phone but the filmstrip + side arrows are tight.
### 2026-08-18 — Shop funnel: aspect-true size preview + Review step with Save-to-My-Designs (shipped to prod)

**Branch `claude/shop-cards-book-design-3uaneo`, fast-forwarded to `main` (commit `9f630f7`). Live in prod.** Continuation of the 2026-07-17 shop overhaul. Two user asks, both from screenshots on a real device:
1. "on the select product the thumbnail doesn't turn square when you select 8×8" — the product preview must reflect the selected size's aspect.
2. "when you select an image the next page should show the image in the tile frame and have info about what you're buying… save button and order button… if order selected then payment process." User confirmed "Save = save the design to My Designs (product + size + photo, reopenable/orderable later)."

**What shipped (all `public/order.html` + `public/manage.html`):**
- **Aspect-true size preview.** `renderDetailPreview()` now renders via `paintScenes(await getArtImage(currentAspect()), currentAspect())` → `renderScene()` → the drawn-scene box math (`let w=maxW, h=w/aspect; if(h>maxH){h=maxH;w=h*aspect}`) reshapes the product to the size's aspect. 5×7→0.714, **8×8→1.0 (square)**, 8×10→0.8. `compositeBadgedImage(url,{aspect})` center-crops the source to that aspect (lines 453-456) so the composited photo fills the reshaped box.
- **Review step** (`detail → photo → review → create`). After picking a photo, "Continue" → `goReview()`: renders the photo composited into the product (aspect-true), shows name / "8×8\" · Square" / specs / price, with **Order** (black primary → `goPay()` → existing checkout) and **Save to My Designs** (white secondary → `saveDesign()`). "← Back to product" returns to detail; checkout's back button (`to-detail`) now returns to review.
- **Save** = `saveDesign()` inserts a `collections` row `{ kind: <product>, book_layout: { print: {productType, variantId, orientation, scale, photoUrl, sourceSlug, sourceTargetIndex} } }` + a `collection_items` thumbnail row. **No DB migration** — reuses the existing `kind` + `book_layout` jsonb columns already in prod.
- **Reopen** via `order.html?design=<slug>` → `loadSavedDesign()` restores state + jumps straight to Review.
- **manage.html My Designs**: `PRODUCT_KINDS` now includes `'framed'`; `buildDesignCard()` routes print designs (tile/print/canvas/framed) to `order.html?design=slug` for both Order and Edit; books still open in `book.html`. Design cards show kind label + title + photo thumbnail + ⋯ menu (Order/Edit/Share/Delete).

**THE KEY LESSON — the "8×8 not square" bug was never a product bug, it was a flawed TEST.** The render math was already correct. My prior headless test measured the "saturated-pixel bounding box" of the composited photo using `/assets/mockups/print.jpg` as the stand-in photo — but that file is a *product mockup* (a framed print on a gray background), so its colorful inner subject is ~0.8 aspect regardless of how the outer box is cropped. Measuring pixels gave 0.8 for every size and sent me hunting a non-existent bug. **Fix to the method: don't measure pixels to verify geometry — hook the actual draw call.** I overrode `window.placeProduct` to log `box.w/box.h` directly; that instantly showed 0.714/1.0/0.8 (correct). For any "is it the right shape/size" check, instrument the function that computes the geometry, not the rendered canvas.

**Other testing gotchas (headless `playwright-core`, chromium `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `python3 -m http.server` in `public/`):**
- **Inline the supabase-js stub via `readFileSync` + `node --check`, don't hand-escape it into a template literal.** A stray char in the inlined stub string throws "Unexpected token ';'" → `window.supabase` never defines → "Cannot read properties of undefined (reading 'createClient')" → blank page. Writing the stub to `stub.js`, `node --check`ing it, then `readFileSync`ing it into the route body eliminated the escaping class of bug.
- **The stub's query-chain must implement every PostgREST method the page calls** — `manage.html`'s `loadCollections` chains `.update().is(...)`, so a stub missing `.is` throws `db.from(...).update(...).is is not a function` and the whole tab fails to render (0 cards). Add `is/not/gte/lte/limit/range/in/order/eq/select/single/then/insert/update` to the chain object up front.
- Verified end-to-end with 0 page errors: aspect reshape (box-hook), review render, Save→"Saved to My Designs.", reopen `?design=`, My Designs card grid.

**Sync/deploy:** origin/main hadn't moved (the parallel session's edit.html commits `3720385` etc. were already in my branch history), so it was a clean fast-forward — pushed the branch then `git push origin <branch>:main`. Recurring parallel-Macs pattern held; no rebase needed this time.

**Still queued (unchanged from 2026-07-17):** per-product sample shots (all use the leopard now); delete the dead scene code (`renderScene`/`sceneBackdrop`/`SCENE_BACKDROPS`/gallery-strip machinery is now unreferenced for the detail preview but left in for tight diffs); the design-card thumbnail shows the raw photo (not the product-shaped mockup) — acceptable, could reshape later.

### 2026-09-01 — Homepage rebuild + pricing/hosting decisions + gallery segment analysis

**Branch `homepage-rebuild` (commits `402a737`, `8403499`), pushed, NOT merged. One file: `public/index.html`.** Started as "should Claude Design build a new homepage or should we?", became a full rebuild plus the pricing decisions behind it.

#### THE LESSON THAT MATTERS MOST — check how stale the checkout is before asserting anything

The session opened with me auditing the working tree on branch `new-badge` and confidently telling the user that **the shop, Stripe billing, print fulfilment and pricing didn't exist**. All of it existed. `new-badge` was **483 commits behind `origin/main`** and I never checked. The user had to correct me with a screenshot of their own live shop.

**Before making any claim about what this repo does or doesn't contain:**
```bash
git fetch origin && git rev-list --count HEAD..origin/main    # how far behind am I?
git ls-tree -r --name-only origin/main | grep -i <thing>      # does it exist on main?
```
A `grep` over the working tree only tells you about the branch you happen to be standing on. This repo has many parallel branches and two machines pushing to it — assume the local checkout is stale until proven otherwise.

**Getting current was fiddly:** an untracked local `.gitignore` (containing just `.vercel`) blocked the merge, and modified `.claude/settings.local.json` + `package-lock.json` blocked it again. Resolved by moving `.gitignore` aside and `git stash push -u`. **`stash@{0}` ("pre-main-pull local cruft") is still held** — it has the local settings/lock changes and the old `.gitignore` in it. `stash@{1}` is older, pre-existing.

**Also still unmerged:** `new-badge` is 2 commits ahead of main — `popcode_new.svg` (the pinwheel badge) and the on-device CLIP identification swap (also on `clip-on-device-identification`). Neither is on main.

#### Brand ground truth (write this down, a design session got every detail wrong)

The user had a Claude Design session produce `~/Desktop/popcode-homepage-design-brief.md`. Its §5 Brand invented an entire identity. Correct values, verified in the repo:

- **Type: CooperBT (display serif) + Inter (body sans)**, both loaded from `/assets/fonts.css` — Inter via a Google Fonts `@import`, CooperBT base64-embedded in that file. 19 pages link it. NOT Fraunces/Nunito.
- **Mark: a black-and-white six-blade pinwheel** — `public/assets/popcode-symbol.png` (270×270, black on transparent) and `popcode-symbol.rev.png` (white). NOT a Fibonacci dot-spiral. The dot-spiral (`popcode_icon.svg`, the 2026-04-17 Illustrator conversion) is the OLDER mark and is still the favicon.
- **Wordmark: gradient purple→blue** — `Popcode_logo.png`, `#7f36fe` → `#5b91fa`. In-app accent gradient is `linear-gradient(135deg,#7657FC,#589AF9)`. So the *mark* is monochrome but the *brand* is not — anyone told "black and white" will strip the gradient out of the logotype.
- **"Badge" is shipped product language.** `howto.html:235` says "Popcode badge"; "Order badge stickers" is a live Sticker Mule product. The brief's "never say badge, say symbol" is a real rename touching UI and a physical product, not a style note.

Lesson: a design session working from a *description* of Popcode will get the identity wrong. Give it the repo, or build in the repo.

#### CLAUDE.md is itself stale

`## Terminology` still says user-facing copy is "Projects". The shipped nav (built by `/nav.js`) reads **My Popcodes / My Designs / Shop / Past Views / How It Works**. Worth a cleanup pass.

#### Pricing + hosting decisions (made in conversation; NOT derivable from code)

- **Hosting is time-bounded and included: five years from creation**, one number for both printed products and free-tier popcodes, renewable, with an email before it lapses. Chosen over perpetual because a printed sale earns ~29% gross once (`PRINT_MARKUP_MULTIPLIER` default **1.4** in `api/create-checkout.js:29`) and was committing to hosting forever.
- **Nothing enforces it.** There is no `expires_at` / `expiry` / `retention` column anywhere in `supabase/migrations/`. `collections.created_at` derives the term without a migration. Renewal email + any enforcement is future work — and in practice it should warn-and-renew, never delete.
- **The homepage publishes no subscription table.** Stripe is `mode: 'payment'` only; there is no recurring billing and no plan/quota/tier concept anywhere in the codebase. Platform side says "free while we're in beta".
- **Why the brief's 4-tier ladder was rejected:** it meters *popcodes*, and popcodes are nearly free (~8¢/month for 100 stored, using the April cost model). The cost driver is **views** — egress per scan. So it charged most where cost was lowest and offered "Venue — unlimited $99" to exactly the profile that generates the most views.

#### The gallery / museum segment (user raised it; analysis worth keeping)

**The economics invert, and I had this backwards at first.** I'd flagged venues as the cost risk — true for video, wrong for tours, because:
- **Identification is once per visitor, not per artwork.** Point at one work → `/api/identify` resolves the gallery → the `.mind` loads → every other work tracks on-device. That's the Phase 3–5 architecture from June, and it is *already* museum-shaped: one handle, whole scoped library.
- **Audio is ~40× smaller than video** (~1 MB for two minutes vs ~40 MB).
- Net: roughly **a fifth of a cent per visitor**. A thousand visitors a month costs a couple of dollars.

**Wedge:** no app install (Bloomberg Connects and Smartify both require a download — the biggest drop-off in visitor tech) and no QR beside the artwork. **Threat: Bloomberg Connects is free to institutions**, philanthropically funded — don't plan to win on price; win on "no app" and on small galleries Bloomberg won't onboard.

**Gaps between what's built and what an institution needs** (bounded, nothing architectural):
1. White-label cover is hard-gated to one email — `edit.html:832` `ADMIN_EMAIL` **plus a DB trigger** (`enforce_cover_config_admin`, see 2026-04-29). Biggest item; mostly un-gating.
2. Analytics is admin-only (`analytics.html:406`).
3. **Transcripts: the `transcript` column exists and is plumbed through `edit.html`, but nothing generates it.** The Whisper edge function was planned in April and never built. For consumers a nice-to-have; for institutions an accessibility/procurement blocker.
4. No multi-language.

**Decision: put a tertiary "For galleries" door on the homepage now (mailto to info@popcodeapp.com), build nothing until a pilot says yes.** Building 1–4 speculatively is weeks of work aimed at a months-long sales cycle while the print shop is already transacting. Pricing for this segment is *quoted* (per-exhibition or annual site licence), never a self-serve tier — the brief's "Show Pass $49" has the right shape and is off by roughly an order of magnitude.

#### What the homepage actually is now

Replaced the gradient splash (`public/index.html`) with a full marketing page. Structure: hero (rotating word) → code entry → two equal forks → six use cases (four audio-led) → four-step how-it-works → pricing → galleries strip → "Every printed photo used to be the end of the story." → FAQ → footer.

- **The code-entry field was preserved.** It is load-bearing: printed pieces carry a short code and this is how someone who typed `popcode.app` on its own reaches their picture.
- Uses a **light marketing header, deliberately not `/nav.js`** — that one builds the signed-in app chrome (Cart, Log Out, My Popcodes) and assumes an account.
- No QR imagery. `Make anything play.` is in the HTML by default so the page reads correctly with JS off and under `prefers-reduced-motion`; the rotating word layers on top, and the slot is fixed-width — **verified the h1 stays exactly 155px tall across all eight words**, so it never jitters.

**Then the hosting callout got demoted (`8403499`) — and this is the more interesting note.** I had put "every Popcode includes five years of hosting…" in a highlighted panel in the pricing section. The user pushed back: *"is your average new user even thinking of hosting… this feels too in the weeds."* They were right. A first-time visitor is still working out what the product is; a prominent panel about expiry hands them an objection they hadn't formed and reads as a catch rather than as candour. The term still gets a straight answer in the FAQ under "How long does it keep working?" — which is where someone hunting for the catch actually goes. **General principle: being honest about an awkward detail is about saying it once in the right place, not about making it prominent.** Placement is the decision, not disclosure.

#### THE ASSET GAP — biggest blocker to launching this page

**The repo contains exactly one real photograph: `public/assets/sample-photo.jpg`.** Everything else in `/assets` is a Prodigi product mockup with the same leopard in it (`book.jpg`, `framed.jpg`, `print.jpg`, `canvas.jpg`, `tile.jpg`), a blank white board book, or an icon. The first fork draft showed six near-identical leopards side by side.

Worked around it: one strong visual per fork card (the photo-book mockup on the left; a CSS-built print card with the Popcode symbol on the right), and the hero's audio card reuses the *same* photo with a sepia/desaturate filter and a different `object-position` so it reads as an older picture. **It works at a glance and will not survive scrutiny — both hero cards are the same photograph.** Real photography is the single biggest thing between this and a launchable page.

#### Not built / still open

- **The brief's "Try it right now" block** (a live scannable target the visitor scans off their own monitor). Never decided, never built — the code-entry bar occupies that slot. MindAR against a glossy backlit screen with moiré is untested; don't ship it unverified.
- **`shop.html:259` bounces anonymous visitors to `/auth.html`.** The new homepage sends cold traffic straight at that wall with equal weight. Browse-then-auth-at-checkout is the obvious shape. Deliberately left alone as a separate change.
- Marketing site `marketing/index.html` (popcodeapp.com) is now inconsistent with this page — separate domain, older story. Decide whether it redirects or gets rebuilt.

#### Build gotchas worth not relearning

- **Browser-pane screenshots only render at `scrollTop === 0` while the pane is hidden.** Scrolled captures came back as blank cream with not even the sticky header — which is the tell that it's a capture artifact, not a CSS bug (a sticky header would paint at any scroll). Workaround that worked: `document.querySelectorAll(sel).forEach(e=>e.style.display='none')` on the preceding sections so the target section sits at the top, then screenshot at 0.
- **`padding: 26px 0` on an element that also carries `.wrap` silently killed the horizontal padding** — same element, higher specificity, so the shorthand zeroed left/right and the code bar ran edge-to-edge on mobile. Use `padding-block` when adding vertical padding to something that already has horizontal padding from another class.
- `html { scroll-behavior: smooth }` makes `window.scrollTo` animate, so a screenshot immediately after lands mid-animation. Set `scrollBehavior='auto'` first when scripting.
- Check `document.documentElement.scrollWidth > clientWidth` after any rotated/negatively-positioned decorative element — the hero's overlapping audio card overflowed the viewport at 375px until it was pinned to the stage edge.
- Preview server for this static site: `.claude/launch.json` with `python3 -m http.server 8099 --directory public` (left untracked, not committed).

### 2026-09-02 — Photos uploading as black squares: root-caused and fixed across all five upload paths (shipped to prod)

**Branch `claude/photos-black-squares-bug-l9a2co`, commit `fc70937`, fast-forwarded to `main` (no merge commit) — live in prod.** No PR (user said "push to prod"). No schema/env/RLS change. Files: `public/{calendar,book,boardbook,create,edit}.html`.

**The report:** user uploaded 9 photos to the calendar maker; 3 came into the tray as solid black squares (screenshot), the other 6 fine. "Photos seem to be fine" outside Popcode.

**First diagnostic that mattered — the tray's own fallback tells you where the bug is.** `.tray-thumb` has `background-color:#eee` and renders `background-image:url(objectURL)`. So a photo that FAILS to load shows LIGHT GRAY, not black. Pure black means the stored JPEG genuinely contains black pixels — i.e. the bug is in our re-encode, not in loading/CORS/format support. That one observation ruled out the entire "unsupported format / broken URL" family in about a minute. Remember it: **gray tile = couldn't load; black tile = we baked black pixels.**

**Root cause: JPEG has no alpha channel.** All five upload paths downscale a photo by drawing it onto a canvas and calling `toBlob('image/jpeg')`. A fresh canvas starts fully transparent, so anything the draw didn't paint opaquely flattens to **solid black** on encode. Two distinct ways a photo hit that:

1. **Any source with transparency.** Reproduced in headless Chromium: a fully transparent PNG → mean `[0,0,0]` (pure black); a 50%-alpha white PNG → `[125,125,125]` (blended halfway to black instead of staying `[250,250,250]`). Affects RGBA PNG, LA (gray+alpha) PNG, anything with a cutout.
2. **A source that decoded to nothing.** `createImageBitmap` can *resolve* with a blank bitmap of the correct dimensions rather than throwing — **Safari does this for some HEICs**. The `catch` never fires, `w0/h0` look sane, `drawImage` is a silent no-op, and the encode yields a fully black JPEG. Reproduced by monkey-patching `createImageBitmap` to return a blank 4000×3000 bitmap: **ordinary JPEGs came out `[0,0,0]` under the old code.** This is the one that best fits the user's symptom (some photos black, some fine, from one import batch).

Things that are NOT the cause (tested, all passed unchanged): huge 108MP JPEG, 30000px-wide panorama, CMYK JPEG, 16-bit grayscale PNG. Canvas size limits and decoder exotica were red herrings.

**The fix (same shape in all five files, inline — deliberately NOT a shared .js):**
- New helper block `// ── Safe photo decoding` with `releaseSource` / `sourcePaints` / `loadViaImg` / `decodeDrawable` / `drawOpaque`, inserted where each file's old `loadDecodable` / `loadDecodablePhoto` lived.
- **`drawOpaque(ctx, src, w, h)`** fills `#ffffff` before `drawImage` and try/catches the draw. Kills the transparency→black class outright (semi-transparent white now encodes 252, was 125).
- **`sourcePaints(src)`** probes a 24×24 downsample and returns true only if some pixel is both opaque (`a>8`) and lit (`any channel >8`). Catches the blank-bitmap case that no `try/catch` can.
- **`decodeDrawable(file)`** tries `createImageBitmap` then `<img>`, and **retries through the other path when the first decodes blank** — this is what actually rescues the Safari/HEIC photo rather than merely detecting it. Returns null only when no path yields pixels.
- When nothing decodes, **keep the original file bytes** (subject to each file's existing `HARD_MAX_MB`/`PHOTO_HARD_MAX_MB` cap) instead of substituting a black JPEG. An original we can't shrink beats a black square.
- `loadViaImg` awaits `img.decode()` after `onload`, closing the load-vs-decode race (Safari can fire load before pixels are ready).
- Also hardened the **`resizeForCompile` / `resizeImage`** steps (calendar, boardbook, book, create, edit) that feed the MindAR compile — a blacked-out compile target would have silently broken *scanning*, not just the thumbnail.

**Behavior notes / accepted trade-offs:**
- A genuinely near-black photo (night shot below RGB 8 across all 576 probe samples) now keeps its original file instead of being downscaled. Non-destructive — larger upload, correct photo.
- A fully transparent source now renders as the `#eee` gray tile rather than a black one, which is *diagnostically useful*: gray now means "this source really has no pixels."
- Left alone on purpose: badge SVG→PNG rasterizers (`toDataURL('image/png')`, alpha is wanted) and video-frame→JPEG previews (frames are opaque).

**Testing method worth reusing — extract the real page code, don't retype it.** These pages are auth-gated and load supabase-js/Sentry from CDNs that are 403 in-sandbox, so driving the live page is impractical. Instead `sed -n` the helper block + optimizer function straight out of each HTML file, paste into a tiny harness page with a file input, and run it under `playwright-core` (chromium `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`). Test images generated with PIL. Two conditions per file: normal, and with `createImageBitmap` monkey-patched to return blank bitmaps. Assert no output has mean RGB < 12. **Clean A/B: old code `[0,0,0]`, new code correct pixels** — that A/B is what proved both the reproduction and the fix, and is far more convincing than eyeballing. Harness lives in the scratchpad (`all.mjs`, `t.mjs`, `page*.html`); `playwright-core` installed in the scratchpad ONLY (`node_modules` is tracked in this repo).
- Always `node --check` every inline `<script>` block after editing these files (the white-screen SyntaxError failure mode from 2026-04-12). Did it after every patch; all five clean.
- Verified helpers and their callers land in the **same inline script block** in each file (function declarations hoist, so definition order doesn't matter — block identity does).

**Deliberately NOT centralized.** Five near-identical copies of this helper block now exist. That's on purpose: the 2026-07-17 note warns that `order.html` broke when it depended on `/composite.js` (404/cache flake), and the repo's idiom is inline duplication. If this ever does get centralized, do it knowingly, not as a drive-by.

**Told the user, and still open:**
- **Already-uploaded black photos are NOT repaired** — the black JPEG is what's in Supabase storage. Those must be re-added. No backfill was written.
- Needs a real-device check with the actual failing photos; I could only verify against synthesized inputs. The useful signal if any still misbehave: **gray tile** (source truly empty) vs **still black** (a path not yet seen).
- Not built, but cheap and probably worth it later: surface a toast when a photo can't be decoded at all (today an undecodable HEIC silently uploads as-is and viewers on other platforms may not see it either).

**Also this session (no code):** user asked mid-session for a read on some "five years of hosting" onboarding copy, then said "wrong session" — nothing was changed for it. Ignore; it belongs to whatever other Popcode session they had open.
### 2026-09-02 (concurrent session) — Board-book parity marathon + a unified crop model + back-cover branding + assorted fixes

**Note:** ran concurrently with the "black squares" session above (both 2026-09-02, different branches/machines). That session's `fc70937` photo-decode fix layered cleanly on top of this session's code (merge base `fd5b9fc`); only these two CLAUDE.md entries conflicted — both kept.

**Branch `claude/shop-cards-book-design-3uaneo`. All pushed straight to `main` (prod) commit-by-commit via the fast-forward flow** (`git push -u origin <branch>` → `git fetch origin main` → `git push origin <branch>:main`). One very long session; the board book was brought to full parity with the photo book, then a real crop bug forced a unification of the crop model across editor/render/print, then the printed back-cover branding was built to spec. `origin/main == my branch` throughout (verified repeatedly — no real parallel divergence this session, but see the "phantom parallel build" note).

#### Board book (`public/boardbook.html`) — brought to full photo-book parity
Shipped in several commits:
- **Popcode sheet = book.html's** (Video|Audio toggle, upload+compress video, record/upload audio). `photoHasMedia` now also counts `existingVideoUrl/existingAudioUrl` (loaded popcodes) — without this a re-saved edit silently dropped the popcode and the badge didn't show.
- **Page badge** = the real `popcode_icon.svg` mark (not a purple pill); **counts** "N pages · N placed · N popcoded"; button enables at placed>0 (video/audio enforced at save with an alert); **result screen** matches book.html (no emoji, View book / Copy link / Back to My Designs).
- **Empty slots show the picture-frame icon** (Popsa-style `.slot.empty` bg), not "tap a photo" text. **Blank inside covers** render as labelled white pages (SPREAD_ROWS uses `'blank'` markers; `null` = the empty gap beside the cover).
- **Photo options menu** rebuilt with icons + sub-labels + Move/swap + Replace (mirrors book.html's `openSlotMenu`).
- **Edit from My Designs**: `boardbook.html?id={slug}` reopens a saved board book (`loadBoardBookForEdit` rebuilds photos/slots/cover/popcodes from `book_layout` + `collection_items`; save UPDATEs the row, reuses unchanged photos/media, skips the `.mind` recompile when the popcoded set is unchanged). `manage.html` gained an Edit action for boardbook (`/boardbook.html?id=`).
- **Connected spreads**: facing pages butt together into one open spread — outer-only corner rounding, shared shadow, a **center gutter crease** (`::after` gradient), right-page label right-aligned.
- Floating dock (Photos / Cover), drag-to-place / drag-from-tray, Edit Photo — all ported earlier in the run.

#### THE BIG ONE — unified crop-and-reposition model (photo book + board book)
**Symptom the user hit:** the ghosted Edit Photo editor let you pan the whole photo behind a fixed crop window, but the **page slot still rendered with `object-fit:cover` + a %-translate** — a *different* model that cannot pan a landscape photo inside a portrait/square slot (it just shows the center strip and, when panned, reveals empty). So the editor showed one crop and the page/print showed another (it "included the out-of-frame part").

**Fix (load-bearing, applies everywhere a placed photo is drawn):** one model — the photo is drawn at its cover/contain-fit size, centered in the box, then panned by a fraction of the box and scaled/rotated. Implemented as:
- `layoutPhotoInSlot(slot, img)` — sizes/positions each `.slot-img` in JS on render/resize (NO object-fit). `.slot-img` CSS is now just `position:absolute; transform-origin:center` (removed inset/width/height/object-fit). The render call is `layoutAllSlotPhotos()` in the rAF after `render()`. Adjust is stashed on the img as `data-adj` (JSON).
- `drawPhotoAdjusted(ctx,img,adjust,x,y,w,h)` — the canvas bake (same math). Board book already used it for print; **added it to book.html** and made the photo-book **proof/print bake each slot** via `bakeSlotImgForPrint()` (draws the true crop to a canvas → background div; slot imgs load `crossorigin="anonymous"` so the canvas is clean; falls back to the old background-div path if a bake fails/taints).
- The editor's `layoutEp` uses the identical math (it already did after the ghost rework), so editor == page == print. Verified headless: a 22% pan moves the photo by exactly 22% of the slot width; left = (W-imgW)/2 + ox/100·W.
- **`clampPan(a, boxW, boxH, iw, ih)`** — bounds the pan to the photo's cover-fit overflow per axis (fit mode centers, no pan) so you can NEVER drag the crop past the photo edge and reveal the gray slot background. Applied in `layoutEp` (editor), `layoutPhotoInSlot` (render), and `drawPhotoAdjusted` (print). This fixed the "gray shows when cropping" regression that the full-pan model introduced.
- Cover/back-cover photos (`.cv-photo-img`/`.bc-img`) still use the OLD `adjustTransform` + object-fit model — a separate surface, left as a follow-up. If a repositioned cover shows the same bug, extend the model there.

**Ghosted Edit Photo preview** (shipped just before the crop fix): the modal now shows the WHOLE photo with the out-of-frame area ghosted (light wash) via `.ep-stage` + `.ep-window` (a crop window with a big light `box-shadow` masking outside it) + a full-size `.ep-img` laid out by `layoutEp`. Stage bg is light (`#f4f3f0`), not black — the old black letterbox bars are gone.

#### Photo book cover + back cover (`public/book.html`)
- **Clicking the cover = edit the PHOTO** (Edit Photo if set, else pick one) — no longer opens the title editor.
- **Edit title** (header ⋯ → Edit title) is now a **3-field form**: Eyebrow / Title / **Dates·year**, with a live preview. The **year shows on the cover date line and the spine** via `coverYear()` (extracts a 4-digit year from the dates string) — so include the year in the dates field ("July 14–24, 2024" → spine "2024").
- **Auto-fill also fills the front cover** (first photo, a shared reference so it still flows into pages; changeable via ⋯).
- **Both covers accept tap-to-place and drag-drop** (front + back), with a place-target highlight — same easy flow as page slots (`placeCoverFromTray`). Before, the back cover only took a photo via the ⋯ device picker.
- **Back-cover branded panel built to the approved PDF spec** (`67b6d94b-PopcodeBackCover.pdf`, A4 landscape 11.7×8.3"): Popcode wordmark at **1.25" wide**, two instruction lines at **8pt Inter semibold / 16pt leading** — "Go to **popcode.app/{slug}** on your phone." / "Scan photos with the Popcode symbol." — then the **Popcode symbol** below. Full-bleed photos reverse everything (white logo/text + reversed symbol on the dark scrim); inset uses dark-on-white. Sizes are print-accurate: computed as cqw off `currentBookSize().wIn` so 1.25"/8pt/16pt hold at A4 **and** 8×8. Positioned via **`cqh`** so the logo sits ~halfway between the image bottom and the page bottom (measured: logo center 80% vs 81% halfway; dropped ~5/8"). Same renderer feeds builder + proof/print.
  - **The "Popcode symbol" is a distinct mark** (black disc + white pinwheel), NOT `popcode_icon.svg` (the dots). It's not a brand asset in the repo — I **extracted it from the PDF** with pymupdf+PIL (render at high DPI, isolate the disc below the text, circular alpha mask) → `public/assets/popcode-symbol.png`, and a color-inverted `popcode-symbol.rev.png` (white disc + black pinwheel) for full-bleed. **Reusable recipe:** `pip install pymupdf pillow numpy`; `page.get_pixmap(matrix=Matrix(12,12))`; restrict the dark-pixel search to a tight box (the first attempt caught the text and made it non-square); circular mask; `255-crop` for the reversed variant.

#### Other fixes this session
- **Audio Popcode playback broken on iOS** — desktop Chrome/Firefox record `audio/webm;codecs=opus`, which **iOS Safari cannot decode at all** (plays on desktop, silent on iPhone). New shared **`public/audio-wav.js`** (`window.normalizeAudio(blob, ext)`) decodes and re-encodes to a mono 22.05 kHz 16-bit **WAV** (universally playable); **only converts webm/ogg** so iOS's own `audio/mp4` passes through untouched. Wired into every recording flow (create, edit, book, boardbook, calendar) + the boardbook "upload audio" path. Best-effort with fallback to the original blob. **Existing webm recordings need a one-time Re-record** (which now saves WAV) to play on mobile. Verified: mp4 passes through, WAV round-trips playable, 0 errors. (Sandbox Chromium has NO H.264 decoder and Web Audio works — so WAV round-trip is testable but real video playback isn't.)
- **Proof PDF missing the scan badge** (photo book) — `buildProof` hid the builder badge but never baked the real one (unlike `buildBookPrintPdf`). Added the same `rasterizeBadge()` bake to `buildProof` so the proof matches the printed page.
- **Download-with-badge in `manage.html`** now available for **book, board book, and calendar** (was hidden for all "product" kinds). `showDownload = !isProduct || kind in {book,boardbook,calendar}`. Board books/books read popcoded photos from `collection_items` (existing modal path); **calendars have no collection_items** so `openDownloadModal` now sources cover + month photos from `book_layout.calendar`. Single-image print designs stay without it.
- **Stripe "webhook failing" emails** (no code change) — the failing URLs (`api.stg.popcode.deploy-cd.com/...`, `api.dev...`, and earlier `api.popcodeapp.com/api/v1/checkout/webhook`) are from the **OLD pre-static backend that no longer exists** — not in the repo anywhere. Current webhook is `popcode.app/api/stripe-webhook` (a backup; `api/finalize-order.js` is the real fulfillment). Action = user deletes the orphaned endpoints in the Stripe dashboard (test + live). Recurs — don't chase it as a code bug.

#### Product / messaging decisions (no code)
- **Back-cover-vs-postcard audit** (all shop products): print the URL+instructions **ON the product** for the 3 multi-page products (photo book, calendar, board book — they have a back cover/PDF we already generate); ship a **companion postcard** for the single/wall pieces (prints, framed, framed canvas, canvas, acrylic, tiles — no printable back, and a URL would wreck the art). Postcard = a Prodigi greeting-card SKU as a 2nd line item on the same order (verify SKU in sandbox; not built).
- **Anti-QR positioning is a pillar**: Popcode is the *anti-QR-code* solution, so **no QR** anywhere (it would muddy the message). Copy avoids the word "scan" near a code; the flow is **"Go to popcode.app → point your phone at the photo → it plays"** (the photo IS the trigger; `popcode.app/{slug}` is the direct-link fallback). Copy text itself is being finalized in a separate chat; the placement/length brief was handed over.

#### Gotchas / lessons
- **`object-fit: cover` + `transform: translate(%)` is NOT a crop-reposition** — cover clips the image to the element box, so translating at scale 1 reveals empty, not more image. To truly pan a mismatched-aspect photo you must draw it at full cover-fit size and clip with the parent. This is why the whole crop model had to be unified.
- **Always clamp a reposition pan** to the image's cover-fit overflow, or you get background bleed (and printed bars).
- **iOS Safari cannot play WebM/Opus** — normalize recorded audio to WAV (or AAC) at capture time; don't trust "the <audio> element plays both formats".
- **Extracting a mark from a PDF**: pymupdf render + PIL circular-mask works, but constrain the dark-pixel search tightly or you'll grab nearby text and mis-square the crop.
- **"Phantom parallel build" confusion**: the user twice showed cover screenshots with features NOT in the repo (a "Change Theme" menu; a rich undo/redo/char-count "Edit Title" modal). `origin/main` never had them, and `origin/main == my HEAD` the whole time. Treat such screenshots as *design references / another session's unpushed local*, not the source of truth — build against the repo (= prod) and say so. (This session's own "did the page-tool circles get added?" scare was just my earlier commit `6fdbf99`, not a parallel push.)
- **Headless-testing these pages** (unchanged recipe): `playwright-core` in the scratchpad, chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `cd public && python3 -m http.server 8249`, `page.route` to stub `@supabase/supabase-js` + `/config.js` and abort sentry/unsplash. The stubbed supabase is empty-data by default; for edit/download flows write a richer stub. **html2canvas + jsPDF are CDN-blocked in the sandbox**, so the actual PDF proof/print export cannot be run here — verify proofs on prod.

#### Still queued / follow-ups
- Extend the unified crop model + clamp to the **cover/back-cover photos** (still object-fit).
- Verify on real hardware: iOS audio after a Re-record; the photo-book **proof PDF** back cover + baked crops; the **calendar** download path (new code); board-book badge placement on square pages.
- Port the branded back-cover panel to the **calendar** and **board book** back covers (this session did the photo book only).
- Postcard product (Prodigi greeting-card SKU) for the single/wall shop items.
- Board-book ordering is still admin-gated; drop the gate when ready.

### 2026-09-02 (later) — International print ordering: 8 → 231 destinations, phone field, customs note, unservable-route handling

**Branch `claude/intl-printed-orders-7e8vs6`, PR #62, merged to `main` as `97b70ee` — live in prod.** Started as the question "what do I need to do to allow customers outside the US to order printed products?" Answer: less than expected on the server, more than expected on the front end.

**The key finding: the backend was already country-agnostic.** `prodigi-quote.js`, `create-checkout.js` and `finalize-order.js` all pass `destinationCountryCode` straight through, `stateOrCounty` was already optional server-side, and `cleanRecipient()` already stripped empty address fields. Nothing server-side limited us to the US. The blocker was purely the hardcoded 8-option `<select>` in `order.html:272` plus the free-text 2-letter code boxes in `book.html` / `calendar.html` (which defaulted to `US` and required the customer to know their own ISO code).

**What shipped:**
- **`public/countries.js`** (NEW) — shared destination list + `popcodeFillCountrySelect(el, selected)` / `popcodeCountryName(code)`. Generated from `/usr/share/iso-codes/json/iso_3166-1.json` (available in the sandbox — no npm package needed). Flat alphabetical, US preselected. Loaded via `<script src="/countries.js">` in order/book/calendar.
- **Phone field** on all three surfaces (`#r-phone`, `#bo-phone`), optional, carried as `recipient.phoneNumber`. Prodigi's docs: *"While recipient email and phoneNumber are technically optional, it's highly recommended you include these if you have international orders."*
- **Customs/VAT disclosure** shown only for non-US destinations (`#intl-note`, `#bo-intl`).
- **`cleanRecipient()` now prunes blank TOP-LEVEL strings, not just blank address fields.** An unfilled phone would have sent `phoneNumber: ""` and hit the exact `MustNotBeEmptyOrWhitespace` error that empty `line2` hit on 2026-06-27. Same bug class, one level up.
- **Prodigi quote failures are now classified.** A 4xx means "this SKU / destination / shipping-method combo isn't servable" — deterministic. Previously it was retried 3×, logged to Sentry as an outage, and returned as a raw 500 with the Prodigi error string pasted into the price note. Now `prodigiQuote()` sets `err.unservable` on 4xx, both retry loops bail immediately, and the customer sees *"We can't ship this size to Japan. Try another size, or a different shipping speed."* before payment. Matters far more at 231 countries than at 8.

**THE COLLISION — a parallel session shipped the same feature mid-PR.** While #62 was open, another session (Opus 4.8, on the user's Mac) pushed `ba11dd0 "broaden Ship-to country list from 8 to 126 destinations"` straight to `main`: 126 hardcoded `<option>` tags in `order.html` only. Same goal, narrower reach — no shared list, no book/calendar, no phone, no customs note, no server-side handling. Resolution: one clean conflict in the `<select>` block, resolved in favour of this branch's `countries.js`.

**That collision caught a real mistake in my list, which is the lesson worth keeping.** Diffing the two lists showed theirs had 4 codes mine lacked: `LB`, `VE`, `XK`, `ZW`. My first cut excluded 24 countries as "sanctioned" — but most of those (Zimbabwe, Lebanon, Haiti, Myanmar, Somalia, Sudan, Iraq, Nicaragua, DRC…) are under **targeted** sanctions, which restrict *named individuals and entities*, not ordinary retail shipping. Excluding whole countries over those just turns away legitimate customers, and taking my list wholesale would have **silently removed destinations that had already shipped to prod**. Narrowed the exclusion to comprehensive embargoes / no-payment-or-carrier-route only: **`CU, IR, KP, SY, RU, BY`**, plus uninhabited territories, plus **Kosovo added manually as `XK`** (a user-assigned code, so it isn't in ISO 3166-1 proper). Final: **231 destinations, a strict superset of what main already shipped.**

**Verified on the real preview by the user: Japan, Brazil, South Africa and India all quoted successfully.** That was the one thing headless testing couldn't prove (the quote endpoint was mocked), and it's the premise the whole feature rests on.

**Still-open decisions (NOT bugs, deliberately deferred):**
- **Postcode is still REQUIRED on every address** (client + server). Blocks the handful of countries with no postal system (Hong Kong, UAE, parts of Ireland). Deliberate: `/api/prodigi-quote` only takes a *country code*, so a postcode Prodigi rejects surfaces **after payment** as `prodigi_failed`. Relaxing it safely means validating the full address pre-charge.
- **International customers are charged in USD**, because Prodigi quotes in your *merchant account* currency, not the destination's. Prodigi's quote API accepts a `currencyCode` override. If you ever use it, note `priceFromQuote()` rounds to whole units of 100 minor — wrong for zero-decimal currencies (JPY).
- **Markup still applies to shipping** (1.4× on product + shipping). Now live for 231 countries, so a small item to a distant country will look very expensive. The safe lever (already noted 2026-06-28): mark up product only, pass shipping at cost.
- Shipping methods stay hardcoded (`Budget`/`Standard`/`Express` in order.html; `Standard` for books/calendars). Prodigi also has `StandardPlus`/`Overnight`, and availability varies by destination — an unavailable one now fails *gracefully* rather than being filtered out up front.
- Prodigi variants carry a `shipsTo` array that `lib/print/catalog.mjs` doesn't model, so unservable size/country pairs are discovered at quote time rather than hidden from the UI.

**Gotchas worth not relearning:**
- **`/usr/share/iso-codes/json/iso_3166-1.json` exists in the sandbox** — 249 entries with `alpha_2`, `name`, `common_name`. Prefer `common_name` when present ("South Korea" not "Korea, Republic of"). No network or npm package needed.
- **Don't post-process generated JS with a blanket `.replace("'", '"')`** — it detonates on "Côte d'Ivoire". Use `json.dumps()` per value for correct escaping.
- **`git push` printing `remote: …/pull/new/<branch>` does NOT mean a PR exists.** It's GitHub's hint on first push of a new branch. The user reasonably read it as "the PR is already open" — it wasn't, which is also why no Vercel preview existed and they were still looking at prod's 8-country list. If someone says "the list is limited", **check whether they're looking at prod or a preview before debugging anything.**
- **This sandbox's git/GitHub clock is skewed ~2 weeks behind.** My commits and the PR's `created_at` were stamped `2026-08-19` while the repo's real history (from the user's Macs) ran to `2026-09-02`. I initially trusted the git timestamps over the environment date and got the entry heading wrong. **Trust the environment date + the repo's own recent commit dates from the user's machines; do NOT trust this sandbox's clock.**
- Testing pattern (unchanged, still works): `playwright-core` installed **in the scratchpad only** (`node_modules` is tracked in this repo), chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `cd public && python3 -m http.server 8099`, `page.route` to stub supabase-js / abort Sentry + Google Fonts. `order.html`'s shipping form lives on a hidden step — walk the parent chain from `#country` setting `style.display=''` to reveal it. **Avoid `pkill -f "http.server"`** — it killed the shell (exit 144); use `nohup … &` and just leave the old one.

**Parallel-Macs collisions are now a pattern, not an anomaly** — this is the fifth (2026-04-17, 2026-04-22, 2026-08-18, and twice today: `ba11dd0` mid-PR, then `7af09ce` session notes landing while I was writing mine). **`git fetch origin main` before starting AND before pushing**, on every machine.

### 2026-09-04 — Security audit: anon key had full read/write on the content tables (fixed, shipped to prod)

**Branch `claude/popcode-image-recognition-safety-i1pwp7`, commit `635dd44`, fast-forwarded to `main`. No PR. Migration RUN in prod the same session. Storage half still OPEN — see "unfinished" at the bottom.**

Started as a product question ("is it risky to launch on MindAR alone instead of the CLIP/Replicate identification gating?"), turned into a real security finding. Short answer to the original question: **MindAR-only is the LOWER-risk launch.** The identification layer was never a safety gate — in slug-world the scope is the URL (a foreign key, can't go wrong); in handle-world it's a cosine similarity search that can pick the wrong book within a creator. Slug-only has strictly fewer failure modes. Also cheaper, no Replicate cold-start, and no viewer camera frames leaving the device. The CLIP work isn't wasted, it's just answering a question we haven't been forced to ask.

#### THE FINDING — anon could read AND write `collections` / `collection_items`

The anon key in `public/config.js` (public by design, served to every visitor) had far more than read.

**The probe technique worth reusing — a CONTROL TEST, not a single request.** An anon `INSERT {}` into `collections` returned `23502` (null value in "slug"), while the same insert into `print_orders` / `pop_images` / `cart_items` returned `42501` "new row violates row-level security policy". Different error = different layer. The locked tables were rejected by the *policy*; collections got *through* the policy and was only stopped by a column constraint. **Never conclude from one endpoint's error alone — compare against a table you know is locked.**

Also: **an UPDATE probe with a non-matching filter is USELESS.** A denied update and a permitted-but-zero-row update both return 204. I ran that first and it proved nothing. (The definitive no-op-write test got blocked by the sandbox classifier, so UPDATE/DELETE were never conclusively confirmed — the policies were rebuilt from scratch anyway.)

**Why it mattered more here than for a normal web app: we ship physical objects.** `view.html` builds its media map as `mediaMap[item.target_index] = {...}`, so a *second* `collection_items` row with an existing target_index silently overrides what plays. Insert alone was enough to repoint the video behind an already-printed book. You cannot recall a printed book. (Sanity check on the mechanism: `9xyx1ryb` legitimately returns **78 items for 21 real pages** — the known duplicate-target_index data issue. Duplicates genuinely occur and last-one-wins is genuinely how it resolves.)

**Reads were unfiltered too.** `GET /rest/v1/collections?select=*` with no filter returned all **45** collections (names, slugs, `user_id`, full `book_layout` photo manifest); `collection_items` returned all **294** media URLs. PostgREST cannot require a filter — "anon may read this table" means "anon may read the whole table". Default cap is 1000 rows, so at this scale one request really did get everything.

**Correctly locked already (good news):** `print_orders` (shipping addresses), `cart_items`, `beta_feedback`, `scan_events`, `creators`, `pop_images`, `identify_events` all returned 0 rows to anon. The sensitive PII was fine. This was purely a content-tables problem — a leftover from the original "anon key, no auth currently" design that the app grew around.

Also confirmed clean while in there: **zero `innerHTML` in view.html or scan.html** (all DB text via `textContent`), vendored+SRI'd MindAR/A-Frame, and every admin endpoint (`update-print-order`, `retry-print-order`, `delete-account`) properly Bearer-token + email gated. The player wrapper itself was never the problem.

#### WHAT SHIPPED

- **`supabase/migrations/2026-09-04-lock-content-tables.sql`** — DO-block drops every existing policy on `collections`/`collection_items`/`experiences` (they were hand-made in the dashboard, names not in git), then rebuilds owner-scoped: `user_id = auth.uid()` for writes, owner-or-admin for reads. `collection_items` inherits ownership via an `exists` subquery on its parent (+ indexes). `experiences` gets RLS on with **no** client policies. New `is_popcode_admin()` helper lists BOTH admin emails.
- **`api/collection.js`** — `GET /api/collection?slug=` , service key, returns ONLY `slug, name, kind, mind_file_url, cover_config, items[]`. Never `user_id`, never `book_layout`. Legacy `experiences` fallback included. Slug regex rejects anything malformed. 60s CDN window.
- **Two SECURITY DEFINER RPCs** for the reads that legitimately cross ownership — both require an explicit candidate list (capped) so neither can enumerate:
  - `popcode_slugs_taken(text[])` — slug availability. Granted to **anon too**, because `scan.html`'s `resolveMiscasedSlug` calls it unauthenticated.
  - `popcode_view_cards(text[])` — Past Views name + first photo. A viewer's scanned list is by definition other people's projects.
- **Wiring:** `view.html` → endpoint; `slug.js` `takenSet()` → RPC; `views.html` `attachThumbs()` + name lookup → RPC; `log-event.js` prefers service key (falls back to anon) so anon INSERT on `scan_events` can be revoked later.

**Callers checked so the policies wouldn't break anything:** analytics.html's unfiltered admin read (covered by the admin exception), cart/shop/design/order/manage (all own-rows), `manage.html:474`'s orphan-claim (**0 rows have NULL user_id**, so it's a silent no-op — verified before relying on it). **Behavior change worth knowing: `edit.html` previously let any signed-in user open another user's slug; now it returns nothing. That's a fix, not a regression.**

#### THE DEPLOY-ORDERING MISTAKE (my error — don't repeat it)

Correct rule: **code first, SQL second** (SQL-first breaks the public viewer, since prod's `view.html` still read the DB directly). Vercel swaps deployments atomically, so there's no broken-viewer window — while the endpoint 404s, the OLD build is still serving.

**What I got wrong:** I told the user to verify "Past Views thumbnails" and "create-a-link suggestions" *before* running the SQL. Both call the new RPCs, which don't exist until the SQL runs. So in the gap: thumbnails went blank, and **creating a project was blocked** with *"Couldn't check that link right now — try again"* (slug.js's catch — it fails safely, no crash, no duplicate slugs). Names still rendered because `views.html` falls back to localStorage. Diagnosed by calling the RPCs directly → `PGRST202 "Could not find the function ... in the schema cache"`.
**Lesson: when a deploy splits across code and DB, enumerate which features are down IN THE GAP and keep the gap to minutes.** Only the scan test is valid before the SQL.

#### VERIFICATION (all run from outside, against prod)

| | Before | After |
|---|---|---|
| Read all collections | 45 rows | `[]` / `*/0` |
| Read all collection_items | 294 rows | 0 |
| Read experiences | 2 rows | 0 |
| Anon `INSERT {}` | `23502` (allowed) | `42501` (blocked) |

Endpoint: returns correct data, **no `user_id`, no `book_layout`**, 404 on unknown slug, 400 on `../../etc/passwd`, legacy fallback works. `popcode_slugs_taken` correctly reports taken/free. `popcode_view_cards` returns name + thumb. 101-slug request refused. User confirmed on a real iPhone: **scan works, video plays.**

#### STORAGE WAS THE WORST OF IT — found, fixed and verified the same session (rated wrong twice first)

**I first called this a minor follow-up, then "anon can list". Both were wrong.** The live policy turned out to be:
`"Allow all on experiences"  cmd: ALL  roles: {public}  qual: (bucket_id = 'experiences')`. In Postgres `public` means EVERYONE including anon, and `ALL` covers INSERT/UPDATE/DELETE. **So the public key could upload, overwrite and delete any file in the bucket** — worse than the database hole, because overwriting `{slug}/video_0.mp4` repoints every printed copy of that book directly (no duplicate-row trick), deleting `{slug}/target.mind` stops it scanning, and deleted files are actually gone. The conclusive evidence is the policy text itself (`ALL` + `public`), not a probe. **A correction worth carrying forward: I first cited "a DELETE of a non-existent path returns `NoSuchKey`, not a permission error" as proof anon could delete. That was an over-read — the Storage API looks the object up BEFORE RLS decides, so a missing path returns `NoSuchKey` either way. It still returns `NoSuchKey` today, with anon writes provably blocked.** The valid write test is an anonymous UPLOAD to a junk path: accepted before, `403 "new row violates row-level security policy"` after.

**Fix written: `supabase/migrations/2026-09-04-lock-storage-bucket.sql`** — drops the wide-open policy, replaces it with four scoped to `authenticated`. Public playback is unaffected because Supabase serves a public bucket's `/object/public/...` URLs **without consulting RLS**; what goes away is the `/object/list/...` API and every anonymous write. **No deploy ordering needed** — no shipped code depends on it. Verified every upload (create/edit/book/boardbook/calendar/design/order) and every list (analytics cost panel, manage delete, edit rename) happens while signed in.

**Known limit, deliberately not fixed:** this closes anonymous access, not cross-account access — any signed-in user can still write to any `{slug}/` folder. Scoping per owner needs a CODE change first: `create.html` uploads files (~1141-1185) **before** inserting the collections row (~1199), so a policy joining `name -> collections.slug -> user_id` would block project creation outright. Reserve the row before the uploads, then tighten.

**THE METHOD LESSON, three times over this session:** I twice under-rated storage because I accepted a status code (`http 200`) and then a partial read instead of looking at the actual policy definition. **`select policyname, cmd, roles, qual from pg_policies where schemaname='storage' and tablename='objects'` is the ground truth — read it FIRST, before probing behaviour.** The probes tell you what happened; the policy tells you what's allowed.

**RAN IN PROD AND VERIFIED THE SAME SESSION.** Operator pasted it in the Supabase SQL editor; "Success. No rows returned". Verified from outside with only the public key:

| | Before | After |
|---|---|---|
| anon list bucket | 52 project folders | `[]` |
| anon list one folder | photo_0.jpg / target.mind / video_0.mp4 | `[]` |
| anon upload to a junk path | accepted | `403` "new row violates row-level security policy" |
| public photo, NO key | 200 | 200, 2.0 MB (unchanged, as intended) |
| public `.mind`, NO key | 200 | 200, 9.6 MB (unchanged, as intended) |

User then confirmed on their side: **creating a project (upload), scanning a book (playback), and the Analytics cost panel (admin bucket listing) all still work.** So the four authenticated policies cover every real code path.

**The superseded intermediate reading** (kept because the mistake is the lesson): I first reported this as "anon can LIST the bucket" — a read-only enumeration problem — because I called the list endpoint, got `http 200`, and never read the body. The body would have shown all 52 folders. And listing was only the symptom; `cmd: ALL` + `roles: {public}` was the disease.

**STILL OPEN after today (both deliberate, neither anonymous-facing):**

1. **Cross-account storage writes.** The fix above closes ANONYMOUS access, not cross-account: any signed-in user can still write to any `{slug}/` folder. Scoping per owner needs a CODE change first — `create.html` uploads the files (~1141-1185) BEFORE inserting the collections row (~1199), so a policy joining `name -> collections.slug -> user_id` would block project creation outright. Reserve the row before the uploads, then tighten.
2. **Fake analytics (genuinely low):** anon can INSERT `scan_events` → fake analytics rows. `log-event.js` already prefers the service key; revoke the anon grant once that's confirmed live in every Vercel env. Both items are written up as commented instructions at the bottom of the migration file (everything after `commit;` is comments only — safe to paste the whole file).

#### LATE ADDITION — vendor docs taken off the public web

Asked whether a coder can tell we use MindAR, and whether hiding it is worth anything. **Yes, completely visible, and no, don't try:** the `<script src>` says `/vendor/mindar/1.2.2-popcode.1/...`, the DOM carries `mindar-image` / `mindar-image-system` / `mindar-image-target`, and MindAR + A-Frame are MIT — the licence *requires* keeping the copyright notice, so stripping it to conceal the dependency would be a violation. Obfuscation buys hours against anyone who cares, makes our own iOS debugging worse, and the moat was never the tracker (`npm install mind-ar` is an afternoon; the print pipeline, the builders, and the accumulated media-session fixes are not).

**But four internal docs were being web-served** (all returned 200): both `PROVENANCE.md` files, A-Frame's, and `stop-start-fix.patch` — our literal source diff — plus `assets/music/README.md`. They name the exact pinned upstream commit, which is the one genuinely useful piece of reconnaissance in there. Moved to `docs/`, mirroring the old paths (commit `7a2faa8`); verified 404 after deploy while the bundles still serve at their recorded byte counts (mindar 1,734,013). **`LICENSE` files deliberately stay under `public/`** — MIT text, correct to ship. Source comments in create/edit/scan/view and the Stack section now point at `docs/`; session-history entries keep the old paths since they were accurate when written.

**General rule this exposes: `public/` IS the web root.** Any `.md`, `.patch` or note dropped next to an asset gets published. Keep engineering docs in `docs/`.

#### GOTCHAS

- **A Supabase key's project ref is in the JWT**, but a Vercel "Sensitive" var can't be revealed to check it. Instead just hit the endpoint on the preview — JSON back = right key.
- **Emergency rollback** if a policy change breaks the viewer (restores read only, still safer than before):
  `create policy emergency_anon_read on public.collections for select to anon using (true);` (+ same for `collection_items`).
- **GitHub raw link for pasting SQL:** `raw.githubusercontent.com/CurtMiddleton/popcode-demo/main/<path>`. A bare `github.com/...` URL pasted into GitHub's file-finder is read as a *path inside the branch you're viewing* → confusing 404 naming the feature branch.
- Testing `view.html` headless (this worked well): playwright-core in the **scratchpad only** (`node_modules` is tracked in this repo), chromium `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `cd public && python3 -m http.server`, `page.route` to stub `@supabase/supabase-js` + abort sentry/fonts, and **stub `/api/collection` to test the happy path, a 404 and a 500** — all three must reach the right screen, never an infinite spinner.
- Foreground `sleep` is blocked in this sandbox; use a backgrounded `until` loop to wait for a deploy.

### 2026-09-09 — Analytics: creator-side activity logging, Content tab + contact sheet, all-time funnel (all shipped to prod)

**Branch `main`, three commits pushed straight to prod: `8de7a87`, `83d2eeb`, `f8159a9`.** No PRs. One migration, already run in prod (see below). Started as a security question about a viewer in Egypt, turned into the analytics work the dashboard had been missing.

#### Part 0 — the "unauthorized user in Egypt?" scare (NOT a breach; keep this reasoning)

User saw `16th Birthday` — created by **Zoe Wietbrock** in Munich — being viewed from **Giza, Egypt**, tagged with Zoe's name, and asked whether someone had her account. Answer: **no, it was Zoe's own iPhone on a trip.** How that was established, because the same question will recur:

- **The `USER` column in the Activity Log is NOT the project owner.** `view.html:551` reads the *viewer's own* Supabase session (`db.auth.getSession()`) and posts `user_id` to `/api/log-event`; analytics joins that to `auth.users`. So a stranger with the link shows `—`; a name means that browser was holding that person's session. Proof it isn't the owner: several `16th Birthday` rows show `—`.
- Decisive evidence it was one travelling phone, from `select ... from scan_events where user_id = '<zoe>' group by country, city, ip, user_agent`:
  - **Same device across an OS update.** Munich Aug 17 = `Version/26.6`; Munich Aug 21 and BOTH Egypt sessions = `Version/26.6.1`. Everything else byte-identical (`OS 18_7`, WebKit `605.1.15`, `Mobile/15E148`).
  - **A network handover mid-session.** Giza IP `41.33.246.187` last event `18:30:11`, Cairo IP `156.187.0.143` first event `18:30:19` — **8 seconds apart**, and Giza/Cairo are one metro area. Two people cannot produce that.
  - German IPs `46.142.174.30` / `46.142.175.3` are the same /23 = one ISP handing out rotating addresses.
- **Do NOT read the `MODEL` column as device identity** — `parseModel()` maps iOS 18+ → "iPhone 16+", a coarse OS bucket. Matching models prove nothing.
- Blast radius if it HAD been real: being signed in buys nothing on the viewer (link-based sharing, `view.html` gates nothing on auth). The exposure is the account — `manage.html`/`edit.html` are RLS'd by `user_id`.
- **Decision: did NOT build session revocation.** No payment data on these accounts; worst case is someone editing their own projects. Trigger to build it = first paying customer, or a real reported compromise.
- Gotcha that wasted a round trip: the first diagnostic query returned "Success. No rows returned" because the user pasted `'<16th-birthday-slug>'` **literally**. The dashboard shows project *names*, not slugs. Give queries that need no substitution (key off a known IP, or join `collections` on `name ilike`).

#### Part 1 — creator-side activity logging (`8de7a87`)

The dashboard only ever saw **consumption** (scan_events written solely by view.html), so it could not answer *"did this signup ever make anything?"* — the metric that matters most for a beta.

- **NEW `public/activity.js`** (65 lines) — `window.logActivity(eventType, { slug, user_id })`. Posts to the existing `/api/log-event`. `keepalive: true` (create.html redirects right after saving). Fire-and-forget, swallows its own errors — logging must never break a save the user waited 30s for. Callers pass their **own** `user_id`, so the file holds no Supabase client and couples to nothing.
- **Event types:** `signup`, `create_project`, `create_book`, `create_boardbook`, `create_calendar`, `create_montage`, `save_design`.
- **Call sites:** `auth.html:291` (signUp — captures `data.user.id`, which exists even while email confirmation is pending), `create.html:1205` (project), `create.html:1653` (montage), `book.html:4123`, `boardbook.html:1688`, `calendar.html:1704`, `order.html:1375` (save design). **All three makers log only in the INSERT branch, not the update branch** — deliberate, so "Created" doesn't fill with edits. Consequence: **editing a design/book logs nothing.** Add `edit_*` events if that's ever wanted.
- **Reused `scan_events` rather than a new table.** Free session grouping, geo, device parsing, and the Activity Log renders it with no new plumbing. Cost: the table name is now a misnomer (mild, next to `collections` meaning Projects).
- **MIGRATION (RUN IN PROD, confirmed `is_nullable = YES`):** `supabase/migrations/2026-09-09-activity-events.sql` → `alter table public.scan_events alter column slug drop not null;`. Needed because `signup` and `create_montage` fire before any project row exists. `api/log-event.js` has `ACCOUNT_EVENTS = ['signup','create_montage']` — those may omit a slug; everything else still must supply one. **The `get_events_with_users` RPC did NOT need recreating** — only a null constraint was relaxed, no column added (contrast the 2026-04-15 lesson).

#### Part 2 — Activity Log fixes (same commit)

- **`User` → `Signed in as`.** Deviated from the user's suggested "Viewer (signed in)" *because* creation events now share the stream — half the rows are creators, so "Viewer" would be wrong exactly on the new rows.
- **Location trail**: a session that moves now renders `Giza → Cairo` (first 3 places, then `→ …`) instead of only the first city, which hid the movement that caused the whole scare.
- **Session keying rewritten** (`buildSessions`, analytics.html:594). Anonymous events now key on **user_agent**, not IP, and an event whose **IP changed** only joins the session within **2 minutes** (a real handover is seconds); unchanged IP keeps the 30-min window. Fixes both directions of the old IP key: one anon visitor whose IP rotated was split in two, and two people behind one household connection were merged into one.
- `eventCategory()` (analytics.html:538) maps event_type → `created` / `viewed` / `ordered`; drives the new **All / Created / Viewed / Ordered** filter pills. `projectCell()` (:534) renders account-level (null-slug) events as **"Account"**.

#### Part 3 — Content tab + contact sheet (`83d2eeb`)

- **Library + Projects merged into one `Content` tab** (8 tabs → 7). Trick used: two separate `.tab-body` elements both carry `data-tab="content"`, and `showTab` reveals every matching one — so the static `#library-section` (outside `#main-content`) and the by-photo body (inside it) display together without moving any DOM. `RANGE_TABS` now `['activity','overview','content']`.
- **Contact sheet** — clicking a project opens a grid of every photo with the media it triggers (`Video` / `Audio` / **`No media`**) plus its scan count, instead of dropping into the first video. `lbMode` is `'sheet'` or `'single'`; `lbApplyMode()` (analytics.html ~1745) switches, `lbRenderSheet()` (:1776) draws it. Opening from a **By Photo thumbnail still jumps straight to that photo** (`openLightbox(slug, targetIndex)` sets single mode when the index matches). **Escape steps single → sheet** before closing, so browsing a project doesn't mean reopening it after every photo. Per-photo counts come from a new `cachedTargetCounts` keyed `'slug|target_index'`, populated in `renderByVideo` from `get_target_scan_counts`.
- **User feedback mid-build: tiles were too small to recognise a photo.** Fixed to `minmax(240px, 1fr)`, `aspect-ratio: 4/3`, **`object-fit: contain`** (the old square `cover` crop was cutting the top and bottom off every portrait shot — fatal for a sheet whose job is showing what a viewer aims a camera at). The media tag moved from floating over the image into the caption row, because on portrait photos it sat on empty letterbox.

#### Part 4 — REGRESSION I introduced in Part 1, fixed in Part 3 (watch for this shape)

Putting creation events in `scan_events` silently polluted two view-only metrics, and they were live in prod for a while:
- **By Project** grew a row for every project the moment it was *created* (all zeros) plus one **literally named `null`** for account-level events with no slug.
- **Unique Visitors** counted creators who had never opened a scanner.

Both now early-return unless `eventCategory(e.event_type) === 'viewed'`. **Lesson: when you add a new event class to a shared table, audit every aggregate that iterates the whole event array** — the ones filtering on an explicit `event_type` were fine; the ones grouping by `slug` or mapping `ip_address` were not.

#### Part 5 — all-time funnel (`f8159a9`)

`Overview` now opens with a five-stage funnel counting **accounts**: Signed up → Made something → Got scanned → Media played → Ordered a print, each with count-of-total and **drop-off vs the previous stage** (amber under 50%). `renderFunnel()` at analytics.html:1545.

- **Deliberately ALL-TIME while the rest of Overview stays range-scoped**, with a note on the page saying so. A lifetime question answered over a rolling 30 days would score an account that joined in March and built something yesterday as a failure.
- **It works retroactively** — stages derive from `cachedUsers` (`get_all_users`, max_rows 1000), `cachedCols`, and `cachedPrints`, all of which have full history. It did NOT need the new events, so it shows real numbers on the existing ~35 accounts immediately.
- `ensureAllEvents()` (:1508) pulls all-time events once (`get_events_with_users` with `days_back: 0`, falling back to `fetchAllRows('scan_events', …)`), promise-cached.
- **`#funnel-wrap` lives inside `#main-content`, which `loadAnalytics` rebuilds on every range change**, so `loadFunnel()` is called again at the end of that rebuild (cheap — all inputs are promise-cached). Same hazard applies to anything else added inside `#main-content`.
- "Ordered a print" matches orders to accounts by **`buyer_email`**, so an order placed under a different email than the account's won't attribute. Only `PAID_PLUS` statuses count (a `pending` order is correctly excluded).

#### Gotchas / lessons

- **After deploying, an already-open tab runs the OLD JavaScript.** User saved a design, it didn't log, and it looked like a bug — a hard refresh fixed it. Check this FIRST for any "my new client-side event didn't fire" report; verify the deploy actually landed by `curl`ing prod for the new string rather than trusting timing.
- **This machine is NOT the Linux sandbox.** `/opt/pw-browsers` and a scratchpad `playwright-core` do **not** exist here. Use the **Browser pane** (`preview_start` with a `.claude/launch.json` entry) instead. Recipe that worked: copy `analytics.html` into the scratchpad, swap the supabase-js CDN tag for a local `stub.js`, strip `sentry-init.js` / `nav.js` / `beta-feedback.js` / `config.js`, and inject dummy `#logout-btn` + `#user-greeting` (nav.js normally provides them). **Remove the temp launch config afterwards** — it points at a scratchpad path.
- The stub's `config.js` replacement must define **`SUPABASE_URL` / `SUPABASE_KEY`** as bare `const`s (those exact names), not `window.*`.
- **An instant-resolving stub session exposes latent TDZ** the real network hides: `loadPrints()` runs before `let cachedPrints` initialises. Added a 60ms delay in the stub's `getSession` to test realistically. **That fragility is still in prod code** — untouched, currently masked by the network round-trip. Same class as the scan.html TDZ in the 2026-06-12 notes.
- Pure logic (session grouping, categories) is far better tested in **node** by extracting the real functions with a brace-matching script than by driving the DOM — 10 assertions ran in a second, including the negative cases (10-min IP change must split; two UAs on one IP must stay separate).
- **PIL is available on this Mac** (11.3.0). Generating deliberately mixed-aspect test photos with visible borders and TOP/BOTTOM labels is what made the contact-sheet cropping bug obvious at a glance.
- Console noise in the stub harness that is NOT real: `nav-btn` null (stripped nav.js), `fonts.googleapis.com`, and 404s for fake media URLs.

#### Still open / next

- **People** and **Business** tab merges from the agreed IA (Accounts gaining per-person made/received/ordered; Prints + Cost combined to show margin). Tidying, not new information.
- `analytics.html` is still gated to **`curtmid@gmail.com` only** (`ADMIN_EMAIL`, ~line 418) — signing in as `curt@theworkshop.works` bounces to manage.html. One-line fix, offered twice, not yet taken.
- Consider `edit_project` / `edit_design` events if edits should be visible.
- Fix the `cachedPrints` TDZ properly.
- No backfill: creation events only exist from 2026-09-09 onward. The **funnel** is unaffected (it reads accounts/collections/orders), but the Activity Log's "Created" filter will look empty for anything older.

### 2026-09-15 — Companion postcard → branded insert, shipping as its own line, smaller print sizes, two mobile-layout bugs

**Branch `claude/eloquent-turing-7vwk8u`. Fast-forward merges to `main` across the session: `08bfba8`, `1e8f3fc`, `933320d`, `35723df`, `cc87dd5` (plus `3c4d8fe` = PR #66, the emergency disable). All live in prod.** Long session: built the companion postcard from `docs/postcard-brief.md`, detoured through mobile layout forensics, and ended with the insert switched on for every Prodigi product. One prod-money bug found and killed, one code review that caught six real defects, and two mobile bugs that had been shipping for a while.

#### THE $76 BUG (the important one — PR #66, merged first)
The companion postcard was originally a **second line item** (`GLOBAL-POST-MOH-6X4-BLA`). A real order quoted **$76**. Cause: **that card SKU is fulfilled in the UK/EU while the prints were fulfilled in the US**, so Prodigi split the order into two shipments and charged a second transatlantic parcel — for a postcard. Prodigi groups a shipment by `labCode`; **two SKUs in one order are only one parcel if the same lab makes both.** Disabled immediately (PR #66) before anything else.

**The rebuild: the card is no longer a line item at all.** Prodigi supports per-order **branding** (`branding: { postcard: { url } }`) — the fulfilling lab prints and inserts the card *in the same box*. No second SKU, no second parcel, no line on the quote. This is the right shape for anything that ships *with* a product.
- `COMPANION_INSERT_FOR` = the set of product types that get one. Started as the wall-art set (print/framed/framedcanvas/canvas/acrylic/tile); **later in the session the user extended it to books and calendars too** — see "Turned on" below.
- `companionInsertCollectionId(lines)` → a single collection id or null; `companionInsertPath(slug)` → `{slug}/companion-card.png`; `companionInsertBranding(url)`.
- **`COMPANION_INSERT.enabled` was `false` for most of the session**, then flipped on at the end — see "Turned on" below.
- **Migration `supabase/migrations/2026-09-14-print-orders-branding.sql`** — `alter table print_orders add column if not exists branding jsonb;`. **RUN IN PROD this session.**
- **DEPLOY ORDER MATTERS AND IS THE OPPOSITE OF THE 2026-09-04 CASE: SQL FIRST, THEN MERGE.** `create-checkout` puts `branding` in the `print_orders` insert **unconditionally** (`api/create-checkout.js:179`) — it's in the payload as `null` even with the feature disabled. PostgREST rejects the whole insert if the column is missing, so merging first takes **checkout down for every customer**. The feature flag does not protect you. Adding a nullable column nothing reads yet is completely safe, so SQL-first has no window at all.

#### `public/postcard-render.js` (NEW) — one module for design AND export
Deliberate departure from the repo's inline-duplication idiom, and worth keeping: the artboard (`postcard.html`) and the checkout upload **must not drift**, because a drifted card prints wrong on a physical object. Verified byte-identical to the pre-extraction export before committing. Exports `window.PopcodePostcard = { buildInsert, CARD, COPY, PRINT, FACES, buildCard, setBaselines, renderFace, buildAssets, buildProofPdf, downloadFace, artGradient }`.
- **A6 LANDSCAPE, 148 × 105mm, `bleedIn: 0`** — pre-cut stock, the file edge IS the card edge. Prodigi states the size in *portrait* notation ("A6, 105 × 148mm") and I built portrait from it first; the user caught it ("the postcard needs to be landscape like tyhe design"). **ORIENTATION IS STILL UNCONFIRMED — check the proof image on the first real order and flip if Prodigi rotates or crops it.**
- `setBaselines()` measures the font's baseline offset with a zero-size inline-block probe, because **CSS positions a line box, not a baseline**, and the artwork's geometry is baseline-relative.
- Verified against the approved PDF at 300 DPI: mean difference 1.57/255, every element within 0.96pt.

#### Shipping as its own line at checkout (user asked: "so the customer knows what they are paying for")
`quoteCart` now returns `{ groups, totalMinor, currency, shippingMinor, printingMinor }`, `sumQuoteMinor` returns `{ totalMinor, itemsMinor, shippingMinor, currency }`, and `cart.html` shows the split. Shipping is rounded to whole dollars and clamped so it can never exceed the total minus $1.

#### `/code-review high` over the branch — SIX findings, all real, all fixed (`08bfba8`)
Ran it before merging because the branch touches the quote path, and that's the thing that takes checkout down when it's wrong. Worth noting **every one was a genuine defect** — this is the review that earned its keep:
1. **`renderFace(FACES[i], slug)`** — the signature had changed to `(slug)` when the card went single-sided, so the proof PDF printed the literal string `popcode.app/front`.
2. **Proof PDF still `orientation: 'portrait'`** after the landscape flip. jsPDF reorders the format array to match the orientation, so it cropped ~a third off the right edge.
3. **`branding.postcard.url` named without checking the file exists.** The upload is best-effort, and **Prodigi fetches that URL server-side — a 404 becomes a failed order AFTER the customer has paid.** Now HEAD-checked in `create-checkout` (same guard `create-montage.js` uses on a soundtrack URL); missing artwork just means no card.
4. **`order.html` never uploaded the insert at all** — it checks out directly, so a buy-now order could only ever have named a missing file. (My own miss: I added the upload to `cart.html` and forgot the second path.) Also fixed a wrong state reference there: `state.sourceSlug` → `state.selectedPhoto && state.selectedPhoto.slug`.
5. **Printify groups reported no shipping**, so a mixed cart showed the whole carrier cost as printing and "Shipping $0.00" — directly undercutting the line-item split. `printify.mjs` now tracks and returns `shippingMinor`. Verified end-to-end: Prodigi + Printify cart → Printing $65.00 / Shipping $21.00 / Total $86.00, both carriers' shipping in the shipping line, parts summing to the total.
6. Stale contradictory comment in `cart-quote.js`.

**Near-misses from earlier in the same session, worth remembering as a class:**
- An `@import` regex `[^;]+;` **broke on the semicolons inside a Google Fonts URL** and silently killed CooperBT. Caught by comparing glyph widths, not by looking. Fixed with `/@import\s+url\([^)]*\)\s*;/g`.
- The artifact inliner used `String.replace` with a **string** replacement, so `$` was special and mangled the module's `${}`. Use a **function** replacement.
- `assertFaceRendered` sampled the card *centre*, which is background in landscape but white type in portrait — it rejected a good render. Now samples corners + a 5×5 grid (layout-independent).
- I deleted `PRODUCT_PROVIDER`/`providerFor` during a catalogue rewrite and restored them; and `cart-quote.js` was still calling the removed `withCompanionCards`, which would have thrown on **every** quote.

#### Smaller print sizes (`1e8f3fc`) — and the SKU that doesn't exist
Smallest print and framed print were both 8×10. Added **prints 4×6, 5×7, 6×6, 8×8** and **frames 5×7, 8×8** (each in the existing black/white/natural).
- **All verified with `scripts/verify-prodigi-sku.mjs` before going live.** 6 of 7 resolved. **`GLOBAL-CFP-6x6` returned 404 — there is no 6×6 classic frame**, even though the bare 6×6 print exists. Removed, with a comment so nobody re-adds it for symmetry.
- Verification also settled two things previously marked as guesses in the code: frame colours come back as `black | brown | dark grey | gold | light grey | natural | silver | white` (our lowercase trio was already right), and **the CFP SKU carries its own glaze and mount**, so no extra attribute is needed.
- **Keep `lib/print/catalog.mjs` and the client mirror in `order.html` in sync.** I wrote a throwaway cross-check (extract the mirror with a regex, `eval` it, compare every id + aspect against the server catalogue, and flag server variants with no UI entry) — run something like it after any catalogue edit. Gotcha: strip the trailing `;` before `eval`, or you get `Unexpected token ';'`.
- **Pricing caveat told to the user, unresolved:** markup is 1.4× on product **and** shipping, so a 5×7 costing ~$3 to make lands at **$12–$21** depending on shipping. The small sizes are not yet the cheap entry point they look like. The lever that never risks eating cost is still the one from 2026-06-28: mark up product only, pass shipping at cost.

#### iOS zoom-on-focus, app-wide (`8814860`)
**iOS Safari zooms the page whenever you focus an input whose computed font-size is under 16px.** `create.html` and `auth.html` were already fixed; everything else was still 15px — **including every field of the checkout address form**, which zooms field-by-field as you tab through an address. Raised to 16px in `order.html`, `cart.html`, `boardbook.html`, `account.html`, `reset.html`, with a comment at each saying *why* (15px otherwise reads as a free style choice and will get "tidied" back). Verified by measuring the computed font-size of every visible input across thirteen pages, and confirmed the 1px bump adds no horizontal overflow at 320/390.

#### manage.html: delete button dropping to its own row (`933320d`)
User reported "my popcodes now 2 lines and trash icon dropping". **I initially blamed Safari page zoom and was wrong** — they checked, it read 100%, and it still broke. The real cause: the layout fitted at 430px and ran a few pixels over below that, so it looked fine on a Pro Max and broke on every smaller iPhone. Three narrow misses:
- The `@media (max-width: 600px)` rule **GREW** the Shop button (height 36→40, padding 18→20, font 14→15) and it kept a `margin-left` the flex gap already provided. Height is worth keeping for the thumb; the width is what overflowed.
- `.card-actions` was a flat wrap container with `margin-left: auto` on delete, so once the row overflowed **delete was the item that wrapped**, and the auto margin parked it alone at the right.
- Heading + "+ New Popcode" came within ~1px of the available width at 390.

**The structural fix is the part that matters: the other five buttons are now wrapped in `.card-actions-main`, so `.card-actions` has exactly two flex children.** The group wraps internally if it must and delete stays beside it, vertically centred — it cannot be stranded at any width. Also narrowed the 28px side gutter to 20px below 390px, which buys back the width without shrinking a tap target. Result, measured at 320/344/360/375/390/402/414/430/600/1100: **one row from 375px up (was 414px), heading on one line from 360px up (was 390px).**

**CSS gotcha that cost a round trip:** the gutter override lost to `.collections-list { padding: 0 28px }` declared *further down the file*. Media queries add no specificity — **an equally specific rule only wins from later in the source**, so that block is deliberately parked at the end of the `<style>`, with a comment saying so.

#### Turned on, and widened to every Prodigi product (`35723df`, `cc87dd5`)
At the end of the session the user said to flip it on — "i'm the only one ordering" — so the first real order is the proof rather than a staging step.

- **`enabled: true`.** Low blast radius by construction: an insert is not part of the quote and the fulfilling lab puts it in the same box, so it cannot repeat the line item's second-parcel mistake or move a price. `create-checkout` HEAD-checks the artwork first, so a slug whose card never uploaded ships without one instead of failing after payment.
- **Then extended to books and calendars.** The user's reasoning: a back cover is easy to miss, the card costs nothing extra, so reinforce the URL everywhere. `COMPANION_INSERT_FOR` is now print/framed/framedcanvas/canvas/acrylic/tile/**book**/**calendar**.
- **Adding them to the set was NOT sufficient, and this is the trap.** `book.html` and `calendar.html` check out directly and did not load `postcard-render.js`, so no card would ever have been built or uploaded — and the HEAD guard would have silently shipped them cardless with no error anywhere. Both now load the renderer and upload before checkout, best-effort, matching `cart.html` / `order.html`. **Any future checkout surface needs the same two things: the script tag AND the upload.**
- **`boardbook` is deliberately EXCLUDED and must stay that way.** It is the one Printify product, and `providers/printify.mjs` ignores `branding` entirely — there is no insert mechanism on that side. Listing it would generate and upload a card nobody prints. If board books should carry the URL it has to go into the artwork the builder produces. A comment at the set says so.
- Before putting the renderer on two more pages I checked it couldn't leak: every rule in its injected CSS is `.pc-*` scoped and its two `@font-face` families (CooperBT, FilsonPro) are ones both pages already load. Smoke-tested book/calendar/cart/order — renderer present, nothing visible added, zero page errors.
- **Verification limit worth knowing:** `lib/print/catalog.mjs` is a server module, never served to a browser, and `create-checkout` needs auth — so the flag state cannot be confirmed by fetching prod. **The first real order is the check:** the `print_orders` row should carry `branding = {"postcard":{"url":"…/companion-card.png"}}`, and the Prodigi proof image settles the orientation question.

#### LESSONS
- **A `200` on a path that already existed proves nothing about your deploy.** I checked `/postcard-render.js` after merging, got 200, and nearly called it done — prod was serving the *old* copy of that file from the earlier disable PR. **Poll for a string that only exists in the new build** (I used the changed `popcode-insert-` filename). Byte-count comparison against `git show <sha>:<path>` is the quick way to tell which commit prod is actually on.
- **When a user says a page looks wrong on their phone, measure before theorising.** I burned a chunk of this session on a zoom hypothesis. What actually settled it: fetch prod's copy of the page, `diff` it against local (byte-identical → the page isn't the variable), then sweep viewport widths 320→430 in headless Chromium measuring `scrollWidth` vs `clientWidth` and the computed geometry of the specific elements. The breakpoint falls out immediately.
- **Trust the user's observation over your own model.** They said 100% and it was still breaking; they were right and I was wrong.
- **Fonts matter in headless layout tests.** Blocking Google Fonts changes wrap points and will make a marginal-fit bug invisible. `fonts.googleapis.com` and `fonts.gstatic.com` are **reachable from this sandbox** (200), and CooperBT/Inter are base64 `@font-face` in **`public/assets/fonts.css`** served locally — so don't block fonts when measuring layout.
- **Verify every new Prodigi SKU.** One of seven was fictitious, and a bad SKU now surfaces as *"we can't ship this size to X"* (from the 2026-09-02 unservable classification) — misleading rather than obviously broken.

#### STATE AT END OF SESSION
- `main` = `cc87dd5` (then `39e20c8`/later for these notes). Branch and main identical.
- **`COMPANION_INSERT.enabled = true`**, for print/framed/framedcanvas/canvas/acrylic/tile/book/calendar. Board books excluded (Printify has no insert mechanism).
- **No real order has carried a card yet** — the first one proves the whole chain (upload → HEAD check → Prodigi branding) and settles orientation.
- **Insert orientation unconfirmed** — settle it from the first real order's proof image.
- **Two pre-existing horizontal-overflow bugs found and NOT fixed** (both confirmed identical before/after my changes, so neither is a regression): `order.html` scrolls sideways ~16px on phones (`.detail` grid children need `min-width: 0` — grid items default to `min-width: auto`); `manage.html` scrolls sideways at ~768px tablet width. Offered both, user hasn't picked them up.
- Small-size pricing (shipping-dominated) still open as a business decision.

### 2026-09-17 — Scan screen rebuilt around the animated mark; and the decision to stay on slugs

**Branch `claude/exciting-wright-3piri0`. Four commits, each fast-forwarded to `main` and verified live on prod: `ebce03b`, `57a4751`, `dbeae61`, `ae62541`.** No PRs. No schema, env or RLS change. Files: `public/view.html`, `public/scan.html`, `public/desktop-note.js`.

#### THE STRATEGIC OUTCOME (the reason this session mattered)

**Decision: stay on the slug model. Leave the CLIP/handle work where it is — built, merged, live, and dormant. Revisit only on a specific trigger.** This came out of the user asking, plainly, what the handle model actually buys and whether slugs scale. The answer is worth not re-deriving:

- **Slugs scale better, not worse.** Identification cost per scan is zero forever regardless of user count; accuracy can't degrade as a library grows (the match set is scoped to one project's ~20 photos *by construction*, and the FK can't be wrong); no third-party runtime dependency; no viewer camera frames leaving the device. The `.mind` file grows per *project*, not per account.
- **The handle model doesn't fix a scaling problem, it fixes a convenience one** — "recipient doesn't need to know which Popcode they're holding" — and charges latency, per-scan inference cost, and a shrinking accuracy margin for it. Phase 4's own numbers: real matches 0.62–0.72 vs a noise ceiling of 0.595, a **0.025 margin** that narrows as a creator's library grows. And the Replicate cold start (5–6s on first scan) was never solved.
- **The benefit it sounds like it has, it doesn't.** "Lost the insert card" isn't rescued by a handle — you'd have to know the handle too. It only helps someone who has already scanned something of that creator's.
- **You already solved the URL-on-the-object problem twice**: back covers on books/calendars, companion inserts on flat and wall art. The handle model's headline benefit aims at a gap the print pipeline closed.
- **Running both is the worst option** — two scan entrances, two URL shapes to explain, a print-time decision about which to print, and doubled surface on the most fragile code in the app. The drift is already demonstrated: `scan.html` sat on the old pill and brackets for months while `view.html` moved on.
- **Cheaper alternative that gets most of the benefit:** a creator landing page at `popcode.app/u/{handle}` that just lists their projects — "which one are you holding?". One memorable address per creator, no inference, no latency, no per-scan cost, no accuracy margin, nothing leaving the phone. Costs one tap. Roughly a day against weeks.
- **What would change the answer:** a white-label/brand deal where "one address for the whole campaign" is the actual sale (the Mission to Ghana shape — `popcode.app/ghana` on everything). That's a revenue reason. Absent that, the CLIP work isn't wasted, it's **banked**.

#### CLIP/handle: exactly what state it's in (verified, not from notes)

Worth writing down because it's easy to over- or under-estimate:

- **It is genuinely live in prod.** `POST /api/identify` with `{"handle":"zzznotreal"}` → `{"matched":false,"reason":"unknown_handle"}`. With `Curt` it sails past the creator lookup **and** past the `new_identification_enabled` gate and reaches Replicate (failed only because the probe frame was a deliberately truncated JPEG). So @Curt is flag-enabled and the pipeline runs end to end.
- **But nothing feeds it.** `grep` over `create.html` / `edit.html` / `book.html` / `manage.html` → **zero** references to `pop_images` or `/api/identify`. The index is written by exactly one thing: `scripts/seed-identification.mjs`, run by hand from a terminal. No handle field on signup, no UI anywhere, no embedding on save.
- **Population: two books (Max, Addie), seeded by hand in June, reachable only by Curt.** A project created today doesn't join. `manage.html` only ever generates `popcode.app/{slug}`.
- **ROUTING LANDMINE if handles are ever opened up.** `vercel.json` rewrites are ordered, and rule 2 is `/:slug([a-z0-9][a-z0-9-]{2,29})` → `view.html`. That matches **any all-lowercase 3–30 char path**. So a creator who picks the handle `sarah` is routed to the viewer, which looks up a collection with that slug, finds nothing, and shows **"Experience not found."** `Curt` only works because of the capital C. Handles are currently disambiguated from slugs *by capitalisation and length* — fine for a one-person experiment, unshippable as a feature. A real resolver is prerequisite work.

#### What shipped to prod

The viewer's scan screen is now built around the animated Popcode mark, on **both** `view.html` (slug flow) and `scan.html` (handle flow) so they can't drift again:

- **Start screen**: the white "Scan image" pill is replaced by the mark on a **141px `#4b3cba` disc** (mark 132px) with a **"Tap to scan"** caption, sitting where the pill was. Five soft **filled** white halos swell out of it (`pop-swell`, scale 1 → 5.6, 5s, one a second, opacity .17). They **stack** — that overlap is what reads as wide concentric bands, Shazam-style. Thin stroked rings cannot produce this; that was a wrong turn. The disc also breathes (1 → 1.04), and the mark turns **once, 360°** on arrival before settling into the pulse.
- **Tapping leaves the mark exactly where it is** and everything around it falls away — wordmark, caption, disc. The mark is inside the button and never moves, which is why the disc is a separate layer behind it rather than the button's background.
- **Scanning**: the **comet** — one P orbits with whole P's fading out behind it, never resolving. `pop-comet`, 1.4s, `--i * .175s` stagger.
- **Found**: **resolve + bloom.** The eight P's land (`pop-land`, .26s, `--i * .035s`), the mark completes, then it opens out in white (`pop-bloom`, scale 1 → 11, .36s at .52s delay). **The bloom IS the hand-off to the video**, not something before it — timed to finish at ~880ms, inside the existing **900ms hold**, so the mark is gone exactly as the video screen takes over.
- **`scan.html` extra**: its **capture phase** (camera open, frames going to `/api/identify`, before any MindAR scene exists) got the same orbiting mark (`#cap-mark`), so the mark searches continuously from first tap through to match.
- The four corner brackets, and the "Point your camera at a Popcoded photo" copy, are gone. `#scan-hint` survives for **error messages only**, with `#scan-hint:empty { display: none }` so a blank one can't render as an empty pill.

**Design exploration lives in two artifacts** (not in the repo — this is why they were unfindable at the start of the session):
- **Popcode Mark Animation** — https://claude.ai/artifact/7iFeHa4Qa2NmofYSZwAvge (the original: the eight-P construction, four motion options, the difference-blend proof)
- **Popcode Scan Screen — Comet** — https://claude.ai/artifact/HJPtEo8ZzkWSU9He4jRvg1 (a Design canvas: interactive tap-through, three success beats, purple options, arrival options, pulse options)

#### THE BUG WORTH NOT RELEARNING: MindAR ships three overlays and all three default to "yes"

This cost **three deploys**, because the overlays are stacked and each one only becomes visible when the thing in front of it is removed.

- `uiScanning` — a white **bracket frame** over the camera (`.scanning .inner`, corner gradients + a scanline). **Our four `.corner` divs were a second set on top of it**, invisible at `opacity: 0` until a match expanded them. Removing ours just uncovered MindAR's, which is why "the brackets are still there" after the first fix.
- `uiLoading` — a **120px `#222` ring with a white top segment, spinning, dead centre**. Our mark sits dead centre too, so it read as a deliberate dark disc *behind* the mark. Found only because the user screenshotted it.
- `uiError` — would draw its own error message **on top of `#error-screen`**.

Fix is one string: `uiScanning: no; uiLoading: no; uiError: no;` in the `mindar-image` attribute (the bundle checks `!== "no"`). **`arError` is emitted directly (`this.el.emit("arError", …)`), independent of `uiError`**, so our error listener is unaffected — checked before disabling. Verified with the camera actually started (`--use-fake-device-for-media-stream`): `.mindar-ui-overlay` / `-loading` / `-scanning` / `-error` all **zero**. The only MindAR chrome left is the compatibility notice (no `getUserMedia` at all), deliberately kept.

**Method lesson:** I twice told the user prod was clean because `grep -c 'class="corner'` returned 0. The grep was accurate and the conclusion was wrong — I was verifying *our markup* rather than *what renders*. When UI comes from a 1.7MB vendored bundle, only a screenshot or a DOM count of the library's own classes settles it. **Grep your own source to check your own change; count rendered elements to check the screen.**

#### THE OTHER REAL BUG: the tap button would have been dead on every desktop visit

`desktop-note.js` mounts its "open this on your phone" panel with `container.insertBefore(el, slot)` where `slot = container.querySelector('#start-btn')`. Wrapping the button with its caption in `#start-tap` made the button a **grandchild** of `#start-screen`, and `insertBefore` **throws** on a node that isn't a direct child. The throw happened inside `showStartScreen()` — **one line before `addEventListener('click', handleStartTap)`** — so the handler never attached. The button would have looked perfect and done nothing.

It only fires when `canScan()` is false, so a phone would have been fine and this would have hidden until someone opened a link at a desk. `mount()` now climbs to whichever ancestor is the child. **Caught only because the headless test runs in a no-coarse-pointer environment, i.e. the desktop path by default.** Test the desktop path deliberately; `?desktopnote=1` / `=0` force it either way.

Second, subtler: the note's hide rule was `.popcode-desktop #start-btn`. Retargeting it to `#start-tap` alone would have **regressed `scan.html`**, which still has a bare `#start-btn` — its button would have stayed visible next to a note telling you to use your phone. Both selectors are in the rule now.

#### THE MARK ITSELF: `fill-rule` must be nonzero, not evenodd

The user spotted "a little triangle" in the rotating P and guessed correctly that the letter was broken into pieces. It was a genuine path bug, inherited from the original artifact.

The P is three subpaths — bowl (r60), counter (r21.5), stem (a capsule). Under **`fill-rule="evenodd"` the stem cancels against the bowl where they overlap and punches a wedge out of the letter.** Eight stacked P's hide it completely; it only shows when one P is alone mid-orbit, which is exactly what the comet does.

Fix: `fill-rule="nonzero"` **and** reverse the counter circle's arcs (`sweep 0 → 1`) so it still punches through as a hole. Bowl and stem are both counter-clockwise, so nonzero unions them; the counter is now clockwise, so it subtracts. Verified by rendering old vs new side by side — the wedge is unmistakable.

**Caveat carried into prod:** this P is **reconstructed by measuring the lockup, not exported from it — a 99.3% match**, with the residual in how the stem meets the bowl. It has to be the P-based version to animate letter by letter. **If the P is ever exported as its own SVG it's a single `d` attribute swap** (`#pop-p` in both files, plus both artifacts) and the end frame becomes exact.

#### Smaller decisions worth keeping

- **Disc `#4b3cba`.** The old `#6C30DE` was the same red-leaning hue as the gradient's endpoint, so disc and background fought at the same angle; pulling it bluer separates them and the darker value gives the white mark more contrast. **Only the disc changed — the gradient is untouched**, deliberately: `linear-gradient(160deg, #5bc8f5, #7c3aed)` is also `#loading` and the same family drives the badge gradient printed on every photo. Changing the disc is a one-screen decision; changing the gradient is a brand decision that reaches physical products already in people's hands.
- **`pointer-events: none` on the halos is load-bearing.** They live inside the button and a transformed child is hit-tested where it's *drawn* — at full travel a halo is wider than the phone, so without it the entire screen becomes one tap target.
- The bands pass behind "Tap to scan" (caption is 93px from the disc centre, bands travel ~390px). Accepted; the lever if it ever reads thin is per-band opacity (.17), not size.
- The mark carries `drop-shadow(0 2px 14px rgba(0,0,0,.34))` instead of a scrim — invisible on the gradient, keeps white legible over a bright photo.
- **None of the iOS media-session handling was touched**: stop-before-play, the 250ms settle, the frozen-frame watchdog, the rescan path, the 900ms hold. Deliberate.

#### Testing recipe (worked well, reuse it)

`playwright-core` in the **scratchpad only** (`node_modules` is tracked in this repo), chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `cd public && python3 -m http.server <port>`. `page.route` to stub `sentry-init.js`, `@supabase/supabase-js@2`, `/api/collection*` and `**/*.mind`. Add `--use-fake-device-for-media-stream` when you need MindAR to actually start.

- **Always `node --check` every inline `<script>` after editing view/scan** (extract with a regex) — the 2026-04-12 white-screen SyntaxError is still the worst failure mode in this file.
- A-Frame **parses the `mindar-image` attribute into an object**, so `getAttribute('mindar-image')` returns an object, not a string. Read `.uiScanning` etc.
- "Offset is outside the bounds of the DataView" after tapping = MindAR failing to parse a stub `.mind`. Expected, not a regression.
- Headless has no camera, so tapping Scan ends at `arError` → "Experience not found". To screenshot the scanning/found states, show `#scanner` and toggle `#scan-mark.found` directly instead of going through the real flow.
- **Don't chain `sleep` in Bash** — it's blocked. Use `run_in_background: true` with an `until` loop for deploy polling.
- A failed `sed` in a `cmd && cmd` chain silently skips the rest. Bit me once.

#### Still open / next

- **`scan.html` is effectively Curt-only** — restyling it was consistency housekeeping, not user-facing work. Said so at the time.
- The **99.3% P** — swap in the real artwork when it's exported.
- **Both artifacts still carry the old evenodd path** in their own copies of the mark; the Design canvas was fixed, the original *Popcode Mark Animation* page was **not** — its difference-blend "99.3%" reading was partly measuring the wedge. Offered, not taken.
- The `/u/{handle}` **menu page** idea above, if the "one address per creator" itch returns without the CLIP cost.
- MindAR's **compatibility overlay** is still on (deliberate).
- Unchanged from previous sessions: the two horizontal-overflow bugs (`order.html` ~16px on phones, `manage.html` at ~768px), small-size print pricing, companion insert orientation.

### 2026-09-18 — popcodeapp.com retired for real, analytics tiers, Shop hero, pricing subhead

**Branch `claude/relaxed-mendel-7mrnck`, all fast-forwarded to `main` and live: `39626b5`, `3d14422`, `a18028c`, `eff64c3`, `85d318e`.** No PRs. No migrations. The headline is that the popcodeapp.com cutover, queued since the 09-01 homepage session, is **done end to end** — and the two hours it took were almost entirely one browser bug.

#### popcodeapp.com → popcode.app (COMPLETE, verified from outside)

```
popcodeapp.com      → 307 → https://popcode.app/   ✓
www.popcodeapp.com  → 307 → https://popcode.app/   ✓
```

What was done, in order: deleted the **`popcode-marketing`** Vercel project (releases both hosts; Squarespace registration and all email DNS untouched) → in `popcode-demo` → **Domains** → **Add Existing** → `popcodeapp.com` with **"Include apex and www variants" ticked** (one dialog covers www, no second pass) → **Redirect to Another Domain**, **307**, → `popcode.app` → both rows then demanded `_vercel` TXT verification → fixed the DNS at Squarespace → Refresh → green.

**Destination is `popcode.app/`, not `/create.html`** (the user's first instinct). Reason: `create.html:474` bounces anyone not signed in straight to `/auth.html?mode=signup`, so a cold visitor typing the old marketing domain would land on a signup form with nothing explaining the product. `popcode.app/` is now a full marketing page, so it serves the same intent and explains first.

**307 not 308, deliberately** — matches the existing `www.popcode.app → popcode.app` row, and a temporary redirect isn't cached hard so it stays easy to undo. Switching to **308** is the proper end state for a retired domain (consolidates link equity) once it's been stable a while. One dropdown in the Domains row.

**Where Domains lives now:** Vercel moved it out of Project Settings. It's a top-level item in the project's left sidebar (below Environment Variables), NOT under Settings → the Settings sidebar has no Domains entry at all. The **Find box / `F`** at the top-left of the sidebar is the reliable way to get there.

#### THE LESSON OF THE DAY — a browser silently mangled a form field

Entering the two `_vercel` TXT values took ~10 attempts in Safari and **worked first try in Chrome**. Symptoms, all of which looked like Squarespace bugs and weren't:

- Pasting `vc-domain-verify=www.popcodeapp.com,<token>` landed as `vc-domain-verify=www.popcodeapp.-` — truncated at the same point every time.
- Typing the rest "reverted"; SAVE greyed out.
- One save produced a **fused** value: `…,ecf4fa6f9f4d7b1fe6a4com,be0e624a794585a9d550` (new token spliced into the old one's tail).
- Another produced a **doubled** token: `…,ecf4fa6f9f4d7b1fe6a4fa6f9f4d7b1fe6a4`.

The tell was the red spell-check underlines on the field — something (Grammarly-class extension, or Safari itself) was hooking the input. **When a form field won't take a value, change browsers before changing anything else.** That should have been attempt two, not attempt ten.

Two secondary red herrings inside that, both mine:
- **The trailing `-` was not a hyphen, it was the text cursor.** I twice advised "delete the trailing hyphen and type the tail" — on a field that already held the correct value, which is what produced the doubled token.
- **The field scrolls, it does not truncate.** A fixed-width input with the caret at the end hides the start (`omain-verify=…`). Zooming the browser out (⌘−) makes the whole value visible and is the way to audit what's actually in there.

#### `_vercel` verification specifics (for if this ever recurs)

- Verification tokens are **issued per project**. Moving a domain between Vercel projects invalidates the old `vc-domain-verify=` values — the published ones were popcode-marketing's. Adding alongside vs replacing doesn't matter; replacing is tidier.
- Shape is strict: `vc-domain-verify=<host>,<exactly 20 hex>`. One comma, ends on a hex char. Both of the failures above would have been caught by that check alone.
- Apex and www get **different tokens**. Pasting the apex token into both is the obvious trap.
- Final live values (apex / www): `ecf4fa6f9f4d7b1fe6a4` / `b308b296c2a0558a0cbd`.

#### Dangling `api.popcodeapp.com` removed

Deleted the `api` CNAME (→ `popcode-prd-fargate-alb-1740653356.us-east-1.elb.amazonaws.com`) and its `_5b30f2b4…` → `…acm-validations.aws` sibling. The ALB was **already gone** (the ELB hostname returns NODATA, HTTP refuses), so the CNAME was dangling today, not at some future AWS-closure date. Zero references in the repo (`api.popcodeapp`, `amazonaws`, `elb`, `fargate` all clean).

**Correction to my own framing**: I'd called this a subdomain-takeover risk on the S3 model. It's weaker — an **ELB hostname carries an AWS-assigned identifier an attacker can't pick**, unlike an S3 bucket name. Still right to delete, but housekeeping rather than a hole.

#### Stripe orphan webhooks — CLEANED UP, closed

The recurring "webhook failing" emails (flagged 2026-07-17 and 2026-09-02) are dealt with. Stripe keeps its endpoint list **in the Stripe account, not in the repo**, which is why grepping never found anything.

What the audit actually showed:

- **Live account: already clean.** One destination, `popcode-print-orders` → `https://popcode.app/api/stripe-webhook`, Active, listening to exactly `checkout.session.completed` — which is the only event `api/stripe-webhook.js` acts on. Deliveries showed `Total 0 / Failed 0` for the week, i.e. no orders that week, not a fault.
- **One sandbox exists** — the legacy **Test mode** environment (`acct_1LZwVVGHI16CD4bx`), "Using 0 of 5 account sandboxes". It held **three** destinations, all deleted this session: `api.stg.popcode.deploy-cd.com/api/v1/checkout/webhook`, `api.dev.popcode.deploy-cd.com/...` (both from the pre-static backend), and a stale `popcode-demo-git-claude-k…vercel.app` preview endpoint from the June print-ordering branch. That last one was worth removing too: once Deployment Protection goes back on, a preview endpoint starts 401-ing and becomes a *new* source of failure emails.
- **`api.popcodeapp.com` was not in this account at all** — neither live nor Test mode. Either it was removed at some point, or those particular emails came from a different Stripe account. If more arrive, read the account name/ID in the email rather than hunting through switchers.

**Where the UI is now:** Workbench → Webhooks shows the current environment's destinations. The environment switcher is on the **main dashboard**, not in Workbench (the `Popcodeapp` chip there is just the account label); sandboxes are listed at `dashboard.stripe.com/sandboxes`, and `dashboard.stripe.com/test/workbench/webhooks` jumps straight into Test mode.

Worth repeating because it stays true: **nothing was ever broken.** `popcode.app/api/stripe-webhook` is only a backup — `api/finalize-order.js` fulfils from the success page with an atomic claim so the two can't double-submit, and credit packs don't touch the webhook at all (`api/finalize-credits.js`).

#### analytics.html — Plan + Popcodes per account (`39626b5`, `3d14422`)

Question asked: "which tier do account holders have?" Answer: **there is no tier** — Stripe is `mode: 'payment'` only, no subscription, no plan column anywhere. So the Accounts table now shows what an account has *bought*:

| Badge | Meaning |
|---|---|
| `Admin` | in `is_popcode_admin()` — uncapped |
| `Pack · N` | `popcode_credits.purchased` |
| `Shop · N` | `from_purchases` (credits refunded by a print order) |
| `Comp · N` | `granted` by hand |
| `Free` | the five |

Plus a **Popcodes** column (`used of allowance`, red at the cap) and a tally line above the table.

- **No new SQL.** `popcode_credits` already carries an admin SELECT policy from the credits migration, so it's read directly with `fetchAllRows`. The used-count is derived in `loadThumbsOnce` from the `collection_items` rows already fetched, applying `popcode_used()`'s exact rule — one per distinct `(collection_id, target_index)` with video or audio, so legacy duplicates collapse and photo-only rows never count. Verified against a stub covering all three cases.
- **`UNCAPPED` uses `is_popcode_admin()`'s two emails, not `ADMIN_EMAIL`** — the DB decides who is exempt; `ADMIN_EMAIL` only gates who may open the page.
- Ledger read failure sets `creditsError`: Plan shows `—` and the plan breakdown is **dropped from the tally**, because a row of zeros reads as "13 free accounts" rather than "table missing".
- `get_all_users` for the table went **35 → 1000** (a capped fetch would have made the new tally report the cap as the total) and primes the shared `cachedUsers`/`usersPromise` so the funnel doesn't re-query.
- **Regression class to watch**: putting creation events into `scan_events` on 09-09 silently polluted view-only aggregates. Same shape here — when a table gains a new reader, audit everything that iterates it.

#### shop.html — gradient hero (`a18028c`, `85d318e`)

Same treatment as home/pricing: one gradient (`135deg #5bc8f5 → #7c3aed`), one curve cut out of it in the page colour (`#f9f9f9`), grid pulled up into the band the arch leaves (`.wrap.shop-body { margin-top: -110px }`). The **o is the Popcode symbol** and turns once on arrival — `1.05s cubic-bezier(.45,.05,.2,1)`, the same gesture as `pop-spinin` on the scan screen. `prefers-reduced-motion` honoured.

**The user's screenshot was a mockup, not the live page** — repo and prod both had a plain `<h1>Shop</h1>`. Classic "phantom parallel build" (see 2026-09-02). Confirmed by fetching prod before building.

Type measured against the mockup with PIL rather than eyeballed, and that mattered — the first pass was wrong in both directions:
- Mark ink **0.61em**, centred **0.25em above the baseline** (CooperBT's lowercase `o` inks 0.52em × 0.52em, so the symbol slightly overshoots the x-height and baseline evenly).
- **viewBox tightened to the pinwheel's own bbox — `46.1 46.1 209 209`** — so the CSS box *is* the ink. Before that I was sizing a shape that filled 69% of its box, which is why a nominally larger mark looked small. The arms are inscribed in a circle half the box wide, so the spin never clips (verified on a mid-spin frame).
- Gaps solved from CooperBT's side bearings (h rsb .010em, p lsb .008em) against the title's -.02em tracking. Rendered result matches the mockup: **h→mark 5px, mark→p 3px, mark 61px**.
- Symbol source is `assets/popcode_symbol_k.svg`'s inner white path (the bare pinwheel, no disc) — NOT `popcode_icon.svg` (the dot-spiral).

Then per the user: hero aligned to **"My Popcodes" in the nav (x=382)** rather than the card grid, title **90px**, subtitle cap **620 → 760px** (the sentence renders ~604px, so 620 left 16px of slack and any font-rendering difference stranded `photos.` on its own line). The nav edge is constant at ≥1280 and starts moving below that, so the hero falls back to the centred column there. **Consequence to expect: the hero sits right of the cards by an amount that varies with window width** (~154px at 1440, ~79px at 1590).

**Bug worth remembering: `nav.js` appends its stylesheet at runtime.** Its `.site-header::after` grey shelf painted as a white smear across the gradient, and deleting the duplicate rule from shop.html's own CSS did nothing — equal specificity, later source order wins. Fixed with `body .site-header::after { display: none }`.

**Pre-existing, NOT from this work:** shop.html scrolls sideways ~142px at 768px (the inline nav not collapsing). Verified identical on the pre-change file at 768/820/900. Same bug as the noted manage.html one. Offered a single nav-breakpoint fix for both; not taken yet.

#### pricing.html subhead (`eff64c3`)

New copy, packs first: *"Packs are only for adding Popcodes to things you already own. / Popcodes are always free and unlimited on anything you buy from the Popcode Shop."* It needs **1193px at 16px against a 1084px column**, so one line would mean ~14.5px — fine-print territory. Broken at the sentence instead (a `<br>` hidden below 800px), which reads deliberate. `.one-line` renamed `.half-sub` since it no longer is.

#### Sandbox/method gotchas

- **A 70-byte response from prod through this sandbox's proxy is a truncated transfer, not a stale deploy.** It cost a round of "is it live?" confusion — a grep for a new string returns 0 on a truncated body exactly as it would on an old build. **Check `size_download` before concluding anything about a deploy.**
- **No `dig` in this sandbox.** Use DoH: `curl -H 'accept: application/dns-json' "https://dns.google/resolve?name=X&type=TXT"` (and `cloudflare-dns.com/dns-query` as a second opinion). **`TTL` equal to the record's full TTL (14400 here) means the resolver fetched fresh from the authoritative nameservers**, so it distinguishes "not saved" from "not propagated".
- **One DoH query returned stale values once**, which nearly had me report a reverted zone. Query both resolvers before raising an alarm.
- popcodeapp.com's nameservers are **Google Cloud DNS** (`ns-cloud-d*.googledomains.com`) — the Google Domains estate Squarespace took over. Propagation is fast.
- **Two Squarespace domains look nearly identical in the DNS UI.** Caught the user editing `popcode.app`'s zone believing it was popcodeapp.com. The apex A record is `216.198.79.1` on both; the **www CNAME is the discriminator** (`9a47defac2c58f6f…` = popcode.app, `3251ad73b6f1c89…` = popcodeapp.com).

#### DO NOT TOUCH in popcodeapp.com's zone

Email lives here and none of it was affected: MX → Google Workspace, `@` TXT SPF (`include:_spf.google.com`), `google._domainkey`, `_dmarc`, and **Resend on its own names — `resend._domainkey` (DKIM) and `send` TXT (`v=spf1 include:amazonses.com ~all`)**. That last pair is why the apex SPF is Google-only and still correct. Every signup confirmation and password reset depends on them. Also keep the two `gv-….googlehosted.com` CNAMEs (Google site verification).

### 2026-09-18 (later) — A prod Sentry error on buy-credits, and horizontal scroll fixed across every page

Same branch (`claude/relaxed-mendel-7mrnck`), fast-forwarded to `main`: **`b9f728a`**. Two things after the popcodeapp.com cutover.

#### The Sentry error: `POST /api/buy-credits` — `credit_orders` not in the schema cache

Production, 7:41 a.m. EDT. `Could not open the order: Could not find the table 'public.credit_orders' in the schema cache` at `api/buy-credits.js:83`.

**Already resolved by the time it was looked at**, verified from outside with only the public key:

```
collections / popcode_credits / credit_orders / print_orders  → [] 200   (all in the schema cache; RLS returning zero rows)
POST /api/buy-credits   → 401 Unauthorized        (NOT "Checkout backend not configured" —
                                                   so STRIPE_SECRET_KEY + SUPABASE_SERVICE_ROLE_KEY
                                                   are present in Production scope)
rpc/popcode_quota       → P0001 "Not signed in"   (the quota function is live)
```

**No money moved and there was nothing to reconcile.** The insert that failed is at `:53-66` and throws at `:83`; `new Stripe(...)` is at `:68` and `checkout.sessions.create` at `:70`. So the failure happened *before* Stripe was constructed — no session, no charge, and no orphan `credit_orders` row either, since the insert is what failed. Worth keeping as a shape: **write the local row before opening the payment session, and a DB failure can't leave money in flight.**

**Cause: a gap between the code going live and the SQL being run** (or the minute before PostgREST reloaded). Can't distinguish the two after the fact. **This is the second instance of the pattern flagged on 2026-09-15 for the `branding` column** — when a deploy splits across code and DB, the code will happily reach a table that isn't there yet. For credits the right order was SQL first, then merge; for anything that only *reads* a new table, code first. The rule is: whichever side fails soft goes first.

**Still unproven:** no real pack purchase has ever completed. Stripe redirect → `finalize-credits` → credits landing on `popcode_credits.purchased` → the nav pill updating is deployed and Postgres-tested but never exercised with money. When it is: check the `credit_orders` row reaches `granted` and that `purchased` moved.

#### Horizontal scroll — the nav bug was on EVERY page, not two (`b9f728a`)

Both were logged as "two pre-existing bugs" (2026-09-15, 2026-09-17). A proper sweep — 10 pages × 15 widths, 320→1280 — showed the first one was universal.

**1. `nav.js`, every page that loads it.** Overflow at **768px → 142px, 820 → 90, 900 → 10**; clean at ≤700 (nav collapsed) and ≥960. The header is `width: 100vw` and flex, so its children sit at min-content and the *header* pushes the page sideways. Logo + five links + cart/profile needs about **938px**, but the inline nav only collapsed at `max-width: 760px` — a 200px band where it could not fit. **Breakpoint moved 760 → 959.**
- Nothing is lost by collapsing earlier: the drawer's bottom cluster already carries cart, account and log out. Verified the drawer opens and contains all three at 390 / 768 / 900 / 959, and that 960+ still shows the inline nav and cart icon.
- The same media query also moves the logo to the 28px content margin, so tablets now get that too — deliberate, one visual jump rather than two.

**2. `order.html` on phones under 414px.** 320 → 86px, 360 → 46, 375 → 31, 390 → 16. `.detail` is a grid, and **a track's floor is its items' min-content**: `.detail-info` reports **378px** of it, so the single column stayed 378 wide inside a 264px container. Fixed with **`minmax(0,1fr)`** on both the two-column and the one-column rule.

**The 378 was a phantom, and proving that is what made the fix honest rather than a clip:** forcing `.detail-info` to 264px reflowed everything inside with **not one child overflowing**. So the content was always happy at the narrower width — the track just refused to shrink to it. `min-width: 0` on the items would do the same; the track form is more targeted.

**Result: all ten pages clean at all fifteen widths**, where six of those widths previously overflowed on all ten.

#### Method lessons from this one

- **A spot-check on two pages made a global bug look local.** Both bugs had been sitting in the notes for weeks as "manage.html and order.html". Sweeping every page that shares a component is cheap and was the whole finding.
- **Measuring each child's min-content was misleading** — every child of `.detail-info` came back under 300px while the parent claimed 378, because `el.style.width = 'min-content'` doesn't measure a flex item the way the grid algorithm does. What settled it: **squeeze the container to the target width and ask what overflows.** Nothing did. That distinguishes "this content needs 378px" (would need real reflow work) from "this track won't go below 378px" (one property).
- Sweep harness is `sweep.mjs` in the scratchpad: for each page/width, `document.documentElement.scrollWidth - clientWidth`, plus the first four visible elements whose `right` exceeds `clientWidth` — naming the culprits is what points straight at the cause.
- **`node sweep.mjs | tail -30` in a background task shows nothing until it exits** (tail buffers to EOF). Don't read an empty output file as "still clean so far".

### 2026-09-18 (evening) — Cart edit fix, welcome page rebuilt, signed-out nav + browsable shop, email opt-in, symmetric arches, off the sand

**All straight to `main`, no PRs, all live.** Worked from branch `claude/viewer-insights`, pushing `HEAD:main` each time — that branch also holds someone's **uncommitted viewer-insights work** (`api/log-event.js`, `public/manage.html`, `public/view.html`, `supabase/migrations/2026-09-18-viewer-insights.sql`) which was deliberately never staged. Commits: `a52ad03` `ebdddfa` `80dd437` `c6f8e42` `1c99ebc` `4e53043` `fd8b83b` `524fe28` `e19345f` `9e28380` `80c1c7b` `6dac76e` `6da3b11`.

#### Cart "Edit design" opened the generic product page (`a52ad03`)
A single-image cart line's `collection_id` is the **source photo's project**, not a saved design — so `order.html?design=<that slug>&edit=1` found no `book_layout.print` and fell through to the blank product page. Now `cart.html editHref()` → `order.html?cartItem=<row id>`; `loadCartItem()` restores product / size / frame colour / mount / orientation / scale / crop and the photo (matched back to the tray by collection + target_index, thumbnail as fallback). `PopcodeCart.update(id, item)` added to `cart.js`; the button reads **Update cart** and replaces the line in place (quantity kept), then returns to the cart. Crop (`adjust`) is now saved in cart-line `options` — lines added before this reopen with the default crop.

#### Welcome / auth page — rebuilt several times, final state
User rejected a split-screen with painting + phone video ("no imagery or videos"). Final `public/auth.html`:
- Loads the **shared `nav.js`** (same white header as every page).
- **Shop-style gradient arch** (`135deg #5bc8f5 → #7c3aed`), headline **"Welcome.<br>Or welcome back."** 46px, `line-height: 1.0`, **flush left at 382px** (the nav's first link, same rule as `shop.html`; centred column below 1280). Subhead 16px white, one line on desktop: "Sign in to make, share and order all things Popcode. Or **create a new account**." (link switches to signup). Hero padding `36px 0 230px` so the text clears the arch peak by ~53px.
- **No card** — form sits straight on `#f9f9f9`. **Sign in / Create account segmented switch** (`#mode-tabs`) replaces the bottom toggle link; the card `h1` only shows for Reset Password; the bottom `.toggle` only shows in forgot mode ("← Back to sign in").
- Phones: fields/button **300px** wide (`.form-side .card { max-width: 300px }` — needs the extra specificity because the base `.card` rule comes later in the file).
- `nav.js` shelf (`.site-header::after`) hidden on this page — it smears on the gradient (same fix as shop).

#### Signed-out nav (`4e53043`, `nav.js`)
Signed out = **Shop / Pricing / How It Works** + a black **Create account** button (→ `/auth.html?mode=signup`) where cart + avatar were. Drawer's bottom cluster becomes Create account / Sign in. Mechanism worth knowing:
- `html.pc-signed-out` is set **synchronously** from localStorage (`/^sb-.*-auth-token$/`, the supabase-js v2 key) so the header never flashes the wrong items, then **confirmed by `getSession()`** inside `loadAccountQuota()` which flips it if stale.
- Private items are hidden **by href** (`a[href^="/manage.html"]`, `/views.html`, `/account.html`, `/cart.html`, `.nav-logout`), so it also covers pages that ship their own legacy `#nav-overlay` drawer.
- Button hides below **375px** (it touches the logo at 360); lives in the drawer there.

#### Signed-out visitors can browse the shop (`fd8b83b`)
`shop.html`, `order.html` and the **book/calendar intro screens** no longer bounce to `/auth.html`. They show products, sizes, sample previews and prices (`/api/prodigi-quote` needs no auth). The first account-requiring step calls `goSignUp()` → `/auth.html?mode=signup&next=<current path+query>`: order.html's `openPhotoStep()` (Choose a photo), and a **capture-phase document click listener** on `#start-book-btn` / `#start-cal-btn`. `?design=` / `?cartItem=` / book-calendar `?id=` still require sign-in first. **Board book stays fully gated** (no intro screen; ordering still admin-only). `auth.html` signUp now passes `emailRedirectTo: origin + landingPage()` so the **confirmation email returns them to that product** (covered by the existing `https://popcode.app/**` allow list). book.html's `uName` line used `data.session.user` — would have crashed signed-out; switched to `currentUser?.`.

#### Marketing email opt-in (`1c99ebc`) — MIGRATION RUN IN PROD
- Signup: optional, **unticked**, separate checkbox "Send me tips, ideas and news from Popcode. Unsubscribe anytime." (EU/UK consent needs all three). Stored in **`user_metadata`**: `marketing_opt_in`, `marketing_opt_in_at` (the consent record); account page opt-out stamps `marketing_opt_out_at`.
- `account.html`: new **Email** card, saves on change via `db.auth.updateUser({ data })`.
- `analytics.html` Accounts: **Emails** column (Yes + date on hover) and "N on the email list" in the tally, via new admin-only RPC **`get_marketing_opt_ins()`** (`supabase/migrations/2026-09-18-marketing-opt-ins.sql`, security definer, `is_popcode_admin()`-gated, no table change). User ran it: "Success. No rows returned". The migration file has a comment with the SQL to **export the opted-in list** for Resend.
- `privacy.html` said "We don't currently send marketing email" — rewritten; Last updated → September 18, 2026.
- Not done: Resend Broadcasts setup; the ~35 existing accounts are all "No" — recommended a personal one-off "want tips?" email rather than adding them.

#### Arches — symmetric everywhere, gentler on phones (`9e28380`, `80c1c7b`)
- The shared hero curve was `M0 96 C 260 8, 700 -18, 1200 52` — **left end 96, right end 52**, so the right side ended higher. Now **`M0 96 C 320 -16, 880 -16, 1200 96`**: both ends 96, peak centred and exactly as high as before (12 units), so no pull-up offsets had to move on desktop. In `index.html`, `shop.html`, `pricing.html`, `auth.html`.
- Phones: curve **120px → 60px** tall (a 120px curve on a 390px screen read as a hill). Every page pulls content up into the curve, so those shrank too: shop `.shop-body` −60→−36 & hero bottom 150→110; pricing `.p-body` −34 at ≤640 & hero bottom 146→106; auth bottom 96 & form −16; home `.codebar` **0 on phones** (`body .codebar` — the base rule is later in the file). Measured home: link-bar text 36px below the curve's lowest gradient point.
- If the curve ever changes again: page-colour fill must match the page (`#f9f9f9`), and every `margin-top: -Npx` pull-up is tuned to the curve's height.

#### Off the sand (`524fe28`, `6da3b11`)
User: "we don't use that sand color anymore." Page backgrounds now **`#f9f9f9`** everywhere (home `--bg`, pricing `--bg`, board book body, all curve fills). Then a site-wide swap of warm UI greys for neutral ones of the same lightness (85 swaps, 15 pages + `nav.js` + `image-source.js`): `f7f6f2→f9f9f9, f7f6f3→f7f7f7, f5f4f0→f4f4f4, faf9f5→fafafa, f2f0eb→f1f1f1, f0eeea→efefef, f3f2ef→f3f3f3, ebe8e1→ebebeb, f1f0ec→f1f1f1, e3e0d8→e3e3e3, d6d2c8→d6d6d6, eceae5→ececec`. **Deliberately kept** (product colours, not UI): the white frame swatch `#f7f6f3` and mount white `#faf9f6` in `order.html`, the unused shelf scene `#efece7`, and anything in `postcard*` (print output). Checked no swap touched canvas `fillStyle` or print/proof CSS.

#### Smaller
- Pricing: Studio title 32 → **42px** (`80dd437`).

#### GOTCHAS FROM THIS SESSION
- **Another Claude session was committing in the SAME working folder at the same time.** Its commit `cb4b301` (book/calendar "saving keeps photos that aren't placed yet") swept up my uncommitted colour swaps in `book.html` / `calendar.html` because they were on disk. Harmless here, but: **stage explicit file paths, commit promptly, and check `git log -3` before assuming your diff is still yours.** It also left untracked `public/zz-book.html`, `zz-calendar.html`, `zz-stub.js` — not mine, not committed. (Note: files in `public/` are web-served if ever committed.)
- **The preview server on :8099 belongs to another session** (`launch.json` `popcode-static`, cwd in another session's scratchpad `.../scratchpad/site`). That dir is **symlinks into `public/`**, so it serves current code — but files created after Sep 14 (e.g. `pricing.html`) aren't linked and 404. Run your own: `cd public && python3 -m http.server 8123` (background), navigate to `localhost:8123`. `lsof -p <pid> | grep cwd` is how this was found.
- **User's phone screenshots were cached**, twice showing already-fixed layouts. Tell them to reload before iterating on a "still broken" report.
- **CSS source order bit three times**: a phone override placed *before* the base rule loses (`.card`, `.codebar`). Raise specificity (`.form-side .card`, `body .codebar`) or put overrides at the end.
- Browser-pane screenshots of a **scrolled** page come back blank (known); measure with `getBoundingClientRect` instead.
- Local auth testing is real Supabase (config.js is live), so signed-out tests are genuine; the pricing API 501s on the static server (expected, not a bug).

#### Open / next
- Cyan hairline under the arch in the user's desktop screenshots — didn't reproduce, drawn over the phone, so probably a screen-ruler tool on their Mac. Asked; unanswered.
- Resend Broadcasts + first newsletter; outreach to existing accounts for opt-in.
- Board book has no signed-out intro screen.
- Ideas offered, not built: remember last-used auth tab per device; Continue with Google/Apple; show/hide password eye.

### 2026-09-19 — Design audit item 1 (the button system), then the cart: cost breakdown + Stripe Tax

**Two PRs, both merged to `main` and live: #68 (button system, `9409966`) and #69 (cart + tax, `608b92c`).** Started from `docs/design-audit-brief.md`. Ended with NY sales tax being collected on production.

#### The placement decision the brief asked for: one shared `public/ui.css`

The brief said to settle this before writing anything, because converting twice is the expensive outcome. Checked rather than assumed:

- The composite.js lesson (2026-07-17) was about shared **JavaScript that a code path calls**. It *threw* and broke the order page. CSS degrades instead — a missing `ui.css` is unstyled buttons on a working page.
- **`public/composite.js` is now an orphan**; nothing references it.
- The precedent that applies is already here: **`/assets/fonts.css` is a shared stylesheet linked by 21 pages** carrying base64 CooperBT, and **`nav.js` injects a shared `<style>` on every page**. Shared CSS is the existing mechanism — and it is where the Arial finding lived, so item 2 could only be fixed in shared code.
- Per-page token blocks are what produced 21 heights and 9 radii in the first place.

**Rollout constraint found while checking: 24 pages carry `class="btn"` in markup but only 7 defined a `.btn` rule.** Linking ui.css everywhere at once would have restyled 17 unconverted pages. So the `<link>` goes in the same commit that converts the page. Written into the file's header comment.

Routing is safe: `ui.css` cannot match the `[a-z0-9-]` slug rewrite (the dot is not in the class), and static files beat rewrites anyway, as `/nav.js` proves.

#### The system

One `.btn` base, three sizes (`sm` 36 / default 44 / `lg` 52), four intents (`primary`/`secondary`/`quiet`/`danger`), plus `btn-icon`, `btn-float`, `btn-link`, `btn-auto`, `btn-block`, `btn-centered`.

- **Height is fixed per size and every variant carries a 1px border** (transparent where unwanted), so a border can never change height. That was the hero pair, 44 vs 46.
- **Radius is pill for text, 50% for icon-only.** Nothing else.
- **Buttons do not cast shadows.** `btn-float` is the one exception (a control over a photo — the carousel arrows).
- Colours read the page's own `var(--ink, …)`, so each page keeps its palette. Nothing declared on `:root`, so no collisions.

`nav.js` and `dialog.js` inject their own CSS and were **aligned to the same numbers in place** rather than made to depend on ui.css — self-containment is what makes them safe.

#### THE AUDIT'S OWN METHOD WAS WRONG IN TWO WAYS — fix these before trusting any future pass

1. **The empty-data stub hides most of the site.** The brief flagged it; this session quantified it. **Manage showed 1 button and actually has 117.** A rich stub (`richstub.js` in the scratchpad: 8 collections, 2 saved print designs, collection_items, cart_items, credits, print_orders, RPCs) is what made manage/cart/auth measurable.
2. **The probe only matched `button` and `a.btn`** — it missed every `<a class="icon-btn">`, which is what manage's view/edit/share actions are. Widened to `a[class*="btn"|"cta"|"chip"|"action"|"pill"]`.

With both fixed: **331 buttons, not 203.** Any future audit should start from the widened probe + rich stub, or it will measure page chrome and call it the site.

Also: **`auth.html` redirects a signed-in user to manage.html**, so it can only be measured signed out (the audit script special-cases it).

#### Results

| | before | after |
|---|---|---|
| distinct heights | 20 | **12** |
| distinct radii | 9 | **5** |
| buttons in Arial | 55 | **0** |
| button shadows | Shop pill, order-success, 2 arrows | **2 arrows** |

The 12 remaining heights are controls deliberately off the scale, each for a reason: tab bars (analytics), segmented toggles (auth, order), the upload drop zone (create), the two-line size tiles (book/boardbook), text affordances, carousel dots, and **nav.js's 32px icon buttons** — resizing those changes every page's header, so they wait.

Also fixed while in the files: **`order-success` background `#fafafb` → `#f9f9f9`** (item 5).

#### THE BUG CLASS WORTH REMEMBERING: a page overriding `.btn`'s display

The user spotted the venue "Talk to us" button looking bottom-heavy. Cause: **`.venue-body .btn { display: block }`** overrode ui.css's `inline-flex`, and with a fixed height **only flex centres the label** — under `block` it top-aligns. `pricing.html` had the identical rule.

Fixed, `.btn-centered` added for what that rule was trying to do, **and a check added to the measurement pass that flags any `.btn` whose computed display is not flex.** That check then immediately caught the same class of bug on **manage.html**, which had a legacy local `.btn` rule (radius 20, `inline-block`) sitting *after* the ui.css link and silently overriding all 117 buttons. `.btn-view`/`.btn-copy` went with it — neither had markup left.

**If a page needs `.btn` to be block-level, it wants `flex`, not `block`.**

#### Near-miss: a backtick in a nav.js comment

Writing the `font-family: inherit` fix, I put backticks in the CSS comment — which is inside a **JS template literal** in nav.js. `node --check` caught it. Would have broken the nav on all 19 pages. **Always `node --check` nav.js/dialog.js after editing their CSS strings.**

---

### The cart (PR #69)

The cart showed one number for printing, one for shipping, no per-item price, and "Taxes we collect are included." Rebuilt against the Popsa screens.

**Layout:** two columns above 940px with the summary **sticky** in the right one (`top: 88px`, verified by scrolling); one column below — a sticky panel on a phone eats the viewport. Zero horizontal overflow at 320/375/402/768/940/1024/1440.

**Per-line prices:** `allocateLinePrices()` in `lib/print/cart.mjs` splits a group's printing charge across its lines. **Prodigi's per-item `unitCost` does not always sum to `costSummary.items`**, so those are WEIGHTS and the group total stays authoritative: floor each share, then hand the leftover pennies to the largest remainders, so the column always adds to the subtotal. **Shipping is deliberately not split** — it is per parcel, and dividing it would invent a number. Verified on real data: $9.67 + $48.33 = $58.

**A bug in my own first version:** all-zero weights produced $0 lines that disagreed with the subtotal. Caught by unit tests (zero weights, negative weights, missing costMinor, length mismatch, odd remainder across five lines). Falls back to copies.

**From the audit:** "Edit design" was `.linkback` (14px purple, weight 600) next to a 13px grey Remove — two unrelated controls doing the same job. Both are now `.btn .btn-link`.

#### Stripe Tax — live in production, NY only

`lib/print/tax.mjs` maps the Prodigi-shaped address (`townOrCity`/`postalOrZipCode`/`countryCode`) to Stripe's (`city`/`postal_code`/`country`) and calls the Tax Calculation API. **Two rules hold throughout:**

1. **Tax never breaks a quote.** Every path returns null on failure. The cart falls back to "calculated at checkout".
2. **Stripe is the only source of a tax number.** Nothing estimates a rate. An address outside your registrations correctly calculates to **zero — that is an answer, not a failure.**

`api/cart-quote.js` gained `tax_minor`, `total_with_tax_minor` (both additive, null when uncalculable) and **`tax_status`** (`off` / `incomplete_address` / `error` / `ok`). `total_minor` keeps its old pre-tax meaning so no existing reader changed.

`api/create-checkout.js` puts the address on a **Stripe Customer** rather than re-asking on Stripe's page (which would let the two addresses diverge from the one sent to Prodigi). Line items carry **`tax_behavior: 'exclusive'`**, so tax is added on top instead of falling back to an account default that might be `inclusive` and quietly take it out of margin.

**Everything is behind `STRIPE_TAX_ENABLED`** (Config, not Secret). This is the money path: `automatic_tax` against a misconfigured account **throws**, and a throw there is checkout down for everyone. It also fails soft — a rejected taxed session is retried once untaxed, because an order that undercharges tax is recoverable and a customer who cannot pay is not.

**Gotchas:**
- **`customer` and `customer_email` are mutually exclusive**, and setting `customer_email: undefined` leaves the key present — enough for the SDK to send it and Stripe to refuse. It must be `delete`d.
- **A null tax covered four situations and they were indistinguishable from outside.** That is what made the first preview test unreadable — the response proved the code was deployed and proved nothing about why it was quiet. Hence `tax_status`. Add a diagnostic like this to anything that can fail silently.

#### THE BUG NO EYE TEST WOULD HAVE CAUGHT: collected tax recorded as revenue

`fulfillOrder` overwrites `total_charged_minor` with the session's `amount_total` — deliberate, because promo codes are enabled and a discount exists only on the session.

**With `automatic_tax` on, `amount_total` includes the tax.** So a single-order session would have recorded $98.62 as the amount charged, and **`analytics.html:1281` sums that column and labels it "Revenue"**. $7.62 of it belongs to New York.

Worse, it would have been **inconsistent**: `fulfillSession` only passes the amount through for a single-order session, so a two-provider cart kept the correct pre-tax figure. One column, two meanings, depending on how many parcels the cart split into.

Fixed with **`settledAmountMinor(session)` = `amount_total − total_details.amount_tax`** in `lib/print/fulfill.mjs`. Collected tax is deliberately **not** stored — Stripe's Tax → Transactions is the record for filing; a second copy would give two answers to one question.

**Found by reading the post-payment path, not by running it** (the test payment could not be run from the sandbox — the cart is auth-gated and Stripe Checkout needs interactive card entry). Doing that also caught `settledAmountMinor` being used in both api files **without being added to either dynamic import** — a ReferenceError that would have broken fulfillment for every order, taxed or not. `node --check` passes fine on an undefined identifier; **grep every helper against its import**.

#### Verified end to end

| | |
|---|---|
| Per-line split | $9.67 + $48.33 = $58 |
| Cart total | $98.62 |
| **Stripe total** | **$98.62** — Stripe labelled it "Sales Tax (8.375%)" |
| Unregistered state (CA) | `tax_status: ok`, tax **$0**, no error |
| Fulfillment after the Customer swap | `ord_1172988`, status `submitted` |
| Tax excluded from revenue | `total_charged_minor` **9100**, not 9862 |
| Production, live key | NY $1.84 on $22.00 (8.375%); CA $0 |

**`buyer_email` is unaffected** by the Customer swap — it is derived in SQL as `coalesce(recipient ->> 'email', u.email)`, never from Stripe's `customer_email`.

#### Vercel / testing gotchas (all recurrences)

- **Env vars apply to the NEXT build only.** The first preview test failed purely because the build predated `STRIPE_TAX_ENABLED`. The endpoint proved the code was deployed; only `tax_status` distinguished "flag off" from "Stripe refused".
- **Preview URLs cannot be built by hand.** The alias for this branch was `popcode-demo-git-claude-epic-fey-b3bb0c-…` — Vercel truncates the branch name and inserts a hash. Get it from the Vercel bot comment on the PR.
- **Vercel's env dialog "Environments" field is a summary of everything selected.** It read `Production, claude/epic-feynman-i1c6ki` with Production still ticked; the Production checkbox is one level up from the preview-branch list (via the `<` back arrow). The user caught this, correctly.
- **Choose Config, not Secret, for a flag.** Secret is one-way — you can never read it back to confirm what is set.
- **Supabase Table Editor is not sorted by `created_at`.** Rows read 21:42 today, then June, then August. An abandoned checkout looked like the test order. **Every Pay click inserts a `pending` row** whether or not it completes, and the insert always writes the pre-tax figure — so a `pending` row's `total_charged_minor` proves nothing about the fulfillment overwrite. Query by `prodigi_order_id`.

#### TAX / COMPLIANCE — facts established, not code

- **Popcode, Inc. NYS Certificate of Authority, ID `87-4123940`, VALIDATED 9/29/2023.** Business address 709 Main St, New Rochelle NY 10801; mailing 998 Edgewood Ave, Pelham NY 10803.
- The certificate's own reverse states: a return is due **even with no business and no tax owed**, until you surrender the certificate; **minimum $50 penalty** per late return. A dormant registration accrues penalties.
- **User confirmed they have been filing in NYS.** No unfiled-period problem. Returns will now carry real taxable sales instead of zeros.
- **Stripe Tax was already active with NY registered** (from the Popcode 1.0 era) — that is why enabling it worked immediately. **Stripe's "Set up filing" is not needed**; there is already a filing process.
- **NY requires a jurisdiction breakdown**, not one state total (Westchester 8.375% ≠ NYC). **Stripe → Tax → Transactions** exports exactly that for ST-100.
- **`tc-721.pdf` is UTAH's exemption certificate**, not NY's — it was for the *old printer*, which was Utah-based. Historical, correctly used at the time. Also: no exemption box checked, no licence number, and the address reads 989 vs the certificate's 998.
- **STILL OPEN: a resale certificate for Prodigi.** They charged $2.55 tax on a NY-bound order, which points at **ST-120** (NY's form) carrying 87-4123940. Confirm with Prodigi first — it depends where their US entity sources the sale. Also worth checking Prodigi invoices for **non-NY** shipments: Popcode can only give a certificate for NY, and drop-ship rules differ by state.
- **Never send the Certificate of Authority to a vendor** — it is nontransferable and not to be reproduced. Vendors get the resale certificate; its number goes *on* that form.

#### STILL OPEN

**Design audit:**
- **Item 3, type scale.** `h1` renders at **12 sizes** (22·23·30·31·34·36·42·44·54·66·90·100), `h2` at 7, `h3` at 8, and **12 headings render in Inter** where the rest are CooperBT — now including an `h2`, which the brief did not catch.
- **Item 4, card tokens.** Six radii (16·20·22·24·28 and a stray **6px**) across 5 shadow values.
- **The noise question.** Untouched — needs the Manage screenshots. The rich stub renders Manage properly now: **117 controls across 8 projects**, where the brief guessed "70+ with a dozen".
- **nav.js's 32px icon buttons and `join-btn`** are off the 36/44/52 scale; fixing them changes every header.
- **manage.html's action row is mismatched at both ends** — icons 40px desktop / 36 phone, the Shop pill the reverse. Pre-existing, left alone deliberately because it sits inside the noise question.

**Popsa parity (cart):** matched per-line prices, the persistent sticky summary, Subtotal/Shipping/Tax/Total, and tax appearing only once an address exists. **Not matched:** shipping options as cards with prices and delivery estimates (ours is a bare dropdown — change it and wait for a re-quote to see the effect; this is the biggest remaining gap), saved addresses, a per-item ⋯ menu, "Add Another Item", a discounts panel (Stripe's promo field is on their page), and payment-method choice shown before leaving the site.

**Three calls from the button work that are cheap to reverse:** the Shop pill lost its drop shadow; button weight standardised to 600 (app pages were 700); shop size-chips are pills now.

### 2026-09-20 — Companion insert was the wrong shape on every order; a dead API key would have read as "we don't ship there"

**Three commits, all fast-forwarded to `main` and live: `30d244f`, `06131bc`, `36bdd43`.** No PRs. No migration (the `branding` column was already run in prod on 2026-09-15). Started as "walk me through the Prodigi dashboard" and turned into two live bugs, neither of which was the thing we set out to do.

#### THE ORIENTATION BUG — and the spec line that settled it

Prodigi's dashboard prints the insert's spec **on the insert itself**, in the Add-insert-set dialog:

> "Single-sided A6 (4.1x5.8"), 260gsm postcard with a smooth finish. **Includes a 4mm white border.**"

**4.1 × 5.8in is 105 × 148mm — the stock is A6 PORTRAIT.** We were generating a 1748 × 1240 **landscape** file, which would have printed rotated or cropped. Not just the generic dashboard card: **every per-order card, on every order**, since the insert has been enabled since 2026-09-15.

This had been sitting in the code as an explicit "ORIENTATION IS UNCONFIRMED — check the proof image on the first order" comment since the card was built. The answer was one dialog away the whole time and nobody had opened it. **When a spec is marked unconfirmed, the supplier's own UI is worth a look before waiting on an order to tell you.**

**Two ways to fix it, and the user picked the right one.** I had already re-composed the design for a portrait canvas (wordmark moved from top-right, where it no longer fits beside "Scan" on a 105mm-wide card, down to bottom-left; vertical rhythm rebalanced) when the user asked *"cant we just rotate the design 90 degrees?"* — which is better, for a reason that only showed up on measuring:

- **A portrait card has 89mm of safe width.** A 30-character slug (`slug.js` MAX) renders ~104mm at the approved 11pt. So the re-lay *needed* auto-shrinking type to stay legal — machinery that exists only because the card got narrow.
- **Rotated, the sentence still runs along the 148mm edge**, exactly as the approved artwork intended. 132mm of room. Nothing to solve.
- And it isn't a redesign. The re-lay was me redrawing signed-off artwork; rotation is that artwork, unchanged, in a correctly-shaped file.

A card is a rectangle with no inherent up, so a landscape-reading postcard is an ordinary object.

**How it works now** (`public/postcard-render.js`): `CARD` stays at the approved landscape 148 × 105 with every placement number untouched (verified: they don't appear in the diff at all). `PRINT.insertPx` is `{ w: 1240, h: 1748 }`, and `buildPostcardInsert()` rotates the rendered face a quarter turn clockwise into that portrait canvas — so the original top edge lands on the right and the type reads top-to-bottom, the usual Western convention for vertical type. The rotation is conditional on the face and file disagreeing about orientation, not hard-coded, so drawing it straight into a differently-shaped box (which would stretch it) can't happen by accident.

Verified: the gradient's corner signature confirms a quarter turn rather than a stretch (purple top-left, cyan bottom-right — the landscape gradient turned), the export is exactly 1240 × 1748 = 104.99 × 148.00mm at 300 DPI, and it matches its declaration in both files.

**Two things fixed alongside, both the same class of mistake:**
- **The proof PDF's orientation was hard-coded** and had already gone stale once. Now derived: `const orientation = w > h ? 'landscape' : 'portrait'`.
- **The sentence's box spanned the full trim**, so a line too long to fit could sit out in the border without ever wrapping. Inset to the safe area, and `fitCopy()` steps the type down only when a line would otherwise breach it. Ordinary slugs still render at the approved 11pt; an `'m' × 30` slug drops to 10.75pt. Called from `setBaselines()` rather than left to each caller, because the artboard and the print path both go through that and a fit applied to only one of them is exactly the preview/press drift this file exists to prevent.

#### THE SECOND BUG — an auth failure reading as an unservable route (`36bdd43`)

`lib/print/providers/prodigi.mjs` classified **every 4xx** quote failure as `unservable`, which makes the caller stop retrying and tell the customer *"We can't ship this item to your country."* **401 and 403 are our own credentials, and 429 is a rate limit that clears** — none of them says anything about the route.

So **a revoked, rotated or mistyped Prodigi key would have shown every customer a plausible-looking product limitation**, with the retry skipped and nothing raised in Sentry, because an unservable route is expected behaviour rather than an error. A total outage in the costume of a catalogue gap.

It surfaced by accident: a `price-list.mjs` run reported **all 17 print and tile variants as "not servable to US"** — items on sale to the US right now. That's what a 401 looked like.

`printify.mjs` had the identical flaw. The set now lives in one module (`lib/print/providers/statuses.mjs`, `UNSERVABLE_STATUSES = {400, 404, 409, 422}`) rather than a copy per provider — the two copies had already drifted in their comments, and this is the kind of rule that gets fixed in one place and left wrong in the other. `price-list.mjs` also now warns when `PRODIGI_API_KEY` and `PRODIGI_BASE_URL` disagree about sandbox vs live, which 401s every row with no hint that the key is the problem.

#### Prodigi dashboard — both insert sets now configured

| set | what it is | cost | usage |
|---|---|---|---|
| **Popcode Round packaging sticker** | "High-gloss round sticker (65mm / 2.5"), placed on the **outside of the packaging**. On tubes, attached to the end cap." Carries the wordmark + `popcode.app` on the brand gradient. | **$1.25** | API + Online order |
| **Popcode companion card** | The A6 postcard, generic (no-slug) artwork as the account-level fallback | **$2.50** | API (advised ticking Online order too, for hand-placed replacement orders where no slug-specific card exists) |

**$3.75 per ORDER, not per item, and in no quote — so it comes straight off margin.**

**I argued for dropping the sticker and was wrong.** I valued it as an information channel ("the card already carries the URL"); its actual job is presentation — the packaging is a brown envelope and the sticker is the only branding on it. The user pushed back, and the dashboard confirmed it's exterior. Kept.

#### Insert economics — and why nothing was dropped

`TYPE_MARKUPS` is no longer a flat 1.4 (a 2026-09-16 session rebalanced it per type when shipping came out of the markup). Margin ≈ goods × (markup − 1), so the goods cost each type needs to carry $3.75:

| | markup | goods needed | actual goods (per `catalog.mjs:406-418`) |
|---|---|---|---|
| print | 1.8 | **$4.69** | $6–22 |
| tile | 2.0 | **$3.75** | $8–10 |

**Nothing is underwater, and I nearly recommended a cut that wasn't warranted.** I assumed the small print sizes sat below that quoted $6 floor. They don't — checking the commit order settled it: the small sizes went in on 15 September (`1e8f3fc`), the markup table the day *after* (`927acb0`), with them already in the catalogue. **Check whether a comment predates the thing you're measuring before you trust its range.**

Also moot by the time we got there: **the 4×6 is already retired and hidden** (not in `order.html`'s picker), for a sharper reason than mine — Prodigi charges the same to make and post a 4×6 as a 5×7, so it earned identical margin for a visibly smaller print and only undercut the 5×7. The shop starts at 5×7.

**Decision: no minimum quantities.** The inserts are billed per *order*, so a per-product quantity minimum is the wrong lever anyway (one 4×6 plus one tile is still one order, one card). And a minimum is real UI work — cart validation, messaging, an error someone meets at checkout — to rescue sizes that have never sold. Minimums make sense when the cheap item is the hero product; that's Mixtiles' model, not ours.

#### "Why is Shutterfly's 4×6 $0.39 + $5.99 shipping and ours ~$22?"

Worth writing down so it isn't re-derived. Four reasons, only one about shipping:

1. **Not the same product.** $0.39 is a glossy photographic print off a minilab. Ours is `GLOBAL-FAP` — enhanced matte art, 200gsm, a fine-art giclée-type print. Shutterfly sells that too and it isn't 39¢ there either.
2. **$0.39 is a loss leader.** They own their labs and print at vast scale; cheap 4×6s are the hook that sells books and canvas. We're a reseller — Prodigi's trade price already contains Prodigi's margin and ours goes on top. **Structurally two margins behind a vertically integrated printer**, and no tuning closes that.
3. **Their $5.99 is a subsidised flat rate**, not a carrier quote. It covers one print or a hundred.
4. **Our shipping isn't per-print either** — the cart quotes each provider's items as a single shipment, so ten prints carry roughly one shipping charge. A single small print is simultaneously our worst case and their best marketing case.

**Conclusion: don't try to win it.** A commodity 4×6 isn't the product; a photo that plays a video is. Matching them means finding a supplier who prints below Prodigi's trade rate — a different company, not a settings change. User confirmed: **keep Standard as the default shipping method and keep the same stock.** Both verified as already the case (both pickers have `selected`, and all four server paths fall back to `'Standard'`) — a genuine no-op, nothing changed.

#### `price-list.mjs` gained margin-after-inserts (`06131bc`)

`--copies=N` to read the table at realistic basket sizes, and a **net** column = margin less the per-order inserts (losses parenthesised), plus a **min qty** column — how many of an item an order needs before it carries its own inserts, i.e. what a minimum would have to be set to. `--inserts=0` gives the old view.

#### LESSONS — deploy verification bit me twice in one session

**I reported "still not live after 20 checks" when it had been live the whole time.** Both failure modes are worth avoiding:
1. **I polled for a string my own file doesn't contain.** "quarter turn" wraps across a line in all three places I wrote it, so the grep could only ever fail. Checking `grep -c` against the *local* file first would have caught it in a second.
2. **I was reading a cached response.** `x-vercel-cache: HIT`, `age: 270` — the CDN served the old bytes for the entire poll, and even a `?cb=` buster came back stale before invalidation caught up.

**The reliable check is `curl` the file and `cmp` it against local.** Byte identity settles it; a string match only tells you about the string you guessed. (This is the third session in a row where deploy verification produced a false reading — see 2026-09-15's "a 200 on a path that already existed proves nothing".)

#### Other gotchas from this session

- **The user's local repo was 214 commits behind the branch.** `git checkout <branch>` printed "Already on ..." and was a silent no-op, so the file they were told to run genuinely didn't exist for them. **When someone says "module not found" for a file you can see, check how far behind their checkout is before debugging anything else** — `git status --short --branch` says it in one line.
- **`.DS_Store` blocked their `git pull`** ("local changes would be overwritten"). Already fixed upstream in `0c17c68` — they're untracked and gitignored now, which is *why* the pull wanted to delete them. `git checkout -- .DS_Store public/.DS_Store public/assets/.DS_Store` then pull. Nothing lost; they only hold Finder window positions.
- **They pasted `test_your_sandbox_key` literally.** Placeholders in a command block get run verbatim. Name them so they can't be mistaken for values (`PASTE_KEY_HERE`), and say explicitly that they must be replaced.
- **Their terminal opens in `~`, not the project** (documented on 2026-04-22, still true). Every command block needs `cd ~/popcode-demo` first.
- **Prodigi's insert set dialog is `Settings` / `Add inserts` tabs**, with the price shown per insert in the row and totalled in the pill at the top right. "Usage" = which order paths get the set by default.

#### STILL OPEN

- **Place one real order** — settles three things at once: whether a per-order `branding` block **replaces** the dashboard default or **adds a second card** (the two doc sources conflict and this is still unresolved), whether the rotation prints right, and the exact margin (`print_orders` records `quote_cost_minor` against `total_charged_minor`, replacing every estimate above).
- **`analytics.html` is still gated to `curtmid@gmail.com` only** (`ADMIN_EMAIL`) — `curt@theworkshop.works` bounces to manage.html. Offered in three sessions now, never taken; `edit.html` already does the two-email version.
- **Re-enable Vercel Deployment Protection** on previews. Flagged in four sessions.
- Shipping options as cards with prices and delivery estimates — the biggest remaining Popsa gap.

### 2026-09-21 — First card-carrying order placed; a silent cart drift, a leaked key, and real margin numbers at last

**Three commits, all fast-forwarded to `main` and live: `63ebecb`, `22e8e02`, `9a6cb0d`.** No PRs, no migrations. The session's purpose was "confirm the sticker and card actually ship" and it became four separate finds on the way there. **Prodigi order `ord_14540083` is placed and is the first order ever to carry a companion card** — its proof image is the outstanding answer to almost everything below.

#### THE CART WAS SHIPPING BOOKS AND CALENDARS CARDLESS (`63ebecb`)

`cart.html` carried its **own hardcoded copy** of the server's `COMPANION_INSERT_FOR`, and the two had already drifted: books and calendars were added server-side on 2026-09-15 and never here. `book.html` and `calendar.html` both call `PopcodeCart.add()`, so those products genuinely reach the cart — and a book bought that way uploaded no artwork, `create-checkout`'s HEAD check then found nothing, and it shipped **cardless with no error anywhere**. The direct-checkout path from those two pages was fine, which is exactly what hid it.

This was already broken when I wrote yesterday's warning that "any future checkout surface needs the script tag AND the upload." The warning was right and I didn't apply it to the surface already in front of me.

**Fix: the client no longer decides.** It uploads artwork for every collection in the order (capped at 4 — each card is a 300 DPI render, and `create-checkout` uses at most one) and the server keeps the product rule. Two copies of one rule is what created this; there is now one.

#### THE LEAKED PRODIGI KEY, AND WHY PROD WENT DOWN FOR TWENTY MINUTES

The user pasted a **live `api.prodigi.com` key in plaintext** while running the SKU verifier. Rotated the same session — and it's worth recording what that did, because it caught the recurring Vercel rule again:

**Print checkout was 401ing on production until a redeploy.** Revoking the old key is instant; the running deployment still had it baked in, and **Vercel env vars only apply to the NEXT build**. Verified from outside with a real quote call, which is the fastest way to check:

```
curl -s -X POST https://popcode.app/api/prodigi-quote -H "Content-Type: application/json" \
  -d '{"productType":"print","variantId":"fap-5x7","copies":1,"destinationCountryCode":"US","shippingMethod":"Standard"}'
```

**That 401 also validated yesterday's fix in production, by accident.** It came back as a plain `Prodigi quote failed (401)`. Before `36bdd43` it would have read *"We can't ship this size to the United States"* — a dead key wearing the costume of a catalogue limitation, with nothing raised in Sentry. Shipped in the morning, proven by a real outage in the afternoon.

Also told the user the key is in `~/.zsh_history` and to delete those lines from a *different* terminal tab, since zsh rewrites the file on exit.

#### REAL MARGIN NUMBERS — every estimate in yesterday's notes is now superseded

The healthy quote that came back after the redeploy is the first hard data:

| 5×7 print, US, Standard | |
|---|---|
| Prodigi goods | **$6.00** |
| Prodigi shipping | **$10.75** |
| your cost | $16.75 |
| customer pays | **$22.00** ($11 printing + $11 shipping) |
| gross margin | $5.25 |
| **after $3.75 of inserts** | **$1.50** |

So yesterday's estimate from the code comment (~$6 goods → about a dollar net) was right, and **nothing needed dropping** — it's positive, just thin.

**The number that actually matters is the second item.** Shipping and inserts are $14.50 of fixed cost the first item has already paid. A second 5×7 adds ~$6 of goods and ~$11 of revenue:

| | one 5×7 | two 5×7 |
|---|---|---|
| customer pays | $22 | ~$33 |
| your cost | $16.75 | ~$23 |
| **net after inserts** | **$1.50** | **~$6.25** |

**The second print roughly quadruples what you keep.** That is the shape of this business, and it makes the answer to thin margins a merchandising one — "add another print", a bundle, a free-shipping threshold — not the minimum-quantity idea. All of those pull the same direction without ever turning a customer away. Also note **$10.75 of the $16.75 cost is postage**: no markup change touches that, only more items per parcel.

#### PRINTS HAVE NO REVERSE SIDE — settled, thirty seconds, no debate

The best answer to "N products, one instruction" would have been printing each product's URL on its own back, the way books and calendars already do. It's dead:

```
GLOBAL-FAP-5x7   print areas  1 — default
PHOTIL-FRA-0507  print areas  1 — default
```

`scripts/verify-prodigi-sku.mjs:82` reads `product.printAreas`, so this is one command. **When a design argument turns on a supplier capability, check the capability before arguing.**

#### THE MULTI-PROJECT PROBLEM — analysed, not built

`companionInsertCollectionId` returns a card only when every card-eligible line shares one collection (`ids.size === 1`). A multi-project order therefore sends **no `branding` key at all** (`prodigi.mjs:116` omits it rather than sending null), so the dashboard's generic card ships instead. That part works — but **the generic card says "enter your code" and nothing in the box carries a code for a flat print.** The fallback exists and is useless exactly when it's needed.

The constraint that shapes every fix: **Prodigi's `branding` has one `postcard` slot per order**, and it is per-order, not per-item. "Several cards" is not available.

| | works for N | recipient does | can pick wrong | runtime cost | first-scan lag | build |
|---|---|---|---|---|---|---|
| A. direct slug (today) | ✗ one | types a URL | never | none | none | done |
| B. multi-URL card | ~4 max | types one per project | never | none | none | ~1 day |
| **C. order code** | ✓ any | types a code, taps a list | never | none | none | ~1 day |
| D. handle + camera | ✓ any | points the phone | **yes** | per scan | **5–6s** | weeks |
| E. email the buyer | ✓ any | clicks a link | never | none | none | hours |

**Recommendation: C + E now, D when scan volume justifies fixing the cold start.**

- **C** reuses the code field already on the homepage, and the ordering problem I priced it expensively on is solvable: **the client mints the code**, renders the card with it, uploads to `orders/{code}.png` and hands it to `create-checkout`. No server-side rendering. Note the code is a **capability URL** — anyone holding it sees that order's projects — so it needs real entropy.
- **D is the camera/handle path, and this conversation reopened the 17 September decision.** I argued then that the handle model's benefit aimed at a gap the print pipeline had closed; the multi-product order *is* that gap. Two things I had wrong: **`/u/{handle}` already routes** (rewrite rule 1, unambiguous at any case or length — the collision only affects the bare `/{handle}` form), and **`creators` already has self-insert/update RLS**. What's genuinely missing is auto-indexing (nothing but `seed-identification.mjs` writes `pop_images`; `handle` in the builder HTML is all `handleVideoPick`) and the unsolved 5–6s cold start, which lands on *every* single-item order because there's no second page to warm it. If D is ever built, use it for **multi-project orders only** — the common case keeps a foreign key that cannot be wrong.
- **E is never the answer alone**: it goes to the buyer, and a gift goes to someone else.

#### STRIPE: COUPON ≠ PROMOTION CODE, AND FOUR LIVE 100%-OFF CODES

`FREE100` was rejected at checkout as invalid while looking perfectly valid in the dashboard. **A coupon is the offer; a promotion code is the typeable string that unlocks it, and the checkout field only accepts the latter.** The old FREE100 had "No promotion codes" — nothing to type. It was also welded to *Applicable Products: 10 Postcard*, a 2023 product, so it would have discounted $0 even once fixed.

Worth knowing for next time: `allow_promotion_codes: true` is all we set; we never pass `discounts` server-side. **So a coupon with no promotion code attached cannot be redeemed at our checkout at all** — that fact is what made the cleanup below safe.

**The real find: four legacy 100%-off coupons were Active with no expiry, and POPSTAR100 had 23 redemptions.** That string is out in the world from the Popcode 1.0 era, when redeeming it cost nothing because the product was digital. It isn't digital now — a redemption means a real print, real postage and $3.75 of inserts billed to us against an order collecting $0.

Checked Subscriptions first (empty) before deleting anything, because a "100% off forever" coupon on a live subscription would have started **charging 23 comped people** on deletion. All legacy coupons removed; one `FREE100` remains, 100% off once, max 2 redemptions.

Two things about a 100%-off order, both already handled: **`fulfill.mjs:25` accepts `no_payment_required`**, which is what Stripe returns at $0, so it still fulfils. And there's **one Stripe line item per provider group carrying printing + shipping together**, so 100% off zeroes the whole thing, postage included — your Prodigi bill is unchanged. The order records `total_charged_minor = 0`, which is honest, not a bug.

#### PRINT RENDERING NOW HAS A REAL PROGRESS MODAL (`22e8e02`)

A 62-page book renders every page at 300 DPI, and progress went through `showToast`, which **auto-hides after 2200ms — shorter than one page takes.** It flickered in and out for the whole job and read as something repeatedly going wrong.

Now a blocking modal with a determinate bar and page counter, in `book.html` and `calendar.html`. Blocking is deliberate: editing mid-render would corrupt the file being built. `closePrintProgress()` runs in a **`finally`**, so a throw can't strand the page behind the scrim.

**The bug worth remembering: both files already defined a `setProgress`** (the save bar) later in the file. Function declarations hoist and the last one wins, so my version was silently replaced and my calls landed on the old `(label, pct, isError)` signature — passing a page-number string as `isError`, which is truthy, flipping the save bar into an error state on every page. **`node --check` passes happily on a name collision**, and the diff looks fine because the clash is 3,000 lines away. It only showed up as a bar stuck at 0% when driven in a browser. Named `openPrintProgress` / `setPrintProgress` / `closePrintProgress`.

#### ORDER-SUCCESS HEADING (`9a6cb0d`)

"Thanks — payment received!" → **"Thanks, payment received!"** at **30px**, not the `--pc-h1` token: the box gives 360px of content and the sentence measures 350px at 30px, 374px at 32px. Below 420px the box's own gutters left 192px and it broke over *three* lines, so those are trimmed there to hold it to two.

**One line on a phone isn't reachable** and I said so rather than shrinking it: 390px would need a 22px headline, and 320px fits nothing readable.

**Measured with a Range over the text.** My first attempt measured the `h1`'s own rect — but an `h1` is a block, so it reports the container width and cheerfully claimed 44px fit at 320px. Same class of error as the postcard copy box. **To ask "do these words fit", measure the words.**

#### LESSONS

- **Two copies of one rule will drift, and the drift is silent.** The cart's product list and the server's disagreed for six days. Same shape as yesterday's `UNSERVABLE_STATUSES`. When a decision is split across client and server, the client's job is to *make things available* and the server's is to *decide*.
- **`node --check` cannot see a name collision.** For anything added to a multi-thousand-line file, grep for the identifier before choosing it, and drive it in a browser after.
- **An element's bounding rect is not its text's width.** Blocks fill their container.
- **Before deleting Stripe coupons, check Subscriptions.** A "forever" discount on a live subscription is someone's comped account.
- Parallel sessions were in `book.html` all day (four commits, ~215 lines on cover artwork and the proof). Rebase was clean, and I **re-ran the browser test after rebasing** rather than assuming.

#### STILL OPEN

- **`ord_14540083`'s proof image** answers three things at once: does a per-order `branding` block **replace** the dashboard default or **add a second card**; does the rotation print right way up; and does sending a card **suppress the sticker**. That last one is a constraint on every option in the table above.
- The **multi-project card** — C + E designed, nothing built.
- **`analytics.html` still gated to `curtmid@gmail.com` only** — four sessions now.
- **Re-enable Vercel Deployment Protection** on previews — five sessions now.
- Shipping options as cards with prices and estimates — the biggest remaining Popsa gap.

### 2026-09-21 (later) — Why an order shipped in two parcels, and why the sticker never shipped at all

Continuation of the same day. Branch `claude/eloquent-turing-7vwk8u`, six commits, each fast-forwarded to `main` and verified live: `9e49b7b`, `acdb279`, `9e095e9`, `6dce211`, `974c2a3`, `48d9ab7`. No PRs, no migrations. Started as one question about a cancelled order and turned up two live defects, one of which I had shipped myself earlier the same day.

#### The cancelled order (14540074) — a $6 print and a $30 framed print

Prodigi split it into two parcels on two carriers:

| | product | carrier | shipping |
|---|---|---|---|
| shp_14071074 | `GLOBAL-FAP-5x7` flat fine-art print | USPS Priority Mail Flat | **$10.75** |
| shp_14071075 | `GLOBAL-CFP-5x7` framed print, black | UPS Ground Shipping | **$21.55** |

Full summary: Items $36.00, **Inserts $5.00**, Shipping $32.30, Tax $6.13, **Total $79.43**. Customer side would have been $58 printing + $33 shipping = **$91** (matches the Stripe figure exactly), $98.62 with tax. Gross **$11.57** — or $17.70 if the ST-120 resale certificate were in place and Prodigi weren't charging us $6.13 of sales tax.

**Why two rates:** a flat print goes in a flat mailer, a framed print is rigid, glazed, heavy and breakable and needs a box on a ground carrier. They are not made in the same place and physically cannot travel together. **Prodigi's own docs say it outright** — *"we allocate to the most cost-effective lab based on the chosen products, destination and shipping method. This may require us to split the order into multiple shipments."* Same mechanism as the $76 bug on 2026-09-15; that one was a UK-fulfilled postcard SKU, this one is a frame on different equipment. Nothing is marked up here: shipping is passed at cost.

The framed item would have cost $21.55 to ship alone. Adding the $6 print cost $10.75 more **only because it couldn't ride along**. Two framed prints from one lab would have shared the $21.55 — which is the real shape of "the second item quadruples net": it only holds **within a lab group**.

#### THE CART WAS COUNTING THE WRONG THING (`9e49b7b`, `acdb279`)

`cart.html` already had a "ships in N parcels" note. It read `priced.groups.length` — the number of **PROVIDERS** (Prodigi vs Printify). One Prodigi group covers any number of labs, so on a Prodigi-only order the count was always 1 and the warning **never fired on the orders it existed for**. Comment in the code even asserted "One group = one parcel", which was simply false.

The data was already in hand and being thrown away: Prodigi returns `quotes[0].shipments[]` on **every** quote, each with `carrier`, `fulfillmentLocation.labCode` and `cost`. `sumQuoteMinor` parsed `costSummary` and dropped the rest.

Now: `sumQuoteMinor` returns `parcels`, `quoteCart` prices each one, `/api/cart-quote` reports the true `shipments` count plus a `parcels:[{carrier, shipping_minor}]` array, and the summary lists them under the shipping line:

```
Subtotal                              $58
Standard shipping                     $33
    USPS Priority Mail Flat           $11
    UPS Ground Shipping               $22
Tax                                 $7.62
Total                              $98.62
```

**Two invariants that matter more than the feature:**

1. **Charged totals are untouched.** The per-parcel figures are a *split* of the shipping line, never a second opinion — same discipline as the per-line prices. Naive per-parcel rounding breaks it: two $10.20 parcels ceil to $11 + $11 = $22 against a $21 charge, and the rows would out-total the total.
2. **Split in WHOLE DOLLARS, not cents.** My first version was proportional in minor units and produced **$10.98 and $22.02** under a $33.00 line — arithmetically correct and visibly wrong, because every other figure in that summary is whole. Splitting the dollars and scaling back gives $11 + $22, which is what you'd write by hand. `priceParts` always ceils shipping to a whole dollar so the division is exact; there is a `% 100` guard anyway.

The largest-remainder splitter is now one shared **`catalog.splitMinor(weights, total)`**, used by both `allocateLinePrices` and the parcel split, instead of a second copy. Use it for any future "show a charged figure broken down".

Rows only render when there are **2+** parcels — repeating a single parcel's rate under the line that already states it is noise. Note wording is number-agnostic ("every rate above"), since an order can split three ways.

Verified against the real order's numbers (printing $58 / shipping $33 / total $91 / 2 parcels summing to $33), plus zero-weight, single-parcel, no-breakdown, odd-remainder and failed-quote paths, and no horizontal overflow at 320–1200px with a 44-character carrier name.

#### THE STICKER — `branding` is a map of slots, and we were naming one

From Prodigi's docs (`https://www.prodigi.com/print-api/docs/reference/`), the **eight** branding slots:

```
postcard   flyer   packing_slip_bw   packing_slip_color
sticker_exterior_round   sticker_exterior_rectangle
sticker_interior_round   sticker_interior_rectangle
```

**The casing is genuinely mixed** — `postcard` and `flyer` are plain words, stickers and packing slips are snake_case. Confirmed against the raw request AND response examples in the page source, not a doc-summariser's rendering (the summariser normalised it, and this repo has been burnt by that before — see the Shotstack `fit: cover/crop` inversion on 2026-07-15). **A misspelt key is not an error — the slot silently never ships**, which is exactly how this would go unnoticed again.

We were sending `{ postcard }`. `create-checkout` now names both slots via a new **`catalog.buildBranding({ postcardUrl, stickerUrl })`**; `companionInsertBranding` is kept as a thin wrapper.

**A REGRESSION I SHIPPED AND CAUGHT 20 MINUTES LATER (`6dce211`)** — worth remembering as a shape. A **multi-project** order has no per-order card (`companionInsertCollectionId` returns null when lines span designs). Today that sends no `branding` at all, so the dashboard default applies and the box gets a generic card *and* a sticker. My first version would have sent `{ sticker_exterior_round }` alone, which **replaces** the default, shipping a sticker and **no card whatsoever**. Strictly worse than before. The override now happens only when there is a card to put in its place:

```
single project, sticker deployed  -> our card + our sticker
single project, sticker missing   -> our card
multi-project / upload failed     -> dashboard default (unchanged)
```

Both assets are HEAD-checked before being named, because Prodigi fetches these URLs server-side and a 404 fails the order AFTER the customer has paid. The sticker URL is **absolute and pinned to production** (`PACKAGING_STICKER.url`, overridable by `PACKAGING_STICKER_URL`): a preview deployment is not publicly reachable (Deployment Protection answers 401), so deriving the origin from the request would quietly hand Prodigi a URL it cannot read.

#### THE "Default for:" OBSERVATION — still unexplained, and I over-claimed before seeing it

A screenshot of Settings → Branding showed the companion card marked **"Default for: API, Online order"** and the sticker set with **no "Default for:" line at all**. Earlier notes (2026-09-20) recorded the sticker as "API + Online order", so **setting the card as default appears to have knocked the sticker off — Prodigi seems to allow one default insert set per channel.**

I had already asserted, in a commit message, that the `branding` override was *the* cause. A cost summary alone cannot distinguish "our object replaced the default" from "the sticker was never a default for API orders", and this screenshot makes the second likelier. **It does not change the fix** — naming the asset explicitly bypasses defaults entirely, which is also why it is the better mechanism: it cannot be switched off by an unrelated dashboard change, the way this one just was.

**Consequence still live:** an order placed from the **dashboard** rather than the API follows those defaults, so it currently gets a card and no sticker.

#### The artwork: rebuilt, then replaced by the original (`974c2a3`, then `48d9ab7`)

The sticker art existed only inside the Prodigi dashboard, which is not a URL their API can fetch. `mdfind` and the Dropbox folder turned up nothing (the `Sticker Mule` folder is the **badge** stickers customers order — a different product), so I rebuilt it as `public/sticker.html`: a canvas artboard pulling `CARD.gradient` straight from `postcard-render.js` so the sticker and the card that travels in the same box could not drift. Canvas takes the axial endpoints directly, so unlike the CSS form there is no projection to do.

**Then the original turned up and replaced it, committed byte-for-byte rather than re-encoded.** `public/sticker.html` was deleted with it: it existed only because the artwork was thought lost, and its composition differed from the approved one — a generator that produces something other than what ships is worse than no generator. The artwork is in git now, so it cannot go missing again.

**The rebuild did settle one fact.** The approved file is **827×827 at 300 DPI = a 70mm square**, so the bleed is **2.5mm** around the 65mm cut, not the 3mm I had assumed. Recorded in `catalog.mjs` beside the config. It runs to all four corners; a square fully covered by artwork with the die cut taking the circle out of the middle means no cut position can expose a bare edge.

Two design notes from the rebuild, if it is ever needed again: the **wordmark already reads "popcode"**, so `popcode.app` beneath it at equal size sets the same seven letters twice and reads as two competing logos — it wants to be small and letterspaced. And **neither symbol PNG works on the gradient**: `popcode-symbol.png` is a black disc with the mark knocked out, `.rev.png` is its inverse (white disc, BLACK pinwheel — `.rev` means colour-inverted for sitting on a dark photo, per 2026-09-02). A white pinwheel means pulling the inner path out of `popcode_symbol_k.svg`, the way `shop.html` does.

#### ECONOMICS — the one that changes the model

**Inserts are billed PER SHIPMENT, not per order.** `Inserts $5.00` on the cancelled order is two postcards at $2.50 and nothing else — two stickers would have made it $7.50. So a lab split **doubles the insert bill**, and inserts are never in the quote, so it comes straight off margin: **$5.00 of that order's $11.57 gross, 43% of what would have been kept.**

Every "$3.75 per order" figure in earlier notes is per-parcel-per-order and wrong for split orders. Verified live the same session: a 5×7 print to the US is **$6.00 goods + $10.75 shipping = $16.75 cost against $22.00 charged**, i.e. $5.25, **$1.50 after inserts** on a single parcel. A two-parcel version of that order would be underwater.

Ruled out while in there: printing the URL on a product's reverse. `GLOBAL-FAP-5x7` and `PHOTIL-FRA-0507` both report `print areas 1 — default` (`scripts/verify-prodigi-sku.mjs` reads `product.printAreas`, so it is one command). **When a design argument turns on a supplier capability, check the capability before arguing.**

#### GOTCHAS

- **`numpy` is NOT installed in this sandbox; PIL is.** An image-analysis script that imports numpy dies on line 2. Write the pixel loops in pure PIL.
- **`curl` status `000` is not a 404** — it means no response (dropped connection through the proxy). I nearly reported a removed page as confirmed-404 on the strength of it. Re-request before drawing a conclusion.
- **Chromium's PNG encoder writes RGBA even with `getContext('2d', { alpha: false })`.** I wrote a comment claiming the flag shrank the export; it does not (785KB either way). Flattening to RGB with PIL is what saves it (182KB, pixel-identical by hash) — but only matters for a file we generate, and the shipped one is now the original at 78KB.
- **A `git rebase` while files are unstaged errors out and does nothing** — harmless here (already up to date), but it prints before the `&&` chain and can look like the commit failed when it did not. Check `git log` rather than trusting the error.
- A sandbox `python3 -m http.server` plus `playwright-core` (scratchpad only — `node_modules` is tracked in this repo) drives `cart.html` fine with a stubbed supabase; **`rows` is a top-level `let` in an inline script, so `window.rows = …` does NOT set it** — assign the bare identifier inside `page.evaluate` instead.
- Deploy verification by `curl` + `cmp` against the local file worked cleanly three times this session. Keep doing that rather than grepping for a guessed string.

#### STILL OPEN

- **Watch the first real order** for `Inserts $3.75` with a Postcard AND a Sticker — that is the proof the whole chain works.
- **Dashboard-placed orders still get no sticker** (the `Default for:` thing above).
- **Per-parcel insert cost vs the cheap end of the catalogue** — a 5×7 nets ~$1.50 on one parcel and loses money on two. Worth a look once a few real orders exist.
- **ST-120 resale certificate for Prodigi** — they charge us sales tax our quote never sees ($6.13 on this order).
- Unchanged from earlier: `analytics.html` still gated to `curtmid@gmail.com` only (five sessions); re-enable Vercel Deployment Protection on previews (six sessions); shipping options as cards with prices and delivery estimates is still the biggest Popsa gap.

### 2026-09-22 → 09-23 — Four new Prodigi product lines: mugs LIVE, magnets/stickers/ornaments built and held back

**Branch `claude/determined-planck-fqj14e`, merged to `main` in five fast-forwards: `c81e2e6` → `be73ac5`.** All live in prod. No PRs, no migrations, no env changes. Task was "add magnets, kiss-cut stickers, Christmas, coloured photo mugs — and see if we can print the address on the mugs (sideways around the handle?) and the back of ornaments."

Short version: **all four are built and correct; only mugs are on the shop.** The other three have no US print lab at Prodigi and quoted $33.18 of transatlantic postage on $3.21 of stickers, which is not a product. Mugs moved to a different SKU and are now the best margin in the shop.

#### The two questions the task asked

**Mugs — the URL CAN go on, and then we took it off.** A mug has ONE wrap-around print area (228.6 × 94.83 mm, aspect 2.41, stated exactly by the API), so there is no back and the only place for an address is inside the artwork. Built it: `popcode.app/{slug}` set vertically at the trailing edge, which is the panel beside the handle. Then removed it at the user's call — the companion card carries the URL like it does for a print or canvas, and a line of type up a photograph was not worth the picture. `drawWrapUrl` is deleted, not left unreachable.

**Ornaments — NO, and this is settled, not open.** Prodigi's own product pages state **"Single-sided print"** for the aluminium, ceramic and glass ornaments. The plastic bauble says "double-sided", but its description explains what that means: *"your design showcased on both sides for a 360-degree display"* — ONE artwork shown twice on a card insert, not a second print area you can put something different on. Don't re-litigate this without checking `printAreas` on the SKU.

#### THE FINDING THAT SHAPED EVERYTHING: these categories are UK-only at Prodigi

Verified from Prodigi's own product pages, then confirmed by live quotes. Magnets UK. Kiss-cut stickers UK/EU. All Christmas UK. Coloured mugs UK/SE. **No US lab, and no `GLOBAL-*` SKU for any of them** (the kiss-cut page advertises a `GLOBAL-STI` prefix but its fulfilment is still UK/EU).

Live price list to a US address, 3 copies, 2026-09-22 — **Budget and Standard are identical, there is one international rate**:

| | goods | shipping | customer pays |
|---|---|---|---|
| 3 × 3×4" stickers | $3.21 | $33.18 | **$44** |
| 3 × 4" magnets | $15.99 | $33.18 | **$73** |
| 3 × ceramic ornaments | $31.98 | $25.65 | **$81** |
| **9 of 16 SKUs** | — | **no US route at all** | — |

Margin was never the problem — every priced row cleared its inserts on a SINGLE copy. $33 of the price is postage passed through at cost, which no markup touches. And it compounds: a print plus a magnet is two parcels on two continents, so two shipping charges AND two sets of branded inserts (~$3.75 each, billed per shipment, in no quote).

#### MUGS ARE SOLVED — `GLOBAL-MUG-W`

Prodigi's `GLOBAL-*` products route to the lab nearest the customer, exactly like the `GLOBAL-FAP` prints. Switching the coloured 11oz mug (`H-MUG-11OZ-*`, UK-only, zero US shipping options) for the white one changed everything:

| | goods | shipping | customer | net after inserts |
|---|---|---|---|---|
| **11oz white mug** | $10.00 | **$6.45** | **$26** | **$5.80** |
| 5×7 print (for scale) | $6.00 | $10.75 | $22 | ~$1.50 |
| UK coloured mug | — | no US route | — | — |

**Roughly four times the net of a small print.** Trade-off: white only, no coloured handle. The five coloured SKUs stay in the catalogue as `hidden: true` — verified, resolvable so a saved design still works, ready if Popcode ever sells into the UK/EU.

#### What's live, what's held back, how to flip it

- **Live:** `mug` (GLOBAL-MUG-W).
- **Built, priced, NOT listed:** `magnet`, `sticker`, `ornament`. Everything about them works. To offer one: remove its name from `NO_US_FULFILMENT` in `order.html` AND drop its `ukOnly: true` in `shop.html`'s PRODUCTS. Two places, one line each.
- **The real fix for that category is a US provider.** `PRODUCT_PROVIDER`/`providerFor` exists for exactly this, and Printify already fulfils the board book from District Photo in the US. Only SKUs and aspects change — none of the handling below is Prodigi-specific. A parallel session has already started `scripts/printify-catalog.mjs` (a Printify catalogue inspector for ornament blueprints), which is the right next step.

#### SKU verification — all 16 resolved, and it corrected three things

`PRODIGI_API_KEY=… node scripts/verify-prodigi-sku.mjs <SKU>...` against the LIVE catalogue. Every one resolved with exactly ONE required `default` print area, so the single asset this app builds is right for all of them and none can hit MissingRequiredAssets.

What it caught, all in the stickers:
- **Aspect was wrong.** I'd used the die-cut print area (66.9×95.3mm, 0.70). It should be the SHEET — Prodigi's accepted pixel sizes for the 3×4" run 360×480 to 900×1200, both exactly **3:4**. The die takes the sticker out of the middle.
- **Two of four max pixel sizes were guesses and wrong** — 8.5" is 2550 square not 2475, 14" is 4200 not 4125.
- **Those caps were stored and never enforced.** A phone photo cropped square is ~3000px, which busts the 5.5" and 8.5" ceilings on ordinary input. The builder now scales down to fit, and the badge clears the 2.5mm (30px) the die trims.

**Attributes are single-valued on these SKUs** (mugs: color + size; aluminium ornaments: style), meaning the SKU already fixes them — unlike the classic frames whose `color` comes back as a pipe-separated list of eight and must be chosen. So `attributes: {}` is correct here; sending a field Prodigi doesn't expect is its own rejection.

**Only single-image magnets are offered.** `MAG-4-*` and `MAG-9-*` are collage magnets declaring 4 and 9 required print areas against our one asset.

#### Pack sizes (`minCopies`) — built, and the data said they weren't needed

Asked whether to require a minimum of three per order. Recommended **per-product pack sizes, not a per-order rule** (a per-order minimum would block someone buying one framed print, which works fine today), implemented so the quantity box starts at the pack size and can't go below — the customer never meets a rejection. Server clamps to the same number via `catalog.normalizeCopies`, used by the quote, cart and checkout paths.

Then the real prices came in and **every row showed `min qty ✓ 1`** — each product covers its own inserts on a single copy. The pack-of-3 was a guess made before there were numbers. Mugs sell singly; the machinery stays on the three hidden products where it'd be right if they're ever sold from the UK.

#### THE MUG MOCKUP — a reusable technique worth knowing about

The drawn canvas mug was poor and the detail page showed a flat panorama with no mug in it. Both fixed with a new kind of template.

**`cutout` templates.** Every existing mockup in `MOCKUPS`/`CARD_MOCKUPS` is an opaque product photo that takes the art ON TOP, clipped to a rectangle. A mug's print area is a cylinder that arcs at top and bottom, and no rectangle describes that. A cutout template is the product photograph with its printed area **erased to transparency**: the art goes UNDERNEATH and the template's own pixels mask it, so the curve comes free. `cylinder: true` shades the art as a curved surface. Both renderers (`renderProductMockup` in order.html, `drawProductCardMockup` in unsplash-samples.js) understand the flag.

**How `public/assets/mockups/mug.png` was made** (repeatable for any product photo):
1. Started from a Prodigi product shot the user supplied — a mug with third-party pop-art on it. Removing the design pixel by pixel is also what makes the asset safe to ship: no third-party artwork survives, and **it means you don't need a blank product photo**.
2. Detect design pixels as `saturation > 22 OR sum(rgb) < 120`. Saturation alone misses the comic's BLACK outlines; "darker than white" alone sweeps in the mug's own neutral grey base shading (sum 474–717) and flattens the bottom arc.
3. Take topmost/bottommost design pixel **per COLUMN, not per row**. Row-wise min..max correctly fills interior white patches (a collar, a sleeve) but at the top the design exists only at the far left and right — the rim dips lowest in the middle — so it bridges straight across and cuts the rim off.
4. **Fit a quartic** to the top and bottom boundaries by least squares, robustly (drop outliers, refit). Per-column integers step 1–2px, which on a curve against white reads as a torn edge. A few columns near the handle sit wildly off (one reported its base 370px high) and drag the curve if not dropped. Residuals: 0.62px rms rim, 1.21px base.
5. **Anti-alias**: coverage = the fraction of each pixel inside the fitted curves. A binary mask on a curve is what looks torn.
6. Grow the hole outward past the design, then despeckle: anything still coloured inside the print region can only be the design, since mug, handle and background are all neutral.

Final: 881×900, ~101KB, rect `{ x: 0.1850, y: 0.1767, w: 0.5596, h: 0.6778 }`, arcs 42px top / 39px bottom, max sub-pixel step between columns 0.78px.

#### Fit vs Fill on a wrap, and where the picture belongs

**Mugs default to `fit`, not `fill`** (`defaultAdjustFor(type)`; prints keep fill). A 2.41-wide band is far wider than any ordinary photo, so Fill crops away most of it — a test elephant came out as a pair of legs — and a customer who never opens Adjust photo would order that unknowingly.

**That change needed a white ground first.** `compositeBadgedImage` draws onto a fresh, transparent canvas and Fit deliberately leaves the sides uncovered; exported as JPEG that transparency becomes **BLACK**. Switching the default alone would have printed two black bands either side of the picture on a white mug. There is now an explicit white fill before the photo in both the full-res and preview paths.

**Where the picture sits: centred, which on a mug means opposite the handle.** The band is 229mm of a ~258mm circumference, so the ~29mm gap is the handle and the band's two ends finish either side of it. The MIDDLE of the band therefore sits directly opposite the handle — the one spot that faces outward whichever hand holds the mug and that the handle never splits. "Away from the drinker" isn't available as a choice: a right-hander and a left-hander present opposite faces. Fit gives this for free — photo centred (~23% margin each end), unprinted ceramic falling either side of the handle, which is how a commercial photo mug looks. Same reasoning puts the **badge at the foot of the MIDDLE of the band**, not a corner: a wrap has no corner anyone sees.

#### Bugs found and fixed along the way

- **SkuNotFound read as "we can't ship there".** Prodigi answers an unknown SKU with 404, which sat in `UNSERVABLE_STATUSES` — so a typo in this catalogue would have told every customer we don't ship to their country and raised nothing in Sentry. Now classified separately (`err.skuNotFound`, `err.noRetry`), named in the message, and both retry loops honour `noRetry`.
- **Round products lose their badge.** A bauble or ceramic ornament is die-cut from a square asset, so the bottom-right corner — where the badge has always gone — is exactly what's thrown away. Measured: 776px from centre on a 600px radius. `round: true` moves it inside the inscribed circle (540px).
- **Detail preview rotated the mug 90°.** That branch exists because a portrait 8×10 frame turned on its side IS a 10×8; a mug's 2.41 wrap made it stand the mug on its handle. Cutout templates never rotate.
- **Adjust photo had no effect on a mug.** I routed the mug preview through `renderProductMockup` and never passed it `adjust`. Worse: `buildPrintAsset` DOES pass it, so the mug would have printed with the customer's crop while the screen showed something else. Detail, review and Edit Photo's save now share one `renderProductPreview`.
- **The detail copy described the product I'd removed** — "nine-colour handle", "made and posted from the UK" — live in prod for about an hour after the SKU switch.

#### METHOD LESSONS (four eye-checks, four wrong)

Worth internalising: **for "is this the right shape", instrument the geometry — never inspect the picture.** Same rule as the 8×8 square-crop bug in August. Four failures this session, each caught by choosing a measurement that isolates the thing in question:

- **Flat base arc.** Called two renders correct by eye. Measuring the lowest printed row at five positions across the base settled it: 0px of curve before, 31px after.
- **Flat top arc.** Measuring the topmost SATURATED pixel of a composited render gave 91px and non-monotone — it was finding the photo's own pale sky, not the mask. **Compositing a flat magenta rectangle** isolates geometry from content and gives a clean curve.
- **"7px sawtooth"** after anti-aliasing — that was a hard colour threshold flipping across a soft edge. A **sub-pixel centroid** of the colour transition gave the truth: 0.78px max, 0.13px mean.
- **A deploy reported live that wasn't.** My poll compared `shop.html`, which that commit never touched, so it matched instantly. **Poll on something that exists only in the new build** — a 404 → 200 on a new asset is unambiguous. Byte-compare with `cmp` against the local file.

**Also: three defects in a row came from adding a SECOND rendering path instead of extending the one that existed** (flat panorama on detail, bare rectangle on review, ignored crop). Consolidating behind `renderProductPreview` should stop it recurring — watch for it when the next product type arrives.

#### Smaller gotchas

- **A 401 on every SKU is usually the KEY, not the host.** A copy-paste placeholder stayed glued to the front of the key (`your-key-here` + 36-char GUID = 49 chars) and `verify-prodigi-sku.mjs` confidently blamed the base URL sixteen times. Its 401 message now describes the key's SHAPE first — `starts "your"` would have ended it in one line. Recovery without re-pasting: `export PRODIGI_API_KEY=${PRODIGI_API_KEY#your-key-here}`.
- A key visible in the user's own terminal is fine; the risk is pasting into chat. `read -rs VAR` avoids `~/.zsh_history`, but if the whole block is pasted at once `read` swallows the next line instead.
- **No numpy in the sandbox; PIL installs via `pip install pillow`.** Least-squares fits were done with hand-rolled Gaussian elimination.
- `mcp__claude-code-remote` has no Prodigi credentials — SKU verification and pricing must be run by the user on their Mac.

#### STILL OPEN

- **Order one mug.** The only way to judge the real thing, and the one question I can't answer from here.
- **Parcel count on a mug-plus-print order.** Both `GLOBAL-*` and US-made, but Prodigi groups shipments by LAB — two labs means a second parcel and a second ~$3.75 of inserts. The cart's shipping breakdown shows it.
- **Printify for magnets, stickers, ornaments** — blueprint selection plus a `send_to_production: false` test order, the way the board book went. `scripts/printify-catalog.mjs` is the start.
- Unchanged from before: re-enable Vercel Deployment Protection on previews; `analytics.html` still gated to `curtmid@gmail.com` only; shipping options as cards with prices and estimates (biggest remaining Popsa gap).

### 2026-09-24 — Ornament order-flow audit, designs filed from the create step, all-products audit, ornament provider settled, Mac git cleanup

**Branch `claude/shop-cards-book-design-3uaneo`, each commit fast-forwarded to `main` and live:** `78a88e7`, `0571aba`, `9f19a70`, `8664424`, `edf4fe7`, `de76db4`. No PRs, no migrations, no env changes.

#### Ornament order flow (`78a88e7`, `0571aba`)
The user walked the ornament order on a real device and listed problems. Fixed:
- **Product page:** no Front/Back toggle (it lives on review now). Size reads **2.9″ × 2.9″** (Printify blueprint 1747's real size); the server label is `'Ceramic Ornament 2.9" × 2.9"'`.
- **Create page:** the name alert reads "Give your Popcode a name." "Popcode created" is now a centred dialog (`#result-overlay`) with a close ×, Edit, View and Share, and it closes on Esc or the backdrop. **The first BowieXmas wasn't lost.** It saved to My Popcodes, but the old result message rendered below the fold, so the user made it a second time.
- **Back panel:** `drawOrnamentBack(slug, S)` in `public/product-preview.js`, shared by order.html and create.html. Wordmark, then "Go to **popcode.app/{slug}** / on your phone and scan the other side." (the user's exact copy), then the symbol. There's a Front/Back toggle on the create page (`#sp-side`) and on review (`#side-toggle`). **The back preview and the printed back use the same link.** The user asked for that and it was already the case.
- **Artwork:** `public/assets/mockups/ornament.png` rebuilt analytically by `scratchpad/build_orn7.py`. The circle is fitted to Printify's blank (residual 0.8px, where the old threshold mask left a ragged left crescent), the hole is found from the enclosed white region, and there's a ceramic shading overlay. The rect `{x:0.1127,y:0.1132,w:0.7728,h:0.7728}` is shared by product-preview.js, unsplash-samples.js and cart.html.
- The user's generator is `scripts/ornament-mockup/ornament_mockup.py`. It uses `detect_hole()` and `np.ptp` (`ndarray.ptp` was removed in numpy 2).

#### Every product now lands in My Designs (`9f19a70`)
The user reported "I hit back to ornaments and it disappeared" and "when you create a product it needs to live in my designs as well". Designs had only been saved when someone pressed Save on review.
- **Review autosaves.** `goReview()` ends with `saveDesign({ auto: true })`. The first save inserts a row and sets `editingDesign`, so every later save updates that same row. The Edit Photo save also autosaves. `loadSavedDesign` always sets `editingDesign` (as `null` when it's a Duplicate, merged with a parallel session's `duplicate` param).
- **The create step files the design too.** `create.html saveShopDesign()` inserts the design row plus a `collection_items` thumbnail. The payload comes from `sessionStorage.popcodeShopProduct.design`, which `order.html carryProductToCreate` fills.
- **Coming back from create lands on review, not page 1.** The back URL carries `&v=&fc=&m=1&o=` (size, frame colour, mount, orientation), applied by `applyCarriedOptions()`, so options no longer reset to the first size. The return link is `…&id=<popcode>&photo=0&created=1&d=<design slug>`, and `adoptCreatedDesign()` picks up that design row.
- **Add to cart straight from the create page.** The dialog's primary button in shop mode is "Add to cart" (`…&add=cart` → order.html adds the line, then goes to `/cart.html`). `edit.html` got the same "Back to {product}" continue link.
- **Bug found along the way:** `renderProductOnly`/`placeProduct` read order.html page globals (`state`, `isLightFrame`, `drawImageIcon`), so create.html never redrew drawn products like Framed Canvas. They now take options (`pageState()`, `st.frameHex`, `st.mounted`), with guarded fallbacks. **Shared renderer code must never read a host page's globals.**

#### All-products customer audit (`8664424`)
The user asked for an audit "as if you were someone ordering from start to finish" for every product. The harness is `scratchpad/audit_all.mjs` + `audit2.mjs`, with `stub_supa.js` logging writes to `window.__ops`, supporting `.eq`/`.in`, and holding saved designs and cart lines. For print, tile, canvas, framed, framedcanvas, acrylic, mug and ornament: the preview paints, review saves (`insert:<kind>`), the correct variant goes to the cart (the ornament sends `front+back`), checkout opens, and there are 0 page errors. Fixed:
- Mug and ornament showed "Portrait" on checkout and in the cart; orientation is now empty for `ORIENTATION_LOCKED` types.
- Plural names ("Ornaments") are now singular (`meta.noun || meta.name`) on review, design names, cart titles, checkout and `namePrefix`.
- "From $X" only shows when `activeSizeList().length > 1`.
- `buildAssetUrls` throws if the photo has no slug, so the back can't print a blank link.
- **Cart thumbnails:**
  - Ornament and mug use their cutout templates.
  - White and natural framed/framedcanvas lines draw a frame in that colour (`drawColouredFrameThumb`; the `framed.jpg` template is black).
  - The size isn't repeated under a title that already contains it.
- Noted, not a bug: My Designs cards show the plain photo, not a product mockup.

#### Ornament provider — 1747 stays (decided)
Another session claimed `catalog.mjs` had a duplicate `ornament` key and a blueprint 1623 entry. **Neither exists on `main` or on any branch** (`git log --all -S 112678` finds nothing). `PRODUCTS.ornament` evaluates to 1747 / provider 80 / variant 118761. The report was **accurate when written** and is not a phantom — see the corrected account in the (later) entry below. It does not change this decision, which was settled on its own evidence: the two were compared with the user's real Printify token:

| | 1623 Imagine Your Photos | **1747 M.i.A Merchandise (live)** |
|---|---|---|
| back print area | yes | yes |
| handling | 10 days | 10 days |
| unit / first ship / +item ship | $7.73 / $6.19 / $1.99 | $8.01 / $5.89 / $0.69 |
| 1 / 3 / 5 ornaments | $13.92 / $33.36 / $52.80 | **$13.90 / $31.30 / $48.70** |

It's a tie for one ornament, and 1747 is cheaper from the second on. 1623's only edge is **packs** (3/5/10-pc variants, e.g. `112679`, whose price isn't in the catalog API) and a **heart** shape. Revisit only to sell those. **The 10-day handling on both means an early Christmas cutoff**, which should be stated on the product page by mid-November.

`scripts/printify-catalog.mjs` printed "—" for shipping because it read `.amount`, but Printify returns `{ cost, currency }` (`edf4fe7`). It now also dumps the raw profile if no price is readable (`de76db4`).

#### The user's Mac was 524 commits behind — cleaned up
The local `main` was at `f3f306a`, and `git pull` failed with "divergent branches" on whatever branch was checked out. Resolved without touching that branch:
- A stray staged `scripts/printify-catalog.mjs` was moved to `/tmp/printify-catalog-backup.mjs`.
- `git checkout -- node_modules/.package-lock.json`
- `git checkout main && git pull --ff-only` → `de76db4`.
- `trek-folio/` (the Bashō repo, nested inside this folder) was added to `.git/info/exclude`.
- Four untracked `public/assets/mockups/framed-*.png` turned out to be the **2500px originals** of the 2000px committed `scenes/framed-*.png` (from `30517aa`, Sept 18). They were moved to `~/Dropbox/Popcode X/mockup-originals/`.

**Why this matters:** a stale checkout makes any claim about the repo unreliable, so a new start-of-session rule (see `## Session workflow`) makes every session report its commit and how far it is behind `origin/main` before making claims. **Correction:** the stale Mac was *not* the source of the "duplicate key / 1623" report — `f3f306a` is from 2026-07-14 and that code was written 2026-09-24, so a July checkout could not contain it. Those commits were genuinely pushed to `claude/shop-cards-book-design-3uaneo` and then orphaned by a reset, which is why `git log --all` no longer finds them. Full account in the (later) entry.

#### Gotchas
- **Tokens on the user's Mac:** `export PRINTIFY_API_TOKEN=$(pbpaste)`. Paste the line, don't press Return, copy the token, then press Return (`$(pbpaste)` reads at Return time). Check with `echo ${#PRINTIFY_API_TOKEN}` and `unset` when done. Never paste a token into chat. Printify tokens live at printify.com → profile → Connections → API tokens (`/app/account/api`) and are shown only once, so make a throwaway token and delete it afterwards. **Don't rotate the one Vercel uses.**
- `scripts/printify-catalog.mjs` has no imports, so it can run from a copy: `git show origin/main:scripts/printify-catalog.mjs > /tmp/x.mjs`.
- This container's clone is **shallow** too, so neither sandbox can date old deletions. The user's Mac has full history.

#### Still open
- **Order one ornament**, to see the real back panel and the artwork.
- 1623 packs/hearts, only if wanted.
- Unchanged: re-enable Vercel Deployment Protection on previews; `analytics.html` is gated to one email; shipping options as cards.

### 2026-09-24 (later) — Shop flow rebuilt around the product; ornaments to a US lab; and a cross-session message that was right when sent and wrong when read

**Branch `claude/determined-planck-fqj14e`, ~20 commits fast-forwarded to `main` through the day.** No PRs, no migrations. Two threads: finishing the Shop's create/choose flow (from the mug work), and moving ornaments off Prodigi's UK-only range onto Printify. Ended with a cross-session collision that produced the most useful lesson in the session — see the last part, it is a method lesson, not a git one.

#### THE TAXONOMY QUESTION THAT STARTED IT (worth keeping, it is a product decision)

User: *"if i want to find the experience to scan my mug i need a place to go... you can't find it in My Designs."* Then the rule, in their words: **My Popcodes is every experience you created; My Designs is the products you created.**

The discriminator is **scannability**, not product type:
- Books, calendars, board books compile their own `.mind` → they ARE experiences → My Popcodes, with a pill.
- Single-image products (mug, print, tile, ornament) point at a **source project's** `.mind` → they are products → My Designs only.
- But a mug made from a *new* photo+video creates a real collection, so that collection belongs in My Popcodes while the mug design stays in My Designs. Both, not either.

Implemented in `manage.html`: `PRODUCT_KINDS` extended, plus a data-based `hasPrintDesign()` fallback so a row is classified by what it *contains*, not by a hardcoded list that will drift. Design cards resolve `viewUrl` from `book_layout.print.sourceSlug`, and hide Open viewer / Share when there is no live source.

**Three bugs of one shape, all "a design slug treated as a Popcode slug":** saved mug designs 404'd from My Popcodes; a design card's Share copied a dead URL; and a reopened design printed a dead companion-card URL (`loadSavedDesign` used `col.id`). Fixed client-side, in the photo-tray filter, and server-side in `create-checkout` — which now selects `mind_file_url` and only earns a companion card when the collection is genuinely scannable.

#### Shop create/choose flow (the four-screen sequence)

Driven by the user's mockups and a lot of tight iteration. The product mockup stays on the left through **every** step so you never lose your place. Photo tray no longer auto-loads — it sits behind a choice ("Create a Popcode" / "Use a past Popcode"), because loading every past thumbnail was slow and presumptuous. Back link in a consistent place and wording on each screen, including after a past-Popcode selection.

- **`public/product-preview.js` (NEW)** — the renderer extracted out of `order.html` so the create page draws the real product with your photo. Its one external dependency (`giftArtOpts()`) became `opts.art`.
- **`create.html` shop mode** (`body.from-shop`) with `returnTo()` validated via `new URL()` + origin comparison. The naive `startsWith('//')` check let `/\evil.com` through — **Chromium normalises a backslash like a second slash**, so that resolves to `http://evil.com/`. Verified 12 cases.
- **Upload retry**: no `upsert` on any save-flow upload, so "Step 3 failed — Load failed" was a permanent dead end with orphaned files and no DB row. `uploadToStorage()` now upserts and retries.

**The extraction's single most valuable catch: a pixel-hash baseline.** Hashed all 9 product previews before the move, re-hashed after — 8 matched, the mug differed, because call sites were not passing `art`. No eye check would have found that. **Baseline-hash any refactor that claims to be behaviour-preserving.**

#### Ornaments: Prodigi UK → Printify US

Prodigi has **no US lab for ornaments** — 3 ceramic ornaments quoted $31.98 goods + $25.65 shipping. Printify's blueprint **1747 / provider 80 / variant 118761** is US-made at **$8.01/unit → $14.00** at the 1.7× markup. `PRODUCT_PROVIDER.ornament = 'printify'`.

**Printify cannot print inserts**, so `ornament` was REMOVED from `COMPANION_INSERT_FOR` and the URL goes on the **back panel** instead (the 1747 product is double-sided; `positions: ['front','back']`). Same reasoning as the board book.

**The round cutout mockup.** The ornament had no mockup and fell back to a drawn rectangle — square and flat. Built `public/assets/mockups/ornament.png` from the product photo with PIL: the disc erased to transparency so the photo goes *underneath* and the template's own pixels (gold string, hole, rim shading, drop shadow) sit on top. `cutout: true` but **not** `cylinder` — an ornament is flat, there is no curvature to shade. A parallel session then rebuilt the PNG six more times from better source photos and retuned the rect (disc 0.58 → 0.77, edge-to-edge); **the cutout mechanism and its comment survived verbatim**, which is the part that mattered.

Also fixed stale specs copy still describing the Prodigi range ("aluminium, glass or bauble / single-sided / posted from the UK").

#### THE CROSS-SESSION EPISODE — read this one

The user asked me to tell a parallel session to pull before committing. `ListAgents` was empty (all other cloud sessions disconnected), so I could not send anything; I wrote a message for the user to paste by hand. I had read `origin/claude/shop-cards-book-design-3uaneo` and found 4 pushed ornament commits, a **duplicate `ornament:` key** in `PRODUCTS` (lines 223 and 357 — verified by brace-matching AND by evaluating the module), and a different blueprint (1623/112678).

The other session replied that **none of it matched the repo** and suggested I was reading an uncommitted copy.

**Both of us were right, about different moments.** The four commits existed and were pushed — I could not have invented them, I fetched them from origin, and `git cat-file -e` still finds all four. Between my write and their read, **the branch was reset onto `main`, orphaning them.** That is exactly why their `git log --all -S 112678` found nothing: `--all` walks *reachable* refs only.

**The error was mine, and it was one of method.** I described a branch by its moving ref, in a message a human would hand over at an unknown later time, without naming the commit I was describing. Had I written "as of `946b792`" the mismatch would have been obvious to both sides instantly instead of reading as one of us hallucinating.

**Rules that follow:**
- **Any message that outlives the moment must name a commit SHA, never a branch name.** A branch ref is a moving target.
- **`git log --all` is not "all commits"** — it is all *reachable* commits. After a reset or force-push, real history becomes invisible to it. `git cat-file -e <sha>` and `git merge-base --is-ancestor` are how you tell "never existed" from "no longer reachable". Do not accept "--all finds nothing" as proof a commit never existed.
- When two sessions disagree about the repo, **check object existence and reachability separately** before anyone deletes anything.

Net: nothing lost, nothing to fix. The other session's `8664424` built on top of my work; I fast-forwarded (was 15 behind, 0 ahead).

#### Other things settled this session

- **A Sentry alert is not always current.** `POST /api/prodigi-quote — Printify base cost not configured for orn-ceramic`, production, looked live. It fired at **22:32:31 EDT** and the fix committed at **22:33:22 EDT** — 51 seconds later. **Check an alert's timestamp against the fix commit before investigating.**
- **Ornament and board book both return `shipping_minor: 0` on a product detail page** — Printify only quotes shipping against a full address, so it appears at the cart. Consistent across both Printify products, not an ornament bug. Prodigi products (mug: $6.45) do show it.
- **Deploy verification gave a false reading again, twice in one session.** First a 5-minute poll that was genuinely stale (real 404), then a byte-compare that reported `product-preview.js DIFFERS (163907)` — 163,907 is `order.html`'s size, i.e. the sandbox proxy returned the wrong body. A direct re-fetch was byte-identical. **A single odd size is a transfer artifact until a second fetch agrees; and a 79-byte "NOT_FOUND" body is a real 404 while a 70-byte truncation is not — check `size_download` and the status code, not just one of them.**
- **This clone is SHALLOW (110 commits).** `git log --diff-filter=D` silently finds nothing for anything removed before that horizon — which is why I could confirm `marketing/`, `demo.mp4` and `.DS_Store` are absent from `main` but could not date their removal. Absence from the tip is verifiable here; history questions are not.

#### STILL OPEN

- **Blueprint 1623 vs 1747 for the ornament.** Only 1747 is built and live. 1623 (provider 59) is ~$0.28/unit cheaper and also double-sided. Compare back panel and production time before the test order — `PRINTIFY_API_TOKEN=<token> node scripts/printify-catalog.mjs 1623 1747`, run in a terminal, never pasted into chat.
- **`PRINTIFY_DRY_RUN` is still `true`.** One test order confirms `baseCostMinor: 801` against the real `line_item.cost`; if it is off, every ornament quote is wrong by that margin. Then `PRINTIFY_DRY_RUN=false` in Production scope — and **Vercel env changes only apply to the next build**, so it needs a redeploy.
- Unchanged: order one mug; parcel count on a mug-plus-print order; re-enable Vercel Deployment Protection on previews; `analytics.html` still gated to `curtmid@gmail.com` only.

### 2026-09-26 (session of 09-25) — Nonprofits page, iterated to a finished pitch; After the Video buttons; Common Tide as a full demo

**Branch `claude/affectionate-dirac-iwzkid`, reset to `main` after every merge. PRs #72–#91 and #93 merged; #92 closed unmerged (see below).** Every merge was verified on prod byte-for-byte against `origin/main` (not against the local file — see lessons).

#### What was built

- **`/nonprofits`, many rounds of the user's direction.** Full-bleed marsh hero with the Common Tide postcard and a phone; "Stories that move. Proof that it works."; How it works as an animated sequence (URL typing → scan mark over the card → Meg's video → buttons arriving); Try it yourself (small, `#f0f0f0` band, downloadable PDF); What you get + Why it works on one dark panel over the girls-at-the-well photo with a **looping animated dashboard** (counts up, bars, funnel; replays every ~7s while on screen); proof line + Where to use it on one **brand-gradient band** with five printed sample pieces (type in The Seasons, labels in Cooper); pricing as two plan cards in `/pricing.html`'s style; closer "Print gets them to open it. / A voice gets them to give."
- **Hero phone = the real experience (PR #93).** It shows Common Tide's live `cover_config` (org cover, local copies of its photo and logo in `/assets/nonprofits-cover.*`, `nonprofits-ct-logo.png`), Meg's video, then the After the Video screen, and loops.
- **`?tweak`** on `/nonprofits`: drag or slide the eyebrow, headline, subhead, buttons, postcard, phone, sound button and hero spacing; *Copy values* gives CSS labelled with its breakpoint. The user used it once (1840px values applied in PR #84).
- **After the Video (PR #85)** — see Current state. `edit.html:` new *After video* tab; the cover save now **merges** into the saved `cover_config` (`wlCoverCfg`) instead of rebuilding it, so the two saves can't wipe each other; project rename rewrites `end.bg_url`. `view.html:` `#end-screen` (z-index 10000 — above `#wl-cover`'s 9999), `applyEndConfig`, `?preview=end` (counts no taps).
- **Cover editor preview** shows the animated scan disc (PR #80). **Common Tide demo pages** (PRs #86, #87), each labelled a demo of a fictional org, no payment fields; footer shows the `utm_*` tags the visit arrived with.
- Postcard PDF: "Give today" moved by editing the PDF content stream's `Tm` operators directly (PyMuPDF), then images re-rendered at the original quality (82 — matched by file size).

#### Lessons worth keeping

- **Safari re-enables a `hidden` text track** when the system's *Closed Captions + SDH* setting is on, and draws its own large captions. Another session's fix (track `hidden`, cues drawn in the page) still showed huge captions for the user. Robust fix: **give the video no `<track>` at all**; fetch the `.vtt`, parse it, draw the cue on `timeupdate` (`nonprofits.html`, hero phone script).
- **"Merge problem" was not a merge problem.** Prod matched `main` exactly; the old phone screen was simply built before the user configured the Common Tide cover. Compare live to `origin/main` first before suspecting lost work.
- **Verify deploys against `origin/main`, not the local file** — other sessions merge to main in parallel (holiday panel, montage, footer, mobile tweaks all landed during this one), so a live page can correctly differ from this branch's copy.
- **Byte-compare flakes:** several first fetches of an asset differed and a re-fetch matched (partial transfers through the sandbox proxy). Retry up to 3× before calling a deploy wrong.
- **CSS cascade trap:** a new rule `.pc .program b { font-family: the-seasons }` lost to an older, equally specific rule later in the file. Edit the existing rule instead of adding an override.
- **Adobe Fonts in headless tests:** the kit only serves font files to allowed domains; route `use.typekit.net` through `curl` with `Referer: https://popcode.app/...` to render it locally. `document.fonts.check()` is the quick pass/fail.
- **Sandbox Chromium can't decode H.264.** To test video flows, transcode to WebM with the bundled ffmpeg (`imageio_ffmpeg`) and route the `.mp4` request to it.
- The local `python3 -m http.server` dies between Bash calls here; start it in the same command as the test.

#### Still open (also in Current state)
- Calendly 15 vs 30 minutes; host name on the booking page.
- Pricing kit contents are a draft.
- Home-page nonprofits panel held back by the user's choice (`f4f1183`, closed PR #92).

### 2026-09-25 / 09-26 — Montage maker grows up (clips, saved montages, framing, timing); holiday panel with Scout's ornament; mobile /nonprofits pass

**Branch `claude/cool-sagan-0k8yp3`, merged to `main` directly after each round at the user's say-so (no PRs), ~20 commits.** Every merge verified live by polling for a string only the new build contains.

#### Montage maker (`create.html` + `edit.html` — the builder is DUPLICATED in both; every change was applied to both with one Python patch and tested on both)
- **Short video clips** alongside photos (`edf4c21`). A clip plays its own length up to **10s** (longer sources use the opening 10s; over 60s refused). No Ken Burns on clips. Clip audio is muted when music is chosen, kept when "No music". `api/create-montage.js` takes `items: [{type, url, seconds, frame}]` and still accepts the old `images`.
- **Limit 40 → 100 items**, render poll 4 → 10 min (`ce73bd3`).
- **Saved montages** (`ce73bd3`): stored in the storage bucket, **no migration** — `experiences/montage-drafts/{user_id}/{draftId}/` holds the uploaded sources plus `draft.json` (order, framing, per-photo times, settings). Signed-in users can already list/write the bucket (see 2026-09-04 storage lock). Save button; a "Save this montage?" prompt on close with unsaved changes; saved **before** a render starts (so a failed start can't lose it); listed as *Your saved montages* when the builder opens empty (open / delete). Rendering uploads into the same folder, so nothing uploads twice.
- **Framing** — tap a thumbnail (tap = frame, press-and-drag = reorder): drag a frame over the photo, zoom slider. Stored as centre + zoom so it survives a Shape change.
  - **GOTCHA, cost one round:** Shotstack's asset `crop` does NOT choose a region of the source — it trims the *placed* picture and leaves black (user's screenshot: half-black frame). Fixed in `e23ab3f`: **photos are cut to the frame in the browser** (`mtgFramedPhoto`, uploaded as `{id}-framed-{aspect}.jpg?v=…`), **video clips are moved with clip `offset` (fractions of viewport, +y is UP) and `scale`**. Semantics confirmed from Shotstack's OpenAPI source (`raw.githubusercontent.com/shotstack/oas-api-definition/main/schemas/*.yaml` — reachable from the sandbox; their docs site isn't useful to WebFetch). The video path is **still unverified on a real render**.
- **Time on screen per photo** (`110bc70`): stepper in the tap panel (1.5–10s; unset = Seconds per photo), clock badge on the thumb. **Last photo rests 1.5s longer** (`END_HOLD_SECONDS` in `lib/montage/timeline.mjs`) — the user saw it vanish ~2s after arriving because the closing fade ate it.
- **Resilience** (`e6ee495`): the user hit a one-off `Internal server error` from Shotstack with 40 items. Now: start retries once on 5xx; status checks retry up to 6 (the render continues at Shotstack regardless); errors name the step; `montage-status` reports failed checks to Sentry and returns Shotstack's `reason` for a failed render.
- **edit.html unsaved note** said "Page removed" after *every* change (incl. a montage). `markUnsaved(what, keep)` now names it; uploading a replacement video showed no note at all before (`f1c29ad`).

#### Home page
- **Holiday panel** between *Two ways to experience* and *Three steps* (`c9dac18`, then `d134a9d`, `b95ed01`, `cf3b7a6`). The ornament photo is the user's (`/assets/holiday-ornament.*`, a pale blob in its corner painted out with PIL); the card is that photo's background colour so it melts in, both lifted ×1.08 together. Headline fixed at two lines (break after "memories") with a font size computed from the column width (`(col − padding) / 10.9`) so line one never overflows — measured at 11 widths. *More gifts that play* chips. `#hol-try { scroll-margin-top: 130px }` clears the sticky header.
- **Scout's ornament PDF** (`/assets/scout-ornament.pdf`): built by rendering an HTML page to PDF in headless Chromium (site's CooperBT from `fonts.css`; Inter from `npm pack @fontsource/inter`), face cut from Scout's real scan photo (`experiences/scout/photo_0.jpeg`, square from the centre). 60% size, gold cord drawn in SVG, **Popcode symbol lower left** placed with `placeBadge`'s round-product geometry (6% of diameter, 45° diagonal). Delivery promise left off on purpose (10-day handling). Build files were in the scratchpad only — regenerate from this description if needed.
- **Phones can't scan their own screen**, so on touch devices (`@media (hover: none) and (pointer: coarse)`) *Try it yourself* says "open this page on a computer, or print it" with a **Scan Scout's ornament** button to `/scout`.

#### /nonprofits (mobile pass) + shop
- Hero phone captions drawn by the page (`2283800`) — **superseded**: Safari re-enables a `hidden` track under the OS *Closed Captions + SDH* setting; the other session removed the `<track>` entirely (see their 09-26 entry).
- Mobile: centred hero buttons, "No app. No QR code." kept together, Play-with-sound beside the phone, tight phone shadow (the big one left a gray edge on the arch), tighter How it works, smaller centred Try card, **Where to use it as a swipe carousel with dots** (`eba3a8e`); footer = home footer minus site links (`ddbe2df`).
- Shop: Ornaments then Photo Mugs after Board Books (`74b27c2`).

#### Lessons
- **Playwright + page data:** a `/unsplash/` abort regex also blocked `/unsplash-samples.js` and broke the shop test — match hostnames (`images\.unsplash\.com`), not words. `edit.html` without `?id=` opens a "No project specified" dialog that intercepts clicks; a stub with no session redirects to `/auth.html`.
- **SVG → PNG in headless Chromium:** `setContent` with an `<img src="file://…">` silently shows a broken image; inline the SVG markup instead.
- `pkill -f "http.server"` from the tool shell killed the shell itself (exit 144) — don't.
- **A Python heredoc with `'EOF'` doesn't expand `$S`** — screenshots landed in a literal `$S/` directory.
- Headless test harness for the builder (both pages): stub `window.supabase` with an in-memory storage map exposed via `page.exposeFunction` (`upload`/`list`/`remove`/`getPublicUrl` → `/__store/…` served by `page.route`), and generate test video with `MediaRecorder` on a canvas (WebM; the sandbox Chromium has no H.264).

