# Flat photo cards — provider finding + build plan

## The provider question, settled

**Cards must be FLAT.** US photo-card buyers do not buy folded cards; Shutterfly's
holiday line is overwhelmingly flat 5×7.

**Prodigi cannot do a flat 5×7.** Verified against their published product pages
(2026-09-04):

| Prodigi product | Format | Size | SKU | Fulfilled |
|---|---|---|---|---|
| Classic greetings cards | **folded** | 5×7", A5 | `CLASSIC-GRE-FEDR-7X5-BLA` | UK |
| Fine art greetings cards | **folded** | 4×6, 5×5, 5×7, A4 | `GLOBAL-GRE-*` | UK, EU |
| Classic postcards | flat | 6×4" only | `CLASSIC-POST-GLOS-6X4` | UK |
| Invitations | flat | 5.8×5.8" square only | `CLASSIC-INV-GLOS-6X6` | UK |

So Prodigi's only flats are a 6×4 postcard and a square invite — neither is the
5×7 flat the market wants. Two independent blockers:

1. **No flat 5×7 exists in their catalogue at any paper/finish.**
2. **The whole card range prints in UK/EU.** Prodigi has a US facility (Charlotte
   NC) but the cards range is not produced there. Shipping 50 holiday cards from
   the UK in December is a delivery-risk and duty problem even if the format fit.

→ **Cards go to Printify**, as a second product behind the adapter already built
for the board book (`lib/print/providers/printify.mjs`). Printify has US card
providers, so cards print and ship domestically.

**Still to pin down:** the exact blueprint / print-provider / variant ids, the
print-area pixel spec, and the per-unit base cost. Run:

```bash
PRINTIFY_API_TOKEN=xxx node scripts/probe-printify-cards.mjs
```

Read-only (GETs only, no orders, no charges). It lists card-like blueprints, then
for each prints providers, variants and placeholder sizes. Feed the winner into a
`card` entry in `PRODUCTS` + `PRODUCT_PROVIDER` in `lib/print/catalog.mjs`, and set
`baseCostMinor` from the first `send_to_production:false` test order — same
sequence the board book followed.

## Decorative art: the obvious sources are BLOCKED for us

A card builder is a print-on-demand product configurator, and the two biggest
stock marketplaces specifically prohibit that use. This is the opposite of the
intuitive answer, so it is worth stating plainly:

- **Envato Elements — prohibited.** Items may not be used in "a print-on-demand
  service, a custom product configurator, or any similar build-your-own or
  made-to-order workflow." Separately, its "merchandising / primary value" clause
  bars products where the licensed item is the main reason someone buys.
- **Creative Market (Extended Commercial) — prohibited.** You may not "allow
  anyone other than the Licensee (such as an End User) to customize a digital or
  physical End Product", and may not use an asset in a "print on demand", "made
  to order" or "download on-demand" application. Their allowance is narrow: you
  may sell pre-designed products on demand *only* where "your customer doesn't
  have control over the design."

A subscription to either would feel like the fast path and would be a licence
breach on day one. Enterprise licensing exists at both if we ever want a specific
asset badly enough to negotiate.

### What we may safely use

1. **SIL OFL / Apache fonts** — Google Fonts, Fontshare. The OFL restricts selling
   the *font software*, not products typeset with it, and carries no
   print-on-demand or end-user-customisation carve-out. This is the strongest
   position available and costs nothing. Shipping: Great Vibes (script), Playfair
   Display, Cormorant Garamond, Cinzel, Inter.
2. **Ornament drawn in code** — `drawOrnament()` in card.html generates the
   snow, wreath, frame and confetti as SVG. Zero licence surface, and it
   recolours with the colourway for free. Most of the Shutterfly look is type
   plus simple geometry, so this covers more ground than it sounds.
3. **Public domain / CC0** — Rawpixel public-domain, Smithsonian Open Access,
   NYPL Digital Collections, openclipart. Good for vintage botanical and holiday
   ornament when we want real illustration.
4. **Commissioned work-for-hire** — the durable answer for a real card line.
   Owning the art outright removes the question permanently.

## Colourways

