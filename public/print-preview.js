/* Print preview: the customer's print file, shown before it is ordered.

   Each product page renders its own print pages (the same code that makes the
   file the lab receives, at screen size) and hands the images here:

   PopcodePrintPreview.open({ intro, sections, mode }) -> Promise<boolean>
     sections: [{ heading, note, html }], html from the helpers below.
     mode: 'cart' (Looks good, add to cart) | 'order' (Looks good, continue)
           | 'view' (Close only). Resolves true to go ahead, false to keep editing.

   PopcodePrintPreview.wrap({ back, front, spineUrl, wMm, hMm, spineMm, safeMm })
     A hardcover laid flat: back | spine | front, with a keep-inside line.
   PopcodePrintPreview.spreads({ pages, wIn, hIn })
     A book as it opens: inside front cover | page 1, 2 | 3, …, last | inside back cover.
   PopcodePrintPreview.list({ items: [{ src, label, safeMm, wMm, hMm }], cols })
     Single pages or products in a grid, each optionally with a keep-inside line.

   Built after the first 12×12" book order (2026-10-18) printed an editor
   placeholder on its cover, a short upside-down spine and a cover photo cropped
   through its own lettering, none of which showed in the editor. */
(function () {
  if (window.PopcodePrintPreview) return;

  var STYLE_ID = 'pp-style';
  var IC_X = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '.pp{position:fixed;inset:0;z-index:9000;background:#f2f0ec;display:flex;flex-direction:column;font-family:Inter,system-ui,sans-serif;color:#1a1a1a}' +
      '.pp-head{display:flex;justify-content:space-between;gap:12px;padding:18px 20px 12px;background:#fff;border-bottom:1px solid #e6e1da}' +
      '.pp-head h2{margin:0 0 4px;font-size:20px}' +
      '.pp-head p{margin:0;font-size:14px;color:#5f5a52;line-height:1.45;max-width:720px}' +
      '.pp-x{background:none;border:none;cursor:pointer;padding:6px;flex:0 0 auto;color:#1a1a1a}' +
      '.pp-body{flex:1;overflow:auto;padding:18px 16px 30px}' +
      '.pp-body>*{max-width:1100px;margin-left:auto;margin-right:auto}' +
      '.pp-body h3{font-size:15px;margin:6px auto 4px}' +
      '.pp-note{font-size:13px;color:#6b665e;margin:0 auto 12px;line-height:1.5}' +
      '.pp-wrap{display:flex;align-items:stretch;margin-bottom:28px;box-shadow:0 4px 18px rgba(0,0,0,.14)}' +
      '.pp-face{position:relative}' +
      '.pp-face img{display:block;width:100%;height:auto}' +
      '.pp-safe{position:absolute;border:1.5px dashed rgba(255,255,255,.9);outline:1px dashed rgba(0,0,0,.45);pointer-events:none}' +
      '.pp-tag{position:absolute;left:6px;top:6px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;font-weight:600;padding:2px 7px;border-radius:9px}' +
      '.pp-spinebox{background:#1a1a1a;display:flex}' +
      '.pp-spinebox img{width:100%;height:100%;object-fit:fill;display:block}' +
      '.pp-spread{margin-bottom:18px}' +
      '.pp-slabel{font-size:12px;color:#8a857d;margin:0 0 5px;min-height:1em}' +
      '.pp-pair{display:flex;width:100%;box-shadow:0 3px 14px rgba(0,0,0,.12);background:#fff}' +
      '.pp-half{flex:1 1 50%;position:relative;overflow:hidden}' +
      '.pp-half+.pp-half{border-left:1px solid #e3ded6}' +
      '.pp-half img{display:block;width:100%;height:100%;object-fit:cover}' +
      '.pp-blankside{background:#fbfaf8;display:flex;align-items:center;justify-content:center;text-align:center;color:#9b968d;font-size:12px}' +
      '.pp-list{display:grid;gap:18px;margin-bottom:24px}' +
      '.pp-item figure{margin:0}' +
      '.pp-item .pp-face{box-shadow:0 3px 14px rgba(0,0,0,.12);background:#fff}' +
      '.pp-item figcaption{font-size:12px;color:#8a857d;margin-top:6px}' +
      '.pp-foot{display:flex;gap:10px;justify-content:flex-end;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #e6e1da}' +
      '.pp-btn{border:none;border-radius:24px;padding:13px 20px;font:600 15px Inter,system-ui,sans-serif;cursor:pointer}' +
      '.pp-back{background:#eee;color:#1a1a1a}.pp-go{background:#1a1a1a;color:#fff}' +
      '@media (max-width:560px){.pp-foot{flex-direction:column-reverse}.pp-btn{width:100%}.pp-list{grid-template-columns:1fr !important}}';
    document.head.appendChild(s);
  }

  function safeBox(safeMm, wMm, hMm) {
    if (!(safeMm > 0 && wMm > 0 && hMm > 0)) return '';
    var x = safeMm / wMm * 100, y = safeMm / hMm * 100;
    return '<div class="pp-safe" style="left:' + x + '%;right:' + x + '%;top:' + y + '%;bottom:' + y + '%"></div>';
  }

  function wrap(o) {
    var total = 2 * o.wMm + o.spineMm;
    var face = function (src, label) {
      return '<div class="pp-face" style="flex:0 0 ' + (o.wMm / total * 100) + '%"><img src="' + src + '" alt="' + esc(label) + '"/>' +
        safeBox(o.safeMm, o.wMm, o.hMm) + '<span class="pp-tag">' + esc(label) + '</span></div>';
    };
    return '<div class="pp-wrap">' + face(o.back, 'Back cover') +
      '<div class="pp-spinebox" style="flex:0 0 ' + (o.spineMm / total * 100) + '%">' + (o.spineUrl ? '<img src="' + o.spineUrl + '" alt="Spine"/>' : '') + '</div>' +
      face(o.front, 'Front cover') + '</div>';
  }

  function spreads(o) {
    var seq = [{ blank: 'Inside front cover' }]
      .concat(o.pages.map(function (src, i) { return { src: src, n: i + 1 }; }), [{ blank: 'Inside back cover' }]);
    var half = function (x) {
      return x.blank
        ? '<div class="pp-half pp-blankside"><span>' + x.blank + '<br><small>left blank</small></span></div>'
        : '<div class="pp-half"><img src="' + x.src + '" alt="Page ' + x.n + '" loading="lazy"/></div>';
    };
    var html = '';
    for (var i = 0; i < seq.length; i += 2) {
      var a = seq[i], b = seq[i + 1] || { blank: 'Inside back cover' };
      var nums = [a, b].filter(function (x) { return !x.blank; }).map(function (x) { return x.n; });
      var label = nums.length === 2 ? 'Pages ' + nums.join('–') : nums.length ? 'Page ' + nums[0] : '';
      html += '<div class="pp-spread"><div class="pp-slabel">' + label + '</div>' +
        '<div class="pp-pair" style="aspect-ratio:' + (2 * o.wIn) + ' / ' + o.hIn + '">' + half(a) + half(b) + '</div></div>';
    }
    return html;
  }

  function list(o) {
    var cols = o.cols || 2;
    return '<div class="pp-list" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr))">' +
      o.items.map(function (it) {
        return '<div class="pp-item"><figure><div class="pp-face"><img src="' + it.src + '" alt="' + esc(it.label || '') + '" loading="lazy"/>' +
          safeBox(it.safeMm, it.wMm, it.hMm) + '</div>' + (it.label ? '<figcaption>' + esc(it.label) + '</figcaption>' : '') + '</figure></div>';
      }).join('') + '</div>';
  }

  function open(o) {
    injectStyle();
    var mode = o.mode || 'view';
    var go = o.goLabel || (mode === 'cart' ? 'Looks good, add to cart' : mode === 'order' ? 'Looks good, continue' : '');
    var el = document.createElement('div');
    el.className = 'pp';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML =
      '<div class="pp-head"><div><h2>' + esc(o.title || 'Print preview') + '</h2><p>' + esc(o.intro || '') + '</p></div>' +
        '<button class="pp-x" aria-label="Close">' + IC_X + '</button></div>' +
      '<div class="pp-body">' + (o.sections || []).map(function (s) {
        return (s.heading ? '<h3>' + esc(s.heading) + '</h3>' : '') + (s.note ? '<p class="pp-note">' + esc(s.note) + '</p>' : '') + s.html;
      }).join('') + '</div>' +
      '<div class="pp-foot">' + (go
        ? '<button class="pp-btn pp-back">Keep editing</button><button class="pp-btn pp-go">' + esc(go) + '</button>'
        : '<button class="pp-btn pp-go">Close</button>') + '</div>';
    document.body.appendChild(el);
    var prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return new Promise(function (resolve) {
      var done = function (v) { el.remove(); document.body.style.overflow = prev; resolve(v); };
      el.querySelector('.pp-x').addEventListener('click', function () { done(false); });
      var back = el.querySelector('.pp-back');
      if (back) back.addEventListener('click', function () { done(false); });
      el.querySelector('.pp-go').addEventListener('click', function () { done(!!go); });
    });
  }

  window.PopcodePrintPreview = { open: open, wrap: wrap, spreads: spreads, list: list };
})();
