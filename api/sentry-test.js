// TEMPORARY Sentry verification route — DELETE once a test event lands in Sentry.
//
//   GET /api/sentry-test          -> JSON diagnostics (no event sent)
//   GET /api/sentry-test?throw=1  -> captures a test exception, then reports diagnostics
//
// Mirrors the Bashō diagnostics route: confirms the server SDK actually initialized,
// the DSN is configured and points at the project you're watching, and which env vars
// Vercel injected (booleans only — never leaks secret values).
import { Sentry } from './_sentry.js';

function parseDsn(dsn) {
  try {
    const u = new URL(dsn);
    return { host: u.host, projectId: u.pathname.replace(/^\//, '') };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const dsn = process.env.SENTRY_DSN || '';
  const client = typeof Sentry.getClient === 'function' ? Sentry.getClient() : null;
  const opts = client ? client.getOptions() : null;

  const diagnostics = {
    sdkInitialized: !!client,
    dsnConfigured: !!dsn,
    enabled: opts ? opts.enabled : false,
    environment: opts ? opts.environment : null,
    dsnTarget: dsn ? parseDsn(dsn) : null,
    envSeen: {
      SENTRY_DSN: !!process.env.SENTRY_DSN,
      SENTRY_ORG: !!process.env.SENTRY_ORG,
      SENTRY_PROJECT: !!process.env.SENTRY_PROJECT,
      SENTRY_AUTH_TOKEN: !!process.env.SENTRY_AUTH_TOKEN,
      VERCEL_ENV: process.env.VERCEL_ENV || null,
    },
  };

  if (req.query && req.query.throw) {
    try {
      throw new Error('Popcode Sentry server test ' + new Date().toISOString());
    } catch (e) {
      Sentry.captureException(e);
      // flushed:true only means the request left the SDK — confirm it in Sentry → Issues.
      diagnostics.flushed = await Sentry.flush(2000);
      diagnostics.captured = true;
    }
  }

  res.status(200).json(diagnostics);
}
