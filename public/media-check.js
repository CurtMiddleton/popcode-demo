/* "Check what each photo plays" — every photo next to a frame of its video (or
   its audio), shown before an order is paid for, and to admins in Analytics.

   Why: on 2026-10-18 a customer's book (only80yearsyoung) had 5 of 19 photos
   playing another photo's video, after an upload overwrote a shared file. She
   only found out by scanning each page herself. A printed copy can't be
   corrected, so the last moment to catch a mix-up is checkout.

   PopcodeMediaCheck.confirm({ db, lines })  -> Promise<boolean>
     lines: cart-style lines { collectionId, productType, assetUrls, title }.
     Books, calendars and board books show every Popcode in the project; any
     other product shows only the photo(s) its assetUrls name (target_index).
     Resolves true to go on to checkout, false to go back and fix. Nothing to
     show, or anything failing to load, resolves true: this must never be the
     reason a sale can't go through.

   PopcodeMediaCheck.show({ title, items })  -> view only (Analytics).
     items: [{ target_index, photo, video, audio, media, name }].

   Two photos pointing at the same file are flagged ("Same video as photo 3"):
   that is exactly what the 10-18 bug looked like. */
(function () {
  if (window.PopcodeMediaCheck) return;

  var WHOLE_PROJECT = { book: 1, calendar: 1, boardbook: 1 };
  var STYLE_ID = 'pmc-style';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // A storage URL without its ?v= cache-buster: two rows can only share a file
  // if these match.
  function fileOf(url) { return url ? String(url).split(/[?#]/)[0] : ''; }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '.pmc{position:fixed;inset:0;z-index:100000;background:#f6f4f1;display:flex;flex-direction:column;font-family:Inter,system-ui,sans-serif;color:#1a1a1a}' +
      '.pmc-head{padding:18px 20px 12px;border-bottom:1px solid #e6e1da;background:#fff}' +
      '.pmc-head h2{margin:0 0 4px;font-size:20px;font-weight:700}' +
      '.pmc-head p{margin:0;font-size:14px;color:#5f5a52;line-height:1.45}' +
      '.pmc-warn{margin-top:10px;background:#fdeceb;color:#9b1c1c;border-radius:10px;padding:9px 12px;font-size:13px;font-weight:600}' +
      '.pmc-body{flex:1;overflow:auto;padding:16px 16px 24px}' +
      '.pmc-group{margin:0 auto 22px;max-width:980px}' +
      '.pmc-group h3{font-size:14px;font-weight:700;margin:0 0 10px;color:#3a362f}' +
      '.pmc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}' +
      '.pmc-card{background:#fff;border-radius:14px;padding:10px;box-shadow:0 1px 3px rgba(0,0,0,.06)}' +
      '.pmc-card.bad{outline:2px solid #d93025}' +
      '.pmc-label{display:flex;justify-content:space-between;gap:8px;font-size:13px;font-weight:600;margin:0 2px 8px}' +
      '.pmc-label span:last-child{color:#8a857d;font-weight:500}' +
      '.pmc-pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
      '.pmc-box{position:relative;aspect-ratio:1;background:#eee;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center}' +
      '.pmc-box img,.pmc-box video{width:100%;height:100%;object-fit:contain;background:#eee}' +
      '.pmc-cap{position:absolute;left:6px;top:6px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;font-weight:600;padding:2px 7px;border-radius:9px;pointer-events:none}' +
      '.pmc-audio{flex-direction:column;gap:10px;padding:10px;font-size:13px;color:#5f5a52}' +
      '.pmc-audio audio{width:100%}' +
      '.pmc-none{font-size:13px;color:#8a857d}' +
      '.pmc-flag{margin:8px 2px 0;font-size:12px;font-weight:600;color:#b3261e}' +
      '.pmc-foot{display:flex;gap:10px;justify-content:flex-end;padding:12px 16px calc(12px + env(safe-area-inset-bottom));border-top:1px solid #e6e1da;background:#fff}' +
      '.pmc-btn{border:none;border-radius:24px;padding:13px 20px;font:600 15px Inter,system-ui,sans-serif;cursor:pointer}' +
      '.pmc-back{background:#eee;color:#1a1a1a}.pmc-go{background:#1a1a1a;color:#fff}' +
      '@media (max-width:560px){.pmc-grid{grid-template-columns:1fr}.pmc-foot{flex-direction:column-reverse}.pmc-btn{width:100%}}';
    var s = document.createElement('style');
    s.id = STYLE_ID; s.textContent = css;
    document.head.appendChild(s);
  }

  // collection_items -> one item per target_index (older saves left duplicate
  // rows for a page; they point at the same media, so the first one will do).
  function normalize(rows, onlyTargets) {
    var by = {};
    (rows || []).forEach(function (r) {
      var ti = r.target_index;
      if (onlyTargets && onlyTargets.indexOf(ti) < 0) return;
      var hasMedia = !!(r.video_url || r.audio_url);
      if (by[ti] && (by[ti].video || by[ti].audio || !hasMedia)) return;
      by[ti] = {
        target_index: ti,
        photo: r.photo_url || null,
        video: r.video_url || null,
        audio: r.audio_url || null,
        media: r.media_type || (r.audio_url && !r.video_url ? 'audio' : 'video'),
        name: r.asset_name || '',
      };
    });
    return Object.keys(by).map(Number).sort(function (a, b) { return a - b; })
      .map(function (k) { return by[k]; })
      .filter(function (it) { return it.video || it.audio; });
  }

  async function loadGroups(db, lines) {
    var groups = [];
    for (var i = 0; i < (lines || []).length; i++) {
      var l = lines[i];
      if (!l || !l.collectionId) continue;
      var only = null;
      if (!WHOLE_PROJECT[l.productType]) {
        only = (l.assetUrls || []).map(function (a) { return a && a.target_index; })
          .filter(function (t) { return typeof t === 'number'; });
        if (!only.length) continue;
      }
      var res = await db.from('collection_items')
        .select('target_index, media_type, video_url, audio_url, photo_url, asset_name')
        .eq('collection_id', l.collectionId);
      if (res.error) throw res.error;
      var items = normalize(res.data, only);
      if (items.length) groups.push({ title: l.title || '', items: items });
    }
    return groups;
  }

  function mediaBox(it) {
    if (it.media === 'audio' && it.audio) {
      return '<div class="pmc-box pmc-audio"><span>&#127911; Audio</span>' +
        '<audio controls preload="none" data-src="' + esc(it.audio) + '"></audio></div>';
    }
    if (it.video) {
      // #t=1.5 makes browsers (iOS Safari included) paint a frame from 1.5 s
      // in, where the first frame is often black. src is set lazily.
      return '<div class="pmc-box"><video controls playsinline muted preload="metadata" data-src="' +
        esc(it.video.replace(/#.*$/, '') + '#t=1.5') +
        '"></video><span class="pmc-cap">Plays</span></div>';
    }
    return '<div class="pmc-box"><span class="pmc-none">Nothing linked</span></div>';
  }

  function render(groups, opts) {
    injectStyle();
    var dupes = 0;
    var body = groups.map(function (g) {
      var firstUse = {};
      var cards = g.items.map(function (it, n) {
        var label = it.name || ('Photo ' + (opts.byTarget ? it.target_index + 1 : n + 1));
        var f = fileOf(it.media === 'audio' ? it.audio : it.video);
        var flag = '';
        if (f && firstUse[f]) { flag = 'Plays the same ' + (it.media === 'audio' ? 'audio' : 'video') + ' as ' + firstUse[f] + '.'; dupes++; }
        else if (f) firstUse[f] = label;
        return '<div class="pmc-card' + (flag ? ' bad' : '') + '">' +
          '<div class="pmc-label"><span>' + esc(label) + '</span><span>' + (n + 1) + ' of ' + g.items.length + '</span></div>' +
          '<div class="pmc-pair">' +
            '<div class="pmc-box">' + (it.photo ? '<img loading="lazy" alt="" src="' + esc(it.photo) + '">' : '<span class="pmc-none">No photo</span>') +
              '<span class="pmc-cap">Photo</span></div>' +
            mediaBox(it) +
          '</div>' +
          (flag ? '<div class="pmc-flag">' + esc(flag) + '</div>' : '') +
        '</div>';
      }).join('');
      return '<div class="pmc-group">' + (groups.length > 1 || opts.showTitles ? '<h3>' + esc(g.title) + '</h3>' : '') +
        '<div class="pmc-grid">' + cards + '</div></div>';
    }).join('');

    var el = document.createElement('div');
    el.className = 'pmc';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML =
      '<div class="pmc-head"><h2>' + esc(opts.heading) + '</h2><p>' + esc(opts.sub) + '</p>' +
        (dupes ? '<div class="pmc-warn">' + dupes + (dupes === 1 ? ' photo plays' : ' photos play') +
          ' the same thing as another photo. If that isn’t what you meant, go back and fix it before ordering.</div>' : '') +
      '</div>' +
      '<div class="pmc-body">' + body + '</div>' +
      '<div class="pmc-foot">' + opts.buttons + '</div>';
    document.body.appendChild(el);
    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Load media only as it scrolls into view: a 60-page book shouldn't fetch
    // 60 videos' metadata at once.
    var lazy = el.querySelectorAll('[data-src]');
    var setSrc = function (m) { if (!m.getAttribute('src')) m.setAttribute('src', m.getAttribute('data-src')); };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { setSrc(e.target); io.unobserve(e.target); } });
      }, { root: el.querySelector('.pmc-body'), rootMargin: '300px' });
      lazy.forEach(function (m) { io.observe(m); });
    } else {
      lazy.forEach(setSrc);
    }

    return function close() {
      el.querySelectorAll('video,audio').forEach(function (m) { try { m.pause(); } catch (e) {} });
      el.remove();
      document.body.style.overflow = prevOverflow;
    };
  }

  async function confirm(opts) {
    var groups;
    try {
      groups = await loadGroups(opts.db, opts.lines);
    } catch (e) {
      console.warn('media check skipped:', e);
      if (window.Sentry) try { Sentry.captureException(e); } catch (_) {}
      return true;
    }
    if (!groups.length) return true;
    var count = groups.reduce(function (n, g) { return n + g.items.length; }, 0);
    return new Promise(function (resolve) {
      var close = render(groups, {
        heading: 'Check what each photo plays',
        sub: 'When someone scans ' + (count === 1 ? 'this photo' : 'a photo') +
          ' in your print, this is what plays. Tap a video to watch it. Once it’s printed it can’t be changed on paper, so take a quick look.',
        buttons: '<button class="pmc-btn pmc-back" type="button">Go back and fix</button>' +
          '<button class="pmc-btn pmc-go" type="button">Everything’s right, continue</button>',
      });
      var root = document.querySelector('.pmc');
      root.querySelector('.pmc-back').addEventListener('click', function () { close(); resolve(false); });
      root.querySelector('.pmc-go').addEventListener('click', function () { close(); resolve(true); });
    });
  }

  function show(opts) {
    var items = (opts.items || []).filter(function (it) { return it.video || it.audio; });
    var close = render([{ title: opts.title || '', items: items }], {
      heading: opts.title || 'What each photo plays',
      sub: items.length + ' photo' + (items.length === 1 ? '' : 's') + ' with media. Each photo next to what it plays; red means two photos share one file.',
      buttons: '<button class="pmc-btn pmc-go" type="button">Close</button>',
      byTarget: true,
    });
    document.querySelector('.pmc .pmc-go').addEventListener('click', close);
  }

  window.PopcodeMediaCheck = { confirm: confirm, show: show, _normalize: normalize, _loadGroups: loadGroups };
})();
