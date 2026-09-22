/*
 * referral.js — remember which Popcode someone arrived from.
 *
 * Every printed product is an advert we have already paid for: it sits in
 * someone's house with a URL on it and a "Create your own Popcode" button on
 * the other end, and it keeps working for years. Until now that button was a
 * bare href, so a visitor who scanned a friend's framed print and went on to
 * open an account was indistinguishable from someone who typed the address in.
 * That left the one number that decides whether Popcode grows by itself —
 * do people who meet a Popcode go on to make their own? — unanswerable.
 *
 * view.html appends ?from={slug} to that button. This file picks it up on
 * whichever page they land on, remembers it across the sign-up detour, and
 * logs two events into the same scan_events stream activity.js writes to:
 *
 *   referral_visit    they tapped the button
 *   referral_signup   they went on to create an account
 *
 * Both carry the REFERRING project's slug rather than one of the newcomer's,
 * which is what lets the dashboard join a new account back to the print that
 * produced it. analytics.html gives them their own category so they can't leak
 * into the view counts (a new event type defaulting into 'viewed' has quietly
 * polluted those aggregates before).
 *
 * Fire-and-forget throughout, like activity.js: a referral is worth measuring
 * and never worth failing a sign-up over, so every path swallows its errors
 * and storage is always reached through try/catch (private-mode Safari and
 * blocked site data both throw on access, not just on write).
 */
(function () {
  'use strict';

  var KEY = 'popcode_ref';
  // 30 days. Long enough to cover "saw it at Christmas, ordered in January",
  // short enough that a stale slug can't be credited for an unrelated signup.
  var TTL_MS = 30 * 24 * 60 * 60 * 1000;
  // The same shape vercel.json rewrites to view.html. Validating here keeps
  // anything hand-typed in the query string out of the events table.
  var SLUG_RE = /^[a-z0-9][a-z0-9-]{2,29}$/;

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      if (!v || !SLUG_RE.test(v.slug || '')) return null;
      if (!v.at || Date.now() - v.at > TTL_MS) { clear(); return null; }
      return v.slug;
    } catch (e) { return null; }
  }

  function write(slug) {
    try { localStorage.setItem(KEY, JSON.stringify({ slug: slug, at: Date.now() })); }
    catch (e) { /* private mode — the visit event still lands, only the signup link is lost */ }
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  function log(type, slug, userId) {
    try {
      if (typeof window.logActivity === 'function') {
        window.logActivity(type, { slug: slug, user_id: userId || null });
      }
    } catch (e) {}
  }

  // Capture on load. The first landing after the tap is usually create.html,
  // which bounces signed-out visitors to auth.html — so this has to survive a
  // navigation, which is why it goes to storage rather than a variable.
  try {
    var from = new URLSearchParams(location.search).get('from');
    if (from && SLUG_RE.test(from)) {
      var fresh = read() !== from;
      write(from);
      // One visit per referring project per tab. Without this a reload or the
      // bounce through auth.html would each count as another person.
      var seen = false;
      try {
        seen = sessionStorage.getItem(KEY + ':seen:' + from) === '1';
        sessionStorage.setItem(KEY + ':seen:' + from, '1');
      } catch (e) { seen = !fresh; }
      if (!seen) log('referral_visit', from);
    }
  } catch (e) {}

  window.PopcodeReferral = {
    /** The referring slug, or null. Does not consume it. */
    get: function () { return read(); },

    /**
     * Record that this referral produced an account, and forget it so the same
     * print can't be credited twice from one browser.
     * @param {string} userId  the new account's id
     * @returns {string|null}  the slug that was credited
     */
    claim: function (userId) {
      var slug = read();
      if (slug) { log('referral_signup', slug, userId); clear(); }
      return slug;
    },

    /** Add ?from= to a same-site URL, for hops that outlive storage. */
    decorate: function (url) {
      var slug = read();
      if (!slug) return url;
      return url + (url.indexOf('?') === -1 ? '?' : '&') + 'from=' + encodeURIComponent(slug);
    }
  };
})();
