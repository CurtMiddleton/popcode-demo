# Handoff: Popcode for Exhibitions

**Owner:** Curt Middleton · **Repo:** github.com/CurtMiddleton/popcode-demo · **Route (proposed):** `popcode.app/exhibitions`
**Goal:** Self-guided audio tours for galleries and museums. Visitors use their own phone and headphones and point the phone at the work itself. The space gets a dashboard of what was scanned, finished, liked and tapped. First milestone: a private demo for a Met development contact, then one real pilot at a local gallery or small museum.
**Written:** 2026-10-08, from a strategy conversation. Nothing is built yet beyond what §4 lists.

---

## 1. The idea

- A placard at the exhibition entrance carries an NFC tag (plus a fallback, see §3). Tapping it opens the exhibition's Popcode.
- The first screen is a **headphone check**: a short test sound and "Hear it? Start the tour." Then the camera opens.
- The visitor points their phone at any work, **in any order**, and hears an audio stop (video is allowed, but audio is the default: eyes stay on the art, not the phone).
- After each stop, up to three actions: learn more, become a member, support the exhibition, or (for commercial galleries) inquire about the work.
- A **heart** saves a work. After the visit, the visitor can replay their favorites and share them.
- The space sees a dashboard: scans per work, how far people listened, hearts, and action taps.

**Why visitors like it:** no crowding at a tiny wall label, no rented handsets to clean, charge or lose, no app, no fixed route.

---

## 2. Positioning: competitors and where we fit

| | Cost to the space | How visitors start | Scans the work itself? | Notes |
|---|---|---|---|---|
| **Bloomberg Connects** | Free (philanthropy-funded) | App, **or QR → browser (no download)** | No (QR codes and menus) | 13-week cohort onboarding, 3–10 hrs/week. Built for permanent collections. |
| **Smartify** | Free to partners (per co-founder; verify) | **App** | **Yes**: image recognition | The closest match. Lists the Met as a partner. Raised £1.5M in Jan 2025. |
| **Nubart** | Not published | QR/printed card → browser | No | Sells **unique take-home cards**, preloads for offline use. Closest to our card idea. |
| **STQRY** | About $2,295+/yr + setup; about $10k with professional content | App or mobile web | No | What a small museum pays for today. |

**We lose on:** price against two free products; maturity (languages, maps, offline mode, accessibility); trust (one-person company); 3D objects (MindAR tracks flat images only).

**We win on:**
1. **Speed.** Live in an afternoon, not after a 13-week cohort. That suits **temporary shows, galleries with monthly shows, open studios and art fairs**.
2. **Commercial galleries.** Free platforms serve nonprofit institutions. "Inquire about this work" with a lead dashboard is a sales tool. **This may be the best first market.**
3. **No app and no QR code by the work.** Recognition of the work itself, in the browser.
4. **Calls to action and fundraising data.** Membership and donation taps per stop are what a development office cares about.
5. **Gift-shop products nobody else has.** Exhibition postcards, prints or catalog pages that play the curator's audio at home, made with our existing shop.

**Don't pitch the Met as a guide replacement.** They already have Smartify and Bloomberg, and the contact is in development (fundraising). Pitch postcards that play at home plus membership calls to action, and ask for introductions.

---

## 3. Non-negotiables and decisions

- **Brand:** use the repo's existing design system. Same rule as `/nonprofits`: if the repo conflicts with this doc, the repo wins.
- **Same codebase, siloed page.** `/exhibitions` is a landing page like `/nonprofits` (its own header, not linked from home until the user decides).
- **Entrance placard (decided 2026-10-08):** branded, with the exhibition title and a short description, then three ways in: **NFC tap (primary)**, a small QR code, and the short URL. This is an exception to the nonprofits brief's "no QR codes anywhere" rule, and it applies only at the entrance. The promise stays "no QR code beside the work."
- **Lock every NFC tag** (write-protect after encoding). An unlocked tag can be rewritten by anyone with a phone to point at a phishing page. Encode `popcode.app/{slug}?via=nfc`.
- **Audio first.** Video is supported but isn't the default or the demo.
- **No accounts for visitors.** Favorites live on the device (and later on a take-home card, §5 phase 3), with an optional "Email me my favorites."
- **Accessibility is a sales requirement, not polish.** Every stop has a transcript, and there's a way to choose a stop without the camera (blind and low-vision visitors; also the fallback for sculpture).
- **No invented stats or testimonials** on the page, as with `/nonprofits`.

