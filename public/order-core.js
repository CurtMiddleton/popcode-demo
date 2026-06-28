// order-core.js — shared client helpers for the Popcode storefront/checkout.
//
// Single source of the product catalog mirror + badge compositor + Prodigi
// quote + money formatting, used by the product-first wizard (shop.html).
// order.html currently keeps its own inline copies of these (it predates this
// module); consolidating order.html onto this file is a planned low-risk
// follow-up. Keep PRODUCTS ids/sizes/aspect in sync with lib/print/catalog.mjs
// (the server is authoritative for SKUs/pricing; this is UI only).
(function (global) {
  // Client mirror of lib/print/catalog.mjs (ids/sizes/aspect must stay in sync).
  const PRODUCTS = {
    print: [
      { id: 'fap-8x10',  size: '8×10"',  aspect: 8 / 10 },
      { id: 'fap-10x10', size: '10×10"', aspect: 1 },
      { id: 'fap-11x14', size: '11×14"', aspect: 11 / 14 },
      { id: 'fap-12x16', size: '12×16"', aspect: 12 / 16 },
      { id: 'fap-16x24', size: '16×24"', aspect: 16 / 24 },
      { id: 'fap-20x28', size: '20×28"', aspect: 20 / 28 },
      { id: 'fap-24x36', size: '24×36"', aspect: 24 / 36 },
    ],
    tile: [
      { id: 'tile-5x7',  size: '5×7"',  aspect: 5 / 7 },
      { id: 'tile-8x8',  size: '8×8"',  aspect: 1 },
      { id: 'tile-8x10', size: '8×10"', aspect: 8 / 10 },
    ],
    canvas: [
      { id: 'can-10x10', size: '10×10"', aspect: 1 },
      { id: 'can-12x16', size: '12×16"', aspect: 12 / 16 },
      { id: 'can-16x20', size: '16×20"', aspect: 16 / 20 },
      { id: 'can-16x24', size: '16×24"', aspect: 16 / 24 },
    ],
    framed: [
      { id: 'cfp-8x10',  size: '8×10"',  aspect: 8 / 10 },
      { id: 'cfp-11x14', size: '11×14"', aspect: 11 / 14 },
      { id: 'cfp-12x16', size: '12×16"', aspect: 12 / 16 },
      { id: 'cfp-16x24', size: '16×24"', aspect: 16 / 24 },
    ],
  };
  const CATEGORIES = ['print', 'tile', 'canvas', 'framed'];
  const CATEGORY_META = {
    print:  { name: 'Prints',        tagline: 'Classic fine-art prints',  desc: 'Museum-quality enhanced matte giclée prints — perfect for any photo.', specs: ['Enhanced matte art paper, 200gsm', 'Giclée print', 'Ships worldwide'] },
    tile:   { name: 'Photo Tiles',   tagline: 'Framed photo tiles',       desc: 'Ready-to-hang framed tiles — great on their own or in a cluster.',     specs: ['Framed photo tile', 'Ready to hang', 'Ships worldwide'] },
    canvas: { name: 'Canvas',        tagline: 'Stretched canvas',         desc: 'Gallery-style stretched canvas with mirror-wrapped edges.',           specs: ['Stretched canvas', 'Mirror-wrapped edges', 'Ships worldwide'] },
    framed: { name: 'Framed Prints', tagline: 'Classic framed prints',    desc: 'Fine-art print in a classic black frame behind perspex glaze.',       specs: ['Fine-art paper + perspex glaze', 'Black classic frame', 'Ships worldwide'] },
  };

  // Photorealistic mockups: face-on product photo + art-opening rect (fractions
  // of the template). renderProductMockup composites the badged photo into it.
  const MOCKUPS = {
    canvas: { template: '/assets/mockups/canvas.jpg', rect: { x: 0.190, y: 0.112, w: 0.670, h: 0.804 } },
    framed: { template: '/assets/mockups/framed.jpg', rect: { x: 0.208, y: 0.111, w: 0.582, h: 0.778 } },
    tile:   { template: '/assets/mockups/tile.jpg',   rect: { x: 0.280, y: 0.206, w: 0.427, h: 0.598 } },
    print:  { template: '/assets/mockups/print.jpg',  rect: { x: 0.190, y: 0.113, w: 0.626, h: 0.782 }, shadow: true },
  };

  function variantOf(type, id) { return (PRODUCTS[type] || []).find((v) => v.id === id) || null; }
  // Effective print aspect for a product + orientation (square ignores orientation).
  function currentAspect(type, id, orientation) {
    const v = variantOf(type, id);
    const a = v ? v.aspect : null;
    if (a && a !== 1 && orientation === 'landscape') return 1 / a;
    return a;
  }

  // Composite the Popcode badge into a photo cropped to `aspect`. Returns a JPEG
  // data URL (the real print asset) unless only a fast `previewCanvas` is wanted.
  async function compositeBadgedImage(photoUrl, opts) {
    opts = opts || {};
    var scale = typeof opts.scale === 'number' ? opts.scale : 0.06;
    var aspect = (typeof opts.aspect === 'number' && opts.aspect > 0) ? opts.aspect : null;
    var previewCanvas = opts.previewCanvas || null;
    var img = new Image(); img.crossOrigin = 'anonymous';
    await new Promise(function (res, rej) { img.onload = res; img.onerror = rej; img.src = photoUrl; });
    var iconImg = new Image();
    await new Promise(function (res, rej) { iconImg.onload = res; iconImg.onerror = rej; iconImg.src = '/assets/popcode_icon.svg'; });
    var returnDataUrl = opts.returnDataUrl !== false; // previews pass false
    var sw = img.naturalWidth, sh = img.naturalHeight;
    var cropW = sw, cropH = sh, sx = 0, sy = 0;
    if (aspect) {
      if (sw / sh > aspect) { cropH = sh; cropW = Math.round(sh * aspect); sx = Math.round((sw - cropW) / 2); }
      else { cropW = sw; cropH = Math.round(sw / aspect); sy = Math.round((sh - cropH) / 2); }
    }
    if (previewCanvas) {
      var maxDim = 500;
      var s = Math.min(1, maxDim / Math.max(cropW, cropH));
      var pw = Math.max(1, Math.round(cropW * s)), ph = Math.max(1, Math.round(cropH * s));
      previewCanvas.width = pw; previewCanvas.height = ph;
      var pc = previewCanvas.getContext('2d');
      pc.clearRect(0, 0, pw, ph);
      pc.drawImage(img, sx, sy, cropW, cropH, 0, 0, pw, ph);
      var pbS = Math.round(Math.min(pw, ph) * scale), pbp = Math.round(Math.min(pw, ph) * 0.025);
      pc.drawImage(iconImg, pw - pbS - pbp, ph - pbS - pbp, pbS, pbS);
      if (!returnDataUrl) return null;
    }
    var c = document.createElement('canvas');
    c.width = cropW; c.height = cropH;
    var ctx = c.getContext('2d');
    ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
    var badgeSize = Math.round(Math.min(cropW, cropH) * scale);
    var pad = Math.round(Math.min(cropW, cropH) * 0.025);
    ctx.drawImage(iconImg, cropW - badgeSize - pad, cropH - badgeSize - pad, badgeSize, badgeSize);
    return c.toDataURL('image/jpeg', 0.92);
  }

  // Composite the badged photo into a real product mockup's art rectangle.
  async function renderProductMockup(targetCanvas, photoUrl, opts) {
    const mk = opts.mockup;
    const tpl = new Image(); tpl.crossOrigin = 'anonymous';
    await new Promise((res, rej) => { tpl.onload = res; tpl.onerror = rej; tpl.src = mk.template; });
    const maxDim = 900;
    const s = Math.min(1, maxDim / Math.max(tpl.naturalWidth, tpl.naturalHeight));
    const tw = Math.round(tpl.naturalWidth * s), th = Math.round(tpl.naturalHeight * s);
    let r = { x: mk.rect.x * tw, y: mk.rect.y * th, w: mk.rect.w * tw, h: mk.rect.h * th };
    const landscape = !!(opts.aspect && opts.aspect > 1);
    const ctx = targetCanvas.getContext('2d');
    if (landscape) {
      targetCanvas.width = th; targetCanvas.height = tw;
      ctx.save(); ctx.translate(th, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(tpl, 0, 0, tw, th); ctx.restore();
      r = { x: th - r.y - r.h, y: r.x, w: r.h, h: r.w };
    } else {
      targetCanvas.width = tw; targetCanvas.height = th;
      ctx.drawImage(tpl, 0, 0, tw, th);
    }
    ctx.fillStyle = '#e9e9ec';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const artUrl = await compositeBadgedImage(photoUrl, { scale: opts.scale, aspect: r.w / r.h });
    const art = new Image(); await new Promise((res, rej) => { art.onload = res; art.onerror = rej; art.src = artUrl; });
    if (mk.shadow) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.30)';
      ctx.shadowBlur = Math.round(tw * 0.022);
      ctx.shadowOffsetX = Math.round(tw * 0.012);
      ctx.shadowOffsetY = Math.round(th * 0.016);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    ctx.drawImage(art, r.x, r.y, r.w, r.h); ctx.restore();
  }

  function dataUrlToBlob(dataUrl) {
    var parts = dataUrl.split(',');
    var mime = (parts[0].match(/:(.*?);/) || [null, 'image/png'])[1];
    var bin = atob(parts[1]), len = bin.length, arr = new Uint8Array(len);
    for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  // Live price from /api/prodigi-quote (display only; server re-quotes at checkout).
  async function quoteFor(productType, variantId, opts) {
    opts = opts || {};
    const resp = await fetch('/api/prodigi-quote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productType, variantId,
        copies: opts.copies || 1,
        destinationCountryCode: opts.country || 'US',
        shippingMethod: opts.shipping || 'Standard',
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Could not price this');
    return data;
  }
  function formatMoney(minor, currency) {
    // Prices are rounded to whole dollars server-side, so drop the .00.
    var whole = minor % 100 === 0;
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD', minimumFractionDigits: whole ? 0 : 2 }).format(minor / 100); }
    catch (_) { return (currency || 'USD') + ' ' + (minor / 100).toFixed(whole ? 0 : 2); }
  }

  global.PopcodeOrderCore = {
    PRODUCTS, CATEGORIES, CATEGORY_META, MOCKUPS,
    variantOf, currentAspect,
    compositeBadgedImage, renderProductMockup, dataUrlToBlob,
    quoteFor, formatMoney,
  };
})(window);
