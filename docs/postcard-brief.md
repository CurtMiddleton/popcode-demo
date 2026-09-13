# Companion postcard — build brief

**Status: nothing built.** Decisions below are settled unless marked OPEN.
Written 2026-09-13 so a fresh session can start from here.

## What it is

A printed card inserted into orders, carrying a one-line explanation of Popcode
and the **unique `popcode.app/{slug}` URL** for what the customer bought.

## Why a vendor "branded insert" can't do this

Printify and Prodigi both sell branded inserts, but an insert is a *static* file
uploaded once to your vendor account — the same sheet in every parcel. Our URL
changes per order, so it physically can't be one.

**The card must be a printed line item with artwork generated per order.** That
isn't a vendor feature question, it's ours to build.

## Scope — the flat and wall pieces only

`print`, `framed`, `framedcanvas`, `canvas`, `acrylic`, `tile`.

The photo book, calendar and board book already print the URL and instructions
on their back cover (built 2026-09-02), so a card in those parcels is redundant.
These six have no printable back, and a URL on the face would wreck the art.

## Mechanism

A **Prodigi greeting-card SKU as a second line item on the same order.**

Two things make this much easier than when it was first proposed:

- `api/create-checkout.js:65` now takes an `items` array (the cart, shipped
  2026-09-03), so adding a second line is natural rather than a rewrite.
- Artwork generation reuses the badge-composite / print-PDF machinery: render →
  upload to the `experiences` bucket → attach as that item's asset.

**Verify the SKU with `GET /v4.0/products/{sku}` before adding it to
`lib/print/catalog.mjs`.** Guessed SKUs return `SkuNotFound`; this repo has been
bitten by that more than once.

## The card — settled

**One side only.** Nothing hidden, the URL always faces up in the box, cheaper
to print.

> ## Scan & Play
>
> Go to **popcode.app/{slug}** on your phone and hit **Scan image**.
>
> *Popcode wordmark · Popcode symbol*

Two steps, one sentence. That's the whole card.

### Why the copy is what it is — four constraints, each learned the hard way

- **It must work for audio or video.** Not "there's a video inside" — plenty of
  Popcodes are a voice memo. "Play" covers both.
- **It must work for a gift AND a self-purchase.** No "someone made this for
  you" — people buy these for themselves.
- **"Scan" is the right verb.** An earlier draft said "point your camera at the
  photo", which describes a flow the product doesn't have — there's a tap first.
- **Step two must match the button exactly.** It is **"Scan image"** (renamed
  and shipped 2026-09-13). Any older draft saying "Tap to Scan" or "Tap Scan" is
  stale.

### What was cut, and why it matters

An earlier version ended with *"Hold your phone over the photo."* That describes
a book flat on a table. **A framed print is on a wall** — you point a phone at
it, you don't hold a phone over it. The step was also redundant: once the
scanner is open, aiming it at the thing is self-evident. Don't reintroduce it.

**No QR code anywhere.** Anti-QR is a positioning pillar — the photo is the
trigger.

### Headline — chosen after iterating

**"Scan & Play"**. The ampersand joins the two into one gesture, which is what
it actually is; full stops ("Scan. Play.") read as two separate commands.

Runners-up, if it ever needs revisiting: *Scan it to life* (echoes "Brought to
life." on popcodeapp.com), *Scan this. It plays.*, *Scan me.*

Rejected: **"Scan. Play. Wow."** — the first two beats are things we control,
the third is a promise the card makes on the product's behalf. If a first scan
is slow or misses, "Wow" reads as sarcasm.

## OPEN decisions

- **Card size** — 4×6 postcard, or something smaller that tucks into a frame box.
- **One card per order, or one per design?** The cart means one order can hold
  several designs with different URLs. Leaning: one card listing them all —
  cheaper, and it reads as a welcome note rather than a receipt.
- **Per-order noun tailoring** — each design's media type is known from
  `collection_items`, so the card could say "a voice" for an all-audio project
  and "a video" for all-video. Only worth it if the copy grows past one line.

## Design precedent

The photo book's back-cover panel (`public/book.html`) is the approved visual
language: Popcode wordmark at 1.25" wide, instruction lines at 8pt Inter
semibold / 16pt leading, then the Popcode symbol.

Assets already in the repo:
- `public/assets/popcode-symbol.png` — black disc, white pinwheel
- `public/assets/popcode-symbol.rev.png` — reversed, for dark grounds

Note the **Popcode symbol is a distinct mark** from `popcode_icon.svg` (the
dots). Don't substitute one for the other.

## Gotcha for whoever builds it

If the chosen card SKU declares **two** print areas, supplying only a front
asset will fail with `MissingRequiredAssets` — the same error this repo hit on
the original Prodigi integration. "One-sided" may still mean supplying a plain
white asset for the back. Check the SKU's print areas first.
