// POST /api/grant-credits — admin-only comp of Popcode credits.
//
// The dashboard button behind the "Ambassadors" idea: hand someone a bank of
// free Popcodes without opening the SQL editor. Writes only the `granted`
// column of popcode_credits, which the credits migration set aside for exactly
// this ("comps and adjustments, by hand") — `purchased` stays the record of
// what was actually paid for, and `from_purchases` what Shop orders credited
// back, so a comp can never be mistaken for revenue.
//
// This has to be a server endpoint rather than a client write: popcode_credits
// grants the client SELECT-your-own-rows only, precisely so that nobody holding
// the public key can grant themselves credits. The service key lives here.
//
// Auth: Authorization: Bearer <supabase token>; caller must be an admin.
//   { userId, amount, note? } -> { ok, email, purchased, granted, from_purchases, allowance }
//
// Env: SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from '@supabase/supabase-js';
import { Sentry } from './_sentry.js';

const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd3BraHNsdXpva3l0cHZtd3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA2MDksImV4cCI6MjA5MTE2NjYwOX0.YMfuRpKvcmfoJ75Gxhf7ekoCaeDfR0Dsz_9Beg5ULAI';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Both addresses, matching is_popcode_admin() in SQL rather than analytics.html's
// single ADMIN_EMAIL: that one only gates who may open the dashboard, this is
// about who the database itself treats as an administrator.
const ADMINS = new Set(['curtmid@gmail.com', 'curt@theworkshop.works']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A comp is a handful of Popcodes, not a blank cheque. Bounded so a slipped
// keystroke can't hand out fifty thousand, and negatives are allowed so a
// mistake can be taken back the same way it was made.
const MAX_DELTA = 1000;
const FREE_ALLOWANCE = 5;   // mirrors popcode_free_allowance() in SQL

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
    const actor = (user.email || '').toLowerCase();
    if (!ADMINS.has(actor)) return res.status(403).json({ error: 'Admins only' });

    const { userId, amount, note } = req.body || {};
    if (!userId || !UUID_RE.test(String(userId))) {
      return res.status(400).json({ error: 'Missing or malformed userId' });
    }
    const delta = Number(amount);
    if (!Number.isInteger(delta) || delta === 0) {
      return res.status(400).json({ error: 'amount must be a non-zero whole number' });
    }
    if (Math.abs(delta) > MAX_DELTA) {
      return res.status(400).json({ error: 'amount must be between -' + MAX_DELTA + ' and ' + MAX_DELTA });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Confirm the account exists before writing. There is a foreign key, so a
    // bad id would fail anyway — but as an opaque constraint error rather than
    // something the dashboard can put in front of a person.
    const { data: target, error: targetErr } = await admin.auth.admin.getUserById(String(userId));
    if (targetErr || !target || !target.user) return res.status(404).json({ error: 'No such account' });
    const targetEmail = target.user.email || null;

    // Compare-and-set rather than read-then-write. Two quick clicks would
    // otherwise both read the same starting balance and the second would
    // overwrite the first, silently losing a grant.
    let row = null;
    for (let attempt = 0; attempt < 4 && !row; attempt++) {
      const { data: existing, error: readErr } = await admin
        .from('popcode_credits')
        .select('user_id, purchased, granted, from_purchases')
        .eq('user_id', userId)
        .maybeSingle();
      if (readErr) throw readErr;

      if (!existing) {
        // No ledger row yet. A conflict here means someone inserted one between
        // the read and the write, so fall through and try the update path.
        const first = Math.max(0, delta);
        const { data: inserted, error: insErr } = await admin
          .from('popcode_credits')
          .insert({ user_id: userId, granted: first })
          .select('user_id, purchased, granted, from_purchases')
          .maybeSingle();
        if (!insErr && inserted) { row = inserted; break; }
        if (insErr && insErr.code !== '23505') throw insErr;   // 23505 = unique violation
        continue;
      }

      // Never let a correction push the balance negative: the quota adds
      // granted to the free five, so a negative would lock the account out of
      // creating anything at all.
      const next = Math.max(0, (existing.granted || 0) + delta);
      const { data: updated, error: updErr } = await admin
        .from('popcode_credits')
        .update({ granted: next, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('granted', existing.granted)          // the compare half
        .select('user_id, purchased, granted, from_purchases')
        .maybeSingle();
      if (updErr) throw updErr;
      if (updated) { row = updated; break; }      // no row back = someone else won, retry
    }
    if (!row) return res.status(409).json({ error: 'Ledger busy, try again' });

    // Audit trail, best-effort. Rides in scan_events like every other
    // account-level event, so the grant shows up in the Activity Log next to
    // what the person went on to make. Never allowed to fail the grant itself —
    // the credits are already committed by this point.
    try {
      await admin.from('scan_events').insert({
        slug: null,
        event_type: 'credits_granted',
        user_id: userId,
        // No geo or device: this is an administrative act, not a visit. The
        // actor and the size of the grant are the useful record.
        user_agent: 'admin:' + actor + ' delta:' + (delta > 0 ? '+' : '') + delta +
                    (note ? ' note:' + String(note).slice(0, 120) : ''),
      });
    } catch (e) {
      Sentry.captureException(e);
    }

    const allowance = FREE_ALLOWANCE + (row.purchased || 0) + (row.granted || 0) + (row.from_purchases || 0);
    await Sentry.flush(2000);
    return res.status(200).json({
      ok: true,
      userId,
      email: targetEmail,
      purchased: row.purchased || 0,
      granted: row.granted || 0,
      from_purchases: row.from_purchases || 0,
      allowance,
    });
  } catch (e) {
    console.error('grant-credits error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return res.status(500).json({ error: e.message });
  }
}
