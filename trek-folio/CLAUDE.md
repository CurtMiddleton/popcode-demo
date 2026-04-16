# Trek Folio — Session Context

## What this app is
Trek Folio is a web app for planning and reliving trips. Users add trips; each trip contains "Plans" (flights, hotels, restaurants, activities, concerts, notes, directions, etc. — 17 types total). Plans with addresses are geocoded and pinned on a per-trip map. The global `/map` shows one pin per trip at the centroid of its plans. A `/photos` gallery holds uploaded trip photos, auto-tagged to the right day via EXIF.

The aesthetic is deliberately editorial (Cormorant Garamond Light display serif, DM Sans body, warm cream + ink palette, small uppercase "micro-labels" as section eyebrows).

## Stack
- **Framework**: Next.js 14.2 (App Router, `src/` layout)
- **Auth / DB / Storage**: Supabase (Postgres + Storage + RLS)
- **Styling**: Tailwind + shadcn/ui (primitives in `src/components/ui/`)
- **Maps**: Google Maps JS API (via `@googlemaps/js-api-loader` v2 — functional API `setOptions` + `importLibrary`, **not** the removed `Loader` class), clustering via `@googlemaps/markerclusterer`
- **Email**: Resend (confirmation emails on plan create), OpenAI (email parsing in the inbox flow)
- **Fonts**: Cormorant Garamond (display), DM Sans (body); DM Sans is `var(--font-dm-sans)`
- **No build step other than Next.js** — run `npm run dev`

## Supabase schema highlights
- `users` — extends `auth.users`, includes `forwarding_alias` for email forwarding
- `trips` — `id, user_id, name, destination, start_date, end_date, cover_image_url`
- `reservations` — one row per plan (all 17 types share this table). Key columns: `type` (enum `reservation_type`), `provider_name`, `confirmation_number`, `start_datetime`, `end_datetime`, `address`, **`lat`**, **`lng`**, **`google_place_id`**, `price`, `notes`, `parsed_data`, `raw_email_body`
- `flights`, `hotels` — type-specific detail rows, FK to reservations
- `photos` — `id, trip_id, user_id, storage_url, caption, taken_at, day_index, reservation_id`
- `trip_shares`, `trip_collaborators` — schema exists, **no UI built yet** (Phase 7)
- `beta_feedback`, `scan_events` — NOT in Trek Folio; those are leftovers from the Popcode repo this was extracted from. Ignore.

Storage bucket: **`trip-photos`** (public). Path pattern: `{user_id}/{trip_id}/{photo_id}.{ext}`. RLS policies in `supabase/migrations/00004_photos_storage_policies.sql`.

## Terminology
- **Plan** — user-facing name for what the DB calls a "reservation." TripIt-style. 17 subtypes, grouped into families in the picker (transport / lodging / food / fun / utility).
- **Trip** — a collection of plans + photos.
- **Day index** — 0-based integer on photos; `day_index = 0` = trip start_date, `1` = +1, etc. Displayed as "Day 1", "Day 2" in the UI.
- **Upcoming / past** — a trip is "upcoming" if `end_date >= today` (or, lacking `end_date`, if `start_date >= today`; no dates → upcoming). Used for pin color on `/map`.

## Design tokens (`globals.css`)
Trip / plan pin colors (hex, used in `src/lib/map-colors.ts`):
- flight: `#0A6E9E` · hotel: `#0E9EC0` · restaurant: `#00B8B0` · bar: `#00A882` · activity: `#1A8C50` · car: `#0D5C30` · note: `#8A7E68`

Structural:
- `--tf-ink: #1A1814` — primary text
- `--tf-muted: #8A7E68` — secondary text  
- `--tf-cream: #FAF6EE` — page background / card fill

Type system classes:
- `.micro-label` — 11px uppercase spaced DM Sans (THE signature eyebrow)
- `.font-display` / `.font-display-italic` / `.font-display-roman` — Cormorant variants
- `.tf-card` / `.tf-card-cream` — base card styles (white vs cream)

## What's been built

1. **Auth** — Supabase email/password via `/login` and `/signup`. Server-side session via `@supabase/ssr`.
2. **Trips CRUD** — create / edit / delete; list at `/trips`; detail at `/trips/[id]`.
3. **Plans CRUD** — 17-tile picker dialog (`plan-picker-dialog.tsx`) → `reservation-form-dialog.tsx` with type-specific sub-forms (flight + hotel fully fleshed; others use the generic form). Enum values added in `00003_expand_plan_types.sql`.
4. **Email confirmation** — `/api/email/reservation-added` sends a Resend email after plan create (non-blocking).
5. **Inbox / email parsing** — `/inbox` page, OpenAI-backed parser at `lib/email-parsing.ts`, dev tester at `/inbox/dev`.
6. **Google Maps (Phase 5)**:
   - `src/lib/google-maps.ts` — single loader helper, uses v2 functional API (`setOptions` + `importLibrary`). Do **not** try to use the removed `Loader` class.
   - `src/lib/map-colors.ts` — hex colors by plan type.
   - Trip detail Map tab (`trip-map.tsx`) — color-coded pins per plan, chronological route polyline, day-filter chips, pin click switches to Itinerary tab + scrolls to `#res-{id}`.
   - Global `/map` (`global-map.tsx`) — one pin per trip at centroid of its geocoded plans; black pin = upcoming, warm-gray pin = past; two-column layout (list panel left + map right); search, sort (upcoming asc, then past most-recent-first), hover-highlight; marker clustering via `@googlemaps/markerclusterer` for overlapping trips.
   - Geocoding on save hook in `reservation-form-dialog.tsx` (fails silently).
   - Backfill script: `node scripts/backfill-geocode.mjs [--apply]` — needs `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local`.
