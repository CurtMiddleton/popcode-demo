/*
 * activity.js — creator-side activity logging.
 *
 * The analytics dashboard historically only saw *consumption* (scan_events
 * written by view.html), so it could not answer "did this signup ever make
 * anything?". This posts creation-side events into the same stream, which is
 * what lets the Activity Log tell one chronological story per person:
 * signed up -> made a book -> their family watched it.
 *
 * Events land in `scan_events` via /api/log-event. Reusing that table means no
 * migration and free geo/device/session grouping; the table name is now a
 * mild misnomer, which is the trade we chose. Event types are namespaced with
 * a `create_` prefix (plus `signup` and `save_design`) so the dashboard can
 * categorise them without a schema change.
 *
 * Every call is fire-and-forget and swallows its own errors — logging must
 * never be able to break a save the user just waited thirty seconds for.
 */
(function () {
  'use strict';

  function getDeviceInfo() {
    var ua = navigator.userAgent || '';
    var device = /iPad|iPhone|iPod/.test(ua) ? 'iOS' :
                 /Android/.test(ua) ? 'Android' : 'Desktop';
    var browser = /CriOS/.test(ua) ? 'Chrome iOS' :
                  /FxiOS/.test(ua) ? 'Firefox iOS' :
                  /EdgiOS/.test(ua) ? 'Edge iOS' :
                  (/Safari/.test(ua) && /Apple/.test(navigator.vendor)) ? 'Safari' :
                  /Chrome/.test(ua) ? 'Chrome' :
                  /Firefox/.test(ua) ? 'Firefox' : 'Other';
    return { device: device, browser: browser };
  }

  /**
   * @param {string} eventType  e.g. 'create_book', 'signup'
   * @param {object} [opts]
   * @param {string} [opts.slug]     project slug; omitted for account events
   * @param {string} [opts.user_id]  the acting user; callers pass their own
   *                                 session id rather than this file holding a
   *                                 Supabase client, so there is no coupling to
   *                                 how each page builds its client.
   */
  window.logActivity = function (eventType, opts) {
    try {
      opts = opts || {};
      var info = getDeviceInfo();
      // keepalive so the event still lands if the page navigates straight
      // after a save (create.html redirects to the result screen).
      fetch('/api/log-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          slug: opts.slug || null,
          event_type: eventType,
          device_type: info.device,
          browser: info.browser,
          user_agent: navigator.userAgent,
          user_id: opts.user_id || null
        })
      }).catch(function () {});
    } catch (e) { /* never let analytics break the app */ }
  };
})();
