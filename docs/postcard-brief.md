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

**Not folded.** Nothing hidden, the URL on the outside, cheaper to print.

**A back was added 2026-09-14** (mocked, not yet approved). The "one side only"
reasoning above was an argument against a *folded* card and still holds — but it
never addressed blank-back versus printed-back. A one-sided card lands
blank-side-up in the parcel **half the time**, and a blank white rectangle beside
a fine-art print reads as unfinished. See "The back" below.

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

### Export — BUILT 2026-09-14

`public/postcard.html` renders both faces at **300 DPI at bleed size
(1875 × 1275px)** via html2canvas + jsPDF, lazy-loaded from cdnjs, same shape as
`buildBookPrintPdf()` / `buildCalendarPrintPdf()`.

- **`window.buildPostcardAssets(slug)`** is the production entry point —
  `{ front: Blob, back: Blob, widthPx, heightPx, dpi }`. Upload to the
  `experiences` bucket and attach each as its print area's asset, the same shape
  the other single-image products already use. **PNG, not JPEG**: the card is a
  smooth gradient, which is exactly what JPEG bands.
- Toolbar buttons export either face or a two-page proof PDF. They disable
  themselves inside an embedded view (an Artifact, a preview pane), where the
  frame sandbox drops downloads silently — otherwise a click looks like nothing
  happened.
- Faces are captured from a fresh off-screen card at 1:1, never the artboard's
  zoomed one: html2canvas and CSS transforms don't mix.

**Verified against the approved PDF at 300 DPI**: every element within
**0.96pt (0.34mm)**, gradient corners within 1/255, fully opaque, ~0.5s per pair.

`assertFaceRendered()` fails the export loudly if a face comes back transparent
or white. This card is almost entirely one CSS gradient and the repo's other
print paths only ever captured solid fills and images, so gradient support was
the one thing that could quietly turn the artwork into a blank rectangle — which
would pass upload and checkout and only surface as a blank printed card.
(It does render correctly; the guard is for future library changes.)

**Sandbox note:** cdnjs IS reachable from the Claude Code sandbox via curl,
contradicting the 2026-09-02 note. The browser can't use the sandbox proxy, so
to test the export, `page.route` the cdnjs URLs to locally downloaded copies of
the same bundles.

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

## The artwork — SETTLED 2026-09-14

**`PC_ProductPostcard.01.pdf`, 6×4 landscape, is the approved design.** The
earlier white-ground exploration is superseded. `public/postcard.html` now
reproduces it and is the production renderer.

What changed versus the first pass: a **full-bleed brand gradient** instead of
white, white type throughout, the headline **left-aligned over two lines with
the ampersand in cyan**, the wordmark **top-right** as the anchor, and the
Popcode symbol dropped entirely. The copy is set **all bold**, with the line
break authored after the URL so the link never splits.

### Every number is measured, not eyeballed

The PDF is the spec, and the renderer's constants cite it:

- **Trim 6×4in and bleed 0.125in** come from the PDF's own TrimBox/BleedBox —
  so the bleed question in "Also needs bleed" below is answered for the artwork,
  though the SKU's requirement still needs confirming.
- **Type** from the text matrices: CooperBT-Light 56.0701pt on 46pt leading with
  `-0.02 Tc` tracking; FilsonPro Bold 11/14pt centred.
- **The gradient** from the PDF's axial shading function (ShadingType 2) and its
  pattern matrix — five stops, reproduced to within 1/255.

Two things this caught that guessing would not have:

- **"Play" is positioned, not flowed.** The artwork tightens the gap after the
  ampersand by hand. Setting it as a literal space renders ~10pt too wide, so
  each headline run carries its own position, exactly as the PDF draws it.
- **Vertical placement is by baseline.** CSS positions a line box, whose
  relation to the baseline depends on font metrics. The renderer measures that
  offset from the live font instead of hard-coding it, so a font swap or a
  failed webfont load can't silently drift the type a few points.

Verified by rendering at 300 DPI and diffing against the PDF: mean difference
**1.57/255**, with the remainder confined to glyph antialiasing edges.

## The back — mocked 2026-09-14, NOT yet approved

Same gradient ground, wordmark centred, and one sentence:

> **No app to download. Works on any phone.**

