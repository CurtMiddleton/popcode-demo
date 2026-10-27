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

  // Capability first: a coarse pointer means a touchscreen, which usually
  // means a phone or tablet with a rear camera. But plenty of Windows laptops
  // have touchscreens too, and they passed as phones: on 2026-10-27 a viewer
  // on one tapped Scan, met a camera prompt, and gave up. So a desktop
  // operating system rules a device out even with touch. iPadOS reports itself
  // as a Mac, so a "Mac" with multi-touch is an iPad and can scan. The
  // "Continue on this computer" link stays for anyone who knows better.
  // ?desktopnote=1 forces the note on, =0 forces it off — so the note can be
  // looked at on a phone, and skipped on a laptop, without faking a device.
  var forced = /[?&]desktopnote=([01])/.exec(location.search);

  function canScan() {
    if (forced) return forced[1] === '0';
    var hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    var coarse = window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches;
    return hasCamera && coarse && !desktopOS();
  }

  function desktopOS() {
    var uad = navigator.userAgentData;
    if (uad && typeof uad.mobile === 'boolean' && uad.platform) {
      if (uad.mobile) return false;
      if (/Windows|macOS|Linux|Chrome OS/i.test(uad.platform)) return !isIpad();
    }
    var ua = navigator.userAgent || '';
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return false;
    return /Windows NT|Macintosh|CrOS|X11/.test(ua) && !isIpad();
  }
  function isIpad() {
    return /Macintosh/.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1;
  }

  // A code to scan with the phone is quicker than copying a link across
  // devices. The generator is vendored (see docs/vendor/qrcode-generator) and
  // only loaded here, on a computer; if it fails, the link and Copy button
  // are still there.
  var QR_SRC = '/vendor/qrcode-generator/1.4.4/qrcode.js';
  function drawQr(box, link) {
    var paint = function () {
      try {
        var qr = window.qrcode(0, 'M');
        qr.addData(link);
        qr.make();
        box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
        box.style.display = 'block';
      } catch (e) {}
    };
    if (window.qrcode) { paint(); return; }
    var sc = document.createElement('script');
    sc.src = QR_SRC;
    sc.onload = paint;
    document.head.appendChild(sc);
  }

  // The link to hand to the phone: this page without its #hash.
  function phoneLink() { return location.origin + location.pathname + location.search; }

  var node = null;

  function injectStyle() {
    if (document.getElementById('popcode-desktop-style')) return;
    var st = document.createElement('style');
    st.id = 'popcode-desktop-style';
    st.textContent =
      // Both hosts are white text over something dark — the gradient splash and
      // the scrimmed white-label cover — so one treatment serves both.
      // #start-tap is view.html's disc + caption group; #start-btn on its own
      // is scan.html, which still has a bare button.
      '.popcode-desktop #start-tap,' +
      '.popcode-desktop #start-btn,' +
      // .wl-scan-wrap is view.html's disc + caption group; the bare button is
      // scan.html, which still has the older markup. Both, so retargeting one
      // can't leave the other's control showing next to this note.
      '.popcode-desktop #wl-cover .wl-scan-wrap,' +
      '.popcode-desktop #wl-cover .wl-scan-btn { display: none !important; }' +
      // The splash logo is absolutely positioned against the vertical centre,
      // which is fine above a small disc but puts it straight behind this
      // panel. Put it back in flow so the note sits under it, as a caption to
      // the mark rather than on top of it.
      '.popcode-desktop #start-screen img.splash-logo {' +
      '  position: static; margin: 0 0 30px; }' +
      // The Popcode's name hangs off the vertical centre too, so it would sit
      // on top of the panel. Back in flow, under the wordmark, where it reads
      // as what this link is.
      '.popcode-desktop #start-screen #start-name {' +
      '  position: static; transform: none; margin: 0 0 24px; }' +
      '.popcode-desktop #start-screen.has-name img.splash-logo { margin-bottom: 16px; }' +
      // The cover's CTA column is sized for a single pill button; the note
      // needs room to set its lines without wrapping into a tower.
      '.popcode-desktop #wl-cover .wl-cta { max-width: 330px; }' +
      // The cover pins its title at a fixed height and pushes the CTA to the
      // bottom, which on a phone keeps them apart. On a short laptop window
      // the panel (now with a code to scan) grows up into the title. Stack
      // logo, title and panel in one centred column instead, scrolling if the
      // window is shorter still. The auto-margin spacers centre it without
      // clipping the top the way justify-content: center does on overflow.
      '.popcode-desktop #wl-cover .wl-content { justify-content: flex-start; gap: 22px;' +
      '  overflow-y: auto; padding-top: 28px; padding-bottom: 28px; }' +
      '.popcode-desktop #wl-cover .wl-content::before,' +
      '.popcode-desktop #wl-cover .wl-content::after { content: ""; margin: auto 0; }' +
      '.popcode-desktop #wl-cover .wl-text { position: static; padding: 0; }' +
      '.popcode-desktop #wl-cover .wl-org-logo { position: static; transform: none; }' +
      '.popcode-desktop #wl-cover .wl-cta { margin-top: 0; }' +
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
      // short laptop window. Put it back in flow so the column just stacks.
      '.popcode-desktop #start-screen #cta-group { position: static; margin-top: 4px; }' +
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
      '#desktop-note .dn-qr{display:none;width:124px;height:124px;padding:7px;box-sizing:border-box;' +
      'border-radius:14px;background:#fff}' +
      '#desktop-note .dn-qr svg{display:block;width:100%;height:100%}' +
      '#desktop-note .dn-or{font-size:12px;opacity:0.7;margin-top:2px}' +
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
    body.textContent = 'Scan this code with your phone’s camera, then point your phone at the photo.';

    var qrBox = document.createElement('div');
    qrBox.className = 'dn-qr';
    qrBox.setAttribute('role', 'img');
    qrBox.setAttribute('aria-label', 'Code that opens this page on your phone');
    drawQr(qrBox, phoneLink());

    var or = document.createElement('div');
    or.className = 'dn-or';
    or.textContent = 'or open this link on your phone';

    var url = document.createElement('div');
    url.className = 'dn-url';
    // The short link people would retype. The query stays when there is one:
    // ?id= is the Popcode itself on view.html links, and ?r= is who it was sent to.
    url.textContent = phoneLink().replace(/^https?:\/\//, '').replace(/\/$/, '');

    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'dn-copy';
    copy.textContent = 'Copy link';
    copy.addEventListener('click', function () {
      var link = phoneLink();
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
    node.appendChild(qrBox);
    node.appendChild(body);
    node.appendChild(or);
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
    var slot = container.querySelector('.wl-scan-btn') ||
               container.querySelector('#start-tap') ||
               container.querySelector('#start-btn');
    // The slot can sit inside a wrapper (the splash groups its disc with the
    // "Tap to scan" caption), and insertBefore throws on a node that isn't a
    // direct child — which would take the rest of the start-up path with it,
    // including the tap handler. Climb to whichever ancestor is the child.
    while (slot && slot.parentNode && slot.parentNode !== container) slot = slot.parentNode;
    if (slot && slot.parentNode === container) container.insertBefore(el, slot);
    else container.appendChild(el);
  }

  window.PopcodeDesktopNote = { canScan: canScan, mount: mount };
})();
