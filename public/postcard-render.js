/* ══════════════════════════════════════════════════════════════════════
   COMPANION POSTCARD — shared renderer.

   The card's design AND its print export, in one place. postcard.html is the
   artboard that displays it; the checkout flow calls buildAssets() to generate
   the per-order artwork. Both go through this file so the approved design and
   the printed one cannot drift — which is the whole premise in
   docs/postcard-brief.md ("one artifact, not two").

   This is a deliberate departure from the repo's inline-duplication idiom (see
   the 2026-09-02 note). That idiom is right for a 30-line helper; it is wrong
   for 200 lines of print geometry measured to a quarter of a point, where a
   silent divergence between the preview and the press file is the exact failure
   being designed against.

   Everything inside the card is in absolute print units (in / pt), so what
   renders on screen is what goes to press.

   Usage:
     <script src="/postcard-render.js"></script>
     const { front, back } = await PopcodePostcard.buildAssets('my972d7m');
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CSS = `
  /* FilsonPro — the rest-of-app sans. Same declaration the app pages use. */
  @font-face {
    font-family: 'FilsonPro';
    src: url('/assets/fonts/FilsonProBold/font.woff2') format('woff2'),
         url('/assets/fonts/FilsonProBold/font.woff') format('woff');
    font-weight: 700;
    font-style: normal;
  }
/* ── The card ──────────────────────────────────────────────────── */
  .pc-card {
    position: relative;
    box-sizing: border-box;
    width:  calc(var(--w) + var(--bleed) * 2);
    height: calc(var(--h) + var(--bleed) * 2);
    overflow: hidden;
    /* The full-bleed gradient. Unlike a white card, this MUST run into the
       bleed — any shortfall shows as a white sliver after trimming. The
       element is the bleed box, so the gradient covers it by construction. */
    background: var(--art-ground);
  }
  .pc-shadow { box-shadow: 0 10px 34px rgba(0,0,0,.18), 0 2px 6px rgba(0,0,0,.1); }

  /* The cut line. Children position from ITS edges, matching the print spec. */
  .pc-trim { position: absolute; inset: var(--bleed); }

  /* Headline — CooperBT Light, two lines, ampersand in cyan. */
  .pc-head { margin: 0; }
  .pc-run {
    position: absolute;
    margin: 0;
    font-family: 'CooperBT', Georgia, 'Times New Roman', serif;
    font-weight: 300;                /* the only weight in fonts.css */
    font-size: var(--head-size);
    line-height: 1;
    color: #fff;
    white-space: nowrap;
    letter-spacing: -0.02em;         /* PDF: -0.02 Tc on "Scan" and "Play" */
  }
  .pc-run.pc-amp { color: var(--cyan); letter-spacing: 0; }   /* PDF: 0 Tc on "&" */

  /* The sentence — FilsonPro Bold, centred on the trim, break authored after
     the URL so the link is never split across lines. */
  .pc-copy {
    position: absolute;
    /* Inset to the safe area, not the trim: centred on the card either way, but
       a line too long to fit now wraps inside the safe area instead of running
       out into Prodigi's 4mm border. fitCopy() shrinks it first, so wrapping is
       the backstop rather than the mechanism. */
    left: var(--margin); right: var(--margin);
    top: var(--copy-top);
    margin: 0;
    font-family: 'FilsonPro', 'Inter', system-ui, sans-serif;
    font-weight: 700;
    font-size: var(--copy-size);
    line-height: var(--copy-lead);
    color: #fff;
    text-align: center;
  }

  /* Popcode wordmark, reversed. */
  .pc-mark {
    position: absolute;
    left: var(--mark-left);
    top:  var(--mark-top);
    width: var(--mark-w);
    height: auto;
    display: block;
  }
/* ── Guides (screen only) ──────────────────────────────────────── */
  .pc-guides { position: absolute; inset: 0; pointer-events: none; }
  .pc-guides::before { content: ''; position: absolute; inset: var(--bleed); outline: 1px solid rgba(255,90,90,.85); }
  .pc-guides::after  { content: ''; position: absolute; inset: calc(var(--bleed) + var(--margin)); outline: 1px dashed rgba(255,255,255,.55); }
  .pc-back .pc-guides::after { outline-color: rgba(70,110,200,.5); }   /* white ground */
  .pc-card.no-guides .pc-guides { display: none; }