**Why that sentence and no other.** People assume AR needs an app, and that
assumption sits between opening the box and actually scanning. It can't go on
the front without breaking the two-step structure the headline is built on, and
the back is the only place it fits. Everything else considered — what Popcode
is, troubleshooting, a repeated URL — is either redundant or undermines the
front.

**No Popcode symbol here, deliberately.** The symbol marks a photo as
scannable, but you scan the *photo*, not the mark (see the 2026-09-02 wording
fix in `order.html`). Showing it unexplained implies otherwise; explaining it
takes a second sentence, which is exactly what this side is not for.

**No QR** — the back is where that temptation lives, and it would contradict the
positioning pillar.

### OPEN: "Works on any phone" may overclaim

Popcode needs a reasonably modern mobile browser with camera access, and the
session notes record real trouble on iPhone XR / iOS 16 (video freezing on first
play, 2026-06-10). Printed on a card in a box, that claim can't be hot-fixed.
The "No app to download" half is both accurate and the valuable half. If the
claim looks too strong, swap the second sentence for **"It opens in your
browser."** — same reassurance, nothing to walk back.

### Settled after the artwork

1. **® , not ™.** Popcode is a registered mark, so the card uses **®**, matching
   `Popcode_logo.png` and therefore the rest of the app. The approved PDF was
   set with ™; that is the one intentional departure from it.

   The swap is not a like-for-like drop-in, because ® and ™ are different
   widths. The wordmark is therefore anchored **left and sized by its
   letterforms**, not by its overall box — matching the box would have nudged
   "popcode" itself sideways to make room for the glyph. Verified: the
   letterforms land within 0.24pt of the artwork on every edge.
2. **Filson Soft vs Filson Pro.** The artwork uses Filson **Soft** Bold; the repo
   only has Filson **Pro**. Confirmed fine to use Pro, which is also what the
   app itself uses. The PDF's embedded Filson Soft is a 25-glyph subset — only
   the characters in that one sentence — so it could not have been reused
   anyway, since the slug changes per order.

### One deliberate difference from the PDF

The PDF's gradient is clipped at x=21.479 while its bleed box starts at 21,
leaving a ~0.5pt white sliver down the left and right edges. The renderer covers
the full bleed. If that sliver reached press it would show as a white hairline
after trimming.

## OPEN decisions

- ~~**Card size**~~ — settled: **6×4 landscape**, matching the approved artwork
  and Prodigi's own `GLOBAL-POST` sizing (which names these landscape-first).
- ~~**One card per order, or one per design?**~~ — settled by the artwork, not
  by preference: the approved card carries exactly ONE URL in 56pt display
  type, so "one card listing them all" would be a different design, not a
  config choice. It is therefore **one card per distinct slug**
  (`companionCardSlugs()`), and two prints of the same popcode share one card.
  Revisit only if someone wants a multi-link card drawn.
- **Per-order noun tailoring** — each design's media type is known from
  `collection_items`, so the card could say "a voice" for an all-audio project
  and "a video" for all-video. Only worth it if the copy grows past one line.

## Catalogue entry — DRAFTED 2026-09-14

In `lib/print/catalog.mjs`, as `COMPANION_CARD` and helpers — **deliberately not
a `PRODUCTS` entry**, so it stays out of `PRODUCT_TYPES`: nobody chooses one,
the server adds it, and a client must not be able to order a bare postcard. It
carries the same fields a variant does, so it flows through
`buildProdigiItems()` unchanged.

- `COMPANION_CARD_FOR` — the six flat/wall types that earn a card.
- `cartNeedsCompanionCard(lines)` / `companionCardSlugs(lines)` — one card per
  distinct slug, deduped; book/calendar/boardbook lines excluded.
- `companionCardAssets({front, back})` — maps rendered faces to the SKU's print
  areas, and throws on a missing one rather than quietly shipping a blank face.

**`COMPANION_CARD.faces` is the single line that changes after SKU
verification.** One print area: leave as is. Two: add the back entry and rename
the front. Verified both shapes produce correct quote and order items with no
code change. `buildPostcardAssets()` renders both faces regardless, so this
stays configuration.

Not yet wired into checkout — that is the next step, and it wants the SKU
confirmed first.

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
