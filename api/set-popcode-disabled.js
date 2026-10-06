// POST /api/set-popcode-disabled — the admin switch that takes a Popcode down.
//
// Disabling sets collections.disabled_at; /api/collection then answers 410 and
// the viewer shows "This Popcode isn't available", so the link and every
// printed copy stop playing. Nothing is deleted: re-enabling clears the column
// and it plays again. Used from Analytics → Content (the project media viewer).
//
// Body: { slug, disabled: true|false, reason? }
// Auth: Authorization: Bearer <supabase token>; caller must be an admin.
// Env: SUPABASE_SERVICE_ROLE_KEY.
// Needs supabase/migrations/2026-10-06-disable-popcode.sql.

import { createClient } from '@supabase/supabase-js';
import { Sentry } from './_sentry.js';

const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd3BraHNsdXpva3l0cHZtd3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA2MDksImV4cCI6MjA5MTE2NjYwOX0.YMfuRpKvcmfoJ75Gxhf7ekoCaeDfR0Dsz_9Beg5ULAI';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAILS = ['curtmid@gmail.com', 'curt@theworkshop.works'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'Backend not configured' });

  try {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid token' });
    if (!ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
      return res.status(403).json({ error: 'Admins only' });
    }

    const { slug, disabled, reason } = req.body || {};
    if (!slug || typeof disabled !== 'boolean') {
      return res.status(400).json({ error: 'Need slug and disabled (true/false)' });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
    const patch = disabled
      ? { disabled_at: new Date().toISOString(), disabled_reason: String(reason || '').slice(0, 500) || null }
      : { disabled_at: null, disabled_reason: null };
    const { data, error } = await admin
      .from('collections')
      .update(patch)
      .eq('slug', String(slug).toLowerCase())
      .select('slug, disabled_at, disabled_reason')
      .maybeSingle();
    if (error) {
      if (error.code === '42703') {
        return res.status(500).json({ error: 'Run supabase/migrations/2026-10-06-disable-popcode.sql first' });
      }
      throw error;
    }
    if (!data) return res.status(404).json({ error: 'Popcode not found' });
    return res.status(200).json(data);
  } catch (e) {
    console.error('set-popcode-disabled error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return res.status(500).json({ error: 'Could not update the Popcode' });
  }
}
