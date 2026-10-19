// POST /api/enhance-photo — AI-upscale a photo that is too small to print well.
//
// Offered from the shop print preview (order.html) when the chosen photo prints
// under 150 DPI at the chosen size. Runs Real-ESRGAN (nightmareai/real-esrgan,
// face_enhance OFF so faces are not redrawn) on Replicate and stores the result
// in the experiences bucket, so the browser can load it without CORS trouble
// and Replicate's short-lived output URL doesn't matter.
//
// Built after a 960×1280 portrait went out as a 12×16" framed print at ~80 DPI
// (2026-10-19); the same model fixed it by hand.
//
// Body: { url, scale? }   url must be a photo in our public experiences bucket.
//    or { id, url }       poll a prediction a previous call returned as pending.
// 200 { url }             the enhanced PNG (public)
// 202 { pending: id }     still running; call again with { id, url }
// Auth: Authorization: Bearer <supabase token> (any signed-in user).
// Env: REPLICATE_API_TOKEN, SUPABASE_SERVICE_ROLE_KEY.
//
// Cost: about a cent per photo on Replicate. Each source photo is enhanced once;
// later calls for the same url return the stored copy.

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Sentry } from './_sentry.js';

export const config = { maxDuration: 60 };

const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd3BraHNsdXpva3l0cHZtd3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA2MDksImV4cCI6MjA5MTE2NjYwOX0.YMfuRpKvcmfoJ75Gxhf7ekoCaeDfR0Dsz_9Beg5ULAI';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_API = 'https://api.replicate.com/v1';
const MODEL = 'nightmareai/real-esrgan';
const BUCKET = 'experiences';
const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
// Stop waiting in time to answer before the 60 s function limit; the browser
// then polls with the prediction id.
const WAIT_MS = 45000;

let versionId = null;
async function modelVersion() {
  if (versionId) return versionId;
  const r = await fetch(`${REPLICATE_API}/models/${MODEL}`, { headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` } });
  if (!r.ok) throw new Error(`Replicate: could not load ${MODEL} (${r.status})`);
  const j = await r.json();
  if (!j.latest_version?.id) throw new Error(`Replicate: ${MODEL} has no latest_version`);
  versionId = j.latest_version.id;
  return versionId;
}

async function getPrediction(id) {
  const r = await fetch(`${REPLICATE_API}/predictions/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` } });
  if (!r.ok) throw new Error(`Replicate: prediction ${id} (${r.status})`);
  return r.json();
}

// Wait for a prediction until it finishes or the deadline passes.
async function settle(p, deadline) {
  while (!['succeeded', 'failed', 'canceled'].includes(p.status) && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1500));
    p = await getPrediction(p.id);
  }
  return p;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!SUPABASE_SERVICE_KEY || !REPLICATE_TOKEN) return res.status(500).json({ error: 'Backend not configured' });

  try {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Please sign in' });
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Please sign in' });

    const { url, id } = req.body || {};
    // Only our own stored photos: this spends money per call.
    if (typeof url !== 'string' || !url.startsWith(PUBLIC_PREFIX) || url.length > 600) {
      return res.status(400).json({ error: 'Not a Popcode photo' });
    }
    const scale = req.body?.scale === 2 ? 2 : 4;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
    // One stored result per source photo and scale (query string ignored).
    const source = url.split('?')[0];
    const key = crypto.createHash('sha256').update(source + '|' + scale).digest('hex').slice(0, 32);
    const path = `enhanced/${key}.png`;
    const publicUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const head = await fetch(publicUrl, { method: 'HEAD' });
    if (head.ok) return res.status(200).json({ url: publicUrl });

    const deadline = Date.now() + WAIT_MS;
    let p;
    if (id) {
      p = await getPrediction(String(id));
    } else {
      const r = await fetch(`${REPLICATE_API}/predictions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${REPLICATE_TOKEN}`, 'Content-Type': 'application/json', Prefer: 'wait=30' },
        body: JSON.stringify({ version: await modelVersion(), input: { image: source, scale, face_enhance: false } }),
      });
      if (!r.ok) throw new Error(`Replicate: could not start (${r.status}) ${(await r.text()).slice(0, 200)}`);
      p = await r.json();
    }
    p = await settle(p, deadline);
    if (p.status === 'failed' || p.status === 'canceled') throw new Error(`Replicate: ${p.status} ${String(p.error || '').slice(0, 200)}`);
    if (p.status !== 'succeeded') return res.status(202).json({ pending: p.id });

    const out = Array.isArray(p.output) ? p.output[0] : p.output;
    const img = await fetch(out);
    if (!img.ok) throw new Error(`Could not fetch the enhanced image (${img.status})`);
    const buf = Buffer.from(await img.arrayBuffer());
    const up = await admin.storage.from(BUCKET).upload(path, buf, { contentType: 'image/png', upsert: true });
    if (up.error) throw up.error;
    return res.status(200).json({ url: publicUrl });
  } catch (e) {
    console.error('enhance-photo error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return res.status(500).json({ error: 'We couldn’t enhance this photo right now.' });
  }
}
