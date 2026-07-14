// GET /api/montage-status?id=<renderId> — poll a Shotstack render.
//
// 200 { status, url, dryRun }
//   status: 'queued' | 'rendering' | 'done' | 'failed'
//   url:    the rendered MP4 (only when status === 'done', real mode)
//
// Dry-run ids (prefixed DRYRUN-) resolve straight to a "done" preview state with
// no url — the builder shows a "preview mode" banner instead of a real video.
//
// Env: SHOTSTACK_API_KEY, SHOTSTACK_BASE_URL.

import { Sentry } from './_sentry.js';

const SHOTSTACK_BASE_URL = (process.env.SHOTSTACK_BASE_URL || 'https://api.shotstack.io/edit/stage').trim().replace(/\/+$/, '');
const SHOTSTACK_API_KEY = (process.env.SHOTSTACK_API_KEY || '').trim();

// Map Shotstack's render lifecycle to the three states the UI cares about.
function mapStatus(s) {
  if (s === 'done') return 'done';
  if (s === 'failed') return 'failed';
  if (s === 'queued') return 'queued';
  return 'rendering'; // fetching | rendering | saving
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const id = (req.query?.id || '').toString();
  if (!id) return res.status(400).json({ error: 'Missing id' });

  if (id.startsWith('DRYRUN-')) {
    return res.status(200).json({ status: 'done', url: null, dryRun: true });
  }

  if (!SHOTSTACK_API_KEY) return res.status(500).json({ error: 'Montage renderer not configured' });

  try {
    const resp = await fetch(`${SHOTSTACK_BASE_URL}/render/${encodeURIComponent(id)}`, {
      headers: { 'x-api-key': SHOTSTACK_API_KEY },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.response) {
      return res.status(502).json({ error: data?.message || `Status check failed (${resp.status})` });
    }
    const status = mapStatus(data.response.status);
    res.status(200).json({ status, url: status === 'done' ? (data.response.url || null) : null, dryRun: false });
  } catch (e) {
    console.error('montage-status error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    res.status(500).json({ error: e.message });
  }
}
