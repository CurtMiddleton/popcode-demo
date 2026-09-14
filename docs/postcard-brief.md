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

## How to build it — decided 2026-09-13

**Build it directly as an HTML artboard at real card dimensions, with the real
brand fonts. Iterate on that. When it's approved, it IS the production
renderer.** One artifact, not two — what you approve is what prints.

**A Claude Design canvas was considered and rejected for this card.** The design
space is small (a headline, one sentence, two marks) and the copy is settled, so
there's little to explore. More importantly the shipping artwork must be
*generated per order* with a different URL each time, so a canvas design could
only ever be a template you then rebuild in code — two artifacts, and a real
chance the code version drifts from the approved one. (Precedent: the book's
back-cover panel was built to a PDF spec and still needed careful `cqw`/`cqh`
work to hold that spec at two book sizes.)

Revisit the canvas only if someone wants several genuinely different looks
compared side by side before committing.

### Fonts — the gotcha that decided the above

- **CooperBT** (the brand display face, used for h1s and the marketing hero) is
  **self-hosted, base64-embedded in `public/assets/fonts.css`** — a licensed
  Bitstream face. It is NOT on Google Fonts. Anything rendering outside this
  repo's pages has to embed that `@font-face` block or it will silently
  substitute and the design will drift.
- **Inter** comes from Google Fonts and is available anywhere.

### Rendering precedent to copy

`buildCalendarPrintPdf()` (`public/calendar.html:1780`) and
`buildBookPrintPdf()` (`public/book.html:2660`) — html2canvas + jsPDF, lazy
loaded from cdnjs, rendering at **300 DPI** (`calendar.html:573`:
`{ wIn, hIn, dpi: 300, PXW, PXH }`). Copy that shape.

Watch the html2canvas 1.4.1 limits documented in the 2026-07-09 session notes:
it mishandles `object-fit` on a **transformed** `<img>`, can't render
`writing-mode: vertical-rl`, and predates CSS `aspect-ratio`. A type-only card
mostly dodges these, but the Popcode symbol must be a **PNG data-URL, not an
SVG** — same reason the badge is rasterised before capture
(`calendar.html:1229`).

**Also needs bleed.** The print PDFs above are trim-size only because Prodigi's
book/calendar templates handle it; confirm what the card SKU wants.

## Prodigi SKUs — pulled 2026-09-14

From Prodigi's public product pages. **None of these are verified against
`GET /v4.0/products/{sku}` yet** — that needs the API key, which lives only in
Vercel. Run `scripts/verify-prodigi-sku.mjs` (added with this work) before
adding anything here to `lib/print/catalog.mjs`.

### Ruled out

- **Greeting cards** — `GLOBAL-GRE` (fine art) and `CLASSIC-GRE-FEDR` (classic)
  are **folded**. The card is settled as one side only, so a folded card is
  three blank faces we'd pay for. It's also the shape most likely to declare
  several print areas.
- **Classic postcards** — `CLASSIC-POST-GLOS` is a *mailing service*: "sent
  direct with no packaging" to a recipient, and the reverse must carry the
  shipping address and postage mark. It never reaches the parcel. Wrong product
  despite the tempting £0.40.

### The right family — fine art postcards, `GLOBAL-POST`

Flat, ships to the customer with the order, "designed for self-sending". From
£1.00. Sizes **4×6" (152×102mm)** and **5×7" (178×127mm)**; note the SKU names
them landscape-first, which matches where the design landed independently.

Stocks: Mohawk fine paper 324gsm recycled (matte), or gloss-laminated 280gsm.

Variants seen on the product page:

| SKU | Size | Stock | Note |
|---|---|---|---|
| `GLOBAL-POST-MOH-6X4-BLA` | 6×4" | Mohawk 324gsm | ships with an envelope |
| `GLOBAL-POST-GLOS-6X4` | 6×4" | gloss 280gsm | |
| `GLOBAL-POST-MOH-7X5` | 7×5" | Mohawk 324gsm | |
| `GLOBAL-POST-GLOS-7X5` | 7×5" | gloss 280gsm | |

**Matte Mohawk is the one to want.** It's the recycled stock, it suits a light
high-contrast serif far better than gloss, and it won't fight the matte fine-art
prints it ships beside.

### Still unanswered — and it's the deciding question

The page says front and back are both customisable, which is exactly the
`MissingRequiredAssets` trap flagged below. Three things need the API:

1. **How many print areas each SKU declares, and whether the back is required.**
   If the back is required we must supply a plain white asset for it — that's a
   renderer change, not just a catalogue entry.
2. **Real bleed and safe-margin figures.** The artboard currently assumes 0.125in
   bleed and a 0.42in safe margin.
3. **Exact attribute names/casing** for stock and finish.

`-BLA` on the 6×4 Mohawk plausibly reads as *blank* (blank reverse, hence the
envelope), which would mean one print area and no white-back asset at all. That
is a guess and must be confirmed, not assumed.

## OPEN decisions

- **Card size** — the artboard says **landscape**, and Prodigi's real sizes are
  6×4" and 7×5". A 4×6 *portrait* is off the table on both counts: Prodigi
  doesn't offer it in this family, and the copy can't fill it (at 4in wide the
  headline caps near 38pt before "Scan & Play" wraps, leaving ~2in of dead
  space). 6×4 composes well at 46pt; 7×5 is worth seeing before committing.
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
