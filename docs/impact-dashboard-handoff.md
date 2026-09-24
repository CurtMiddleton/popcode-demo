# Handoff: Popcode impact dashboard

**Owner:** Curt Middleton · **Repo:** github.com/CurtMiddleton/popcode-demo · **Stack:** Express, Supabase, Vercel, MindAR
**Goal:** A dashboard that shows a nonprofit how its printed piece performed: scans, viewing, button taps, and (via their donation platform) gifts. First user: the Green Empowerment Giving Tuesday 2026 pilot.

---

## 1. Look and feel: it must look like Popcode

- Use the repo's existing design system: fonts, colors, spacing, components, wordmark, and the spiral badge. **The repo is the source of truth.** Don't introduce a new palette or typefaces.
- **Layout reference only:** https://claude.ai/artifact/WwCZF7p7BSrjZrfHNRaJPi. Take the structure and content from it (sections, metrics, order). Ignore its cream palette and fonts; restyle everything in Popcode's brand.
- Calm, editorial, not a busy SaaS analytics screen. One accent at most, used to highlight the key moment (e.g. Giving Tuesday) and the money.
- Responsive: EDs and board members will open it on phones. Test at 390px wide.
- Language: "scans" is fine here. No QR imagery anywhere.

---

## 2. Screen contents (top to bottom)

1. **Header:** Popcode wordmark, org name, campaign selector, "Export report" button.
2. **Title:** campaign name, date range, piece type, number of photos, "Updated [time]".
3. **Headline numbers (5 cards):** Scans · Watched to end · Button taps · Gifts · Raised. Each has a one-line note (e.g. "764 different phones", "Avg. watch 0:48 of 1:00", "121 on Donate", "Avg. gift $155").
4. **Scans by day:** bar chart across the campaign, with one configurable highlight date (Giving Tuesday) in the accent color and its value labeled.
5. **From photo to gift:** four-step funnel: Scanned a photo → Watched to the end → Tapped a button → Gave (confirmed). Note under it: "Gifts and totals come from your donation platform, matched through tracking tags on your donate link."
6. **Stories table:** per photo: thumbnail, name, scans, avg. watch time, % watched to end, button taps.
7. **Button taps:** horizontal bars per button (Donate, Volunteer, Newsletter, Share, or whatever the org configured).
8. **Address donors used:** split between the org's own address (yourorg.org/story) and popcode.app/{handle}.
9. **Footer line:** "Popcode collects no personal information from donors. Counts are anonymous."

Empty states matter: before launch, each section should say what will appear there rather than showing zeros.

---

## 3. Data model (Supabase)

Existing hierarchy: **Account → Collection → Image.** Treat a **campaign as a Collection.**

### `events` (append-only)
| column | notes |
|---|---|
| id, created_at | |
| account_id, collection_id, image_id | image_id null for page-level events |
| device_id | random anonymous ID generated in the browser and kept in localStorage. No fingerprinting, no IP stored. |
| event_type | `page_view`, `camera_start`, `recognized`, `video_progress`, `button_tap` |
| value | progress % (25/50/75/100) or button_id |
| entry | `custom` or `popcode` (see §4) |
| platform | `ios`, `android`, `other` (coarse, from user agent) |

### `story_buttons`
id, collection_id, label, url, sort_order, active. Outbound URLs get UTMs appended at click time: `utm_source=popcode&utm_medium=print&utm_campaign={collection slug}`. Don't overwrite UTMs the org has already put on the URL.

### `campaign_results`
collection_id, gifts_count, amount_total, currency, source (`manual` | `csv`), updated_at, updated_by. Gift data comes from the org's donation platform (Classy, Donorbox, Givebutter, Bloomerang, etc.), filtered by our UTM. **MVP: an admin form where Curt enters totals.** CSV import can come later.

Security: row-level security so org users see only their own account. Curt's admin role sees all accounts.

---

## 4. Custom addresses

Orgs point their own address (yourorg.org/story) at their Popcode page with a simple redirect. A redirect usually **won't** carry a referrer, so ask orgs to redirect to `popcode.app/{handle}?via=org`. The page reads `via=org`, stores `entry=custom` for that visit, then strips the parameter from the address bar. Everything else is `entry=popcode`.

---

## 5. Metric definitions

- **Scans:** count of `recognized` events.
- **Different phones:** distinct device_id among `recognized`. Label it "about" or "approximately": iOS may clear storage, so this is an estimate.
- **Watched to end:** plays that reached 100% ÷ plays started (per photo and overall).
- **Avg. watch time:** mean of each play's furthest progress × video length.
- **Button taps:** count of `button_tap`, overall and per button.
- **Funnel:** distinct devices that reached each stage; the last stage ("Gave") comes from `campaign_results` and is labeled as coming from the donation platform.
- **Scans by day:** grouped in the org's time zone (store a time zone on the account; default America/New_York).
- Compute aggregates in SQL (views or RPC functions), not in the browser.

---

## 6. Sharing and export

- **Share link:** a read-only, unguessable link (signed token, revocable) so an ED can send it to their board without an account.
- **Export report:** a print stylesheet that produces a clean one- or two-page PDF, plus a CSV of daily numbers.

---

## 7. Phases

1. **Before the pilot prints (~Nov 3):** event logging, story buttons with UTMs, and `?via=org` handling live on the story page. Without these, there's no data to show later.
2. **By Giving Tuesday (Dec 1):** dashboard with headline numbers, scans by day, stories table, button taps, and address split. Admin-only is fine.
3. **By mid-December:** gifts entry, funnel, share link, and export, in time to build the GE case study.

---

## 8. Done when

- Scanning a test card creates the expected events, with no personal data stored.
- Button taps open the org's URL with correct UTMs and are counted.
- The dashboard matches Popcode's brand and the layout reference, works at 390px, and shows proper empty states.
- An org user can't see another org's data (RLS tested).
- A share link opens a read-only view and can be revoked.
- Export produces a clean PDF and a CSV.
