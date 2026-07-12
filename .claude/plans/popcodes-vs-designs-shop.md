# Popcodes vs Designs + product-first Shop — information architecture

Locked with the user 2026-07-12. This restructures the app's core IA.

## The model
Three concepts, distinguished by **intent**:

- **Popcode** — a standalone AR experience: image(s) → video/audio, scannable at
  `popcode.app/{slug}`. **No purchase required.** Use cases: grandma's photo album
  with her narration, museum/gallery exhibits linked to audio guides, a poster you
  print yourself, a business card. This is the CORE of the app. → **My Popcodes**
- **Design** — a physical product bought *from us*: Photo Book, Prints, Photo Tiles,
  Canvas, Calendar. Laid out, optionally with popcoded (scannable) images, then
  ordered. → **My Designs**
- **Shop** — product-first front door: pick what to make → design + popcode → order.

**Overlap is one-way and clean:** a Design's images CAN be Popcodes (so the printed
book/tile is scannable), and from a Popcode you can "order a print of it" (which
creates a Print Design). But the two libraries stay separate by intent — making an
AR link vs buying a product. A museum exhibit never becomes a Design; a book is
always a Design.

## Decisions locked
1. Today's `manage.html` list splits: standalone single/multi-image AR experiences
   (kind=`standard`) → **My Popcodes**; the book(s) → **My Designs**.
2. Ordering a print *of* a pure Popcode → **creates a Print Design** in My Designs
   (it's now a product), not just an order tucked under the Popcode.
3. Naming: **My Popcodes** / **My Designs** / **Shop**.

## Data model
No schema change to start. `collections.kind` is the discriminator:
- Popcodes (My Popcodes): `kind = 'standard'`.
- Designs (My Designs): `kind IN ('book','print','tile','canvas','calendar')`.
Persisting prints/tiles/calendars as re-editable Designs (Phase 3) needs a layout
config column (e.g. a generic `design_config` jsonb, or reuse `book_layout`).

## Phased build (additive — live site keeps working throughout)

**Phase 1 — Split the library + Shop entry (the visible win)**
- `manage.html` → two tabs: **My Popcodes** (kind=standard) and **My Designs**
  (kind is a product). Filter by kind.
- Remove the standalone "Make a Book" button; add a **Shop** entry to the nav.
- New `shop.html` (top-level product grid): **Photo Book first** → `book.html`;
  Prints / Tiles / Canvas route to the order flow (pick a Popcode/photo → order.html).
- Nav labels across the ~11 pages: "My Projects" → "My Popcodes"; add "My Designs"
  + "Shop"; drop "Make a Book". (Terminology change like the old Collections→Projects.)
- No DB migration.

**Phase 2 — Product-first Shop, full**
- Flesh out `shop.html` as the primary create/buy entry. Book builds from scratch;
  Prints/Tiles pick a photo (from a Popcode or a fresh upload) → layout → order.
- Reuse the Popsa-style category grid currently in `order.html`.

**Phase 3 — Make Prints/Tiles/Canvas saveable Designs**
- Persist them as `collections` (kind=`print`/`tile`/…) + layout config, so they
  live in My Designs and can be re-edited + re-ordered (today they're ad-hoc orders).

**Phase 4 — "Order a print of a Popcode" → creates a Print Design** (decision #2).

**Phase 5 — Calendar** (new product/editor; reuses the book page engine).

## Notes / risks
- Multi-session effort; do phases in order so the live site never breaks.
- Terminology change touches ~11 pages (nav drawer on each).
- The book (build-from-scratch) vs prints (order-a-photo) flows differ — that's the
  crux of Phase 2/3.