### Demo content: the Met
- **Images:** Met Open Access images of public-domain works are CC0 and fine to use.
- **Audio:** the Met's audio guide recordings are **not** Open Access. Don't use them unless the contact says yes in writing. The default is **the user's own 60–90 s narration**.
- **No Met branding** on anything public. The demo is a private pitch.

---

## 4. Checked against the code (`origin/main`, 2026-10-08)

| Need | What exists |
|---|---|
| Audio stops | Yes. `view.html` `triggerAudio` / `startAudio`. **Upload an audio file** (MP3/M4A/WAV, ≤25 MB) as well as recording, in create and edit (PR #197). **Transcript box** per audio page in create and edit, shown under the player with line breaks (PR #198). |
| Many works in one exhibition | One Popcode = one `.mind` file with N targets (`collection_items.target_index`). **Untested at 30–100 targets** (see §6). |
| Actions after a stop | After the Video, `collections.cover_config.end` (+ `per_target`), admin-only (Edit → *After video* tab), max 3 buttons, UTM-tagged. **Shown after audio too since PR #200 (2026-10-09)**, with "Listen again" in place of "Watch again". |
| Scan / listen analytics | `scan_events` via `api/log-event.js`: `scan_open`, `target_found`, `media_progress` (`progress_pct`), `audio_complete`, `cta_*`. Device ID `pc_device` (localStorage). |
| Entry source | `?via=org` read and kept for the visit (≈`view.html:870`). **Extend for `via=nfc` / `via=qr`.** Check how it's parsed first. |
| Dashboard | Queued in `docs/impact-dashboard-handoff.md`. Its phase 1 events table is `scan_events`. The museum dashboard is that dashboard with per-work rows and hearts. |
| Headphone check | None. |
| Hearts / favorites | None. |
| Replay without scanning | None. Scanning is currently the only way to play. |
| Browse stops (no camera) | None. |
| Offline / preload | None (no service worker). Audio is `preload="metadata"`. |
| Making a Popcode | The `create.html` wizard. Check how it copes with dozens of images. The free tier is 5 Popcodes (counted as photos with media), so museums need a paid/admin plan. |

---

## 5. Phases

### Phase 1: demo (before meeting the Met contact)
1. Pick 6–8 public-domain works from Met Open Access; print them as posters (or show them on a screen).
2. Record the user's own narration per work, with a transcript.
3. Build one Popcode with those targets, audio stops and After the Video buttons (e.g. "Become a member").
4. ~~Show the end screen after audio~~ Done (PR #200).
5. **Headphone check screen** before the camera: a left/right chime, "Hear it?" with Yes / "No headphones? Read along instead" (turns on transcripts). Self-reported; iOS Safari can't detect headphones.
6. A locked NFC tag on a mock entrance placard.

### Phase 2: pilot-ready
- **Hearts.** A heart on the audio player, stored per device (`pc_device`), logged as an event so the dashboard can count it.
- **"My visit" / replay.** A list view of the exhibition (thumbnail, title, play) that works without scanning. It also serves as **browse stops** (accessibility, sculpture). Hearted works sit at the top.
- **"Email me my favorites"**: optional email capture, with the space's consent copy. This is the lead list development wants.
- **Preload at the entrance**: fetch all audio after the tap, while there's still signal (service worker or plain prefetch).
- **Dashboard (museum view):** per work: scans, average listened %, completions, hearts, action taps; entry by `via`. Build on the impact-dashboard brief, don't fork it.
- **Sharing:** a link to a favorite (image + audio) that plays without scanning. **Per-work "shareable" switch**, because loan agreements and in-copyright works may forbid images leaving the building.
- `/exhibitions` landing page. Headline names galleries first (e.g. "Audio tours for galleries and museums").

### Phase 3: take-home card
- A printed card per visitor with a **unique ID** (NFC + printed short code). Tapping it at home opens *your* visit: favorites saved to the card, no account. Giving the card to a friend is the share feature. The museum gives it away or sells it in the shop (Nubart already sells cards this way).
- Exhibition **postcards / prints in the gift shop** that play the stop's audio at home, made with the existing shop.

---

## 6. Risks to test before promising anything

1. **Target count.** Compile time, `.mind` size, load time on cellular and per-frame matching at 30, 60 and 100 targets on a real iPhone. If it degrades, split by gallery room (one Popcode per room, the entrance tap picks the room) or cap exhibitions.
2. **Recognition on real paintings:** glare on glass and varnish, dim galleries, dark old masters, look-alike series. Run `scan-check.js` on the demo images; then test in a real room.
3. **3D works** need the browse list (or an NFC tag on that label only, not on every label, which would bring back the crowding).
4. **Signal** in basement galleries → preload.
5. **Camera permission drop-off** right after the tap. The screen before the prompt should say why: "Point your camera at any painting."
6. **Museum / gallery rules** on raised phones and photography, especially for loan shows.
7. **Content is the real bottleneck.** Small spaces often have no recorded audio. Decide whether we offer script help or a recording session (STQRY quotes $3–8k per tour for content).
8. **Sales cycle.** Museums plan exhibitions 12–24 months out. Galleries and art fairs move in weeks; start there.

---

## 6b. Demo placard (2026-10-09/10)

The user designed a landscape placard: left half has the exhibition title, dates and description; right half has the Bruce wordmark, "For an audio tour of this collection", a concentric-circle tap target, then QR code and URL as fallbacks. Review notes given:
- **Mismatch:** the placard is titled for the *Richter Collection*, but the four audio stops are from the *anonymous promised gift* (Pissarro, Cassatt, Sargent, Hassam). Recommended a neutral demo title (e.g. "From Paris to Cos Cob") with copy written for those four.
- Its "April 2, 2023–Ongoing" date conflicts with a listing that says the Richter installation closed 2025-08-03. Verify.
- `thebruce.org/Richter` doesn't exist. Print the real `popcode.app/{slug}` for the demo; pitch a museum-domain redirect as a later step.
- QR → `?via=qr`, NFC → `?via=nfc`. The viewer doesn't record `via=qr` / `via=nfc` yet (only `via=org`): small change, not built. QR at least 2.5 cm, with a quiet zone.
- Copy: "audio tour" in lower case; add "Headphones recommended"; "Tap your phone here" (Android reads from mid-back, not the top); a contactless icon in the circle.
- **NFC tags:** genuine NXP NTAG213/215, round, 35–38 mm, white PET sticker, from a specialist seller (GoToTags, Shop NFC, Seritag, ZipNFC). Anti-metal only near metal. Write with NFC Tools, then lock. Reads don't wear the tag (passive; ~100k write cycles, at least 10-year retention); a new tag per exhibition.
- Don't publish anything with the Bruce's logo.

## 7. Open questions for the user

- Name: **decided 2026-10-08: "Popcode for Exhibitions"** at `/exhibitions`. "Museums" was rejected because galleries, the likely biggest market, wouldn't see themselves in it. If the gallery and museum pitches diverge (inquire vs membership), add `/galleries` and `/museums` as two versions of the same page. "Docent" is still an option as the name for the visitor feature.
- First pilot: which local gallery or small museum?
- **Bruce Museum (Greenwich) lead:** the user knows the board chair. Two different collections:
  - *William L. Richter Collection* (mostly French: Corot, Pissarro, Renoir, Gauguin, Braque, Picasso, Matisse). Exhibition listed 2023-04-02 to 2025-08-03, so it **may not be up now**.
  - *Anonymous promised gift of 70 works* (press release 2022-04-13), shown in the Richter Art Wing. **Proposed demo set (all public domain, all flat):** Pissarro *The Market of Gisors, Grande-Rue* (1885), Hassam *Rainy Day on the Avenue* (1893), Sargent *Girl Fishing* (1913), Cassatt *Two Little Sisters* (c. 1901–02); backup Pissarro *Haymaking at Éragny* (1891). In copyright (museum-supplied images only, privately): Hopper, Wyeth, Giacometti, Moore, Miró, and treat Picasso *Le Guitariste* and Kandinsky *Rosa Rot* the same. Sculpture (Giacometti, Moore, Nadelman, Frishmuth) needs the browse list. Confirm what's on view, and get images from the museum.
- Pricing: per exhibition vs annual licence (pricing.html already says both).
- Will the Met contact let us use a few real audio stops in the private demo?

Sources for §2: bloombergconnects.org/features, sjmusart.org/connect/bloomberg-connects, tech.eu (Smartify funding, 2025-01-29), leisureopportunities.co.uk (Smartify free to partners), cordis.europa.eu (Nubart), stqry.com FAQ and cost posts. Checked 2026-10-08; recheck prices before quoting them.
