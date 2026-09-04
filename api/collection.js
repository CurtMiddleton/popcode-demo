// GET /api/collection?slug=my-book  — the public viewer's only data read.
//
// view.html used to query Supabase directly with the anon key, which meant the
// anon role needed SELECT on `collections` and `collection_items`. PostgREST
// can't require a filter, so that also meant anyone could fetch the whole table
// in one unfiltered request: every project, every media URL, every owner id.
//
// Reading through here instead lets the anon policies be removed entirely
// (see supabase/migrations/2026-09-04-lock-content-tables.sql). The response
// carries only what the player needs — deliberately NOT `user_id` (an
// auth.users UUID) or `book_layout` (the full photo manifest for a book,
// including pages that were never popcoded).
//
// 200 { slug, name, kind, mind_file_url, cover_config, items:[...] }
// 404 { error: 'not_found' }
//
// Env: SUPABASE_SERVICE_ROLE_KEY (already set in Production and Preview).

import { createClient } from '@supabase/supabase-js';
import { Sentry } from './_sentry.js';

const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Matches PopcodeSlug's rule in public/slug.js: lowercase alphanumerics with
// interior hyphens. Anything else can't be a real slug, so reject it here
// rather than passing arbitrary input to the database.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Viewer backend not configured' });
  }

  const slug = String(req.query.slug || '').trim().toLowerCase();
  if (!SLUG_RE.test(slug)) return res.status(400).json({ error: 'bad_slug' });

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // `id` is needed to fetch the items but is not part of the response.
    const { data: col, error: colErr } = await db
      .from('collections')
      .select('id, slug, name, kind, mind_file_url, cover_config')
      .eq('slug', slug)
      .maybeSingle();
    if (colErr) throw colErr;

    if (col) {
      const { data: items, error: itemsErr } = await db
        .from('collection_items')
        .select('target_index, media_type, video_url, audio_url, transcript, photo_url')
        .eq('collection_id', col.id)
        .order('target_index');
      if (itemsErr) throw itemsErr;

      // A viewer's cache is cheap to refill and a repointed video should not
      // linger, so keep the CDN window short.
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
      return res.status(200).json({
        slug: col.slug,
        name: col.name,
        kind: col.kind || 'standard',
        mind_file_url: col.mind_file_url,
        cover_config: col.cover_config || null,
        items: items || [],
      });
    }

    // Legacy single-target format. Still live — view.html has always fallen
    // back to it, and slug.js counts its slugs as taken.
    const { data: exp, error: expErr } = await db
      .from('experiences')
      .select('slug, name, mind_file_url, video_url')
      .eq('slug', slug)
      .maybeSingle();
    if (expErr) throw expErr;

    if (exp) {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
      return res.status(200).json({
        slug: exp.slug,
        name: exp.name || null,
        kind: 'legacy',
        mind_file_url: exp.mind_file_url,
        cover_config: null,
        items: [{
          target_index: 0,
          media_type: 'video',
          video_url: exp.video_url,
          audio_url: null,
          transcript: null,
          photo_url: null,
        }],
      });
    }

    return res.status(404).json({ error: 'not_found' });
  } catch (e) {
    console.error('collection error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    return res.status(500).json({ error: 'lookup_failed' });
  }
}