7. **Photos (Phase 6)**:
   - Per-trip Photos tab grouped by day + "Unsorted" bucket.
   - Multi-file upload with HEIC→JPEG conversion (via `heic2any`) and EXIF `DateTimeOriginal` parsing (via `exifr`) to auto-assign `day_index`.
   - Lightbox (`photo-lightbox.tsx`): arrow keys, ESC, mobile swipe, inline caption editor, day re-assign dropdown, delete.
   - Global `/photos` page grouped by trip with the same lightbox.
   - Max 100 photos / trip enforced in `lib/photos.ts`.
8. **Editorial polish** — vertical rotating TREK FOLIO logomark in the sidebar; PageHeader at 42px titles; `.micro-label` bumped 9→11px; trip detail header meta row at 13px `text-tf-ink/70`; map markers ~50% of original size.

## Remaining / not yet built
- **Phase 7 — Share links + collaborators.** Shared albums were explicitly requested ("anyone in the group can add to the album"). Schema (`trip_shares`, `trip_collaborators`) exists; UI + RLS extensions don't. First thing to build when Phase 7 starts: extend `photos` RLS to allow collaborators to insert, then add an invite-by-email flow.
- **Richer trip cards on `/trips`** — next-up flight/hotel preview strip.
- **Domain + Vercel deploy** — IN PROGRESS when this CLAUDE.md was written. Vercel project for Trek Folio, custom domain `trekfol.io`, Resend verified sender for that domain.
- **Profile / settings polish** — profile page exists but is bare.
- **Mobile nav / drawer** — sidebar works but cramped on small screens; revisit.

## Running locally
```bash
cd ~/trek-folio
npm install
npm run dev   # http://localhost:3000
```

Required env vars in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY         # for backfill script + admin ops
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
GOOGLE_MAPS_API_KEY               # same value; used by backfill script
OPENAI_API_KEY                    # email parsing
RESEND_API_KEY
RESEND_FROM                       # e.g. "Trek Folio <hello@trekfol.io>"
RESEND_WEBHOOK_SECRET             # email-in webhook
```

## Deployment
Target: Vercel → `trekfol.io` (user has the domain registered/planned). Once deployed:
- Add the Vercel URL and custom domain to the Google Maps API key referrer restrictions.
- Add to Supabase Auth → URL Configuration (Site URL + Redirect URLs).
- Add DNS for `trekfol.io` (A / CNAME records from Vercel).
- Verify the domain in Resend for sending from `@trekfol.io`.

## Conventions & tips for Claude
- **Never rename DB tables/columns casually** — many were inherited from an earlier Popcode-era schema and the app depends on the names (e.g. the table is called `reservations`; only the UI calls them "Plans").
- **When editing shared design-system pieces** (`globals.css` tokens, `page-header.tsx`, `sidebar.tsx`), remember they propagate everywhere.
- **Server vs client Supabase**: `lib/supabase/server.ts` for server components / actions; `lib/supabase/client.ts` for client components; `lib/supabase/admin.ts` for privileged (service-role) ops.
- **Google Maps SDK** is loaded once, globally, via `loadGoogleMaps()` in `lib/google-maps.ts`. Don't instantiate `Loader` directly — that class was removed in v2.
- **Geocoding / EXIF / HEIC libs are dynamically imported** (`await import(...)`), so they don't bloat the main bundle. Preserve that pattern.
- **Write no unnecessary comments.** This codebase favors terse, well-named identifiers over prose.
- **Session history lives below.** When the user says "save notes", append a dated entry summarizing what was built, any surprises, file:line refs for tricky spots, and what's left. Commit `CLAUDE.md` and push.

## Session history

### 2026-04-16 — Repo extraction (Trek Folio → its own repo)
Trek Folio had been living as `trek-folio/` inside the `popcode-demo` repo. Extracted to a standalone `trek-folio` repo this day. All the phase work listed in "What's been built" above predates this entry; see the commit history (phases 1–6 each have dedicated commits on the branch that was extracted).

Vercel deploy attempted in the same session. Setup included: creating new Google Cloud project, enabling Maps JS / Places / Geocoding APIs, restricting the API key to HTTP referrers for `localhost:3000` (prod URL to be added after Vercel deploys), creating the `trip-photos` Supabase bucket and running the 00004 migration.

Known quirks to remember:
- `@googlemaps/js-api-loader` v2 removed the `Loader` class (the original Phase 5 code used it and had to be fixed mid-session). If future work imports it, use `setOptions` + `importLibrary` instead.
- iOS Safari's `<input type="file" accept="image/*,.heic,.heif">` shows Photo Library, Camera, and Files — camera-roll upload already works without extra code.
- Supabase `type "public.reservation_type" does not exist` error means you're looking at the wrong Supabase project in the dashboard; check the project ref in the URL matches the one in `.env.local`.
