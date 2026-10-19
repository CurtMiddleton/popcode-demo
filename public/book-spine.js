/* Popcode photo book spine — shared by book.html ("Order this one now") and
   cart.html (cart checkout).

   Prodigi's layflat books take the spine as its OWN asset (print_area
   'spine'), separate from the page PDF; its width depends on the page count
   AND the lab that binds it, so it is looked up per order at checkout
   (/api/book-spine). Until 2026-10-01 only the book page built one — the cart
   never did, and the book page swallowed any failure — so both Rwanda &
   South Africa orders went to Prodigi with no spine file and printed a blank
   spine. Callers now treat a missing spine as an error, not a skip.

   Design (matched to the editor's spine 2026-10-18): a white strip widthMm ×
   the book height; the cover eyebrow (italic) + title in the book's cover
   font, dark type, reading top-to-bottom from the head; the year in Inter at
   the foot. Type scales to the spine thickness (title capped at 32pt; eyebrow
   and year in the editor's proportions to it). 300 DPI. */
(function () {
  var DPI = 300;
  // The spine runs the book's full height: 210mm for A4 landscape and 8×8",
  // 297mm for the 12×12" square. Until 2026-10-18 every spine was 210mm, so a
  // 12×12" book's spine came out 87mm short.
  var HEIGHT_MM = { 'book-a4l-layflat': 210, 'book-21sq-layflat': 210, 'book-30sq-layflat': 297 };
  function heightFor(variantId) { return HEIGHT_MM[variantId] || 210; }
  var PX_PER_MM = DPI / 25.4, PX_PER_PT = DPI / 72, PT_PER_MM = 72 / 25.4;
  var SANS = "'Inter', 'Helvetica Neue', Arial, sans-serif";
  // The book's cover fonts (book.html COVER_FONTS / COVER_WEIGHT): the spine is
  // set in the font the customer chose, as the editor's spine shows it.
  var FONTS = {
    cooper:    { family: 'CooperBT', stack: "'CooperBT', Georgia, serif", weight: 400 },
    dmsans:    { family: 'DM Sans', stack: "'DM Sans', sans-serif", weight: 700 },
    inter:     { family: 'Inter', stack: "'Inter', sans-serif", weight: 700 },
    filson:    { family: 'FilsonPro', stack: "'FilsonPro', 'Nunito', sans-serif", weight: 700 },
    cormorant: { family: 'Cormorant Garamond', stack: "'Cormorant Garamond', Georgia, serif", weight: 400 },
    libre:     { family: 'Libre Baskerville', stack: "'Libre Baskerville', Georgia, serif", weight: 700 },
  };
  function fontFor(id) { return FONTS[id] || FONTS.cooper; }
  var INK = '#1A1814';   // the editor's spine text colour, on white

  function coverYear(s) { var m = (s || '').match(/\b(19|20)\d{2}\b/); return m ? m[0] : ''; }

  // { eyebrow, big, year } from a saved book_layout (cart) — the same rule as
  // book.html's spineParts() reads from the live cover.
  function partsFromLayout(layout, fallbackTitle) {
    var c = (layout && layout.cover) || {};
    return {
      eyebrow: (c.eyebrow || '').trim() || null,
      big: (c.title || fallbackTitle || 'My book').trim(),
      year: (coverYear(c.subtitle) || coverYear(c.title) || '').trim() || null,
      font: c.font || null,
    };
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src;
      s.onload = res; s.onerror = function () { rej(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }
  async function ensureLibs() {
    if (!(window.jspdf && window.jspdf.jsPDF)) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    if (!document.querySelector('link[data-spine-fonts]')) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.dataset.spineFonts = '1';
      l.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=DM+Sans:ital,wght@0,400;0,700;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;700&display=swap';
      document.head.appendChild(l);
    }
    // Filson is self-hosted (book.html declares it; the cart doesn't).
    if (!document.querySelector('style[data-spine-filson]')) {
      var st = document.createElement('style'); st.dataset.spineFilson = '1';
      st.textContent = "@font-face{font-family:'FilsonPro';src:url('/assets/fonts/FilsonProBold/font.woff2') format('woff2');font-weight:600 700;font-display:swap}";
      document.head.appendChild(st);
    }
  }
  async function ensureFonts(sizes, f) {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.all([
        document.fonts.load(f.weight + ' ' + sizes.big + 'px "' + f.family + '"'),
        document.fonts.load('italic 400 ' + sizes.name + 'px "' + f.family + '"'),
        document.fonts.load('400 ' + sizes.year + 'px "Inter"'),
      ]);
    } catch (e) { /* falls back to the stack's next face */ }
  }

  // The spine strip drawn on a canvas, widthMm × heightMm, at `pxPerMm`
  // (300 DPI by default). Shared by the print PDF and the print preview, so
  // the preview shows exactly the strip that's printed.
  async function drawCanvas(widthMm, parts, heightMm, pxPerMm) {
    var H_MM = heightMm || 210;
    var PPM = pxPerMm || PX_PER_MM;
    var s = PPM / PX_PER_MM;                                         // vs 300 DPI
    if (!(widthMm > 0)) throw new Error('No spine width');
    await ensureLibs();
    var usablePt = Math.max(0, (widthMm - 4) * PT_PER_MM);         // 2mm safety each long edge
    var bigPt = Math.min(32, usablePt / 1.25);
    var k = bigPt > 0 ? bigPt / 32 : 0;
    // Eyebrow and year in the editor's proportions to the title (1.35 : 2.1 : 1.25).
    var px = { big: bigPt * PX_PER_PT * s, name: bigPt * 0.64 * PX_PER_PT * s, year: bigPt * 0.6 * PX_PER_PT * s, gap: 5 * PT_PER_MM * k * PX_PER_PT * s };
    var f = fontFor(parts.font);
    await ensureFonts(px, f);

    var T = Math.max(1, Math.round(widthMm * PPM));                  // thickness
    var L = Math.round(H_MM * PPM);                                  // length
    var inset = 16.5 * PPM;
    var c = document.createElement('canvas'); c.width = T; c.height = L;
    var ctx = c.getContext('2d');
    // White with dark type, as the editor's spine shows it. (Until 2026-10-18
    // the print was a black strip with white Cormorant whatever the design.)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, T, L);
    // Rotate so +x runs DOWN the spine (top → bottom), letter tops toward the
    // front cover: the US/UK convention, readable with the book lying face up.
    // (It read bottom → top until 2026-10-18.)
    ctx.translate(T, 0); ctx.rotate(Math.PI / 2);
    ctx.fillStyle = INK;
    ctx.textBaseline = 'alphabetic';
    // Optical vertical centring on the title's x-height.
    var baseline = T / 2 + px.big * 0.32;
    // A long title in a wide font can run into the year: scale everything
    // down until eyebrow + title + year fit between the insets.
    var measure = function () {
      var w = 0;
      if (parts.eyebrow && px.name > 0) { ctx.font = 'italic 400 ' + px.name + 'px ' + f.stack; w += ctx.measureText(parts.eyebrow).width + px.gap; }
      if (px.big > 0) { ctx.font = f.weight + ' ' + px.big + 'px ' + f.stack; w += ctx.measureText(parts.big).width; }
      if (parts.year && px.year > 0) { ctx.font = '400 ' + px.year + 'px ' + SANS; w += px.gap + ctx.measureText(parts.year).width; }
      return w;
    };
    var need = measure(), room = L - 2 * inset;
    if (need > room && need > 0) {
      var fit = room / need;
      px.big *= fit; px.name *= fit; px.year *= fit; px.gap *= fit;
      baseline = T / 2 + px.big * 0.32;
    }
    // Eyebrow + title from the head of the spine, year at the foot: the
    // editor's layout.
    var x = inset;
    if (parts.eyebrow && px.name > 0) {
      ctx.font = 'italic 400 ' + px.name + 'px ' + f.stack;
      ctx.fillText(parts.eyebrow, x, baseline);
      x += ctx.measureText(parts.eyebrow).width + px.gap;
    }
    if (px.big > 0) {
      ctx.font = f.weight + ' ' + px.big + 'px ' + f.stack;
      ctx.fillText(parts.big, x, baseline);
    }
    if (parts.year && px.year > 0) {
      ctx.font = '400 ' + px.year + 'px ' + SANS;
      ctx.textAlign = 'right';
      ctx.fillText(parts.year, L - inset, T / 2 + px.year * 0.36);
    }
    return c;
  }

  // The spine strip as a single-page PDF Blob, widthMm × heightMm at 300 DPI.
  async function buildPdf(widthMm, parts, heightMm) {
    var H_MM = heightMm || 210;
    var c = await drawCanvas(widthMm, parts, H_MM);
    var data = c.toDataURL('image/jpeg', 0.95);
    c.width = c.height = 0;
    var doc = new window.jspdf.jsPDF({ unit: 'mm', format: [widthMm, H_MM], orientation: 'portrait', compress: true });
    doc.addImage(data, 'JPEG', 0, 0, widthMm, H_MM);
    return doc.output('blob');
  }

  // Prodigi's spine width (mm) for this book and destination. Retries once;
  // null if Prodigi can't say (callers decide whether that's fatal).
  async function fetchWidthMm(opts) {
    var body = {
      productType: 'book', variantId: opts.variantId,
      numberOfPages: opts.pageCount,
      destinationCountryCode: opts.address && opts.address.countryCode,
      state: (opts.address && opts.address.stateOrCounty) || undefined,
    };
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        var r = await fetch('/api/book-spine', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, opts.token ? { Authorization: 'Bearer ' + opts.token } : {}),
          body: JSON.stringify(body),
        });
        var d = await r.json().catch(function () { return {}; });
        if (d && d.widthMm > 0) return d.widthMm;
      } catch (e) { /* retry */ }
    }
    return null;
  }

  // Look up, render and upload a book's spine. Resolves to the asset
  // { url, print_area: 'spine' }; THROWS with a customer-readable message if
  // any step fails, so a book never goes to print with a blank spine.
  async function prepare(opts) {
    var widthMm = await fetchWidthMm(opts);
    if (!widthMm) {
      var us = opts.address && opts.address.countryCode === 'US';
      throw new Error(us && !(opts.address.stateOrCounty || '').trim()
        ? 'Please choose a state — we need it to size your book’s spine.'
        : 'We couldn’t get your book’s spine size from the printer. Please try again in a minute.');
    }
    var blob = await buildPdf(widthMm, opts.parts, heightFor(opts.variantId));
    var path = opts.slug + '/print/spine_' + Date.now() + '.pdf';
    var up = await opts.db.storage.from('experiences').upload(path, blob, { contentType: 'application/pdf', upsert: true });
    if (up.error) throw new Error('We couldn’t upload your book’s spine: ' + up.error.message);
    return { url: opts.db.storage.from('experiences').getPublicUrl(path).data.publicUrl, print_area: 'spine' };
  }

  window.PopcodeSpine = { buildPdf: buildPdf, drawCanvas: drawCanvas, fetchWidthMm: fetchWidthMm, prepare: prepare, partsFromLayout: partsFromLayout, heightFor: heightFor };
})();
