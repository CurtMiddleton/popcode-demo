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
            recipient_code, progress_pct, device_id, entry, segment, source } = req.body;
    // Account-level events (signup) belong to a person, not a project, so slug
    // is optional. Everything project-scoped still has to name one.
    // A montage is rendered before the project exists (and may be abandoned),
    // so it is logged against the account rather than a slug.
    // book_demo_click, demo_postcard_download and pay_click_* come from the
    // /nonprofits landing page, exh_book_demo_click from /exhibitions:
    // marketing clicks, before any account or project exists. exh_try_download
    // is /exhibitions' "Try it yourself" handout.
    const ACCOUNT_EVENTS = ['signup', 'create_montage', 'book_demo_click', 'demo_postcard_download',
                            'pay_click_year_end', 'pay_click_gala', 'exh_book_demo_click',
                            'exh_try_download', 'page_view', 'page_engage'];
    if (!event_type) return res.status(400).json({ error: 'Missing fields' });
    if (!slug && !ACCOUNT_EVENTS.includes(event_type)) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    // Marketing-page visits (public/source.js). Crawlers that run JS still
    // get here; drop them rather than count them.
    if ((event_type === 'page_view' || event_type === 'page_engage') &&
        /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit/i.test(req.headers['user-agent'] || '')) {
      return res.status(200).json({ ok: true, skipped: true });
    }

    // No IP address is stored (2026-09-26): the impact dashboard promises orgs
    // that Popcode keeps no donor IPs. Distinct viewers are counted by the
    // anonymous device_id instead. Vercel's geo headers below are derived from
    // the IP at the edge; only the city-level result is kept.

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

    // Impact-dashboard fields (2026-09-26-impact-events.sql). collection_id is
    // looked up here rather than sent by the page: it survives a slug rename,
    // and a viewer can't attribute events to a project it didn't open.
    const extra = { ...coords };
    if (typeof device_id === 'string' && /^[a-z0-9-]{8,64}$/i.test(device_id)) extra.device_id = device_id;
    if (entry === 'custom' || entry === 'popcode') extra.entry = entry;
    if (typeof segment === 'string' && /^[a-z0-9][a-z0-9-]{0,19}$/.test(segment)) extra.segment = segment;
    // How a new account found Popcode (public/source.js), or which page a
    // visitor opened and from where (page_view). Rebuilt from known keys so
    // the page can't store anything else.
    if (['signup', 'page_view', 'book_demo_click', 'exh_book_demo_click', 'exh_try_download',
         'demo_postcard_download'].includes(event_type)) {
      const clean = cleanSource(source);
      if (clean) extra.source = clean;
    }
    // Time on page, scroll and seconds per section (source.js), kept beside
    // the touch so it needs no column of its own.
    if (event_type === 'page_engage') {
      const first = cleanTouch(source && source.first);
      const engage = cleanEngage(source && source.engage);
      if (!first || !engage) return res.status(400).json({ error: 'Missing fields' });
      extra.source = { first, engage };
    }
    if (slug && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { data: col } = await db.from('collections').select('id').eq('slug', slug).maybeSingle();
        if (col) extra.collection_id = col.id;
      } catch (e) { /* the event matters more than the id */ }
    }

    // First outreach-link visit from this browser? Checked before the insert
    // so the row being written doesn't count.
    let firstOutreachVisit = false;
    const t0 = extra.source && extra.source.first;
    if (event_type === 'page_view' && t0 && t0.utm_source === 'email' && extra.device_id) {
      try {
        const { count } = await db.from('scan_events').select('id', { count: 'exact', head: true })
          .eq('event_type', 'page_view').eq('device_id', extra.device_id);
        firstOutreachVisit = !count;
      } catch (e) { /* no alert beats a wrong one */ }
    }

    let { error } = await db.from('scan_events').insert({ ...row, ...extra });
    // Before the migrations that add these columns run, naming one fails the
    // whole insert. Losing a pin or a device id beats losing the event.
    if (error && Object.keys(extra).length &&
        /latitude|longitude|device_id|entry|collection_id|segment|source/.test(error.message || '')) {
      ({ error } = await db.from('scan_events').insert(row));
    }
    if (error) throw error;
    // Awaited: Vercel may freeze the function once the response is sent.
    await leadAlert(db, event_type, { ...row, ...extra }, firstOutreachVisit);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('log-event error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    res.status(500).json({ error: e.message });
  }
}

// { first, last } touches from source.js, each with known keys only and
// strings capped. Returns null if nothing usable came in.
const SOURCE_KEYS = ['referrer', 'landing', 'utm_source', 'utm_medium', 'utm_campaign',
                     'utm_content', 'utm_term', 'via', 'ref', 'click', 'pv'];
