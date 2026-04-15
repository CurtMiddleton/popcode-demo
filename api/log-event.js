import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd3BraHNsdXpva3l0cHZtd3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA2MDksImV4cCI6MjA5MTE2NjYwOX0.YMfuRpKvcmfoJ75Gxhf7ekoCaeDfR0Dsz_9Beg5ULAI';

export default async function handler(req, res) {
  // Allow CORS from popcode.app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { slug, event_type, target_index, device_type, browser, user_agent, user_id } = req.body;
    if (!slug || !event_type) return res.status(400).json({ error: 'Missing fields' });

    // IP address — use x-forwarded-for (Vercel sets this)
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
               || req.headers['x-real-ip']
               || null;

    // Free geo headers Vercel injects automatically on all deployments
    const country = req.headers['x-vercel-ip-country'] || null;
    const region  = req.headers['x-vercel-ip-country-region'] || null;
    const city    = decodeURIComponent(req.headers['x-vercel-ip-city'] || '') || null;

    const db = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { error } = await db.from('scan_events').insert({
      slug,
      event_type,
      target_index: target_index ?? null,
      device_type:  device_type  ?? null,
      browser:      browser      ?? null,
      user_agent:   user_agent   ?? null,
      ip_address:   ip,
      country,
      region,
      city,
      user_id:      user_id      ?? null,
    });

    if (error) throw error;
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('log-event error:', e);
    res.status(500).json({ error: e.message });
  }
}
