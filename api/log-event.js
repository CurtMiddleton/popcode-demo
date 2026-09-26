import { createClient } from '@supabase/supabase-js';
import { Sentry } from './_sentry.js';

const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd3BraHNsdXpva3l0cHZtd3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA2MDksImV4cCI6MjA5MTE2NjYwOX0.YMfuRpKvcmfoJ75Gxhf7ekoCaeDfR0Dsz_9Beg5ULAI';

// This runs server-side, so it has no reason to write as anon. Using the
// service key here is what makes it possible to revoke anon INSERT on
// scan_events — without that, anyone holding the public key (i.e. anyone) can
// post arbitrary analytics rows. Falls back to anon so logging degrades rather
// than breaks if the service key is missing from an environment; revoke the
// anon grant only once you've confirmed it's set everywhere.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  // Allow CORS from popcode.app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { slug, event_type, target_index, device_type, browser, user_agent, user_id,
            recipient_code, progress_pct } = req.body;
    // Account-level events (signup) belong to a person, not a project, so slug
    // is optional. Everything project-scoped still has to name one.
    // A montage is rendered before the project exists (and may be abandoned),
    // so it is logged against the account rather than a slug.
    // book_demo_click and demo_postcard_download come from the /nonprofits
    // landing page: marketing clicks, before any account or project exists.
    const ACCOUNT_EVENTS = ['signup', 'create_montage', 'book_demo_click', 'demo_postcard_download'];
    if (!event_type) return res.status(400).json({ error: 'Missing fields' });
    if (!slug && !ACCOUNT_EVENTS.includes(event_type)) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // IP address — use x-forwarded-for (Vercel sets this)
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
               || req.headers['x-real-ip']
               || null;

    // Free geo headers Vercel injects automatically on all deployments
    const country = req.headers['x-vercel-ip-country'] || null;
    const region  = req.headers['x-vercel-ip-country-region'] || null;
    const city    = decodeURIComponent(req.headers['x-vercel-ip-city'] || '') || null;
    // City-level coordinates for the analytics reach map. Only written when
    // Vercel sent them, so local/dev events stay as they were.
    const lat = parseFloat(req.headers['x-vercel-ip-latitude']);
    const lon = parseFloat(req.headers['x-vercel-ip-longitude']);
    const coords = Number.isFinite(lat) && Number.isFinite(lon)
      ? { latitude: lat, longitude: lon } : {};

    const db = createClient(SUPABASE_URL, SUPABASE_KEY);
    const row = {
      slug:         slug         ?? null,
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
      // Personal-link code (?r=) and how far into the media a viewer got.
      // Added only when present, so a plain view writes exactly the columns
      // it always did.
      ...(typeof recipient_code === 'string' && /^[a-z0-9]{6,16}$/.test(recipient_code)
        ? { recipient_code } : {}),
      ...(Number.isFinite(progress_pct)
        ? { progress_pct: Math.max(0, Math.min(100, Math.round(progress_pct))) } : {}),
    };

    let { error } = await db.from('scan_events').insert({ ...row, ...coords });
    // Before 2026-09-26-event-coordinates.sql runs, naming latitude/longitude
    // fails the whole insert. Losing a pin beats losing the event.
    if (error && Object.keys(coords).length && /latitude|longitude/.test(error.message || '')) {
      ({ error } = await db.from('scan_events').insert(row));
    }
    if (error) throw error;
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('log-event error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    res.status(500).json({ error: e.message });
  }
}
