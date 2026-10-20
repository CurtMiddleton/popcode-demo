/*
 * source.js — remember how someone first found Popcode.
 *
 * referral.js answers one narrow version of this question (they tapped
 * "Create your own" on someone's Popcode). Everyone else arrived as a blank:
 * a sign-up from Kazakhstan was indistinguishable from one who typed the
 * address in. This file records, per browser, the outside page that sent
 * them (document.referrer), any campaign tags on the link (utm_*, ?via=,
 * ?ref=) and the page they landed on. auth.html sends it with the `signup`
 * event, so the dashboard can say "Google", "instagram.com", "a Popcode"…
 *
 * Two touches are kept:
 *   first  the very first visit this browser made (never overwritten)
 *   last   the most recent visit that came from somewhere (an outside
 *          referrer or a tagged link). Plain reloads and clicks between our
 *          own pages don't count, so they can't wipe it.
 *
 * Privacy: only the referrer's origin + path are kept — never its query
 * string, which for webmail and search can carry personal text. No IP, no
 * cookies. The stored touches are sent only with the signup; marketing pages
 * also log an anonymous page_view (see logPageView below).
 *
 * Storage is always reached through try/catch (private-mode Safari and
 * blocked site data throw on access). Loaded directly by the pages people
 * land on without nav.js (view, nonprofits, exhibitions) and injected by
 * nav.js everywhere else; the guard below makes a double load harmless.
 */
