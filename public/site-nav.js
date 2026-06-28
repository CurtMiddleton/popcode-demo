// site-nav.js — shared slim top navigation bar (Popsa-style).
//
// Drop-in: just add <script src="/site-nav.js"></script> to a page. It injects a
// sticky white nav bar at the top of <body> plus a spacer, so page content isn't
// hidden behind it. Stateless by design (links work signed-in or out; the target
// pages handle their own auth) to stay simple and avoid duplicate auth clients.
(function () {
  if (window.__pcNavLoaded) return;
  window.__pcNavLoaded = true;

  var path = (location.pathname.replace(/\/+$/, '') || '/index.html');
  function isActive(href) {
    var base = href.replace('.html', '');
    if (href === '/index.html') return path === '/index.html' || path === '';
    return path === href || path.indexOf(base) === 0;
  }
  function a(href, label, cls) {
    return '<a href="' + href + '" class="' + (cls || '') + (isActive(href) ? ' pcnav-active' : '') + '">' + label + '</a>';
  }

  var css =
    '.pcnav{position:sticky;top:0;z-index:300;background:rgba(255,255,255,0.92);backdrop-filter:saturate(180%) blur(12px);-webkit-backdrop-filter:saturate(180%) blur(12px);border-bottom:1px solid #eee;}' +
    '.pcnav-inner{max-width:1100px;margin:0 auto;height:64px;display:flex;align-items:center;gap:28px;padding:0 24px;}' +
    '.pcnav-logo{display:flex;align-items:center;flex-shrink:0;}' +
    '.pcnav-logo img{height:26px;display:block;}' +
    '.pcnav-links{display:flex;align-items:center;gap:26px;margin-left:auto;}' +
    '.pcnav-links a{font-family:"Inter",sans-serif;font-size:15px;font-weight:500;color:#333;text-decoration:none;transition:color .15s;}' +
    '.pcnav-links a:hover{color:#7657FC;}' +
    '.pcnav-links a.pcnav-active{color:#7657FC;}' +
    '.pcnav-links a.pcnav-cta{background:#1a1a1a;color:#fff;padding:9px 18px;border-radius:999px;font-weight:600;}' +
    '.pcnav-links a.pcnav-cta:hover{color:#fff;opacity:.9;}' +
    '.pcnav-burger{display:none;margin-left:auto;flex-direction:column;gap:5px;background:none;border:none;cursor:pointer;padding:8px;}' +
    '.pcnav-burger span{width:22px;height:2px;background:#1a1a1a;border-radius:2px;}' +
    '@media (max-width:720px){' +
      '.pcnav-burger{display:flex;}' +
      '.pcnav-links{position:absolute;top:64px;left:0;right:0;flex-direction:column;align-items:stretch;gap:0;background:#fff;border-bottom:1px solid #eee;box-shadow:0 12px 32px rgba(0,0,0,0.08);margin:0;display:none;}' +
      '.pcnav-links.open{display:flex;}' +
      '.pcnav-links a{padding:16px 24px;border-top:1px solid #f2f2f2;font-size:16px;}' +
      '.pcnav-links a.pcnav-cta{background:none;color:#7657FC;border-radius:0;}' +
    '}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var nav = document.createElement('header');
  nav.className = 'pcnav';
  nav.innerHTML =
    '<div class="pcnav-inner">' +
      '<a class="pcnav-logo" href="/index.html"><img src="/assets/Popcode_logo.png" alt="Popcode"></a>' +
      '<button class="pcnav-burger" id="pcnav-burger" aria-label="Menu"><span></span><span></span><span></span></button>' +
      '<nav class="pcnav-links" id="pcnav-links">' +
        a('/shop.html', 'Create &amp; Order') +
        a('/howto.html', 'How it works') +
        a('/manage.html', 'My Projects', 'pcnav-cta') +
      '</nav>' +
    '</div>';

  function mount() {
    document.body.insertBefore(nav, document.body.firstChild);
    var spacer = document.createElement('div');
    document.body.insertBefore(spacer, nav.nextSibling);
    var burger = document.getElementById('pcnav-burger');
    var links = document.getElementById('pcnav-links');
    burger.addEventListener('click', function () { links.classList.toggle('open'); });
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
