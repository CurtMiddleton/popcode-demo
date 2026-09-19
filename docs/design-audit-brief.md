# Design audit — brief

Written 2026-09-19, from a measured pass over 20 pages. The goal is that the
site reads as one professionally executed product rather than nineteen pages
that each grew their own styling.

Two halves:

1. **Consistency** — buttons, type, cards, colour. Measurable, and measured
   below. This is mostly mechanical once a decision is made.
2. **Noise** — screens where the functionality is heavier than it needs to be.
   Judgement, and it needs real data on screen (see *Blind spot*).

---

## How this was measured

A headless pass (`playwright-core`, chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `cd public && python3 -m
http.server 8188`) loads every page at **1440** and **402** with a stubbed
`window.supabase` that reports a signed-in admin, then dumps the *computed*
style of every visible button, heading and card: height, radius, font family,
size, weight, border width, shadow. Scripts are in the scratchpad
(`audit.mjs`, `density.mjs`, `btn.mjs`) — rewrite them rather than hunting for
them; they are twenty lines each.

Measure computed style, not the stylesheet. Most of the findings below are
invisible in the CSS because they come from a rule in another file, a
breakpoint, or a declaration that was never written at all.

**Blind spot, important:** the stub returns *empty data*, so any page whose
body is a list renders nearly bare — Manage shows no project cards, Cart no
lines, Shop no products, Views no history. Every count below is of page
chrome only. The noise question in particular cannot be answered from these
numbers; it needs a richer stub or screenshots from a real signed-in session.

---

## What the pass found

203 visible buttons, 130 headings, 40 cards, across 20 pages.

### 1. There is no shared button. This is the big one.

| | |
|---|---|
| distinct heights | **21** (16px → 70px) |
| distinct radii | **9** — `0 · 12 · 14 · 16 · 20 · 24 · 30 · 50% · 999px` |
| font sizes | 13 · 14 · 15 · 16 · 18 |
| weights | 400 · 500 · 600 · 700 |
| families | Inter **and Arial** (see 2) |

Six pages mix three or more radii within a single screen:
`analytics` (0/20/50%), `boardbook` · `book` · `calendar` (14/16/50%),
`create` (12/30/50%), `order` (0/14/16/50%).

**The mismatched pair on the homepage** that prompted this: `.btn-ghost`
carries `border: 1px` and `.btn-dark` carries none, so the two hero buttons
differ by exactly 2px — 39 vs 41 on a phone, 44 vs 46 on desktop. The same
pair is on `pricing.html`. The fix is `box-sizing` aware: give every variant
the same border width (transparent where it isn't wanted), never add height
with a border.

Other bordered buttons, for the same reason: `.range-btn` (analytics),
`.size-chip` (order), `.bi-size` / `.bi-year` (book, boardbook, calendar, 2px),
`.delete-btn` (account).

**Shadows** are on four things only — `.cbtn` (index carousel), `.btn`
(order-success), `.active` (order). Plus the gradient Shop pill on Manage
cards, which the stub could not render but is visible in the product. Decide
whether buttons cast shadows at all; today it reads as an accident.

### 2. Nineteen pages have buttons in Arial

`.hicon.hamburger` and `.hicon.profile-btn` — built by `nav.js` — never get a
`font-family`, so they fall back to the browser default: **Arial 13.33px**, on
every page that loads the nav. Same for `.remove-page-btn` (create),
`.cbtn` (index), and 14 unnamed buttons on index.

Cheap to fix, and it is the kind of thing that reads as sloppy without anyone
being able to name why.

### 3. The heading scale is ad hoc

`h1` renders at **11 different sizes**: 100 · 90 · 66 · 54 · 44 · 42 · 36 · 34
· 31 · 23 · 22.

- 44 is the de-facto app default (12 pages)
- 42 on account · analytics · privacy · terms
- 36 pricing, 31 order-success, **22 reset**
- 100 index / 90 shop are the marketing heroes and are deliberate

`h2` has five sizes. **Two `h1`s and six `h3`s render in Inter** where every
other heading is CooperBT.

A three-step scale — marketing hero, page title, section title — would cover
every one of these.

### 4. Cards

Six radii: 16 · 20 · 22 · 24 · 28 — and a stray **3px on calendar.html**.
Six distinct shadow values. No obvious system.

### 5. One page is the wrong colour

`order-success.html` has `background: #fafafb`; every other page is
`#f9f9f9`. A leftover from the 2026-09-18 "off the sand" pass.

---

## Suggested order of work

Consistency first — it is mechanical, low-risk, and makes the noise problems
easier to see.

1. **A button system.** One base (`.btn`) with size (`sm` / `md` / `lg`) and
   intent (`primary` / `secondary` / `quiet` / `danger`) variants, one radius
   rule (pill for text, circle for icon-only), one height per size, borders
   that never change height. Then convert page by page. This single change
   resolves the heights, the radii, the borders and the shadows at once.
2. **Give `nav.js` its font.** One declaration, nineteen pages.
3. **A type scale.** Three heading steps plus body and caption; fix the
   stragglers rendering in Inter.
4. **Card radius and shadow tokens.** Two radii (card, inner) and two
   elevations.
5. **`order-success` background.**

Everything above belongs in one shared place. The repo's idiom is inline
duplication per page (deliberately — see the `composite.js` note in the
2026-07-17 session entry), so the honest options are a single small
`public/ui.css` that every page links, or a documented token block pasted per
page. **Decide this before starting**; converting twice is the expensive
outcome.

---

## The noise question — candidates, not conclusions

These need real screenshots before anyone changes them. Named from reading the
code and from what the product does, in rough order of suspicion:

- **`manage.html` card actions.** Six icon buttons per card — view, edit,
  share, download, Shop, delete — all the same visual weight, plus a gradient
  Shop pill that is the only coloured thing on the screen. With a dozen
  projects that is 70+ controls of equal emphasis. The obvious shape is one or
  two primary actions and the rest behind a `⋯` menu; the design cards on the
  same page already use that pattern, so the page disagrees with itself.
- **`order.html`.** 15 controls above the fold before any data loads: product,
  size, frame colour, mount, orientation, scale, photo, shipping. A staged
  flow exists (`detail → photo → review`) but the detail step carries
  everything at once.
- **`analytics.html`.** Seven tabs, a date-range bar, a search field and
  chunk-size pills. Admin-only, so it is the lowest-value fix — but the tab
  merges already agreed in the 2026-09-09 notes (People, Business) are still
  open.
- **The three builders** (`book`, `boardbook`, `calendar`). Floating dock,
  per-page tool buttons, per-slot menus, sheets. These are the product's
  deepest screens and the most likely to be genuinely too busy — but also the
  riskiest to simplify, so they should go last and only with the user watching
  on a real device.
- **`edit.html`.** Media tiles plus the admin white-label section, which is
  hidden for everyone else but still shapes the layout.

---

## What not to do

- Don't restyle by eye. Re-run the measurement pass after each change; the
  numbers above are the regression test.
- Don't touch `view.html` / `scan.html` chrome without care. The scan screen's
  iOS media-session handling is load-bearing and has cost several sessions;
  visual changes there are fine, structural ones are not.
- Don't change the brand gradient. `linear-gradient(160deg,#5bc8f5,#7c3aed)`
  is also the badge printed on physical products already in people's hands.
- Don't convert every page at once. One page, re-measure, then the rest.
