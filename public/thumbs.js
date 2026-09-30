/* Popcode thumbnails — our own, instead of Supabase's image renderer.

   Card grids (My Popcodes, My Designs, the impact page) used Supabase's
   /render/image transform so a 24 MP phone photo never had to be decoded on a
   phone. That transform is metered per origin image: 100 a month on Pro, and
   2026-09-30 hit 116, after which new thumbnails can be refused.

   Instead, each stored photo gets a small JPEG saved next to it the first time
   a signed-in viewer needs one:

     {slug}/photo_0.jpg  →  {slug}/photo_0.t640-{version}.jpg

   {version} hashes the original's Last-Modified + Content-Length (both
   readable cross-origin; ETag isn't), so a photo replaced at the same path
   gets a new thumbnail rather than a stale one. Two widths: 640 for cards,
   1400 for the product mockups drawn onto canvases.

   PopcodeThumbs.src(url, px, db) → Promise<url to display>. Never rejects:
   anything unexpected resolves to the original URL, which is what the cards
   showed before thumbnails existed. */
(function () {
  var WIDTHS = [640, 1400];
  var MARK = '/storage/v1/object/public/experiences/';
  var QUALITY = 0.85;

  // At most two full-size originals decoding at once — each is ~100 MB of
  // pixels at 24 MP, which is what crashes a phone.
  var queue = [], active = 0, MAX_ACTIVE = 2;
  function limited(task) {
    return new Promise(function (resolve, reject) {
      queue.push({ task: task, resolve: resolve, reject: reject });
      pump();
    });
  }
  function pump() {
    while (active < MAX_ACTIVE && queue.length) {
      var job = queue.shift();
      active++;
      Promise.resolve().then(job.task).then(job.resolve, job.reject).then(function () { active--; pump(); });
    }
  }

  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function loadImg(src, cors) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      if (cors) im.crossOrigin = 'anonymous';
      im.onload = function () { resolve(im); };
      im.onerror = reject;
      im.src = src;
    });
  }
  function version(url) {
    return fetch(url, { method: 'HEAD', cache: 'no-cache' }).then(function (r) {
      if (!r.ok) return null;
      var lm = r.headers.get('last-modified') || '', len = r.headers.get('content-length') || '';
      return (lm || len) ? hash(lm + '|' + len) : null;
    }).catch(function () { return null; });
  }

  var cache = new Map();
  function src(url, px, db) {
    var key = url + '|' + px;
    if (!cache.has(key)) cache.set(key, make(url, px, db).catch(function () { return url; }));
    return cache.get(key);
  }

  async function make(url, px, db) {
    var u;
    try { u = new URL(url, location.href); } catch (e) { return url; }
    var at = u.pathname.indexOf(MARK);
    if (at < 0) return url;                                   // not one of our stored photos
    var path = decodeURIComponent(u.pathname.slice(at + MARK.length));
    if (/\.t\d+-[0-9a-z]+\.jpg$/.test(path)) return url;      // already a thumbnail
    var w = WIDTHS.filter(function (x) { return x >= (px || 0); })[0] || WIDTHS[WIDTHS.length - 1];

    var v = await version(url);
    if (!v) return url;
    var tPath = path.replace(/\.[^./]+$/, '') + '.t' + w + '-' + v + '.jpg';
    var tUrl = u.origin + u.pathname.slice(0, at) + MARK + tPath.split('/').map(encodeURIComponent).join('/');

    try { await loadImg(tUrl, true); return tUrl; } catch (e) { /* not made yet */ }

    return limited(async function () {
      var im = await loadImg(url, true);
      if (!im.naturalWidth || im.naturalWidth <= w * 1.05) return url;   // already small enough
      var h = Math.max(1, Math.round(im.naturalHeight * w / im.naturalWidth));
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(im, 0, 0, w, h);
      im.src = '';
      var blob = await new Promise(function (r) { c.toBlob(r, 'image/jpeg', QUALITY); });
      c.width = c.height = 0;
      if (!blob) return url;
      // Save it for everyone after — only when signed in (storage writes need
      // it); a failed save still shows this viewer the thumbnail.
      if (db && db.storage && db.auth) {
        db.auth.getSession().then(function (res) {
          if (!res || !res.data || !res.data.session) return;
          return db.storage.from('experiences').upload(tPath, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
        }).catch(function () {});
      }
      return URL.createObjectURL(blob);
    });
  }

  window.PopcodeThumbs = { src: src, WIDTHS: WIDTHS };
})();
