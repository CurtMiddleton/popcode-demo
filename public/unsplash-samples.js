// Curated Unsplash sample photos for shop previews (random per page load),
// plus a small product-mockup compositor so storefront cards can show those
// photos inside the real Prodigi product templates.
//
// Photos are hotlinked from images.unsplash.com — the account has Unsplash Pro,
// and the CDN serves Access-Control-Allow-Origin: * so canvas compositing works
// (loaders must still set img.crossOrigin = 'anonymous').
//
// Pool is travel / people (families, couples, kids) / pets — every ID verified
// to return 200. Consumers should keep a local fallback (e.g.
// /assets/sample-leopard.jpg) for offline/blocked cases.
//
// API:
//   unsplashSample(w)          → one random URL sized to width w (default 1600)
//   unsplashSamples(n, w)      → n distinct random URLs, interleaved across
//                                categories so any small pick spans the mix
//   unsplashSampleCat(cat, w)  → one random URL from 'travel'|'people'|'pets'
//   drawProductCardMockup(canvas, productId, photoUrl) → Promise; draws the
//     product template with the photo composited into its art opening.
(function () {
  const POOL = {
    travel: [
      'photo-1503220317375-aaad61436b1b', // backpacker at a mountain lake
      'photo-1527631746610-bca00a040d60', // traveler in an old-town alley
      'photo-1539635278303-d4002c07eae3', // friends hiking in the mountains
      'photo-1507525428034-b723cf961d3e', // beach
      'photo-1476514525535-07fb3b4ae5f1', // canoe on a lake
      'photo-1519098901909-b1553a1190af', // coastal cliffs
      'photo-1506905925346-21bda4d32df4', // mountain peak at dusk
      'photo-1501785888041-af3ef285b470', // lake + mountains
    ],
    people: [
      'photo-1476703993599-0035a21b17a9', // mom + kids on the couch
      'photo-1503454537195-1dcabb73ffb9', // little girl, painted face
      'photo-1544005313-94ddf0286df2',    // portrait
      'photo-1523301343968-6a6ebf63c672', // backyard pool party
      'photo-1516589178581-6cd7833ae3b2', // couple, heart hands at sunset
      'photo-1542037104857-ffbb0b9155fb', // family walking in a field
      'photo-1609220136736-443140cffec6', // dad with kids
      'photo-1511632765486-a01980e01a18', // friends at sunset
      'photo-1502086223501-7ea6ecd79368', // kids jumping in the forest
      'photo-1478061653917-455ba7f4a541', // family hug
      'photo-1543342384-1f1350e27861',    // parents with newborn
      'photo-1511895426328-dc8714191300', // family
      'photo-1517841905240-472988babdf9', // portrait
      'photo-1529626455594-4ff0802cfb7e', // portrait
    ],
    pets: [
      'photo-1537151625747-768eb6cf92b2', // corgi puppy
      'photo-1596492784531-6e6eb5ea9993', // samoyed
      'photo-1450778869180-41d0601e046e', // dog lying in the grass
      'photo-1518791841217-8f162f1e1131', // cat
      'photo-1583511655857-d19b40a7a54e', // puppy
      'photo-1548199973-03cce0bbc87b',    // dogs running
    ],
  };
  const CATS = Object.keys(POOL);
  const url = (id, w) => 'https://images.unsplash.com/' + id + '?auto=format&fit=crop&w=' + (w || 1600) + '&q=80';
  const shuffled = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  window.unsplashSampleCat = function (cat, w) {
    const ids = POOL[cat] || POOL.people;
    return url(ids[Math.floor(Math.random() * ids.length)], w);
  };
  window.unsplashSample = function (w) {
    return window.unsplashSampleCat(CATS[Math.floor(Math.random() * CATS.length)], w);
  };
  // Interleave categories (travel, people, pets, travel, …) so even a pick of
  // 3–5 spans the mix instead of coming out all-landscapes or all-dogs.
  window.unsplashSamples = function (n, w) {
    const lists = shuffled(CATS).map(c => shuffled(POOL[c]));
    const out = [];
    let i = 0;
    while (out.length < n) {
      const list = lists[i % lists.length];
      if (list.length) out.push(url(list.shift(), w));
      else if (lists.every(l => !l.length)) lists.forEach((l, k) => l.push(...shuffled(POOL[CATS[k]]))); // refill if n > pool
      i++;
    }
    return out;
  };

  // ── Product-card mockup compositor ──────────────────────────────
  // Draws a Prodigi product template and cover-crops a photo into its art
  // opening. rect = art opening as FRACTIONS of the template image (keep in
  // sync with order.html's MOCKUPS where products overlap). The book template
  // gets its cover title re-drawn (the baked text sits on the baked photo).
  const CARD_MOCKUPS = {
    print:  { template: '/assets/mockups/print.jpg',  rect: { x: 0.190, y: 0.113, w: 0.626, h: 0.782 } },
    tile:   { template: '/assets/mockups/tile.jpg',   rect: { x: 0.280, y: 0.206, w: 0.427, h: 0.598 } },
    canvas: { template: '/assets/mockups/canvas.jpg', rect: { x: 0.190, y: 0.112, w: 0.670, h: 0.804 } },
    framed: { template: '/assets/mockups/framed.jpg', rect: { x: 0.208, y: 0.111, w: 0.582, h: 0.778 } },
    book:   { template: '/assets/mockups/book.jpg',   rect: { x: 0.143, y: 0.253, w: 0.735, h: 0.537 }, bookText: true },
  };
  const _cache = {};
  function loadImg(src, cors) {
    const key = (cors ? 'c:' : '') + src;
    if (_cache[key]) return _cache[key];
    _cache[key] = new Promise((res, rej) => {
      const i = new Image();
      if (cors) i.crossOrigin = 'anonymous';
      i.onload = () => res(i); i.onerror = () => rej(new Error('img ' + src));
      i.src = src;
    });
    return _cache[key];
  }

  // Draws template + photo into `cv`. Resolves once the template is drawn; if
  // the photo can't load, the template's own baked photo stays visible.
  window.drawProductCardMockup = async function (cv, productId, photoUrl) {
    const mk = CARD_MOCKUPS[productId];
    if (!mk) throw new Error('No card mockup for ' + productId);
    const tpl = await loadImg(mk.template, true);
    const s = Math.min(1, 900 / Math.max(tpl.naturalWidth, tpl.naturalHeight));
    cv.width = Math.round(tpl.naturalWidth * s);
    cv.height = Math.round(tpl.naturalHeight * s);
    const ctx = cv.getContext('2d');
    ctx.drawImage(tpl, 0, 0, cv.width, cv.height);
    if (!photoUrl) return;
    let photo;
    try { photo = await loadImg(photoUrl, true); }
    catch (_) { return; } // offline/blocked → keep the template as-is
    const r = { x: mk.rect.x * cv.width, y: mk.rect.y * cv.height, w: mk.rect.w * cv.width, h: mk.rect.h * cv.height };
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    const pa = photo.naturalWidth / photo.naturalHeight, ra = r.w / r.h;
    let dw, dh;
    if (pa > ra) { dh = r.h; dw = dh * pa; } else { dw = r.w; dh = dw / pa; }
    ctx.drawImage(photo, r.x + (r.w - dw) / 2, r.y + (r.h - dh) / 2, dw, dh);
    if (mk.bookText) {
      // Legibility gradient + the sample cover title (mirrors the book maker's
      // Overlay cover style).
      const g = ctx.createLinearGradient(0, r.y + r.h * 0.55, 0, r.y + r.h);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g; ctx.fillRect(r.x, r.y + r.h * 0.55, r.w, r.h * 0.45);
      const lx = r.x + r.w * 0.075;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'italic ' + Math.round(r.h * 0.055) + 'px "CooperBT", Georgia, serif';
      ctx.fillText('A Book of Memories', lx, r.y + r.h * 0.72);
      ctx.font = Math.round(r.h * 0.125) + 'px "CooperBT", Georgia, serif';
      ctx.fillText('Our Story', lx, r.y + r.h * 0.845);
      ctx.globalAlpha = 0.85;
      ctx.font = Math.round(r.h * 0.045) + 'px Inter, sans-serif';
      ctx.fillText(String(new Date().getFullYear() + 1), lx, r.y + r.h * 0.93);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };
})();
