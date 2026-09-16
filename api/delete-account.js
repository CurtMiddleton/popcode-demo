import { createClient } from '@supabase/supabase-js';
import { Sentry } from './_sentry.js';

const SUPABASE_URL = 'https://mrwpkhsluzokytpvmwqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd3BraHNsdXpva3l0cHZtd3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTA2MDksImV4cCI6MjA5MTE2NjYwOX0.YMfuRpKvcmfoJ75Gxhf7ekoCaeDfR0Dsz_9Beg5ULAI';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Buckets that hold per-project files, keyed by `{slug}/...`.
const USER_BUCKETS = ['experiences', 'pop-targets'];

const LIST_PAGE = 100;   // Supabase storage list() page size
const REMOVE_BATCH = 100;

/**
 * Recursively list every object under `prefix` in `bucket`.
 *
 * list() is NOT recursive and project files nest one level down
 * (`{slug}/book/`, `{slug}/board/`, `{slug}/calendar/`), so a flat listing
 * silently leaves every book, board-book and calendar photo behind.
 * Supabase marks a folder placeholder with `id === null`; anything else
 * is a real object.
 */
async function listAllPaths(admin, bucket, prefix) {
  const found = [];
  const stack = [prefix];

  while (stack.length) {
    const dir = stack.pop();
    let offset = 0;

    for (;;) {
      const { data, error } = await admin.storage
        .from(bucket)
        .list(dir, { limit: LIST_PAGE, offset });

      if (error) throw new Error(`list ${bucket}/${dir}: ${error.message}`);
      if (!data || data.length === 0) break;

      for (const entry of data) {
        const path = `${dir}/${entry.name}`;
        if (entry.id === null) stack.push(path);
        else found.push(path);
      }

      if (data.length < LIST_PAGE) break;
      offset += data.length;
    }
  }

  return found;
}

/** Delete every object under `{slug}/` across all user buckets. */
async function purgeSlugStorage(admin, slugs) {
  let removed = 0;

  for (const bucket of USER_BUCKETS) {
    const paths = [];
    for (const slug of slugs) {
      paths.push(...(await listAllPaths(admin, bucket, slug)));
    }

    for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
      const batch = paths.slice(i, i + REMOVE_BATCH);
      const { error } = await admin.storage.from(bucket).remove(batch);
      if (error) throw new Error(`remove from ${bucket}: ${error.message}`);
      removed += batch.length;
    }
  }

  return removed;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Service key not configured' });
  }

  try {
    // Verify the user's token
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid token' });

    // Use service role to delete the user and their data
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Read the slugs BEFORE deleting any rows — they are the only map from
    // this account to its files. Delete the rows first and the objects are
    // orphaned in the bucket with no way to trace them back to anyone.
    const { data: cols, error: colsError } = await admin
      .from('collections')
      .select('slug')
      .eq('user_id', user.id);
    if (colsError) throw new Error('Could not list projects: ' + colsError.message);

    const slugs = (cols || []).map(c => c.slug).filter(Boolean);

    // Purge storage first. If this fails we abort WITHOUT deleting the
    // account, so the caller can retry — the slugs are still resolvable.
    // Deleting the account on a failed purge would strand the files forever.
    const filesRemoved = slugs.length ? await purgeSlugStorage(admin, slugs) : 0;

    // Anything still keyed to this user that won't cascade. Both are
    // best-effort: leftover cart state or stale analytics must never block
    // an erasure request, and the content itself is already gone by here.
    const { error: cartError } = await admin
      .from('cart_items').delete().eq('user_id', user.id);
    if (cartError) console.warn('cart_items delete warning:', cartError.message);

    // Analytics: keep the aggregate counts, drop the link to the person.
    const { error: eventsError } = await admin
      .from('scan_events').update({ user_id: null }).eq('user_id', user.id);
    if (eventsError) console.warn('scan_events anonymise warning:', eventsError.message);

    // print_orders is deliberately retained: transaction records are kept
    // under the legal-obligation basis (tax/accounting), and the orders have
    // already been transmitted to the print provider for fulfilment.

    // Delete collections (collection_items cascade via FK)
    const { error: colDeleteError } = await admin
      .from('collections').delete().eq('user_id', user.id);
    if (colDeleteError) throw new Error('Could not delete projects: ' + colDeleteError.message);

    // Delete the auth user (creators/pop_images cascade from auth.users)
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    res.status(200).json({ ok: true, projectsDeleted: slugs.length, filesRemoved });
  } catch (e) {
    console.error('delete-account error:', e);
    Sentry.captureException(e);
    await Sentry.flush(2000);
    res.status(500).json({ error: e.message });
  }
}