`;

  let cssInjected = false;
  function injectCss() {
    if (cssInjected) return;
    cssInjected = true;
    const el = document.createElement('style');
    el.id = 'popcode-postcard-css';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  const CARD = {
    /* The card READS LANDSCAPE, 148 x 105mm — the approved artwork, unchanged.

       The FILE Prodigi wants is A6 portrait. Its own spec line on the insert:
       "Single-sided A6 (4.1x5.8"), 260gsm postcard with a smooth finish.
       Includes a 4mm white border." 4.1 x 5.8in is 105 x 148mm. So the artwork
       is composed here at its reading size and ROTATED on export — see
       buildPostcardInsert(). A card is a rectangle with no inherent up, so a
       landscape-reading postcard is an ordinary object; what matters is that the
       file matches the stock, which rotation achieves without touching a design
       that was signed off.

       An earlier version supplied a 1748 x 1240 landscape FILE and flagged the
       orientation as unconfirmed. That was the actual bug: right composition,
       wrong file shape.

       Re-composing for portrait was tried and rejected: at 105mm wide the
       sentence has only 89mm of safe width, and a 30-character slug (slug.js
       MAX) runs past it — a problem the approved layout does not have, and one
       created purely by turning the design rather than the file.

       Pre-cut stock, so there is no bleed to supply, and Prodigi adds the 4mm
       border itself — marginIn keeps content well clear of it.

       This replaces a GLOBAL-POST line item, which turned out to be fulfilled
       in a different country — a second transatlantic parcel that never
       travelled with the print. See docs/postcard-brief.md. */
    wIn: 148 / 25.4,    // 5.8268in — the reading width
    hIn: 105 / 25.4,    // 4.1339in
    bleedIn: 0,         // pre-cut stock; the file edge is the card edge
    marginIn: 8 / 25.4, // 8mm — double Prodigi's stated 4mm border, for comfort

    // Headline: CooperBT-Light, two authored lines, 46pt leading on 56.07pt.
    // PDF: "Scan " span at x=61.7 (= trim + 31.7pt), em-box top y=49.4.
    headSizePt: 56.0701,  // unchanged from the approved artwork
    headLeadPt: 46,
    // Each headline run carries its own text matrix in the artwork, so each is
    // placed here the same way — left edge + baseline, both from the trim edge.
    // "Play" is positioned, NOT flowed after a space: the artwork tightens that
    // gap by hand, and a literal space glyph renders it ~10pt too wide.
    headRuns: [
      { key: 'scan', leftIn: 11.18 / 25.4, baseIn: 27.43 / 25.4 },
      { key: 'amp',  leftIn: 11.18 / 25.4, baseIn: 43.65 / 25.4 },
      { key: 'play', leftIn: 11.18 / 25.4 + 0.69618, baseIn: 43.65 / 25.4 },
    ],

    // Sentence: Bold 11pt / 14pt, centred on the trim.
    // PDF: line 1 em-box top y=212.8 (= trim + 182.8pt), centred on x=246.
    copySizePt: 11,
    copyLeadPt: 14,
    copyBaseIn: 70.35 / 25.4,   // 68.34mm in the artwork, scaled for the taller card
    // A slug is creator-chosen and may be up to 30 characters (slug.js MAX).
    // Ordinary ones sit well inside the 132mm safe width at the approved 11pt,
    // but a long slug of wide letterforms does not, and this asset is generated
    // per order with nobody looking at it — so overflow has to be impossible,
    // not merely unlikely. fitCopy() steps the size down ONLY when a line would
    // breach the safe area, leaving the approved 11pt untouched in every
    // ordinary case.
    copyMinPt: 8,

    // Wordmark, reversed. PDF ink box 100.3 × 26.5pt, left edge 297.6pt from the
    // trim's left edge, top 29.4pt below it.
    //
    // Anchored LEFT, not right, and sized by its LETTERFORMS rather than its
    // overall box: the artwork was set with a ™ but Popcode is registered, and ®
    // is a different width. Matching the whole box would have shifted "popcode"
    // itself to accommodate the glyph swap. The letterforms occupy 84.81% of this
    // asset's width, so 1.17226in of letterform (the artwork's) needs 1.38222in
    // of image. Both assets are cropped tight to the letterforms top and left, so
    // left/top carry over from the artwork unchanged.
    markWIn:    35.11 / 25.4,            // as the artwork sets it
    markLeftIn: 101 / 25.4,              // keeps the artwork's ~11.9mm right margin
    markTopIn:  11.37 / 25.4,

    /* BACK — blank white. Decided 2026-09-14 after seeing it printed as a second
       branded side: one side only is cheaper and keeps the card's single message
       undiluted.

       It is still RENDERED, deliberately. If the chosen SKU declares the back as
       a REQUIRED print area, a front-only order fails with MissingRequiredAssets,
       and the fix is to supply a plain white asset — this one. When the back is
       optional we send nothing at all, so no white ink is laid down; that is
       governed by COMPANION_CARD.faces in lib/print/catalog.mjs. */
    backGround: '#ffffff',

    cyan: '#00aeef',    // the ampersand — sampled from the PDF text span

    /* Background: axial shading (ShadingType 2) lifted from the PDF.
       `from`/`to` are the shading axis endpoints as fractions of the BLEED
       box, derived from the pattern matrix
         [411.7653617 301.660968 301.660968 -411.7653617 39.4944546 22.6903832]
       applied to Coords [0 0 1 0]. `stops` are the stitching function's four
       FunctionType-2 segments at Bounds [.2 .4 .5]. */
    gradient: {
      from: { x: 0.0401, y: 0.9945 },   // near bottom-left
      to:   { x: 0.9571, y: 0.0087 },   // near top-right
      stops: [
        [0.0, '#6e57a5'],
        [0.2, '#6d60ab'],
        [0.4, '#6b79bb'],
        [0.5, '#6a86c4'],
        [1.0, '#41bfee'],
      ],
    },
  };

  /* Vertical placement is by BASELINE, because that is what the artwork actually
     specifies (a PDF text matrix positions the baseline) and it is the only
     anchor that survives a change of typeface. A browser instead positions the
     line BOX, whose relationship to the baseline depends on the font's ascent and
     descent — so setBaselines() measures that offset from the live font and
     corrects for it. Getting this wrong is a silent, plausible-looking drift of a
     few points, which is exactly the kind of error that reaches press. */

  /* Copy — settled in docs/postcard-brief.md, set as drawn in the approved
     artwork: all bold white, with the line break authored after the URL so the
     link never splits. */
  const COPY = {
    head: { scan: 'Scan', amp: '&', play: 'Play' },
    // With a slug the card names the project's own link. Without one it is the
    // GENERIC card for Prodigi's dashboard insert set — the account-level
    // fallback, which has no order to name — so it points at the homepage's
    // "Have a code? Enter it here." field instead of a Scan button that only
    // exists on a project page.
    line: (slug) => (slug
      ? [`Go to popcode.app/${slug}`, 'on your phone and hit Scan image.']
      : ['Go to popcode.app', 'on your phone and enter your code.']),

  };

  /**
   * Express the PDF's axial shading as a CSS linear-gradient for a given box.
   *
   * CSS gradients are box-relative: the gradient line runs through the centre at
   * the given angle, its length set so the gradient covers the corners. The PDF
   * instead names two absolute points. So we convert the angle, then project the
   * PDF's endpoints onto the CSS gradient line to get the stop offsets — which is
   * why the first and last stops land near 3% and 97% rather than 0 and 100%.
   *
   * Doing this in code rather than pasting fixed percentages keeps the gradient
   * correct if the bleed (and so the box) changes after SKU verification.
   *
   * @param {number} wIn box width in inches (the bleed box)
   * @param {number} hIn box height in inches
   * @returns {string} a CSS linear-gradient() value
   */
  function artGradient(wIn, hIn) {
    const g = CARD.gradient;
    const W = wIn, H = hIn;
    // Endpoints in inches, y measured downward from the top-left of the box.
    const x0 = g.from.x * W, y0 = g.from.y * H;
    const x1 = g.to.x   * W, y1 = g.to.y   * H;
    const dx = x1 - x0, dy = y1 - y0;

    // CSS angles run clockwise from "to top", where up is -y on screen.
    const angle = Math.atan2(dx, -dy) * 180 / Math.PI;

    // The CSS gradient line: through the box centre, length covering the corners.
    const rad = angle * Math.PI / 180;
    const ux = Math.sin(rad), uy = -Math.cos(rad);
    const L = Math.abs(W * ux) + Math.abs(H * uy);
    const cx = W / 2, cy = H / 2;

    // Where each PDF endpoint falls along that line, as a fraction of it.
    const proj = (x, y) => (((x - cx) * ux + (y - cy) * uy) + L / 2) / L;
    const p0 = proj(x0, y0), p1 = proj(x1, y1);

    const stops = g.stops
      .map(([t, hex]) => `${hex} ${((p0 + (p1 - p0) * t) * 100).toFixed(2)}%`)
      .join(', ');
    return `linear-gradient(${angle.toFixed(2)}deg, ${stops})`;
  }

  /**
   * Build one card face at real print dimensions.
   * @param {object} o
   * @param {string} o.slug      the per-order slug — the whole reason this card exists
   * @param {boolean} [o.guides] draw trim/safe guides (screen only, never for print)
   */
  function buildPostcard(o) {
    const wIn = CARD.wIn, hIn = CARD.hIn;
    const bleedW = wIn + CARD.bleedIn * 2, bleedH = hIn + CARD.bleedIn * 2;

    const el = document.createElement('div');
    el.className = 'pc-card' + (o.guides ? '' : ' no-guides');
    el.style.cssText = [
      `--w:${wIn}in`, `--h:${hIn}in`,
      `--bleed:${CARD.bleedIn}in`, `--margin:${CARD.marginIn}in`,
      `--art-ground:${artGradient(bleedW, bleedH)}`,
      `--cyan:${CARD.cyan}`,
      `--head-size:${CARD.headSizePt}pt`,
      `--copy-size:${CARD.copySizePt}pt`, `--copy-lead:${CARD.copyLeadPt}pt`,
      `--copy-top:${(CARD.copyBaseIn - CARD.copySizePt * 0.72 / 72).toFixed(4)}in`,
      `--mark-w:${CARD.markWIn}in`,
      `--mark-left:${CARD.markLeftIn}in`, `--mark-top:${CARD.markTopIn}in`,
    ].join(';');

    const trim = document.createElement('div');
    trim.className = 'pc-trim';

    {
      const [l1, l2] = COPY.line(o.slug);
      const runs = CARD.headRuns.map((r) =>
        `<span class="pc-run pc-${r.key}" data-run="${r.key}"`
        + ` style="left:${r.leftIn}in;top:${(r.baseIn - CARD.headSizePt * 0.72 / 72).toFixed(4)}in"`
        + `>${COPY.head[r.key]}</span>`).join('');
      trim.innerHTML = `
        <h1 class="pc-head">${runs}</h1>
        <p class="pc-copy">${escapeHtml(l1)}<br>${escapeHtml(l2)}</p>
        <img class="pc-mark" src="/assets/Popcode_wordmark.rev.png" alt="Popcode">
      `;
    }
    el.appendChild(trim);

    const guides = document.createElement('div');
    guides.className = 'pc-guides';
    el.appendChild(guides);
    return el;
  }

  /**
   * Shrink the sentence, and only if it would otherwise run past the safe area.
   *
   * The URL line carries a creator-chosen slug of up to 30 characters
   * (slug.js MAX). At the approved 11pt that is ~104mm of type on a card whose
   * safe width is 89mm — it would print into the border, or off the card. This
   * is a per-order asset generated without anyone looking at it, so overflow has
   * to be impossible rather than unlikely.
   *
   * Called from setBaselines() rather than left to each caller, because the
   * artboard and the print path both go through that and a fit applied to only
   * one of them is exactly the preview/press drift this file exists to prevent.
   */
  function fitCopy(card) {
    const p = card.querySelector('.pc-copy');
    if (!p) return;
    const safePx = (CARD.wIn - CARD.marginIn * 2) * 96;
    const widest = () => {
      const rng = document.createRange();
      rng.selectNodeContents(p);
      return Array.from(rng.getClientRects()).reduce((m, r) => Math.max(m, r.width), 0);
    };
    // A transformed card (the artboard zooms) reports scaled rects, so compare
    // in the card's own units.
    const scale = card.getBoundingClientRect().width / card.offsetWidth || 1;
    let pt = CARD.copySizePt;
    while (pt > CARD.copyMinPt && widest() / scale > safePx) {
      pt = Math.max(CARD.copyMinPt, pt - 0.25);
      p.style.fontSize = pt + 'pt';
    }
  }

  /**
   * Put each text block's FIRST BASELINE exactly where the artwork specifies.
   *
   * CSS positions a line box, not a baseline. The distance between the two
   * depends on the font's ascent/descent and the leading, so it can't be
   * hard-coded without silently drifting when the face or its metrics change
   * (including the case where the webfont hasn't loaded and a fallback is in
   * use). Measure it instead: a zero-size inline-block sits ON the baseline, so
   * its bottom edge less the block's top edge IS the offset.
   *
   * Call after document.fonts.ready — measuring against a fallback bakes in the
   * wrong correction.
   */
  function setBaselines(card) {
    // Approximate fallbacks are already inline (baseline less ~0.72em cap height);
    // these measured values replace them.
    const place = (sel, baselineIn) => {
      const el = card.querySelector(sel);
      if (!el) return;
      const probe = document.createElement('span');
      probe.style.cssText = 'display:inline-block;width:0;height:0;overflow:hidden';
      el.insertBefore(probe, el.firstChild);
      const top = el.getBoundingClientRect().top;
      const scale = card.getBoundingClientRect().width / card.offsetWidth || 1;
      const offsetIn = (probe.getBoundingClientRect().bottom - top) / scale / 96;
      probe.remove();
      el.style.top = (baselineIn - offsetIn) + 'in';
    };
    // Fit before placing: shrinking the copy changes where its baseline sits.
    fitCopy(card);

    // Baselines are stated from the TRIM edge; .pc-trim is that box.
    CARD.headRuns.forEach((r) => place(`.pc-${r.key}`, r.baseIn));
    place('.pc-copy', CARD.copyBaseIn);
  }

  /** The slug is order data, so it is escaped even though slugs are constrained. */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }


  /* ════════════════════════════════════════════════════════════════════
     PRINT EXPORT

     Each face is rendered at 300 DPI at BLEED size and handed to Prodigi as
     that print area's asset. Same html2canvas + jsPDF approach as
     buildBookPrintPdf() / buildCalendarPrintPdf(), lazy-loaded from cdnjs.

     Faces are captured from a fresh off-screen card at 1:1, never from the
     artboard's zoomed one — html2canvas and CSS transforms don't mix.
     ════════════════════════════════════════════════════════════════════ */
  const PRINT = {
    dpi: 300,
    /* The insert is a single printed face on pre-cut A6 stock.

       A branded insert is printed on one side of pre-cut stock, so there is no
       sheet to compose and no back to supply. */
    // One face, at the size Prodigi's insert postcard expects.
    insertPx: { w: 1240, h: 1748 },   // 105 x 148mm (A6 portrait) at 300 DPI
  };
  const FACES = ['front'];   // an insert is printed on one side

  function loadPrintLibs() {
    if (window._pcPrintLibs) return window._pcPrintLibs;
    const load = (src) => new Promise((res, rej) => {
      const el = document.createElement('script');
      el.src = src; el.onload = res;
      el.onerror = () => rej(new Error('Could not load ' + src));
      document.head.appendChild(el);
    });
    window._pcPrintLibs = Promise.all([
      load('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
      load('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
    ]);
    return window._pcPrintLibs;
  }

  /**
   * Fail loudly if a face didn't render as intended.
   *
   * The front is almost entirely one CSS gradient, and this repo's other print
   * paths only ever captured solid fills and images — so gradient support is the
   * one thing that could silently turn the artwork into a transparent or white
   * rectangle. Such an asset would pass upload and checkout and surface only as a
   * blank printed card, which is unrecoverable.
   *
   * A missing gradient shows up as a transparent or white face, so both are
   * treated as failures.
   */
  function assertFaceRendered(canvas, side) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const white = (r, g, b) => r > 245 && g > 245 && b > 245;

    // Corners sit inside the margin, so they are background on any layout.
    // Never sample the centre: it is background on a landscape card but lands
    // on white type in portrait, which is what made an earlier version of this
    // check reject a perfectly good render.
    for (const [x, y] of [[4, 4], [W - 5, 4], [4, H - 5], [W - 5, H - 5]]) {
      const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
      if (a < 250) throw new Error(`Postcard ${side}: did not render — transparent at ${x},${y}`);
      if (white(r, g, b)) throw new Error(`Postcard ${side}: rendered white at ${x},${y} — the gradient is missing`);
    }

    // And the ground must cover the card, not just its corners. Type is a small
    // share of the face, so a mostly-white grid means the gradient is absent.
    let lit = 0, n = 0;
    for (let gy = 1; gy < 6; gy++) {
      for (let gx = 1; gx < 6; gx++) {
        const [r, g, b] = ctx.getImageData((W * gx / 6) | 0, (H * gy / 6) | 0, 1, 1).data;
        n++; if (!white(r, g, b)) lit++;
      }
    }
    if (lit / n < 0.6) throw new Error(`Postcard ${side}: only ${lit}/${n} sampled points carry the gradient`);
    return canvas;
  }

  /**
   * Render one face to a 300 DPI canvas at bleed size.
   * @param {string} slug
   */
  async function renderFace(slug) {
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none;';
    const card = buildPostcard({ slug, guides: false });
    holder.appendChild(card);
    document.body.appendChild(holder);

    try {
      // Baselines are measured from the live font, so the face must not be
      // captured until the real faces are in — a fallback would shift the type.
      await document.fonts.ready;
      setBaselines(card);

      const mark = card.querySelector('.pc-mark');
      if (mark && !mark.complete) await mark.decode().catch(() => {});

      const canvas = await window.html2canvas(card, {
        scale: PRINT.dpi / 96,
        backgroundColor: null,
        useCORS: true,
        logging: false,
        width: card.offsetWidth,
        height: card.offsetHeight,
      });
      return assertFaceRendered(canvas, 'insert');
    } finally {
      holder.remove();
    }
  }

  /**
   * Production entry point: the insert artwork for one order.
   *
   * PNG rather than JPEG — the card is a smooth gradient, which is exactly
   * what JPEG bands. Upload to the `experiences` bucket and hand the public URL
   * to Prodigi as branding.postcard.url on the order.
   *
   * @param {string} slug the order's slug — what the whole card exists to carry
   */
  window.buildPostcardAssets = async function buildPostcardAssets(slug) {
    return { insert: await buildPostcardInsert(slug), dpi: PRINT.dpi, ...PRINT.insertPx };
  };

  /** A two-page proof for human review. JPEG here — it is read, not printed. */
  async function buildPostcardProofPdf(slug) {
    await loadPrintLibs();
    const { jsPDF } = window.jspdf;
    const w = CARD.wIn + CARD.bleedIn * 2, h = CARD.hIn + CARD.bleedIn * 2;
    // jsPDF reorders the format array to suit the orientation, so a setting that
    // disagrees with the card crops an edge off. Derive it from the card rather
    // than naming it: this was hard-coded once and went stale the moment the
    // card's orientation changed.
    const orientation = w > h ? 'landscape' : 'portrait';
    const doc = new jsPDF({ unit: 'in', format: [w, h], orientation, compress: true });
    const canvas = await renderFace(slug);
    doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, w, h);
    doc.save(`popcode-insert-${slug}.pdf`);
  }

  /** Save one face as the print-ready PNG. */
  async function downloadFace(slug) {
    await loadPrintLibs();
    const canvas = await renderFace(slug);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `popcode-insert-${slug}-${PRINT.dpi}dpi.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  injectCss();

  /**
   * The print-ready insert: one face at exactly the pixel size Prodigi's
   * branded-insert postcard expects.
   *
   * The card is composed LANDSCAPE (its reading orientation, and the approved
   * artwork) and the stock is A6 PORTRAIT, so the face is rotated a quarter
   * turn on the way into the file. The recipient turns the card; the artwork is
   * the one that was signed off, to the pixel.
   *
   * @param {string} slug
   * @returns {Promise<Blob>} PNG, PRINT.insertPx
   */
  async function buildPostcardInsert(slug) {
    await loadPrintLibs();
    const { w, h } = PRINT.insertPx;
    const face = await renderFace(slug);

    // The face is landscape and the file is portrait, so this must be a quarter
    // turn — not a stretch into a differently-shaped box, which is what drawing
    // it straight into these dimensions would do.
    const turned = (face.width > face.height) !== (w > h);

    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    if (turned) {
      // Clockwise about the centre: the card's top edge ends up on the right, so
      // it reads when turned anticlockwise — the natural way to pick a card up.
      ctx.translate(w / 2, h / 2);
      ctx.rotate(Math.PI / 2);
      // Drawn to an exact rect in the ROTATED frame, whose axes are swapped.
      ctx.drawImage(face, -h / 2, -w / 2, h, w);
    } else {
      ctx.drawImage(face, 0, 0, w, h);
    }
    return new Promise((res) => out.toBlob(res, 'image/png'));
  }

  window.PopcodePostcard = {
    buildInsert: buildPostcardInsert,
    CARD, COPY, PRINT, FACES,
    buildCard: buildPostcard,
    setBaselines,
    renderFace,
    buildAssets: window.buildPostcardAssets,
    buildProofPdf: buildPostcardProofPdf,
    downloadFace,
    artGradient,
  };
})();
