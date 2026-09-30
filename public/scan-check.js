/* ─────────────────────────────────────────────────────────────────────────
   Scan check — "will the camera be able to recognise this photo?"

   Runs MindAR's own compiler on a single photo, the same way the Generate
   step does (640px max, drawn on white), and reads how many feature points it
   found. That's what scanning actually depends on, so it beats guessing from
   brightness or contrast.

   Thresholds were set on 2026-09-30 by compiling 7 real photos from
   /assets and 16 degraded versions (blurred, darkened, flattened, plain
   gradient, text on white, the logo). At the finest scale:
     real photos    tracking 19–50   matching 145–449
     hard to scan   tracking 0–14    matching 0–157, and every one was
                    under either 12 tracking or 110 matching
   So: warn below 12 tracking points OR below 110 matching points.

   Never blocks anything. If MindAR isn't loaded, the compile throws, or it
   takes over 15s (no WebGL: MindAR fails without ever settling), the
   result is { ok: true, skipped: true } and the creator carries on.

   Needs MINDAR.IMAGE.Compiler on the page (the vendored
   /vendor/mindar/1.2.2/mindar-image-aframe.prod.js, with the AFRAME stub that
   create.html uses). Exposes window.PopcodeScanCheck.check(source), where
   source is a File/Blob, an <img>, or a URL. Resolves to
   { ok, reason: 'dark'|'detail'|null, tracking, matching, ms }.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var MAX_DIM = 640;          // same as create.html's MAX_COMPILE_DIM
  var MIN_TRACKING = 12;
  var MIN_MATCHING = 110;
  var DARK_MEAN = 60;         // 0–255 average brightness
  var TIMEOUT_MS = 15000;

  function loadImage(source) {
    if (source instanceof HTMLImageElement && source.complete && source.naturalWidth) {
      return Promise.resolve(source);
    }
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = (source instanceof Blob) ? URL.createObjectURL(source) : (source && source.src) || source;
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Could not load photo')); };
      img.src = url;
    });
  }

  // Draw onto white at compile size, as create.html does before compiling.
  function prepare(img) {
    var scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    var x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  function meanBrightness(canvas) {
    var s = document.createElement('canvas');
    s.width = 48; s.height = 48;
    var x = s.getContext('2d');
    x.drawImage(canvas, 0, 0, 48, 48);
    var d = x.getImageData(0, 0, 48, 48).data, sum = 0;
    for (var i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return sum / (d.length / 4);
  }

  function canvasToImage(canvas) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = canvas.toDataURL('image/jpeg', 0.92);
    });
  }

  // Let the page paint "Checking…" before the compiler takes the main thread.
  function nextPaint() {
    return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
  }

  async function check(source) {
    var t0 = performance.now();
    try {
      if (!(window.MINDAR && MINDAR.IMAGE && MINDAR.IMAGE.Compiler)) return { ok: true, skipped: true };
      var img = await loadImage(source);
      var canvas = prepare(img);
      var target = await canvasToImage(canvas);
      await nextPaint();
      var compiler = new MINDAR.IMAGE.Compiler();
      // Without WebGL MindAR throws inside its own async code and this promise
      // never settles, which would leave "Checking…" spinning. Give up quietly.
      var data = await Promise.race([
        compiler.compileImageTargets([target], function () {}),
        new Promise(function (_, reject) { setTimeout(function () { reject(new Error('scan check timed out')); }, TIMEOUT_MS); })
      ]);
      var d = data[0];
      var tracking = d.trackingData[0] ? d.trackingData[0].points.length : 0;
      var m = d.matchingData[0];
      var matching = m ? m.maximaPoints.length + m.minimaPoints.length : 0;
      var ok = tracking >= MIN_TRACKING && matching >= MIN_MATCHING;
      var reason = ok ? null : (meanBrightness(canvas) < DARK_MEAN ? 'dark' : 'detail');
      return { ok: ok, reason: reason, tracking: tracking, matching: matching, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      if (window.Sentry) try { Sentry.captureException(e); } catch (_) {}
      return { ok: true, skipped: true, error: String(e && e.message || e) };
    }
  }

  var MESSAGES = {
    dark: 'It’s quite dark, so the camera may not recognise it.',
    detail: 'It doesn’t have much detail for the camera to lock onto. Blurry, plain or faded photos are the usual cause.'
  };

  window.PopcodeScanCheck = { check: check, MESSAGES: MESSAGES };
})();