// { secs, scroll, sections: { key: secs } } with everything bounded.
function cleanEngage(e) {
  if (!e || typeof e !== 'object') return null;
  const n = (v, max) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0);
  const sections = {};
  if (e.sections && typeof e.sections === 'object') {
    Object.keys(e.sections).slice(0, 30).forEach(k => {
      if (/^[a-z0-9][a-z0-9-]{0,29}$/i.test(k)) sections[k] = n(e.sections[k], 1800);
    });
  }
  const secs = n(e.secs, 1800);
  return secs ? { secs, scroll: n(e.scroll, 100), sections } : null;
}
function cleanTouch(t) {
  if (!t || typeof t !== 'object') return null;
  const out = {};
  for (const k of SOURCE_KEYS) {
    if (typeof t[k] === 'string' && t[k]) out[k] = t[k].slice(0, k === 'referrer' ? 200 : 120);
  }
  if (typeof t.at === 'string' && !Number.isNaN(Date.parse(t.at))) out.at = new Date(t.at).toISOString();
  return Object.keys(out).length ? out : null;
}
function cleanSource(src) {
  if (!src || typeof src !== 'object') return null;
  const first = cleanTouch(src.first);
  const last = cleanTouch(src.last);
  if (!first && !last) return null;
  return { first, last };
}

// ── Lead alerts (2026-10-15) ──────────────────────────────────────────────
// An email to the owner the moment something a person should follow up on
// happens: a sign-up, a Book-a-demo click, a "Try it yourself" download, or
// the first visit from an outreach-email link (utm_source=email). Sent via
// Resend (popcodeapp.com is verified there). Needs RESEND_API_KEY in the
// Vercel env; without it this does nothing. Never throws: an alert must not
// cost the event. Calendly emails actual bookings itself.
const ALERT_TO = process.env.LEAD_ALERT_TO || 'curt@popcodeapp.com';
const PAGE_NAMES = { exh_book_demo_click: '/exhibitions', exh_try_download: '/exhibitions',
                     book_demo_click: '/nonprofits', demo_postcard_download: '/nonprofits' };

function describeTouch(t) {
  if (!t) return 'not recorded';
  const tag = t.utm_source || t.via || t.ref;
  if (tag) return [t.utm_source, t.utm_campaign, t.utm_content].filter(Boolean).join(' / ');
  if (t.referrer) return t.referrer.replace(/^https?:\/\//, '');
  return 'direct / unknown (first page ' + (t.landing || '/') + ')';
}

async function leadAlert(db, type, r, firstOutreachVisit) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const LEADS = ['signup', 'exh_book_demo_click', 'book_demo_click', 'exh_try_download', 'demo_postcard_download'];
  if (!LEADS.includes(type) && !(type === 'page_view' && firstOutreachVisit)) return;
  try {
    // Flood guard: the endpoint is public, so cap alerts at 30 an hour.
    const hourAgo = new Date(Date.now() - 3600e3).toISOString();
    const { count } = await db.from('scan_events').select('id', { count: 'exact', head: true })
      .in('event_type', LEADS).gte('created_at', hourAgo);
    if ((count || 0) > 30) return;

    const place = [r.city, r.region, r.country].filter(Boolean).join(', ') || 'unknown place';
    const touch = r.source && (r.source.last || r.source.first);
    let subject, lines;
    if (type === 'signup') {
      let who = '';
      try {
        const { data } = await db.auth.admin.getUserById(r.user_id);
        const u = data && data.user;
        if (u) who = [u.user_metadata && u.user_metadata.full_name, u.email].filter(Boolean).join(' · ');
      } catch (e) {}
      subject = 'New sign-up' + (who ? ': ' + who : '');
      lines = ['Someone just created a Popcode account.', '', 'Who: ' + (who || 'unknown'),
               'Where: ' + place, 'Found us via: ' + describeTouch(touch)];
    } else if (type === 'page_view') {
      const t = r.source.first;
      subject = 'Outreach link opened: ' + [t.utm_campaign, t.utm_content].filter(Boolean).join(' · ');
      lines = ['Someone opened a link from an outreach email (first visit from this browser).', '',
               'Page: ' + (t.landing || '/'), 'Campaign: ' + describeTouch(t), 'Where: ' + place,
               'Device: ' + (r.device_type || 'unknown'), '',
               'The place comes from their internet connection, so it is approximate, but it often points to the gallery.'];
    } else {
      const what = { exh_book_demo_click: 'clicked Book a demo', book_demo_click: 'clicked Book a demo',
                     exh_try_download: 'downloaded the Try it yourself handout',
                     demo_postcard_download: 'downloaded the demo postcard' }[type];
      subject = 'Lead: someone ' + what + ' on ' + PAGE_NAMES[type];
      lines = ['Someone ' + what + ' on popcode.app' + PAGE_NAMES[type] + '.', '',
               'Where: ' + place, 'Device: ' + (r.device_type || 'unknown'),
               'Came from: ' + describeTouch(touch), '',
               (type.indexOf('book_demo') !== -1
                 ? 'A click is not a booking: Calendly emails you separately if they book.'
                 : 'Worth a follow-up if you can match them to a gallery you emailed.')];
    }
    lines.push('', 'Analytics: https://popcode.app/analytics.html');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: ctl.signal,
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Popcode alerts <info@popcodeapp.com>', to: [ALERT_TO],
                             subject: subject.slice(0, 150), text: lines.join('\n') })
    }).finally(() => clearTimeout(timer));
  } catch (e) {
    console.error('lead alert failed:', e);
  }
}
