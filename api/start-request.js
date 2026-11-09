import { createClient } from '@supabase/supabase-js';

// "Get started without a call" form on /givingtuesday (2026-11-09).
// Emails the request to the owner through Resend, with Reply-To set to the
// person who filled it in, so answering is one click. Nothing is stored except
// an anonymous `gt_start_submit` row in scan_events (no name or email), so
// Analytics can count submissions.
//
// If Resend isn't configured or the send fails, this returns 503 and the page
// falls back to a prefilled email, so a request is never silently lost.
const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd3BraHNsdXpva3l0cHZtd3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA2MDksImV4cCI6MjA5MTE2NjYwOX0.YMfuRpKvcmfoJ75Gxhf7ekoCaeDfR0Dsz_9Beg5ULAI';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const TO = process.env.LEAD_ALERT_TO || 'curt@popcodeapp.com';

const WANTS = {
  thanks: 'A Giving Tuesday thank-you card',
  appeal: 'A year-end appeal',
  both: 'Both',
  unsure: 'Not sure yet'
};

function clean(v, max) {
  return typeof v === 'string' ? v.replace(/\r/g, '').trim().slice(0, max) : '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const b = req.body || {};

  // Honeypot: a hidden field people never see. Bots fill it; pretend success.
  if (clean(b.website, 200)) return res.status(200).json({ ok: true });

  const name = clean(b.name, 120);
  const org = clean(b.org, 160);
  const email = clean(b.email, 200);
  const phone = clean(b.phone, 40);
  const wants = WANTS[b.wants] || WANTS.unsure;
  const when = clean(b.when, 120);
  const note = clean(b.note, 3000);
  const kit = b.kit === 'year_end' ? 'Year-End Kit ($2,500)' : b.kit === 'giving_tuesday' ? 'Giving Tuesday Kit ($1,250)' : '';
  const ready = !!b.ready;
  const utm = b.utm && typeof b.utm === 'object' ? b.utm : {};

  if (!name || !org || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'missing' });
  }

  const db = createClient(SUPABASE_URL, SUPABASE_KEY);
  // Flood guard: the endpoint is public.
  try {
    const hourAgo = new Date(Date.now() - 3600e3).toISOString();
    const { count } = await db.from('scan_events').select('id', { count: 'exact', head: true })
      .eq('event_type', 'gt_start_submit').gte('created_at', hourAgo);
    if ((count || 0) > 20) return res.status(429).json({ error: 'busy' });
  } catch (e) {}

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(503).json({ error: 'not_configured' });

  const campaign = [utm.utm_source, utm.utm_campaign, utm.utm_content]
    .map(v => clean(v, 60)).filter(Boolean).join(' / ');
  const lines = [
    (ready ? 'Ready to start: ' : 'Wants to talk by email: ') + name + ', ' + org, '',
    'Name: ' + name,
    'Organization: ' + org,
    'Email: ' + email,
    phone ? 'Phone: ' + phone : '',
    'Interested in: ' + wants,
    kit ? 'Kit: ' + kit : '',
    when ? 'Needs it in donors’ hands by: ' + when : '',
    'Ready to start now: ' + (ready ? 'Yes' : 'Not yet, has questions'),
    campaign ? 'Came from: ' + campaign : '',
    '', note ? 'Their message:\n' + note : '(No message)',
    '', 'Reply to this email to answer them directly.'
  ].filter((l, i, a) => l !== '' || (a[i - 1] !== ''));

  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: ctl.signal,
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Popcode <info@popcodeapp.com>', to: [TO], reply_to: email,
        subject: ((ready ? 'Ready to start: ' : 'Question: ') + org + ' (' + name + ')').slice(0, 150),
        text: lines.join('\n')
      })
    }).finally(() => clearTimeout(timer));
    if (!r.ok) throw new Error('resend ' + r.status);
  } catch (e) {
    console.error('start request email failed:', e);
    return res.status(503).json({ error: 'send_failed' });
  }

  try {
    // device_id (anonymous, same one source.js uses) lets Analytics → Website tie the
    // submission to the visit and the outreach link it came from. No name or email stored.
    const device_id = typeof b.device_id === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(b.device_id) ? b.device_id : null;
    await db.from('scan_events').insert({ event_type: 'gt_start_submit', device_id,
      country: req.headers['x-vercel-ip-country'] || null });
  } catch (e) {}

  return res.status(200).json({ ok: true });
}