Each template lists the colourways it supports; a zone's `color` is a palette
ROLE (`ink` / `accent` / `onPhoto`), never a hex. One swatch click recolours
ground, type and ornament together, so a family cannot assemble an incoherent
card. Benchmark from Shutterfly's own grid: they run 2–5 swatches per design and
price at **$1.01–$1.44/card**, against our modelled $1.10–$1.72 — we are in the
right zone but slightly high, which the shipping-inclusive markup explains.

## Architecture: three layers, kept apart

Shutterfly's ~40 nav links resolve to a handful of physical cards. We mirror that
in `lib/print/cards.mjs`:

- **FORMAT** — the physical thing. Two: `flat-5x7`, `flat-5.5sq`. Binds to a SKU.
- **TEMPLATE** — a `ground` (`bleed` / `inset` / `collage`), photo slots, text
  zones, an ornament and a colourway list. Pure data; hundreds possible.
- **CATEGORY** — a tag query over templates. `OCCASIONS` entries are named queries.

"Pet Christmas Cards" is `tags ⊇ {christmas, pet}` — one line, no new product and
no new code. Four starter templates already populate eight live categories.

## Type on the front

A template declares **text zones**; the buyer edits only the string, the template
owns the typography. That's what stops 200 designs becoming 200 layout bugs.

- Geometry is **fractional (of the trimmed card)**, so one set of numbers drives
  the editor and the 300 DPI bake. Verified: at 1500px trim width a `size: 0.072`
  headline renders at exactly 151.2px = 0.072 × 2100.
- `TEXT_ROLES` carries `maxChars` **and `maxLines`** (a zone may override with
  `lines`, since display type is single-line by intent). `fitCardText()` runs two
  passes: first shrink to the line budget, then **resolve overlaps
  geometrically** — a single line of 13% display type is taller than the gap a
  template leaves beneath it, so line budgets alone cannot guarantee the
  invariant. Pass 2 shrinks the larger of any overlapping pair until they clear,
  which holds regardless of what a template author wrote or a buyer typed — character limits alone can't prevent overflow
  ("Wishing You a Merry Christmas" is 29 chars but far wider than "2026"), and an
  overflowing greeting colliding with the signature is the one failure mode that
  would otherwise reach print.
- `resolveText()` clamps per role **server-side too**, so a client can't smuggle an
  oversized string into a print render.

## TRIM vs BLEED — the trap

They do not share an aspect ratio. A 5×7 trims at 1500×2100 (0.714) but bleeds at
1575×2175 (0.724). Template geometry is fractions of **trim**; the provider wants
**bleed**. Hand a renderer bleed pixels while it lays out against trim fractions
and every line of type lands slightly wrong. Hence two clearly-named functions,
`cardTrimSize()` and `cardBleedSize()` (the latter also returning the offset and
`bleedFrac`), and `renderCard()` only ever draws trim.

## Pricing

Packs of 25/50/75/100 with a tiered discount (0/10/15/20%) off the marked-up
retail price. `cardPackPrice()` floors the result just above cost, so a tier
discount eats margin and never principal — same posture as the shipping-inclusive
markup. Whole-dollar rounding matches `priceFromQuote` so display and charge agree.

## State

Built and headless-tested (0 page errors): `public/card.html` — category browse,
template picker, inline on-card typing with two-way side-panel sync, auto-fit,
photo slots, video Popcode attach, pack selector, save to My Designs
(`kind:'card'`, reusing `book_layout` jsonb — no migration).

**Not linked from the Shop yet**, deliberately — same posture as the board book:
it stays reachable at `/card.html` until ordering is wired. Pricing shows a
placeholder rather than a number, because the card SKU isn't pinned down.

## Next

1. Run the probe; pin the SKU; add the catalog entry.
2. Print bake: trim render → bleed canvas, plus the card **back** (both candidate
   SKUs are duplex) carrying the `popcode.app/{slug}` panel — cards are the ideal
   home for the back-panel branding already designed for book back covers.
3. Wire quote/checkout through the existing cart, then link from `shop.html`.
4. Grow the template library; every new design lights up more categories for free.
