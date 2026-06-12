#!/usr/bin/env node
// Phase 1 — creation/ingest pipeline: seed ONE existing collection into the
// new identification index.
//
// What it does, for a collection identified by --slug:
//   1. Reads the collection + its items from a SOURCE project (prod by
//      default — collections/collection_items are anon-readable and the
//      photos are public URLs). READ ONLY.
//   2. Upserts a `creators` row (by unique --handle) in the TARGET project.
//   3. Upserts the `collections` row into TARGET (FK target for pop_images;
//      the branch usually starts with empty data). mind_file_url is preserved,
//      NOT repointed — the new path's .mind lives in the pop-targets bucket.
//   4. Copies the compiled .mind into the pop-targets bucket as {slug}/target.mind.
//   5. Embeds each photo via Replicate (CLIP ViT-B/32) and writes a pop_images row.
//
// SOURCE is read-only; ALL writes go to TARGET (the Supabase branch). No
// production table is mutated.
//
// Usage:
//   TARGET_SUPABASE_URL=https://<branch-ref>.supabase.co \
//   TARGET_SUPABASE_SERVICE_KEY=<branch service_role key> \
//   REPLICATE_API_TOKEN=<token> \
//   node scripts/seed-identification.mjs --slug <slug> --handle <handle> [--display-name "Name"]
//
// Optional env:
//   SOURCE_SUPABASE_URL, SOURCE_SUPABASE_ANON_KEY  (default: prod, from public/config.js)
//   REPLICATE_CLIP_MODEL                            (default: krthr/clip-embeddings)

import { createClient } from '@supabase/supabase-js';
import { embedImageFromUrl, toPgVector } from '../lib/identification/embed.mjs';

const TARGET_BUCKET = 'pop-targets';

// Prod defaults — same public values as public/config.js (anon key is public by design).
const SOURCE_URL = process.env.SOURCE_SUPABASE_URL || 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SOURCE_KEY = process.env.SOURCE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd3BraHNsdXpva3l0cHZtd3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA2MDksImV4cCI6MjA5MTE2NjYwOX0.YMfuRpKvcmfoJ75Gxhf7ekoCaeDfR0Dsz_9Beg5ULAI';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function die(msg) { console.error('✗ ' + msg); process.exit(1); }

const slug = arg('slug');
const handle = arg('handle');
const displayName = arg('display-name');

if (!slug || !handle) die('Required: --slug <slug> --handle <handle>');

const TARGET_URL = process.env.TARGET_SUPABASE_URL;
const TARGET_KEY = process.env.TARGET_SUPABASE_SERVICE_KEY;
if (!TARGET_URL || !TARGET_KEY) {
  die('Set TARGET_SUPABASE_URL and TARGET_SUPABASE_SERVICE_KEY (the BRANCH project URL + its service_role key).');
}
if (!process.env.REPLICATE_API_TOKEN) die('Set REPLICATE_API_TOKEN.');

const source = createClient(SOURCE_URL, SOURCE_KEY);
const target = createClient(TARGET_URL, TARGET_KEY, { auth: { persistSession: false } });

console.log(`→ Seeding "${slug}" as creator @${handle}`);

// 1. Read source collection + items.
const { data: col, error: colErr } = await source
  .from('collections').select('*').eq('slug', slug).single();
if (colErr || !col) {
  die(`Collection "${slug}" not found in source (${colErr?.message || 'no row'}). ` +
      'This pipeline seeds collections-model projects, not legacy experiences.');
}
if (!col.mind_file_url) die('Source collection has no mind_file_url.');

const { data: items, error: itemsErr } = await source
  .from('collection_items').select('*').eq('collection_id', col.id).order('target_index');
if (itemsErr) die('Failed reading collection_items: ' + itemsErr.message);
if (!items || items.length === 0) die('Collection has no items.');
console.log(`  found ${items.length} item(s)`);

