// POST /api/align-transcript — exact word timings for an audio page's
// transcript, from ElevenLabs forced alignment (audio + text → when each word
// is spoken). create.html and edit.html call it when they save an audio page
// with a transcript and store the result in collection_items.transcript_timing.
// The viewer's "Follow along" then lights each word as it is spoken.
//
// Body: { audio_url, transcript }
// Auth: Authorization: Bearer <supabase token> (any signed-in user; it spends
//       ElevenLabs credit, so it is not open to the world).
// Env: ELEVENLABS_API_KEY. Without it this answers 501 and the editors save
//      without timings (the viewer falls back to proportional timing).
// 200 { timing: [[start, end], ...] }  — one pair per word, seconds.

import { createClient } from '@supabase/supabase-js';
import { Sentry } from './_sentry.js';
import { wordTimings } from './_word-timing.js';

const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd3BraHNsdXpva3l0cHZtd3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA2MDksImV4cCI6MjA5MTE2NjYwOX0.YMfuRpKvcmfoJ75Gxhf7ekoCaeDfR0Dsz_9Beg5ULAI';
// Only our own uploads: this fetches the URL server-side.
const AUDIO_PREFIX = SUPABASE_URL + '/storage/v1/object/public/experiences/';
const MAX_AUDIO_BYTES = 30 * 1024 * 1024; // uploads are capped at 25 MB
const MAX_TEXT = 20000;

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  const KEY = process.env.ELEVENLABS_API_KEY;
  if (!KEY) return res.status(501).json({ error: 'not_configured' });

  try {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: userError } = await anon.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid token' });

    const { audio_url, transcript } = req.body || {};
    const text = String(transcript || '');
    if (typeof audio_url !== 'string' || !audio_url.startsWith(AUDIO_PREFIX) || audio_url.includes('..')) {
      return res.status(400).json({ error: 'bad_audio_url' });
    }
    if (!text.trim() || text.length > MAX_TEXT) return res.status(400).json({ error: 'bad_transcript' });

    // The editors replace audio at the same path, so skip any cached copy.
    const audioResp = await fetch(audio_url + (audio_url.includes('?') ? '&' : '?') + 'align=' + Date.now());
    if (!audioResp.ok) return res.status(400).json({ error: 'audio_not_found' });
    const audio = await audioResp.arrayBuffer();
    if (audio.byteLength > MAX_AUDIO_BYTES) return res.status(413).json({ error: 'audio_too_large' });

    const name = audio_url.split('?')[0].split('/').pop() || 'audio';
    const form = new FormData();
    form.append('file', new Blob([audio], { type: audioResp.headers.get('content-type') || 'application/octet-stream' }), name);
    form.append('text', text);
    const el = await fetch('https://api.elevenlabs.io/v1/forced-alignment', {
      method: 'POST', headers: { 'xi-api-key': KEY }, body: form,
    });
    if (!el.ok) {
      const detail = (await el.text()).slice(0, 300);
      Sentry.captureMessage(`forced-alignment ${el.status}: ${detail}`, 'warning');
      return res.status(502).json({ error: 'alignment_failed', status: el.status });
    }
    const timing = wordTimings(text, await el.json());
    if (!timing) return res.status(422).json({ error: 'alignment_mismatch' });
    return res.status(200).json({ timing });
  } catch (err) {
    Sentry.captureException(err);
    return res.status(500).json({ error: 'server_error' });
  }
}
