// Sentry browser error monitoring — errors only.
//
// Mirrors the Bashō setup, adapted for Popcode's no-build static site:
//   - errors only: no performance tracing, no Session Replay (conserves free-tier quota)
//   - never reports from local dev (only Vercel preview + production)
//   - tags events production | preview | development
//
// The DSN is public-safe (same as the Supabase anon key already in config.js). A static
// site has no build step to inject NEXT_PUBLIC_* env vars into the page, so it lives here.
// The Sentry SDK is loaded just before this file from the CDN bundle in each page's <head>.
(function () {
  if (typeof window === 'undefined' || !window.Sentry) return;

  // Public DSN for the Popcode Inc. Sentry project.
  var SENTRY_DSN = '__SENTRY_DSN__'; // TODO: replace with the real Popcode browser DSN

  // No-op until a real DSN is filled in (placeholder still contains "__").
  if (!SENTRY_DSN || SENTRY_DSN.indexOf('__') !== -1) return;

  var host = window.location.hostname;
  var isLocal =
    host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '';
  var isPreview = /\.vercel\.app$/.test(host);
  var environment = isLocal ? 'development' : isPreview ? 'preview' : 'production';

  window.Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0, // errors only — no performance tracing
    environment: environment, // production | preview | development
    enabled: !isLocal, // never report from local dev (preview + prod do)
  });
})();
