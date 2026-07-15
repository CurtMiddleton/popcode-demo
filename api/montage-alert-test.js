// TEMPORARY — GET /api/montage-alert-test
//
// Proves the montage "alert on render failure" wiring end to end: it fires the
// SAME Sentry.captureException + flush path that api/create-montage.js and
// api/montage-status.js use when a render is rejected (out-of-credits) or fails.
// Hit this URL, then confirm the issue appears in Sentry (project popcode-web)
// and that the alert email arrives. Delete this file once verified.
//
// Reports non-secret diagnostics so you can confirm the DSN is actually wired in
// this deployment before trusting the alert. The DSN is public/send-only.

import { Sentry } from './_sentry.js';

function parseDsn(dsn) {
  try {
    const u = new URL(dsn);
    return { host: u.host, projectId: u.pathname.replace(/\//g, '') || null };
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const dsn = process.env.SENTRY_DSN || '';
  const enabled = process.env.NODE_ENV === 'production' && !!dsn;

  let sent = false;
  if (enabled) {
    // Identical mechanism to the real montage failure branches.
    Sentry.captureException(new Error('Montage alert-path test — this is a deliberate test event, safe to resolve.'));
    await Sentry.flush(2000);
    sent = true;
  }

  res.status(200).json({
    ok: true,
    dsnConfigured: !!dsn,
    dsnTarget: dsn ? parseDsn(dsn) : null,   // host + projectId, no secret
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
    enabled,
    sent,
    note: enabled
      ? 'Test event sent — check Sentry Issues (popcode-web) and your alert email.'
      : 'Sentry is disabled here (no DSN or not production) — no event sent.',
  });
}
