#!/usr/bin/env node
// Phase 2 test harness — run the identification logic against the branch
// without deploying anything. Give it a handle and an image (URL or local
// file) and it prints the match.
//
// Usage:
//   TARGET_SUPABASE_URL=https://<branch-ref>.supabase.co \
//   TARGET_SUPABASE_SERVICE_KEY=<branch service_role key> \
//   node scripts/test-identify.mjs --handle Curt --image <url-or-path> [--threshold 0.6]
//
// Embeds with on-device CLIP (transformers.js) — no API token. Requires
// `npm install`; the first run downloads the model weights once.
//
// Tips:
//   * Easiest first test: pass one of the seeded photo URLs (from
//     pop_images.image_url) — it should match its own page at ~1.0 confidence.
//   * A real-world test: a phone photo of the printed page (different angle/light)
//     — confidence will be lower; that's the number Phase 4 tunes the threshold to.

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { embedImageFromUrl, toPgVector } from '../lib/identification/embed.mjs';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function die(m) { console.error('✗ ' + m); process.exit(1); }

const handle = arg('handle');
const image = arg('image');
const threshold = arg('threshold');
if (!handle || !image) die('Required: --handle <handle> --image <url-or-local-path>');

const URL = process.env.TARGET_SUPABASE_URL || process.env.IDENTIFY_SUPABASE_URL;
const KEY = process.env.TARGET_SUPABASE_SERVICE_KEY || process.env.IDENTIFY_SUPABASE_SERVICE_KEY;
if (!URL || !KEY) die('Set TARGET_SUPABASE_URL and TARGET_SUPABASE_SERVICE_KEY (the branch).');

// A local file is turned into a data-URI so transformers.js RawImage can read it.
let imageUrl = image;
if (!/^https?:|^data:/.test(image)) {
  const buf = await readFile(image).catch(() => die(`Cannot read file: ${image}`));
  const ext = (image.split('.').pop() || 'jpg').toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  imageUrl = `data:${mime};base64,${buf.toString('base64')}`;
  console.log(`(loaded local file ${image} as data-URI)`);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });
const topk = Number(arg('topk', '5'));
const thr = threshold != null ? Number(threshold) : 0.60;

// Resolve creator, embed once, then show the RAW top-K candidates with scores
// (bypassing the threshold) so we can see exactly how the real photo ranks.
const { data: creator, error: cErr } = await db
  .from('creators').select('id').ilike('handle', handle).maybeSingle();
if (cErr) die('creator lookup failed: ' + cErr.message);
if (!creator) die(`unknown handle @${handle}`);

console.log(`→ identify(@${handle}) … embedding image`);
const vec = await embedImageFromUrl(imageUrl);

const { data, error } = await db.rpc('identify_match', {
  p_creator_id: creator.id,
  p_embedding: toPgVector(vec),
  p_limit: topk,
});
if (error) die('identify_match RPC failed: ' + error.message);

console.log(`\nTop ${topk} candidates (cosine similarity):`);
for (const r of (data || [])) {
  console.log(`  page ${String(r.target_ref).padStart(3)}   ${(r.confidence * 100).toFixed(1)}%`);
}
const top = (data || [])[0];
if (top && top.confidence >= thr) {
  console.log(`\n✓ MATCH at threshold ${(thr * 100).toFixed(0)}% → page ${top.target_ref} (${(top.confidence * 100).toFixed(1)}%).`);
} else {
  console.log(`\n✗ No match at threshold ${(thr * 100).toFixed(0)}%.` +
    (top ? ` Best was page ${top.target_ref} at ${(top.confidence * 100).toFixed(1)}%.` : ' No candidates.'));
  console.log(`  (Re-run with --threshold 0.5 etc. to see what a lower cutoff would do.)`);
}