// 2. Upsert the creator (by unique handle).
//    user_id is left null: the branch carries prod's SCHEMA but not its
//    auth.users rows, so FK-ing to the prod user id fails in the branch. The
//    identification flow scopes by creator_id/handle, not user_id, so this is
//    inert for testing. At a real prod cutover, set user_id to the auth user.
const { data: creator, error: creatorErr } = await target
  .from('creators')
  .upsert({ user_id: null, handle, display_name: displayName ?? col.name ?? handle },
          { onConflict: 'handle' })
  .select().single();
if (creatorErr) die('Failed upserting creator: ' + creatorErr.message);
console.log(`  creator ${creator.id}`);

// 3. Ensure the collections row exists in TARGET (FK target for pop_images).
//    Preserve id/slug; do NOT repoint mind_file_url (prod's column meaning).
//    user_id null for the same branch/auth.users reason as the creator above.
const { error: colUpsertErr } = await target
  .from('collections')
  .upsert({ id: col.id, slug: col.slug, name: col.name, mind_file_url: col.mind_file_url, user_id: null },
          { onConflict: 'id' });
if (colUpsertErr) die('Failed upserting collection into target: ' + colUpsertErr.message);

// 4. Copy the compiled .mind into the pop-targets bucket.
const mindRes = await fetch(col.mind_file_url);
if (!mindRes.ok) die(`Failed downloading .mind from ${col.mind_file_url} (${mindRes.status})`);
const mindBytes = new Uint8Array(await mindRes.arrayBuffer());
const { error: upErr } = await target.storage.from(TARGET_BUCKET)
  .upload(`${slug}/target.mind`, mindBytes, { contentType: 'application/octet-stream', upsert: true });
if (upErr) die(`Failed uploading .mind to ${TARGET_BUCKET}: ${upErr.message}`);
const mindUrl = target.storage.from(TARGET_BUCKET).getPublicUrl(`${slug}/target.mind`).data.publicUrl;
console.log(`  .mind → ${mindUrl}`);

// 5. Resume by default: skip targets already embedded (this also makes the run
//    restart-safe on the throttled tier and naturally de-dupes repeated
//    target_index rows). Pass --fresh to wipe this collection's rows and rebuild.
const fresh = process.argv.includes('--fresh');
if (fresh) {
  const { error: delErr } = await target.from('pop_images').delete().eq('collection_id', col.id);
  if (delErr) die('Failed clearing existing pop_images: ' + delErr.message);
}
const { data: existing } = await target.from('pop_images')
  .select('target_ref').eq('collection_id', col.id);
const done = new Set((existing || []).map(r => r.target_ref));
if (done.size) console.log(`  resuming — ${done.size} target(s) already indexed`);

// 6. Embed each photo and insert a pop_images row. A single bad/missing photo
//    is skipped, not fatal.
let inserted = 0, skipped = 0, failed = 0;
for (const item of items) {
  const idx = item.target_index;
  const ref = String(idx);
  if (done.has(ref)) { skipped++; continue; }
  if (!item.photo_url) { console.warn(`  ! target ${idx}: no photo_url — skipping`); failed++; continue; }
  process.stdout.write(`  embedding target ${idx}… `);
  let vec;
  try {
    vec = await embedImageFromUrl(item.photo_url);
  } catch (e) {
    console.warn(`skip (embed failed: ${e.message})`);
    failed++;
    continue;
  }
  const { error: insErr } = await target.from('pop_images').upsert({
    collection_id: col.id,
    creator_id: creator.id,
    image_url: item.photo_url,
    video_url: item.video_url ?? null,
    audio_first: true,
    embedding: toPgVector(vec),
    target_ref: ref,
  }, { onConflict: 'collection_id,target_ref' });
  if (insErr) { console.warn(`skip (insert failed: ${insErr.message})`); failed++; continue; }
  done.add(ref);
  inserted++;
  console.log(`ok (${vec.length}d)`);
}

console.log(`✓ Done. ${inserted} new, ${skipped} already present, ${failed} failed — ` +
            `${done.size} unique target(s) for @${handle} / "${slug}".`);
console.log(`  Verify: select count(*) from pop_images where creator_id = '${creator.id}';`);
