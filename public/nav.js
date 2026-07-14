/* Shared Popcode top nav — white sticky/frosted bar with the gradient logo,
   gray inline nav (black on hover), and cart + profile icons. Injects itself at
   the top of <body> and reuses the page's existing #nav-overlay drawer for
   mobile. Include with <script src="/nav.js"></script> right after <body> so it
   renders before the page's own inline scripts run.

   It provides #nav-btn (hamburger) and hidden #user-greeting / #logout-btn so
   each page's existing nav/logout JS keeps working unchanged. Sign-out lives on
   the Account page (profile icon). */
(function () {
  if (window.__popcodeNavInjected) return;
  window.__popcodeNavInjected = true;

  var css = `
  .site-header {
    position: sticky; top: 0; z-index: 50; width: 100vw;
    background: #ffffff;
    padding: 0 28px; height: 100px; min-height: 0; display: flex; align-items: center; justify-content: flex-start; gap: 0;
    margin: 0; align-self: stretch;
  }
  /* Soft gray shelf that starts just below the 100px white nav and fades down +
     out to white at the left/right, defining the nav edge from the content. */
  .site-header::after {
    content: ''; position: absolute; left: 0; right: 0; top: 100%; height: 66px; pointer-events: none;
    background: linear-gradient(to bottom, #eef0f1 0%, rgba(238,240,241,0) 100%);
    -webkit-mask-image: linear-gradient(to right, transparent 0%, transparent 9%, #000 18%, #000 82%, transparent 91%, transparent 100%);
    mask-image: linear-gradient(to right, transparent 0%, transparent 9%, #000 18%, #000 82%, transparent 91%, transparent 100%);
  }
  .site-header .brand { display: flex; align-items: center; flex-shrink: 0; margin-left: 52px; }
  .site-header .brand img { height: 32px; display: block; }
  .site-header .nav-inline { display: flex; align-items: center; gap: 6px; margin-left: 170px; }
  .site-header .nav-inline a {
    color: #8a8a8a; text-decoration: none; font-family: 'Inter', sans-serif;
    font-size: 14px; font-weight: 600; padding: 8px 12px; border-radius: 8px;
    white-space: nowrap; transition: color 0.15s;
  }
  .site-header .nav-inline a:hover, .site-header .nav-inline a.active { color: #1a1a1a; }
  .site-header .header-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }
  .site-header .hicon {
    position: relative; display: flex; align-items: center; justify-content: center;
    width: 42px; height: 42px; border-radius: 50%; background: none; border: none;
    cursor: pointer; text-decoration: none; color: #1a1a1a; transition: background 0.15s;
  }
  .site-header .hicon:hover { background: #f3f2ef; }
  .site-header .hicon.profile-btn { background: #f0eeea; }
  .site-header .hicon.profile-btn:hover { background: #e7e4dd; }
  .site-header .hamburger { display: none; }
  @media (max-width: 1040px) { .site-header .nav-inline { margin-left: 40px; } }
  @media (max-width: 760px) {
    /* Mobile: just the logo (pinned left) and the hamburger — cart + profile
       move into the full-screen drawer. */
    .site-header { padding: 0 16px; gap: 0; }
    .site-header .brand { margin-left: 0; }
    .site-header .nav-inline { display: none; }
    .site-header .cart-btn, .site-header .profile-btn { display: none; }
    .site-header .hamburger { display: flex; margin-left: auto; }
  }

  /* ── Full-screen mobile drawer (Popsa-style) ──────────────────────
     Overrides each page's small dropdown drawer (this stylesheet is appended
     last, so it wins). White full-bleed sheet: logo top-left + X, big nav list,
     and account/cart/log-out pinned to the bottom. */
  #nav-overlay { position: fixed; inset: 0; z-index: 200; display: none; }
  #nav-overlay.open { display: block; }
  #nav-overlay #nav-drawer-bg { display: none; }
  #nav-overlay #nav-drawer {
    position: absolute; inset: 0; width: 100%; max-width: none; height: 100%;
    background: #ffffff; border-radius: 0; box-shadow: none; padding: 0;
    opacity: 1; transform: none;
    display: flex; flex-direction: column; overflow-y: auto;
    animation: navDrawerFade 0.16s ease;
  }
  @keyframes navDrawerFade { from { opacity: 0; } to { opacity: 1; } }
  .nav-drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 22px 16px 10px; }
  .nav-drawer-head .brand img { height: 30px; display: block; }
  .nav-drawer-close { background: none; border: none; cursor: pointer; padding: 8px; color: #1a1a1a; line-height: 0; border-radius: 8px; }
  .nav-drawer-close:hover { background: #f3f2ef; }
  #nav-overlay #nav-drawer .nav-link {
    display: flex; align-items: center; gap: 16px; padding: 15px 22px;
    font-size: 22px; font-weight: 600; color: #1a1a1a; text-decoration: none;
    font-family: 'Inter', sans-serif; background: none; border: none; width: 100%;
    text-align: left; cursor: pointer;
  }
  #nav-overlay #nav-drawer .nav-link:hover { background: #f6f6f6; }
  #nav-overlay #nav-drawer .nav-link svg { flex-shrink: 0; color: #555; width: 22px; height: 22px; }
  #nav-overlay #nav-drawer .nav-link.external { color: #666; font-size: 15px; }
  #nav-overlay #nav-drawer .nav-divider { height: 1px; background: #ececec; margin: 10px 22px; }
  .nav-drawer-bottom { margin-top: auto; padding-bottom: 20px; }
  .nav-drawer-bottom .nav-cart-count {
    margin-left: auto; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px;
    background: #ff3b6b; color: #fff; font-size: 12px; font-weight: 700;
    display: none; align-items: center; justify-content: center; line-height: 1;
  }
  .nav-drawer-bottom .nav-logout { color: #c92a2a; }
  .nav-drawer-bottom .nav-logout svg { color: #c92a2a; }`;
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var items = [
    { href: '/manage.html', label: 'My Popcodes', nav: 'popcodes', match: function (p, s) { return p === '/manage.html' && s.indexOf('designs') === -1; } },
    { href: '/manage.html?tab=designs', label: 'My Designs', nav: 'designs', match: function (p, s) { return p === '/manage.html' && s.indexOf('designs') !== -1; } },
    { href: '/shop.html', label: 'Shop', nav: 'shop', match: function (p) { return p === '/shop.html' || p === '/order.html'; } },
    { href: '/views.html', label: 'Past Views', match: function (p) { return p === '/views.html'; } },
    { href: '/howto.html', label: 'How It Works', match: function (p) { return p === '/howto.html'; } },
  ];
  var path = location.pathname;
  var search = location.search || '';
  var nav = items.map(function (it) {
    // data-nav lets manage.html's client-side tab switch highlight the active link.
    var dn = it.nav ? ' data-nav="' + it.nav + '"' : '';
    var active = it.match(path, search) ? ' class="active"' : '';
    return '<a href="' + it.href + '"' + dn + active + '>' + it.label + '</a>';
  }).join('');

  var header =
    '<header class="site-header">' +
      '<a href="/manage.html" class="brand"><img src="/assets/Popcode_logo.png" alt="Popcode"/></a>' +
      '<nav class="nav-inline">' + nav + '</nav>' +
      '<div class="header-right">' +
        '<a class="hicon cart-btn" href="/shop.html" title="Cart" aria-label="Cart"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></a>' +
        '<a class="hicon profile-btn" href="/account.html" title="My Account" aria-label="My Account"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></a>' +
        '<button id="nav-btn" class="hicon hamburger" aria-label="Menu"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>' +
        // Hidden — kept so existing per-page greeting/logout JS never errors.
        '<span id="user-greeting" style="display:none"></span>' +
        '<button id="logout-btn" style="display:none" aria-hidden="true"></button>' +
      '</div>' +
    '</header>';

  if (document.body) document.body.insertAdjacentHTML('afterbegin', header);

  var IC_CART = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
  var IC_LOGOUT = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
  var IC_CLOSE = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  function signOut() {
    try {
      if (window.supabase && typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_KEY !== 'undefined') {
        var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        db.auth.signOut().finally(function () { location.href = '/auth.html'; });
        return;
      }
    } catch (e) {}
    location.href = '/auth.html';
  }

  // Turn each page's small dropdown drawer into a Popsa-style full-screen sheet:
  // add a logo + close header, and pin account / cart / log-out to the bottom.
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('nav-btn');
    var overlay = document.getElementById('nav-overlay');
    var drawer = document.getElementById('nav-drawer');
    function close() { if (overlay) overlay.classList.remove('open'); }

    if (btn && overlay && !btn.__wired) {
      btn.__wired = true;
      btn.addEventListener('click', function () { overlay.classList.add('open'); });
      overlay.addEventListener('click', function (e) {
        if (e.target === document.getElementById('nav-drawer-bg')) close();
      });
    }

    if (drawer && !drawer.__enhanced) {
      drawer.__enhanced = true;
      // Header: logo (same top-left spot as the closed nav) + close button.
      var head = document.createElement('div');
      head.className = 'nav-drawer-head';
      head.innerHTML = '<a href="/manage.html" class="brand"><img src="/assets/Popcode_logo.png" alt="Popcode"/></a>' +
        '<button class="nav-drawer-close" type="button" aria-label="Close menu">' + IC_CLOSE + '</button>';
      drawer.insertBefore(head, drawer.firstChild);
      head.querySelector('.nav-drawer-close').addEventListener('click', close);

      // Bottom-pinned account cluster: My Account (moved from the list) + Cart +
      // Log Out, plus the external site link. These replace the cart/profile
      // icons hidden from the mobile bar.
      var bottom = document.createElement('div');
      bottom.className = 'nav-drawer-bottom';
      bottom.appendChild(document.createElement('div')).className = 'nav-divider';
      var account = drawer.querySelector('.nav-link[href="/account.html"]');
      if (account) bottom.appendChild(account);
      var cart = document.createElement('a');
      cart.className = 'nav-link'; cart.href = '/shop.html';
      cart.innerHTML = IC_CART + 'Cart<span class="nav-cart-count" id="nav-cart-count">0</span>';
      bottom.appendChild(cart);
      var logout = document.createElement('button');
      logout.type = 'button'; logout.className = 'nav-link nav-logout';
      logout.innerHTML = IC_LOGOUT + 'Log Out';
      logout.addEventListener('click', signOut);
      bottom.appendChild(logout);
      var external = drawer.querySelector('.nav-link.external');
      if (external) bottom.appendChild(external);
      // Drop the now-orphaned divider that used to precede the external link.
      var strayDivider = drawer.querySelector(':scope > .nav-divider');
      if (strayDivider) strayDivider.remove();
      drawer.appendChild(bottom);

      // Close the sheet whenever a link inside it is tapped.
      drawer.addEventListener('click', function (e) {
        if (e.target.closest('a.nav-link')) close();
      });
    }
  });
})();
