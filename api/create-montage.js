// POST /api/create-montage — kick off a Shotstack render of a photo montage.
//
// Body: {
//   images:  [{ url }],            // ordered, public URLs (Supabase experiences bucket)
//   perImageSeconds?: number,      // default 3
//   transition?: 'kenburns'|'fade',
//   musicUrl?: string|null,        // public URL of a bundled track, or null
//   aspect?: 'portrait'|'landscape'|'square'
// }
// 200 { renderId, dryRun }
//
// Env: SHOTSTACK_API_KEY, SHOTSTACK_BASE_URL (default the stage/sandbox host),
//      MONTAGE_DRY_RUN ('true' forces mock mode even if a key is set).
//
// Dry-run (no key, or MONTAGE_DRY_RUN=true) returns a fake render id so the whole
// builder UI + upload + polling flow can be exercised on a preview deploy before
// the paid key is live. It never calls Shotstack and never produces a real MP4.

import { Sentry } from './_sentry.js';

const SHOTSTACK_BASE_URL = (process.env.SHOTSTACK_BASE_URL || 'https://api.shotstack.io/edit/stage').trim().replace(/\/+$/, '');
const SHOTSTACK_API_KEY = (process.env.SHOTSTACK_API_KEY || '').trim();
const DRY_RUN = process.env.MONTAGE_DRY_RUN === 'true' || !SHOTSTACK_API_KEY;

const MAX_IMAGES = 40;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { images, perImageSeconds, transition, musicUrl, aspect } = req.body || {};
    if (!Array.isArray(images) || images.length < 2) {
      return res.status(400).json({ error: 'A montage needs at least 2 photos.' });
    }
    if (images.length > MAX_IMAGES) {
      return res.status(400).json({ error: `A montage can have at most ${MAX_IMAGES} photos.` });
    }
    for (const img of images) {
      if (!img || typeof img.url !== 'string' || !/^https:\/\//.test(img.url)) {
        return res.status(400).json({ error: 'Each photo must have a public https URL.' });
      }
    }

    // A soundtrack Shotstack can't fetch fails the WHOLE render. Verify the music
    // URL first and drop it (render silent) rather than hard-failing — e.g. when a
    // track's file hasn't been uploaded to /assets/music yet.
    let finalMusic = typeof musicUrl === 'string' && musicUrl ? musicUrl : null;
    let musicSkipped = false;
    if (finalMusic) {
      try {
        const head = await fetch(finalMusic, { method: 'HEAD' });
        if (!head.ok) { finalMusic = null; musicSkipped = true; }
      } catch { finalMusic = null; musicSkipped = true; }
    }

    const { buildShotstackEdit } = await import('../lib/montage/timeline.mjs');
    const { edit } = buildShotstackEdit({
      images,
      perImageSeconds,
      transition: transition === 'fade' ? 'fade' : 'kenburns',
      musicUrl: finalMusic,
      aspect: ['portrait', 'landscape', 'square'].includes(aspect) ? aspect : 'portrait',
    });

    if (DRY_RUN) {
      // Mock render id — montage-status resolves it to a "preview" done state.
      const renderId = 'DRYRUN-' + Math.random().toString(36).slice(2, 12);
      return res.status(200).json({ renderId, dryRun: true, musicSkipped });
    }

    const resp = await fetch(`${SHOTSTACK_BASE_URL}/render`, {
      method: 'POST',
      headers: { 'x-api-key': SHOTSTACK_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(edit),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.response?.id) {
      const msg = data?.message || `Shotstack render failed (${resp.status})`;
      // Alert the team — this is where an out-of-credits / rejected render surfaces
      // (Shotstack refuses the render request). Best-effort; never blocks the reply.
      Sentry.captureException(new Error('Shotstack render rejected: ' + msg));
      await Sentry.flush(2000);
      return res.status(502).json({ error: msg });
    }
    res.status(200).json({ renderId: data.response.id, dryRun: false, musicSkipped });
  } catch (e) {
    console.error('create-montage error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    res.status(500).json({ error: e.message });
  }
}
