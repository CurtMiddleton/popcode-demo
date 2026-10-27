/* ─────────────────────────────────────────────────────────────────────────
   Camera error screen — "the camera didn't start", with the fix.

   Both viewers used to show their "Experience not found / This link may be
   invalid or expired" screen when MindAR's camera failed. The Popcode had
   loaded fine; the camera hadn't. Someone who once tapped Block on the
   camera prompt gets that screen on every visit (the browser remembers),
   and it sends them looking for a broken link (2026-10-27, a pilot viewer).

   This rewrites #error-screen for the camera case: blocked (NotAllowedError,
   or the Permissions API reports 'denied') gets the steps to allow it on
   this kind of device; anything else gets "close other camera apps". Both
   get a Try again button that reloads.

   Loaded by view.html and scan.html. Exposes
   window.PopcodeCameraError.show(err), where err is the getUserMedia
   rejection if the page kept it (view.html does), or null.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function platform() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
      return /CriOS|FxiOS|EdgiOS/.test(ua) ? 'ios-other' : 'ios-safari';
    }
    if (/Android/.test(ua)) return 'android';
    return 'desktop';
  }

  var STEPS = {
    'ios-safari': 'Tap <b>aA</b> in Safari’s address bar, then <b>Website Settings → Camera → Allow</b>.',
    'ios-other': 'Open the iPhone <b>Settings</b> app, find this browser, and turn on <b>Camera</b>.',
    'android': 'Tap the icon just left of <b>popcode.app</b> in the address bar, then <b>Permissions</b> (or <b>Site settings</b>) <b>→ Camera → Allow</b>.',
    'desktop': 'Click the camera or lock icon in the address bar and allow the camera for this site. Popcode works best on a phone.'
  };

  function injectStyle() {
    if (document.getElementById('popcode-camerr-style')) return;
    var st = document.createElement('style');
    st.id = 'popcode-camerr-style';
    st.textContent =
      '#error-screen .ce-steps{max-width:320px;margin:14px auto 0;font-size:15px;line-height:1.55;color:#ddd}' +
      '#error-screen .ce-steps b{color:#fff}' +
      '#error-screen .ce-retry{margin-top:26px;padding:13px 34px;border:none;border-radius:999px;' +
      "background:#fff;color:#111;font-family:'DM Sans',system-ui,sans-serif;font-size:16px;font-weight:700;cursor:pointer}";
    document.head.appendChild(st);
  }

  function render(blocked) {
    var es = document.getElementById('error-screen');
    if (!es) return;
    injectStyle();
    es.textContent = '';
    var h = document.createElement('h2');
    h.textContent = blocked ? 'Camera access is blocked' : 'The camera didn’t start';
    var p = document.createElement('p');
    p.textContent = blocked
      ? 'Popcode needs your camera to see the photo. To turn it back on:'
      : 'Another app may be using it. Close any app that uses the camera, then try again.';
    es.appendChild(h);
    es.appendChild(p);
    if (blocked) {
      var steps = document.createElement('div');
      steps.className = 'ce-steps';
      steps.innerHTML = STEPS[platform()] + ' Then tap Try again.';
      es.appendChild(steps);
    }
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ce-retry';
    btn.textContent = 'Try again';
    btn.addEventListener('click', function () { location.reload(); });
    es.appendChild(btn);
    document.getElementById('loading') && (document.getElementById('loading').style.display = 'none');
    es.style.display = 'flex';
  }

  function show(err) {
    if (err && err.name === 'NotAllowedError') { render(true); return; }
    var perms = navigator.permissions;
    if (!perms || !perms.query) { render(false); return; }
    perms.query({ name: 'camera' }).then(
      function (st) { render(st.state === 'denied'); },
      function () { render(false); });
  }

  window.PopcodeCameraError = { show: show };
})();
