/* Popcode shopping cart — shared client module.
 *
 * The cart lives in Supabase (cart_items, owner-scoped by RLS), not in
 * localStorage, so a design added on a phone is still in the cart on a desktop
 * and the nav badge is right on every device.
 *
 * A cart line stores the FINISHED print file, not a recipe: the badge composite
 * (prints) or the print PDF (books, calendars, board books) is rendered when the
 * line is added, because the maker page is the only place that can render it.
 * Prices are never stored — /api/cart-quote prices the cart live and
 * /api/create-checkout re-quotes server-side before charging, so a tampered row
 * can ask for a different product but never a different price.
 *
 * Usage:
 *   <script src="/config.js"></script>
 *   <script src="/cart.js"></script>
 *   await PopcodeCart.add({ collectionId, productType, variantId, copies,
 *                           assetUrls, pageCount, options, title, thumbUrl });
 */
(function () {
  'use strict';

  var db = null;
  var cache = null;          // last-known rows, so the badge can render instantly
  var listeners = [];

  function client() {
    if (db) return db;
    if (window.__popcodeCartDb) { db = window.__popcodeCartDb; return db; }
    if (!window.supabase || typeof SUPABASE_URL === 'undefined') return null;
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.__popcodeCartDb = db;
    return db;
  }

  // Pages that already made a Supabase client should hand it over, so the cart
  // shares one auth session rather than starting a second one.
  function attach(existing) { if (existing) { db = existing; window.__popcodeCartDb = existing; } return db; }

  function emit() {
    var n = cache ? cache.length : 0;
    paintBadge(n);
    listeners.forEach(function (cb) { try { cb(cache || [], n); } catch (e) {} });
    try { window.dispatchEvent(new CustomEvent('popcode-cart-change', { detail: { items: cache || [], count: n } })); } catch (e) {}
  }

  function onChange(cb) { listeners.push(cb); if (cache) cb(cache, cache.length); }

  // ── data ────────────────────────────────────────────────────────────────
  async function list(force) {
    var c = client();
    if (!c) return [];
    if (cache && !force) return cache;
    var res = await c.from('cart_items').select('*').order('created_at', { ascending: true });
    if (res.error) { console.warn('cart load failed', res.error.message); return cache || []; }
    cache = res.data || [];
    emit();
    return cache;
  }

  async function count(force) { return (await list(force)).length; }

  async function add(item) {
    var c = client();
    if (!c) throw new Error('Cart unavailable');
    var { data: { user } } = await c.auth.getUser();
    if (!user) throw new Error('Please sign in to add to your cart.');
    var row = {
      user_id: user.id,
      collection_id: item.collectionId || null,
      product_type: item.productType,
      variant_id: item.variantId,
      copies: Math.max(1, parseInt(item.copies, 10) || 1),
      asset_urls: item.assetUrls || [],
      page_count: item.pageCount || null,
      options: item.options || {},
      title: item.title || null,
      thumb_url: item.thumbUrl || null,
    };
    var res = await c.from('cart_items').insert(row).select().single();
    // .select() so an RLS block surfaces as an error instead of a silent no-op
    // (the 2026-04-17 lesson: PostgREST returns 204 for a policy-filtered write).
    if (res.error) throw new Error(res.error.message);
    cache = (cache || []).concat([res.data]);
    emit();
    return res.data;
  }

  async function setCopies(id, copies) {
    var c = client();
    var n = Math.min(99, Math.max(1, parseInt(copies, 10) || 1));
    var res = await c.from('cart_items').update({ copies: n, updated_at: new Date().toISOString() }).eq('id', id).select();
    if (res.error) throw new Error(res.error.message);
    if (!res.data || !res.data.length) throw new Error('Could not update that item.');
    cache = (cache || []).map(function (r) { return r.id === id ? res.data[0] : r; });
    emit();
    return res.data[0];
  }

  async function remove(id) {
    var c = client();
    var res = await c.from('cart_items').delete().eq('id', id);
    if (res.error) throw new Error(res.error.message);
    cache = (cache || []).filter(function (r) { return r.id !== id; });
    emit();
  }

  async function clear() {
    var c = client();
    var { data: { user } } = await c.auth.getUser();
    if (!user) return;
    var res = await c.from('cart_items').delete().eq('user_id', user.id);
    if (res.error) throw new Error(res.error.message);
    cache = [];
    emit();
  }

  // Shape a cart row for the pricing / checkout APIs.
  function toLine(row) {
    return {
      id: row.id,
      collectionId: row.collection_id,
      productType: row.product_type,
      variantId: row.variant_id,
      copies: row.copies,
      assetUrls: row.asset_urls || [],
      pageCount: row.page_count || null,
      title: row.title || row.product_type,
    };
  }

  // Live price for the whole cart (display only — checkout re-quotes).
  async function quote(rows, opts) {
    opts = opts || {};
    var resp = await fetch('/api/cart-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: rows.map(toLine),
        destinationCountryCode: opts.countryCode || 'US',
        address: opts.address || null,
        shippingMethod: opts.shippingMethod || 'Standard',
      }),
    });
    var data = await resp.json().catch(function () { return {}; });
    if (!resp.ok) { var e = new Error(data.error || 'Could not price your cart'); e.unservable = data.unservable; throw e; }
    return data;
  }

  // ── badge ───────────────────────────────────────────────────────────────
  function paintBadge(n) {
    // Header icon: hang a count bubble off the cart button.
    document.querySelectorAll('.cart-btn').forEach(function (btn) {
      btn.setAttribute('href', '/cart.html');
      if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
      var b = btn.querySelector('.cart-badge');
      if (!n) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('span'); b.className = 'cart-badge'; btn.appendChild(b); }
      b.textContent = n > 99 ? '99+' : String(n);
    });
    // Drawer row.
    var d = document.getElementById('nav-cart-count');
    if (d) {
      d.textContent = String(n);
      d.style.display = n ? '' : 'none';
      var link = d.closest('a'); if (link) link.setAttribute('href', '/cart.html');
    }
  }

  function money(minor, currency) {
    var v = (minor || 0) / 100;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency', currency: currency || 'USD',
        minimumFractionDigits: v % 1 === 0 ? 0 : 2, maximumFractionDigits: 2,
      }).format(v);
    } catch (e) { return '$' + v.toFixed(2); }
  }

  window.PopcodeCart = {
    attach: attach, list: list, count: count, add: add, setCopies: setCopies,
    remove: remove, clear: clear, quote: quote, toLine: toLine,
    onChange: onChange, money: money, refreshBadge: function () { return list(true); },
  };

  // Paint the badge as soon as the header exists. Signed-out visitors just get 0.
  function boot() { list(true).catch(function () {}); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
