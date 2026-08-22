// Curt's hand-picked sample photos for shop previews (random per page load),
// plus a small product-mockup compositor so storefront cards can show those
// photos inside the real Prodigi product templates.
//
// The photos were selected by Curt (Drive folder, 2026-08-01) and are
// hotlinked from images.unsplash.com. NOTE: the 12 Unsplash+ premium picks
// (plus.unsplash.com) were REMOVED from the pool — hotlinked premium files
// render with tiled "Unsplash+" watermarks at preview sizes (they only serve
// clean via an entitled download). To restore them, download the originals
// from the Unsplash+ account and self-host under /assets/samples/. The CDN
// serves Access-Control-Allow-Origin: * so canvas compositing works (loaders
// must still set img.crossOrigin = 'anonymous').
//
// Pool is travel / people (families, couples, kids) / pets — every URL
// verified to return 200. The bundled /assets/sample-photo.jpg (one of the
// same 50, hosted locally) is the offline/blocked fallback.
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
      'https://images.unsplash.com/photo-1532347922424-c652d9b7208e', // poolside straw hat
      'https://images.unsplash.com/photo-1501555088652-021faa106b9b', // hiker, yellow backpack valley
      'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9', // Venice, Rialto bridge
      'https://images.unsplash.com/photo-1549144511-f099e773c147', // Paris, Eiffel Tower
      'https://images.unsplash.com/photo-1682686581264-c47e25e61d95', // desert dune walk
      'https://images.unsplash.com/photo-1527142879-95b61a0b8226', // resort pool + palms
      'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e', // Kyoto street
      'https://images.unsplash.com/photo-1554357475-accb8a88a330', // Petra
      'https://images.unsplash.com/photo-1483729558449-99ef09a8c325', // Rio de Janeiro
      'https://images.unsplash.com/photo-1489493585363-d69421e0edd3', // Manarola cliff town
      'https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7', // hot-air balloons
      'https://images.unsplash.com/photo-1539920951450-2b2d59cff66d', // camel caravan dunes
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470', // alpine lake
      'https://images.unsplash.com/photo-1551918120-9739cb430c6d', // infinity pool
      'https://images.unsplash.com/photo-1527824404775-dce343118ebc', // Monument Valley
    ],
    people: [
      'https://images.unsplash.com/photo-1738898178964-88696087d43b', // couple, beach piggyback
      'https://images.unsplash.com/photo-1581579186913-45ac3e6efe93', // family with dog on the lawn
      'https://images.unsplash.com/photo-1559054109-82d938dac629', // friends at the overlook
      'https://images.unsplash.com/photo-1611024847487-e26177381a3f', // family group
      'https://images.unsplash.com/photo-1624272864537-8ecc72b67958', // father + child
      'https://images.unsplash.com/photo-1561524891-8e08ab8569f3', // family on the boardwalk
      'https://images.unsplash.com/photo-1531984929664-2fb2be468d3e', // toddler hug
      'https://images.unsplash.com/photo-1555689070-2d15336749b6', // couple piggyback in a field
      'https://images.unsplash.com/photo-1561525140-c2a4cc68e4bd', // family at sunset
      'https://images.unsplash.com/photo-1518658761661-a3c568ee7b64', // friends jumping on the beach
      'https://images.unsplash.com/photo-1446160657592-4782fb76fb99', // friends at the Golden Gate
      'https://images.unsplash.com/photo-1539635278303-d4002c07eae3', // forest sunrays walk
      'https://images.unsplash.com/photo-1605713288610-00c1c630ca1e', // kids hugging
      'https://images.unsplash.com/photo-1531983412531-1f49a365ffed', // mother + child
      'https://images.unsplash.com/photo-1506456331400-7088248a8db1', // beach sunset, parent + kid
      'https://images.unsplash.com/photo-1560328055-e938bb2ed50a', // dad with baby on shoulders
      'https://images.unsplash.com/photo-1517554558809-9b4971b38f39', // family walking a field
    ],
    pets: [
      'https://images.unsplash.com/photo-1530281700549-e82e7bf110d6', // golden retriever on the beach
      'https://images.unsplash.com/photo-1504826260979-242151ee45b7', // puppy on the beach
      'https://images.unsplash.com/photo-1503256207526-0d5d80fa2f47', // border collie
      'https://images.unsplash.com/photo-1557495235-340eb888a9fb', // woman with black lab
      'https://images.unsplash.com/photo-1504595403659-9088ce801e29', // two happy dogs
      'https://images.unsplash.com/photo-1559190394-df5a28aab5c5', // spaniel out the car window
      'https://images.unsplash.com/photo-1510771463146-e89e6e86560e', // golden with a flower
    ],
  };
  const CATS = Object.keys(POOL);
  const IX = 'ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0';
  const url = (base, w) => base + '?' + IX + '&auto=format&fit=crop&w=' + (w || 1600) + '&q=80';
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
  // Baby / family subset (from the verified people pool) for the board-book product
  // mockups. Swap for self-hosted real baby photos under /assets/samples/ if desired.
  const BABY = [
    'https://images.unsplash.com/photo-1560328055-e938bb2ed50a', // dad with baby on shoulders
    'https://images.unsplash.com/photo-1531984929664-2fb2be468d3e', // toddler hug
    'https://images.unsplash.com/photo-1531983412531-1f49a365ffed', // mother + child
    'https://images.unsplash.com/photo-1624272864537-8ecc72b67958', // father + child
    'https://images.unsplash.com/photo-1506456331400-7088248a8db1', // beach, parent + kid
    'https://images.unsplash.com/photo-1605713288610-00c1c630ca1e', // kids hugging
    'https://images.unsplash.com/photo-1581579186913-45ac3e6efe93', // family with dog
  ];
  window.unsplashBaby = function (w) { return url(BABY[Math.floor(Math.random() * BABY.length)], w); };
  window.unsplashBabies = function (n, w) {
    const a = shuffled(BABY); const out = [];
    for (let i = 0; i < n; i++) out.push(url(a[i % a.length], w));
    return out;
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
  // rect = art opening; crop = the PRODUCT's bounding box (incl. its baked
  // shadow) within the template. The finished canvas is cropped to `crop`, so
  // the product — not the empty template around it — is what CSS sizes. That
  // keeps products the same visual size on the storefront cards and the
  // detail pages.
  const CARD_MOCKUPS = {
    print:  { template: '/assets/mockups/print.jpg',  rect: { x: 0.190, y: 0.113, w: 0.626, h: 0.782 }, crop: { x: 0.168, y: 0.089, w: 0.667, h: 0.823 } },
    tile:   { template: '/assets/mockups/tile.jpg',   rect: { x: 0.280, y: 0.206, w: 0.427, h: 0.598 }, crop: { x: 0.242, y: 0.167, w: 0.521, h: 0.696 } },
    canvas: { template: '/assets/mockups/canvas.jpg', rect: { x: 0.190, y: 0.112, w: 0.670, h: 0.804 }, crop: { x: 0.168, y: 0.094, w: 0.709, h: 0.869 } },
    framed: { template: '/assets/mockups/framed.jpg', rect: { x: 0.208, y: 0.111, w: 0.582, h: 0.778 }, crop: { x: 0.116, y: 0.019, w: 0.800, h: 0.980 } },
    // Book rect spans the FULL cover incl. the hinge strip so no baked template
    // photo can peek out at the left edge; the hinge highlight is redrawn on
    // top (see `hinge`).
    book:   { template: '/assets/mockups/book.jpg',   rect: { x: 0.133, y: 0.253, w: 0.745, h: 0.537 }, bookText: true, hinge: true, crop: { x: 0.113, y: 0.233, w: 0.781, h: 0.573 } },
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

  // Products without a photoreal template are drawn programmatically
  // (frame + photo + shadow on a transparent canvas, cropped tight like the
  // template composites so the sizing system treats them the same).
  const DRAWN_CARDS = {
    framedcanvas: { kind: 'framedcanvas' },
    acrylic: { kind: 'acrylic' },
  };
  async function loadCardPhoto(photoUrl, fallbackUrl) {
    try { return await loadImg(photoUrl, true); }
    catch (_) { if (fallbackUrl) { try { return await loadImg(fallbackUrl, true); } catch (_) {} } }
    return null;
  }
  function coverDraw(ctx, photo, x, y, w, h) {
    const pa = photo.naturalWidth / photo.naturalHeight, ra = w / h;
    let dw, dh;
    if (pa > ra) { dh = h; dw = dh * pa; } else { dw = w; dh = dw / pa; }
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(photo, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
  }
  async function drawSimpleCard(cv, kind, photoUrl, fallbackUrl) {
    const photo = await loadCardPhoto(photoUrl, fallbackUrl);
    if (!photo) throw new Error('No sample photo available');
    const artW = 660, artH = 880;                    // 3:4 portrait product
    const frame = kind === 'framedcanvas' ? 36 : 0;  // classic-frame face
    const gap = kind === 'framedcanvas' ? 14 : 0;    // shadowed frame→canvas gap
    const M = 52;                                    // margin for the cast shadow
    const pw = artW + 2 * (frame + gap), ph = artH + 2 * (frame + gap);
    cv.width = pw + 2 * M; cv.height = ph + 2 * M;
    const ctx = cv.getContext('2d');
    const x = M, y = M;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.24)';
    ctx.shadowBlur = 34; ctx.shadowOffsetX = 10; ctx.shadowOffsetY = 24;
    ctx.fillStyle = kind === 'framedcanvas' ? '#141414' : '#ffffff';
    ctx.fillRect(x, y, pw, ph);
    ctx.restore();
    if (kind === 'framedcanvas') {
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(x + frame, y + frame, pw - 2 * frame, ph - 2 * frame);
      coverDraw(ctx, photo, x + frame + gap, y + frame + gap, artW, artH);
    } else {
      coverDraw(ctx, photo, x, y, pw, ph);
      // acrylic gloss: diagonal sheen + bright polished edge
      const sheen = ctx.createLinearGradient(x, y, x + pw, y + ph);
      sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
      sheen.addColorStop(0.35, 'rgba(255,255,255,0.02)');
      sheen.addColorStop(0.55, 'rgba(255,255,255,0.10)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen; ctx.fillRect(x, y, pw, ph);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 4;
      ctx.strokeRect(x + 2, y + 2, pw - 4, ph - 4);
    }
  }

  // Square layflat book — drawn (there's no photoreal square template): a
  // full-bleed square cover with the same hinge highlight, legibility
  // gradient and sample title as the landscape composite.
  async function drawSquareBookCard(cv, photoUrl, fallbackUrl) {
    const photo = await loadCardPhoto(photoUrl, fallbackUrl);
    if (!photo) throw new Error('No sample photo available');
    const S = 780, M = 56;
    cv.width = S + 2 * M; cv.height = S + 2 * M;
    const ctx = cv.getContext('2d');
    const x = M, y = M;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.26)'; ctx.shadowBlur = 30; ctx.shadowOffsetX = 12; ctx.shadowOffsetY = 22;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, S, S);
    ctx.restore();
    coverDraw(ctx, photo, x, y, S, S);
    const hw = S * 0.03;
    const hg = ctx.createLinearGradient(x, 0, x + hw, 0);
    hg.addColorStop(0, 'rgba(255,255,255,0.55)'); hg.addColorStop(0.45, 'rgba(255,255,255,0.10)');
    hg.addColorStop(0.75, 'rgba(0,0,0,0.12)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg; ctx.fillRect(x, y, hw, S);
    const tg = ctx.createLinearGradient(0, y + S * 0.55, 0, y + S);
    tg.addColorStop(0, 'rgba(0,0,0,0)'); tg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = tg; ctx.fillRect(x, y + S * 0.55, S, S * 0.45);
    const lx = x + S * 0.075;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic ' + Math.round(S * 0.042) + 'px "CooperBT", Georgia, serif';
    ctx.fillText('A Book of Memories', lx, y + S * 0.80);
    ctx.font = Math.round(S * 0.095) + 'px "CooperBT", Georgia, serif';
    ctx.fillText('Our Story', lx, y + S * 0.885);
    ctx.globalAlpha = 0.85;
    ctx.font = Math.round(S * 0.034) + 'px Inter, sans-serif';
    ctx.fillText(String(new Date().getFullYear() + 1), lx, y + S * 0.945);
    ctx.globalAlpha = 1;
  }

  // Draws template + photo into `cv`. Resolves once the template is drawn; if
  // the photo can't load, the template's own baked photo stays visible.
  window.drawProductCardMockup = async function (cv, productId, photoUrl, fallbackUrl) {
    if (productId === 'book-square') return drawSquareBookCard(cv, photoUrl, fallbackUrl);
    if (DRAWN_CARDS[productId]) return drawSimpleCard(cv, DRAWN_CARDS[productId].kind, photoUrl, fallbackUrl);
    const mk = CARD_MOCKUPS[productId];
    if (!mk) throw new Error('No card mockup for ' + productId);
    // Resolve BOTH images before drawing anything, and never show the
    // template's baked sample photo on its own: if the sample can't load,
    // try the local fallback; with neither, reject so the caller shows
    // nothing instead of the template-only shot.
    const tpl = await loadImg(mk.template, true);
    let photo = null;
    try { photo = await loadImg(photoUrl, true); }
    catch (_) { if (fallbackUrl) { try { photo = await loadImg(fallbackUrl, true); } catch (_) {} } }
    if (!photo) throw new Error('No sample photo available');
    const s = Math.min(1, 900 / Math.max(tpl.naturalWidth, tpl.naturalHeight));
    cv.width = Math.round(tpl.naturalWidth * s);
    cv.height = Math.round(tpl.naturalHeight * s);
    const ctx = cv.getContext('2d');
    ctx.drawImage(tpl, 0, 0, cv.width, cv.height);
    const r = { x: mk.rect.x * cv.width, y: mk.rect.y * cv.height, w: mk.rect.w * cv.width, h: mk.rect.h * cv.height };
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    const pa = photo.naturalWidth / photo.naturalHeight, ra = r.w / r.h;
    let dw, dh;
    if (pa > ra) { dh = r.h; dw = dh * pa; } else { dw = r.w; dh = dw / pa; }
    ctx.drawImage(photo, r.x + (r.w - dw) / 2, r.y + (r.h - dh) / 2, dw, dh);
    if (mk.hinge) {
      // Redraw the cover hinge over the photo's left edge: a soft highlight
      // strip fading into a faint crease shadow (mimics the template's own
      // hinge, which the full-width photo just covered).
      const hw = r.w * 0.030;
      const g = ctx.createLinearGradient(r.x, 0, r.x + hw, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.10)');
      g.addColorStop(0.75, 'rgba(0,0,0,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(r.x, r.y, hw, r.h);
    }
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
    // Trim the canvas to the product's bounding box so CSS sizes the product
    // itself, not the empty template padding around it.
    if (mk.crop) {
      const c = { x: Math.round(mk.crop.x * cv.width), y: Math.round(mk.crop.y * cv.height), w: Math.round(mk.crop.w * cv.width), h: Math.round(mk.crop.h * cv.height) };
      const tmp = document.createElement('canvas');
      tmp.width = c.w; tmp.height = c.h;
      tmp.getContext('2d').drawImage(cv, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
      cv.width = c.w; cv.height = c.h;
      cv.getContext('2d').drawImage(tmp, 0, 0);
    }
  };
})();
