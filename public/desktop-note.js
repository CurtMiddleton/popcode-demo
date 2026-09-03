/* ─────────────────────────────────────────────────────────────────────────
   "Open this on your phone" — shown on the viewer's start screen when the
   device can't do the one thing Popcode needs: point a camera at a print.

   Someone who gets a Popcode link will often open it at their desk first.
   Tapping Scan there wakes the laptop's front camera, shows them their own
   face, and never matches anything — which reads as broken rather than as
   "wrong device". This says so before they tap, and hands them the link.

   Loaded by view.html and scan.html. Exposes window.PopcodeDesktopNote.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // Capability, not user-agent. A coarse pointer means a touchscreen, which in
  // practice means a phone or tablet — both of which have a rear camera and
  // work fine. A touchscreen laptop reads as capable and simply doesn't get
  // the note; that's the safe direction to be wrong in, since we'd rather let
  // someone try than block someone who could have scanned.
  // ?desktopnote=1 forces the note on, =0 forces it off — so the note can be
  // looked at on a phone, and skipped on a laptop, without faking a device.
  var forced = /[?&]desktopnote=([01])/.exec(location.search);

  function canScan() {
    if (forced) return forced[1] === '0';
    var hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    var coarse = window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches;
    return hasCamera && coarse;
  }

  var node = null;

  function injectStyle() {
    if (document.getElementById('popcode-desktop-style')) return;
    var st = document.createElement('style');
    st.id = 'popcode-desktop-style';
    st.textContent =
      // Both hosts are white text over something dark — the gradient splash and
      // the scrimmed white-label cover — so one treatment serves both.
      '.popcode-desktop #start-btn,' +
      '.popcode-desktop #wl-cover .wl-scan-btn { display: none !important; }' +
      // The cover's CTA column is sized for a single pill button; the note
      // needs room to set its lines without wrapping into a tower.
      '.popcode-desktop #wl-cover .wl-cta { max-width: 330px; }' +
      // A white-label cover is composed for a portrait phone: a 120px display
      // title plus this panel doesn't fit a laptop window, and the title wins
      // the collision. Cap it here — the cover is already being seen on a
      // device it wasn't laid out for, and the note is the point on that one.
      // The inline font-size applyCoverConfig writes is why this needs the
      // override.
      '.popcode-desktop #wl-cover .wl-title { font-size: 58px !important; }' +
      '.popcode-desktop #wl-cover .wl-subtitle { font-size: 15px !important; }' +
      // The splash pins its Create/Sign-in group to the bottom absolutely,
      // which is fine behind a single button but collides with this panel on a
      // short laptop window. Put it back in flow so the column just stacks,
      // and give the tagline back some of its margin to pay for the height.
      '.popcode-desktop #start-screen #cta-group { position: static; margin-top: 4px; }' +
      '.popcode-desktop #start-screen #tagline { margin-bottom: 30px; }' +
      '.popcode-desktop #start-screen { padding-top: 28px; padding-bottom: 28px; overflow-y: auto; }' +
      '#desktop-note{display:flex;flex-direction:column;align-items:center;gap:10px;' +
      'width:100%;max-width:330px;box-sizing:border-box;margin-bottom:22px;padding:18px;' +
      // Dark rather than light: this sits on the purple splash and on whatever
      // photo a creator picked for their cover, and white text needs the same
      // ground under it either way.
      'border-radius:20px;background:rgba(22,22,32,0.42);border:1px solid rgba(255,255,255,0.18);' +
      '-webkit-backdrop-filter:blur(14px) saturate(1.1);backdrop-filter:blur(14px) saturate(1.1);' +
      "font-family:'DM Sans',system-ui,sans-serif;color:#fff;text-align:center}" +
      '#desktop-note .dn-title{font-size:18px;font-weight:700;line-height:1.25}' +
      '#desktop-note .dn-body{font-size:14px;line-height:1.5;opacity:0.85}' +
      '#desktop-note .dn-url{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;' +
      'background:rgba(255,255,255,0.12);font-size:13px;font-weight:600;word-break:break-all;line-height:1.35}' +
      '#desktop-note .dn-copy{width:100%;padding:12px 16px;border:none;border-radius:999px;' +
      "background:#fff;color:#1a1a1a;font-family:'DM Sans',system-ui,sans-serif;" +
      'font-size:15px;font-weight:700;cursor:pointer}' +
      '#desktop-note .dn-copy:active{transform:scale(0.98)}' +
      '#desktop-note .dn-anyway{background:none;border:none;padding:0;cursor:pointer;' +
      "font-family:'DM Sans',system-ui,sans-serif;font-size:13px;color:rgba(255,255,255,0.75);" +
      'text-decoration:underline}' +
      '#desktop-note .dn-anyway:hover{color:#fff}';
    document.head.appendChild(st);
  }

  function build() {
    if (node) return node;
    injectStyle();
    node = document.createElement('div');
    node.id = 'desktop-note';

    var title = document.createElement('div');
    title.className = 'dn-title';
    title.textContent = 'Open this on your phone';

    var body = document.createElement('div');
    body.className = 'dn-body';
    body.textContent = 'Popcode plays through your phone’s camera — point it at the printed photo and the video or audio starts.';

    var url = document.createElement('div');
    url.className = 'dn-url';
    // Strip the query/hash: what people retype is the short link itself.
    url.textContent = (location.host + location.pathname).replace(/\/$/, '');

    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'dn-copy';
    copy.textContent = 'Copy link';
    copy.addEventListener('click', function () {
      var link = location.origin + location.pathname;
      var done = function () {
        copy.textContent = 'Copied — open it on your phone';
        setTimeout(function () { copy.textContent = 'Copy link'; }, 2600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(done, fallback);
      } else {
        fallback();
      }
      // execCommand is deprecated but still the only path in a few desktop
      // browsers that gate the async clipboard behind a permission prompt.
      function fallback() {
        try {
          var ta = document.createElement('textarea');
          ta.value = link;
          ta.setAttribute('readonly', '');
          ta.style.cssText = 'position:fixed;opacity:0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          done();
        } catch (e) {
          copy.textContent = 'Press ⌘C to copy';
        }
      }
    });

    // Never a dead end: someone who wants to look anyway gets the scanner back.
    var anyway = document.createElement('button');
    anyway.type = 'button';
    anyway.className = 'dn-anyway';
    anyway.textContent = 'Continue on this computer';
    anyway.addEventListener('click', function () {
      document.body.classList.remove('popcode-desktop');
      if (node && node.parentNode) node.parentNode.removeChild(node);
    });

    node.appendChild(title);
    node.appendChild(body);
    node.appendChild(url);
    node.appendChild(copy);
    node.appendChild(anyway);
    return node;
  }

  // Move the note into whichever start screen is showing, taking the hidden
  // scan button's place rather than landing at the bottom of the stack. Moving
  // the node (rather than cloning) means there's only ever one in the document.
  function mount(container) {
    if (!container || canScan()) return;
    document.body.classList.add('popcode-desktop');
    var el = build();
    var slot = container.querySelector('.wl-scan-btn') || container.querySelector('#start-btn');
    if (slot) container.insertBefore(el, slot);
    else container.appendChild(el);
  }

  window.PopcodeDesktopNote = { canScan: canScan, mount: mount };
})();
