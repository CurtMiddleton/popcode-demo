/* Popcode photo book spine — shared by book.html ("Order this one now") and
   cart.html (cart checkout).

   Prodigi's layflat books take the spine as its OWN asset (print_area
   'spine'), separate from the page PDF; its width depends on the page count
   AND the lab that binds it, so it is looked up per order at checkout
   (/api/book-spine). Until 2026-10-01 only the book page built one — the cart
   never did, and the book page swallowed any failure — so both Rwanda &
   South Africa orders went to Prodigi with no spine file and printed a blank
   spine. Callers now treat a missing spine as an error, not a skip.

   Design (ported from Bashō, unchanged from book.html's earlier
   html2canvas version): a #1a1a1a strip widthMm × 210mm, the cover eyebrow
   (italic) + title in Cormorant Garamond reading bottom-to-top from 16.5mm in,
   the year in Inter at the far end. Type scales to the spine thickness, capped
   at the reference sizes (title 32pt, eyebrow 14pt, year 12pt). 300 DPI. */
(function () {
  var DPI = 300, H_MM = 210;
  var PX_PER_MM = DPI / 25.4, PX_PER_PT = DPI / 72, PT_PER_MM = 72 / 25.4;
  var SERIF = "'Cormorant Garamond', Georgia, serif";
  var SANS = "'Inter', 'Helvetica Neue', Arial, sans-serif";

  function coverYear(s) { var m = (s || '').match(/\b(19|20)\d{2}\b/); return m ? m[0] : ''; }

  // { eyebrow, big, year } from a saved book_layout (cart) — the same rule as
  // book.html's spineParts() reads from the live cover.
  function partsFromLayout(layout, fallbackTitle) {
    var c = (layout && layout.cover) || {};
    return {
      eyebrow: (c.eyebrow || '').trim() || null,
      big: (c.title || fallbackTitle || 'My book').trim(),
      year: (coverYear(c.subtitle) || coverYear(c.title) || '').trim() || null,
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
      l.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=Inter:wght@400&display=swap';
      document.head.appendChild(l);
    }
  }
  async function ensureFonts(sizes) {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.all([
        document.fonts.load('400 ' + sizes.big + 'px "Cormorant Garamond"'),
        document.fonts.load('italic 400 ' + sizes.name + 'px "Cormorant Garamond"'),
        document.fonts.load('400 ' + sizes.year + 'px "Inter"'),
      ]);
    } catch (e) { /* falls back to Georgia / Arial */ }
  }

  // The spine strip as a single-page PDF Blob, widthMm × 210mm at 300 DPI.
  async function buildPdf(widthMm, parts) {
    if (!(widthMm > 0)) throw new Error('No spine width');
    await ensureLibs();
    var usablePt = Math.max(0, (widthMm - 4) * PT_PER_MM);         // 2mm safety each long edge
    var bigPt = Math.min(32, usablePt / 1.25);
    var k = bigPt > 0 ? bigPt / 32 : 0;
    var px = { big: bigPt * PX_PER_PT, name: 14 * k * PX_PER_PT, year: 12 * k * PX_PER_PT, gap: 5 * PT_PER_MM * k * PX_PER_PT };
    await ensureFonts(px);

    var T = Math.max(1, Math.round(widthMm * PX_PER_MM));            // thickness
    var L = Math.round(H_MM * PX_PER_MM);                            // length
    var inset = 16.5 * PX_PER_MM;
    var c = document.createElement('canvas'); c.width = T; c.height = L;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, T, L);
    // Rotate so +x runs UP the spine (bottom → top) and +y across it.
    ctx.translate(0, L); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'alphabetic';
    // Optical vertical centring on the title's x-height.
    var baseline = T / 2 + px.big * 0.32;
    var x = inset;
    if (parts.eyebrow && px.name > 0) {
      ctx.font = 'italic 400 ' + px.name + 'px ' + SERIF;
      ctx.fillText(parts.eyebrow, x, baseline);
      x += ctx.measureText(parts.eyebrow).width + px.gap;
    }
    if (px.big > 0) {
      ctx.font = '400 ' + px.big + 'px ' + SERIF;
      ctx.fillText(parts.big, x, baseline);
    }
    if (parts.year && px.year > 0) {
      ctx.font = '400 ' + px.year + 'px ' + SANS;
      ctx.textAlign = 'right';
      ctx.fillText(parts.year, L - inset, T / 2 + px.year * 0.36);
    }
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
    var blob = await buildPdf(widthMm, opts.parts);
    var path = opts.slug + '/print/spine_' + Date.now() + '.pdf';
    var up = await opts.db.storage.from('experiences').upload(path, blob, { contentType: 'application/pdf', upsert: true });
    if (up.error) throw new Error('We couldn’t upload your book’s spine: ' + up.error.message);
    return { url: opts.db.storage.from('experiences').getPublicUrl(path).data.publicUrl, print_area: 'spine' };
  }

  window.PopcodeSpine = { buildPdf: buildPdf, fetchWidthMm: fetchWidthMm, prepare: prepare, partsFromLayout: partsFromLayout };
})();
