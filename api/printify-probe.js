// TEMPORARY read-only Printify discovery probe. Delete after we've captured the
// board-book IDs (Phase 0 spike for docs/board-book-printify-plan.md).
//
// GET /api/printify-probe?k=popcode
// Reads PRINTIFY_API_TOKEN (Vercel env) and returns, in one shot:
//   - the account's shops (id, title, sales_channel)
//   - the board-book blueprint (id 2727, or found by title) + its print providers
//   - the variants for the first provider (so we can pick the 6×6 + page options)
//   - the artwork placeholders (px dimensions per print area) for the artwork spec
// No writes, no orders — catalog + shops only. Light ?k guard so a leaked preview
// URL isn't trivially enumerable.

const BASE = 'https://api.printify.com/v1';

async function pf(path, token) {
  const resp = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const text = await resp.text().catch(() => '');
  let json = null; try { json = JSON.parse(text); } catch (_) {}
  return { ok: resp.ok, status: resp.status, json, raw: json ? null : text.slice(0, 300) };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if ((req.query.k || '') !== 'popcode') return res.status(403).json({ error: 'nope' });

  const token = (process.env.PRINTIFY_API_TOKEN || '').trim();
  if (!token) return res.status(200).json({ configured: false, note: 'PRINTIFY_API_TOKEN not visible to this deployment (set it, then redeploy / push).' });

  const out = { configured: true };
  try {
    // 1. Shops
    const shops = await pf('/shops.json', token);
    out.shops = shops.ok ? shops.json : { error: shops.status, body: shops.raw };

    // 2. Board-book blueprint. Try the known product-page id 2727 first; if that's
    //    not a board book, search the catalog by title.
    let blueprintId = 2727;
    let bp = await pf(`/catalog/blueprints/${blueprintId}.json`, token);
    const looksLikeBoard = bp.ok && /board\s*book/i.test(bp.json?.title || '');
    if (!looksLikeBoard) {
      const all = await pf('/catalog/blueprints.json', token);
      const match = (all.ok ? all.json : []).find((b) => /board\s*book/i.test(b.title || ''));
      if (match) { blueprintId = match.id; bp = await pf(`/catalog/blueprints/${blueprintId}.json`, token); }
      out.blueprintSearch = match ? { found: match.id, title: match.title } : { found: null, note: '2727 was not a board book and none matched "board book" by title' };
    }
    out.blueprint = bp.ok ? { id: blueprintId, title: bp.json?.title, brand: bp.json?.brand, model: bp.json?.model } : { error: bp.status, body: bp.raw };

    // 3. Print providers for the board book
    const provs = await pf(`/catalog/blueprints/${blueprintId}/print_providers.json`, token);
    out.printProviders = provs.ok ? provs.json : { error: provs.status, body: provs.raw };

    // 4. Variants for the first provider (+ artwork placeholders)
    const firstProvider = provs.ok && Array.isArray(provs.json) && provs.json[0]?.id;
    if (firstProvider) {
      const vars = await pf(`/catalog/blueprints/${blueprintId}/print_providers/${firstProvider}/variants.json`, token);
      out.firstProviderId = firstProvider;
      if (vars.ok) {
        const list = vars.json?.variants || [];
        out.variantCount = list.length;
        // Trim to the useful bits: id, title, options, and print-area placeholder sizes.
        out.variantsSample = list.slice(0, 12).map((v) => ({
          id: v.id, title: v.title, options: v.options,
          placeholders: (v.placeholders || []).map((p) => ({ position: p.position, width: p.width, height: p.height })),
        }));
      } else {
        out.variants = { error: vars.status, body: vars.raw };
      }
    }
  } catch (e) {
    out.error = String(e);
  }
  return res.status(200).json(out);
}
