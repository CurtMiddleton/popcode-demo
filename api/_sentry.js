// Shared Sentry init for the Vercel serverless functions (errors only).
//
// Mirrors the Bashō config: tracesSampleRate 0, no replay, environment tagged from
// VERCEL_ENV, and reporting only enabled on Vercel (NODE_ENV=production for both
// preview and production builds) — never from local dev. A clean no-op until
// SENTRY_DSN is set in the Vercel env, so this is safe to ship before the DSN exists.
//
// Filename is underscore-prefixed so Vercel treats it as a helper module, not a route.
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production' && !!process.env.SENTRY_DSN,
});

export { Sentry };
