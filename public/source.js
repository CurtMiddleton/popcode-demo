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
 * cookies, nothing sent until the person actually signs up.
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
