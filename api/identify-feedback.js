// POST /api/identify-feedback  — Phase 4 agreement signal.
//
// After /api/identify picks a page, scan.html lets MindAR track the photo the
// user actually points at. The first targetFound tells us which page MindAR
// locked — the ground truth for that scan. We record it against the identify
// event and set `agreed` (did the new identify guess the same page MindAR
// tracked?). This is the real-world accuracy signal that tunes the threshold,
// without touching prod view.html or needing labeled data.
//
// Body: { event_id, tracked_target_ref }
//
// Env (same as /api/identify): IDENTIFY_SUPABASE_URL / IDENTIFY_SUPABASE_SERVICE_KEY
// (fall back to SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).

import { createClient } from '@supabase/supabase-js';
import { Sentry } from './_sentry.js';

const SUPABASE_URL = process.env.IDENTIFY_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.IDENTIFY_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Identification backend not configured' });
  }

  try {
    const { event_id, tracked_target_ref } = req.body || {};
    if (!event_id || tracked_target_ref == null) {
      return res.status(400).json({ error: 'Missing event_id or tracked_target_ref' });
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: row } = await db
      .from('identify_events').select('matched_target_ref').eq('id', event_id).maybeSingle();
    const tracked = String(tracked_target_ref);
    const agreed = row && row.matched_target_ref != null
      ? String(row.matched_target_ref) === tracked
      : null;

    await db.from('identify_events')
      .update({ tracked_target_ref: tracked, agreed })
      .eq('id', event_id);

    return res.status(200).json({ ok: true, agreed });
  } catch (e) {
    console.error('identify-feedback error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return res.status(500).json({ error: e.message });
  }
}
