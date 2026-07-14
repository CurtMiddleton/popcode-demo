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
    content: ''; position: absolute; left: 0; right: 0; top: 100%; height: 72px; pointer-events: none;
    background: linear-gradient(to bottom, #e6e6e6 0%, rgba(230,230,230,0) 100%);
    -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 16%, #000 84%, transparent 100%);
    mask-image: linear-gradient(to right, transparent 0%, #000 16%, #000 84%, transparent 100%);
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
    .site-header { padding: 0 18px; gap: 14px; }
    .site-header .nav-inline { display: none; }
    .site-header .hamburger { display: flex; }
  }`;
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var items = [
    { href: '/manage.html', label: 'My Popcodes', match: function (p, s) { return p === '/manage.html' && s.indexOf('designs') === -1; } },
    { href: '/manage.html?tab=designs', label: 'My Designs', match: function (p, s) { return p === '/manage.html' && s.indexOf('designs') !== -1; } },
    { href: '/shop.html', label: 'Shop', match: function (p) { return p === '/shop.html' || p === '/order.html'; } },
    { href: '/views.html', label: 'Past Views', match: function (p) { return p === '/views.html'; } },
    { href: '/howto.html', label: 'How It Works', match: function (p) { return p === '/howto.html'; } },
  ];
  var path = location.pathname;
  var search = location.search || '';
  var nav = items.map(function (it) {
    var active = it.match(path, search) ? ' class="active"' : '';
    return '<a href="' + it.href + '"' + active + '>' + it.label + '</a>';
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

  // Fallback hamburger wiring (in case a page doesn't wire #nav-btn itself).
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('nav-btn');
    var overlay = document.getElementById('nav-overlay');
    if (btn && overlay && !btn.__wired) {
      btn.addEventListener('click', function () { overlay.classList.add('open'); });
      var bg = document.getElementById('nav-drawer-bg');
      overlay.addEventListener('click', function (e) { if (e.target === bg) overlay.classList.remove('open'); });
    }
  });
})();