(function () {
  'use strict';
  if (window.PopcodeSource) return;

  var KEY = 'popcode_src';
  // Long enough for "saw it in October, made a book for Christmas".
  var TTL_MS = 180 * 24 * 60 * 60 * 1000;
  var TAGS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'via', 'ref'];

  function clip(s, n) { return String(s).slice(0, n); }

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!v || !v.first || !v.first.at) return null;
      if (Date.now() - v.first.at > TTL_MS) { localStorage.removeItem(KEY); return null; }
      return v;
    } catch (e) { return null; }
  }

  function write(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
  }

  // An outside referrer as origin + path, or null for none / our own pages.
  function externalReferrer() {
    try {
      if (!document.referrer) return null;
      var r = new URL(document.referrer);
      if (r.hostname === location.hostname) return null;
      if (/(^|\.)popcode\.app$|(^|\.)popcodeapp\.com$/.test(r.hostname)) return null;
      if (r.protocol !== 'http:' && r.protocol !== 'https:') return null;
      return clip(r.origin + (r.pathname === '/' ? '' : r.pathname), 200);
    } catch (e) { return null; }
  }

  function touchFromThisPage() {
    var t = { at: Date.now(), landing: clip(location.pathname, 120) };
    var ref = externalReferrer();
    if (ref) t.referrer = ref;
    try {
      var q = new URLSearchParams(location.search);
      TAGS.forEach(function (k) {
        var val = q.get(k);
        if (val) t[k] = clip(val, 100);
      });
      // Ad click ids: only whether one was there, never the id itself.
      if (q.get('gclid')) t.click = 'google_ads';
      else if (q.get('fbclid')) t.click = 'facebook';
    } catch (e) {}
    return t;
  }

  function cameFromSomewhere(t) {
    if (t.referrer || t.click) return true;
    for (var i = 0; i < TAGS.length; i++) if (t[TAGS[i]]) return true;
    return false;
  }

  try {
    var now = touchFromThisPage();
    var stored = read();
    if (!stored) write({ first: now, last: cameFromSomewhere(now) ? now : null });
    else if (cameFromSomewhere(now)) { stored.last = now; write(stored); }
  } catch (e) {}

  // ── Page views (2026-10-15) ──────────────────────────────────────────────
  // The marketing pages log one `page_view` each load, so the dashboard's
  // Website panel can count visits nobody acted on (an outreach email opened,
  // /exhibitions read, no demo booked). Same touch shape as above, sent as
  // `source.first`; the random pc_device id (shared with view.html) counts
  // visitors. No cookies, no IP stored. Skipped for bots, prerenders, and
  // browsers the admin has used (analytics.html sets popcode_owner).
  var PAGES = ['/', '/pricing', '/exhibitions', '/nonprofits', '/nonprofits/thanks',
               '/nonprofits-thanks', '/howto', '/shop', '/book', '/boardbook',
               '/calendar', '/privacy', '/terms', '/photo-book-that-plays-videos',
               '/popcode-vs-artivive', '/popcode-vs-qr-codes', '/audio-tour-without-an-app',
               '/printed-appeal-with-video'];
  function pagePath() {
    var path = location.pathname.replace(/\.html$/, '').replace(/^\/index$/, '/') || '/';
    if (path.length > 1) path = path.replace(/\/$/, '');
    return path;
  }
  function trackable() {
    if (PAGES.indexOf(pagePath()) === -1) return false;
    if (navigator.webdriver) return false;
    if (/bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|pingdom|uptime/i.test(navigator.userAgent)) return false;
    try { if (localStorage.getItem('popcode_owner')) return false; } catch (e) {}
    return true;
  }
  function deviceId() {
    var d = null;
    try { d = localStorage.getItem('pc_device'); } catch (e) {}
    if (!d) {
      d = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      try { localStorage.setItem('pc_device', d); } catch (e) {}
    }
    return d;
  }
  // One id per page load, shared by its page_view and page_engage rows.
  var PV = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function logPageView() {
    try {
      if (!trackable()) return;
      var path = pagePath();
      if (sessionStorage.getItem('pc_pv:' + path + location.search)) return; // a reload isn't a visit
      try { sessionStorage.setItem('pc_pv:' + path + location.search, '1'); } catch (e) {}
      var d = deviceId();
      var t = touchFromThisPage();
      t.landing = path;
      t.pv = PV;
      t.at = new Date(t.at).toISOString();
      var mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      fetch('/api/log-event', {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'page_view', device_id: d,
          device_type: mobile ? 'mobile' : 'desktop', source: { first: t, last: null } })
      }).catch(function () {});
    } catch (e) {}
  }
  // ── Engagement (2026-10-15) ──────────────────────────────────────────────
  // Seconds the page was visible, deepest scroll, and seconds per <section>
  // (the one under the middle of the screen gets each visible second). Sent
  // as a page_engage row whenever the tab is hidden or closed, cumulative, so
  // the dashboard keeps the largest per page load (pv).
  function sectionKey(sec, i, all) {
    if (sec.id) return sec.id.slice(0, 30);
    if (/(^|\s|-)hero(\s|$)/.test(sec.className) || /-hero\b/.test(sec.className)) return 'hero';
    var lb = (sec.getAttribute('aria-labelledby') || '').split(/\s+/)[0];
    if (lb) return lb.replace(/-h$/, '').slice(0, 30);
    return i === all.length - 1 ? 'end' : 's' + i;
  }
  function trackEngagement() {
    if (!trackable()) return;
    var secs = 0, scroll = 0, per = {}, sentSecs = -1;
    function tick() {
      if (document.visibilityState !== 'visible' || secs >= 1800) return;
      secs++;
      var all = document.querySelectorAll('section');
      var mid = window.innerHeight / 2;
      for (var i = 0; i < all.length; i++) {
        var r = all[i].getBoundingClientRect();
        if (r.height > 0 && r.top <= mid && r.bottom > mid) {
          var k = sectionKey(all[i], i, all);
          per[k] = (per[k] || 0) + 1;
          break;
        }
      }
      measure();
    }
    function measure() {
      var h = Math.max(document.documentElement.scrollHeight, 1);
      var pct = Math.round(Math.min(1, (window.scrollY + window.innerHeight) / h) * 100);
      if (pct > scroll) scroll = pct;
    }
    function send() {
      if (secs < 1 || secs === sentSecs) return;
      sentSecs = secs;
      var body = JSON.stringify({ event_type: 'page_engage', device_id: deviceId(),
        source: { first: { landing: pagePath(), pv: PV }, engage: { secs: secs, scroll: scroll, sections: per } } });
      try {
        if (navigator.sendBeacon && navigator.sendBeacon('/api/log-event', new Blob([body], { type: 'application/json' }))) return;
      } catch (e) {}
      fetch('/api/log-event', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: body }).catch(function () {});
    }
    setInterval(tick, 1000);
    window.addEventListener('scroll', measure, { passive: true });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') send(); });
    window.addEventListener('pagehide', send);
  }
  try { trackEngagement(); } catch (e) {}

  if (document.visibilityState === 'prerender') {
    document.addEventListener('visibilitychange', function once() {
      if (document.visibilityState === 'prerender') return;
      document.removeEventListener('visibilitychange', once);
      logPageView();
    });
  } else {
    logPageView();
  }

  window.PopcodeSource = {
    /**
     * What to send with the signup event: { first, last } with timestamps as
     * ISO strings, or null when storage is unavailable.
     */
    get: function () {
      var v = read();
      if (!v) return null;
      function iso(t) {
        if (!t) return null;
        var o = {};
        for (var k in t) if (Object.prototype.hasOwnProperty.call(t, k)) o[k] = t[k];
        o.at = new Date(t.at).toISOString();
        return o;
      }
      return { first: iso(v.first), last: iso(v.last) };
    }
  };
})();
