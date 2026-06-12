// POST /api/identify  — "which photo is this?" (Phase 2)
//
// Body: { handle, frame }      frame = image URL or data-URI (server embeds it)
//    or { handle, embedding }  embedding = precomputed 768-float vector
//
// 200 { matched:true,  collectionId, mind_file_url, images:[...], confidence, target_ref }
// 200 { matched:false, reason:'low_confidence' | 'unknown_handle' }
//
// Scoped to the creator behind {handle}; never a global search.
//
// Env (point these at the branch while testing, prod at cutover):
//   IDENTIFY_SUPABASE_URL          (falls back to SUPABASE_URL)
//   IDENTIFY_SUPABASE_SERVICE_KEY  (falls back to SUPABASE_SERVICE_ROLE_KEY)
//   REPLICATE_API_TOKEN
//   IDENTIFY_THRESHOLD             (optional; cosine-similarity cutoff)

import { createClient } from '@supabase/supabase-js';
import { identifyByHandle } from '../lib/identification/identify.mjs';

const SUPABASE_URL = process.env.IDENTIFY_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.IDENTIFY_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const THRESHOLD = process.env.IDENTIFY_THRESHOLD ? Number(process.env.IDENTIFY_THRESHOLD) : undefined;

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
    const { handle, frame, embedding } = req.body || {};
    if (!handle || (!frame && !embedding)) {
      return res.status(400).json({ error: 'Missing handle and frame/embedding' });
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const result = await identifyByHandle(
      db,
      handle,
      { imageUrl: frame, embedding },
      { threshold: THRESHOLD, supabaseUrl: SUPABASE_URL },
    );
    return res.status(200).json(result);
  } catch (e) {
    console.error('identify error:', e);
    return res.status(500).json({ error: e.message });
  }
}
