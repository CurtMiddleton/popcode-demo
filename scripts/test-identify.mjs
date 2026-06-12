#!/usr/bin/env node
// Phase 2 test harness — run the identification logic against the branch
// without deploying anything. Give it a handle and an image (URL or local
// file) and it prints the match.
//
// Usage:
//   TARGET_SUPABASE_URL=https://<branch-ref>.supabase.co \
//   TARGET_SUPABASE_SERVICE_KEY=<branch service_role key> \
//   REPLICATE_API_TOKEN=<token> \
//   node scripts/test-identify.mjs --handle Curt --image <url-or-path> [--threshold 0.6]
//
// Tips:
//   * Easiest first test: pass one of the seeded photo URLs (from
//     pop_images.image_url) — it should match its own page at ~1.0 confidence.
//   * A real-world test: a phone photo of the printed page (different angle/light)
//     — confidence will be lower; that's the number Phase 4 tunes the threshold to.

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { identifyByHandle } from '../lib/identification/identify.mjs';

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
if (!process.env.REPLICATE_API_TOKEN) die('Set REPLICATE_API_TOKEN.');

// A local file is turned into a data-URI so Replicate can read it.
let imageUrl = image;
if (!/^https?:|^data:/.test(image)) {
  const buf = await readFile(image).catch(() => die(`Cannot read file: ${image}`));
  const ext = (image.split('.').pop() || 'jpg').toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  imageUrl = `data:${mime};base64,${buf.toString('base64')}`;
  console.log(`(loaded local file ${image} as data-URI)`);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });

console.log(`→ identify(@${handle}) …`);
const result = await identifyByHandle(db, handle, { imageUrl }, {
  threshold: threshold != null ? Number(threshold) : undefined,
  supabaseUrl: URL,
});

console.log(JSON.stringify(result, null, 2));
if (result.matched) {
  console.log(`\n✓ Matched page ${result.target_ref} at ${(result.confidence * 100).toFixed(1)}% confidence.`);
  console.log(`  collection ${result.collectionId}`);
  console.log(`  .mind  ${result.mind_file_url}`);
  console.log(`  ${result.images.length} image(s) in this collection.`);
} else {
  console.log(`\n✗ No match (${result.reason}).`);
}
