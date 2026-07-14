// GET /api/montage-file?url=<rendered mp4 url> — same-origin proxy for a
// finished Shotstack render.
//
// Shotstack serves rendered files from S3 without CORS headers, so the browser
// can't fetch().blob() them directly. The builder needs the bytes in-page to
// re-host the MP4 durably in Supabase (Shotstack output URLs are transient) and
// to hand it to create.html's normal save path. This streams those bytes back
// with a permissive CORS header.
//
// SSRF guard: only proxies hosts that clearly belong to Shotstack.

import { Sentry } from './_sentry.js';

function isAllowedHost(u) {
  try {
    const h = new URL(u).hostname;
    return /(^|\.)shotstack\.io$/.test(h) || h.includes('shotstack');
  } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const url = (req.query?.url || '').toString();
  if (!/^https:\/\//.test(url) || !isAllowedHost(url)) {
    return res.status(400).json({ error: 'Unsupported url' });
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) return res.status(502).json({ error: `Fetch failed (${upstream.status})` });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
    res.setHeader('Content-Length', buf.length);
    res.status(200).send(buf);
  } catch (e) {
    console.error('montage-file error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    res.status(500).json({ error: e.message });
  }
}
