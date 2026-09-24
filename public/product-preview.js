/* The product preview renderer, shared by the Shop and the create page.

   This lived inside order.html, so the create page could only show a snapshot of
   the product taken before you left the Shop — it had no way to redraw the mug
   with the photo you were choosing. Copying ~390 lines across would have drifted
   the moment either side changed, the way the cart's product list silently did,
   so the code moved here and both pages call it.

   Self-contained on purpose: everything it needs is in this file and every input
   arrives as an argument. The one thing it used to reach for, order.html's
   giftArtOpts(), now arrives as opts.art — so it renders the same on a page that
   has no product state at all. */
(function () {
  'use strict';

  const MOCKUPS = {
          canvas: { template: '/assets/mockups/canvas.jpg', rect: { x: 0.190,  y: 0.112, w: 0.670, h: 0.804 } },
          framed: { template: '/assets/mockups/framed.jpg', rect: { x: 0.208,  y: 0.111, w: 0.582, h: 0.778 } },
          tile:   { template: '/assets/mockups/tile.jpg',   rect: { x: 0.280,  y: 0.206, w: 0.427, h: 0.598 } },
          // A borderless print has no frame/depth of its own, and the template's wall
          // is near-white, so it washes out on the white storefront card. `shadow`
          // makes renderProductMockup cast a real drop shadow so it reads as a
          // physical print lifted off the wall.
          print:  { template: '/assets/mockups/print.jpg',  rect: { x: 0.190,  y: 0.113, w: 0.626, h: 0.782 }, shadow: true },
          // Made from Prodigi's own product shot with the design it carried erased
          // pixel by pixel, so the asset holds no third-party artwork. `cutout`
          // puts the art under the template, letting the cylinder's arcs mask it.
          /* A flat round ornament: the disc is erased to transparency so the photo
             goes underneath and the template's own pixels — gold string, the hole,
             the rim shading, the drop shadow — sit on top. Not `cylinder`: it is
             flat, so there is no curvature to shade. */
          ornament: { template: '/assets/mockups/ornament.png', rect: { x: 0.1127, y: 0.1132, w: 0.7728, h: 0.7728 }, cutout: true },
          mug:    { template: '/assets/mockups/mug.png',    rect: { x: 0.1850, y: 0.1767, w: 0.5596, h: 0.6778 }, cutout: true, cylinder: true },
        };

  const WRAP_FACE_FRAC = 0.335;

  const WRAP_BADGE_SCALE = 0.095;

  const WRAP_BADGE_LIFT = 0.10;

  const CORRECTION_PRESETS = [
          { key: 'off',    label: 'Off',    gamma: 1.00, contrast: 1.00, saturation: 1.00 },
          { key: 'light',  label: 'Light',  gamma: 1.10, contrast: 1.02, saturation: 1.06 },
          { key: 'medium', label: 'Medium', gamma: 1.16, contrast: 1.04, saturation: 1.10 },
          { key: 'strong', label: 'Strong', gamma: 1.22, contrast: 1.06, saturation: 1.16 },
          { key: 'max',    label: 'Max',    gamma: 1.30, contrast: 1.08, saturation: 1.22 },
        ];

  const ACTIVE_CORRECTION = 'medium';

  function correctionByKey(key) {
          return CORRECTION_PRESETS.find(p => p.key === key) || CORRECTION_PRESETS[0];
        }

  function applyCorrection(ctx, w, h, corr) {
          if (!corr || (corr.gamma === 1 && corr.contrast === 1 && corr.saturation === 1)) return;
          // Precompute a 256-entry LUT for the per-channel gamma+contrast curve
          // (both are independent of the other channels; saturation is not).
          const invG = 1 / corr.gamma, con = corr.contrast, sat = corr.saturation;
          const lut = new Uint8ClampedArray(256);
          for (let i = 0; i < 256; i++) {
            let v = Math.pow(i / 255, invG);        // gamma lift (midtone brighten)
            v = (v - 0.5) * con + 0.5;              // contrast around mid
            lut[i] = Math.max(0, Math.min(255, Math.round(v * 255)));
          }
          const imgd = ctx.getImageData(0, 0, w, h), d = imgd.data;
          for (let i = 0; i < d.length; i += 4) {
            let r = lut[d[i]], g = lut[d[i + 1]], b = lut[d[i + 2]];
            if (sat !== 1) {                        // saturation around per-pixel luma
              const l = 0.299 * r + 0.587 * g + 0.114 * b;
              r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
            }
            d[i] = r; d[i + 1] = g; d[i + 2] = b;
          }
          ctx.putImageData(imgd, 0, 0);
        }

  const DEFAULT_ADJUST = () => ({ fit: 'fill', scale: 1, ox: 0, oy: 0, rot: 0 });

  function normalizeAdjust(a) {
          const d = DEFAULT_ADJUST();
          if (!a || typeof a !== 'object') return d;
          return {
            fit: a.fit === 'fit' ? 'fit' : 'fill',
            scale: Math.max(1, Math.min(3, +a.scale || 1)),
            ox: Math.max(-80, Math.min(80, +a.ox || 0)),
            oy: Math.max(-80, Math.min(80, +a.oy || 0)),
            rot: ((Math.round((+a.rot || 0) / 90) * 90) % 360 + 360) % 360,
          };
        }

  function clampPan(a, boxW, boxH, iw, ih) {
          if (!iw || !ih || !boxW || !boxH) return a;
          if (a.fit === 'fit') { a.ox = 0; a.oy = 0; return a; }
          const fitScale = Math.max(boxW / iw, boxH / ih);
          const rotated = (a.rot % 180) !== 0;
          const imgW = (rotated ? ih : iw) * fitScale * a.scale;
          const imgH = (rotated ? iw : ih) * fitScale * a.scale;
          const maxOx = Math.max(0, (imgW - boxW) / (2 * boxW) * 100);
          const maxOy = Math.max(0, (imgH - boxH) / (2 * boxH) * 100);
          a.ox = Math.max(-maxOx, Math.min(maxOx, a.ox));
          a.oy = Math.max(-maxOy, Math.min(maxOy, a.oy));
          return a;
        }

  function drawPhotoAdjusted(ctx, img, adjust, x, y, w, h) {
          const a = normalizeAdjust(adjust);
          const iw = img.naturalWidth, ih = img.naturalHeight;
          if (!iw || !ih) return;
          clampPan(a, w, h, iw, ih);
          const fitScale = a.fit === 'fit' ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
          ctx.save();
          ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
          ctx.translate(x + w / 2 + (a.ox / 100) * w, y + h / 2 + (a.oy / 100) * h);
          ctx.scale(a.scale, a.scale);
          ctx.rotate(a.rot * Math.PI / 180);
          const dw = iw * fitScale, dh = ih * fitScale;
          ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
          ctx.restore();
          /* Where the photo actually landed, clipped to the box. Under 'fit' it is
             letterboxed, so the badge has to sit in the corner of the PHOTO — the
             corner of the box is bare ceramic. Rotation is ignored here: it is not
             used on the products that letterbox. */
          const cx = x + w / 2 + (a.ox / 100) * w, cy = y + h / 2 + (a.oy / 100) * h;
          const sw2 = dw * a.scale / 2, sh2 = dh * a.scale / 2;
          return { x: Math.max(x, cx - sw2), y: Math.max(y, cy - sh2),
                   w: Math.min(x + w, cx + sw2) - Math.max(x, cx - sw2),
                   h: Math.min(y + h, cy + sh2) - Math.max(y, cy - sh2) };
        }

  async function compositeBadgedImage(photoUrl, opts) {
          opts = opts || {};
          var scale = typeof opts.scale === 'number' ? opts.scale : 0.06;
          var aspect = (typeof opts.aspect === 'number' && opts.aspect > 0) ? opts.aspect : null;
          var adjust = opts.adjust || null;
          var previewCanvas = opts.previewCanvas || null;
          var img = new Image(); img.crossOrigin = 'anonymous';
          await new Promise(function (res, rej) { img.onload = res; img.onerror = rej; img.src = photoUrl; });
          var iconImg = new Image();
          await new Promise(function (res, rej) { iconImg.onload = res; iconImg.onerror = rej; iconImg.src = '/assets/popcode_symbol_color.svg'; });
          var returnDataUrl = opts.returnDataUrl !== false; // previews pass false
          var sw = img.naturalWidth, sh = img.naturalHeight;
          var cropW = sw, cropH = sh, sx = 0, sy = 0;
          if (aspect) {
            if (sw / sh > aspect) { cropH = sh; cropW = Math.round(sh * aspect); sx = Math.round((sw - cropW) / 2); }
            else { cropW = sw; cropH = Math.round(sw / aspect); sy = Math.round((sh - cropH) / 2); }
          }
          // Fast preview path: draw the crop straight into a small canvas (no full-res
          // intermediate, no toDataURL) so the grid/detail stay snappy.
          if (previewCanvas) {
            var maxDim = 500;
            var s = Math.min(1, maxDim / Math.max(cropW, cropH));
            var pw = Math.max(1, Math.round(cropW * s)), ph = Math.max(1, Math.round(cropH * s));
            previewCanvas.width = pw; previewCanvas.height = ph;
            var pc = previewCanvas.getContext('2d');
            pc.clearRect(0, 0, pw, ph);
            // Same white ground as the print, so the preview matches it.
            pc.fillStyle = '#ffffff'; pc.fillRect(0, 0, pw, ph);
            var pbox = adjust ? drawPhotoAdjusted(pc, img, adjust, 0, 0, pw, ph) : null;
            if (!adjust) pc.drawImage(img, sx, sy, cropW, cropH, 0, 0, pw, ph);
            placeBadge(pc, iconImg, pw, ph, scale, Object.assign({}, opts, { box: pbox }));
            if (!returnDataUrl) return null;
          }
          // Full-res output (the actual print asset). JPEG keeps the file small so
          // compositing + upload at checkout is fast (no transparency needed once
          // the badge is flattened onto the photo).
          //
          // Kiss-cut stickers are the one product with a MAXIMUM accepted pixel
          // size as well as a minimum (900x1200 for the 3x4", 2550 square for the
          // 8.5"). A phone photo cropped square is about 3000px, so the cap bites
          // on ordinary input and the asset is scaled down to fit it. Aspect is
          // preserved — a single ratio, so the crop stays exactly what was
          // previewed.
          var srcCropW = cropW, srcCropH = cropH;
          if (opts.maxPx && opts.maxPx.w && opts.maxPx.h) {
            var capScale = Math.min(1, opts.maxPx.w / cropW, opts.maxPx.h / cropH);
            if (capScale < 1) {
              cropW = Math.max(1, Math.floor(cropW * capScale));
              cropH = Math.max(1, Math.floor(cropH * capScale));
            }
          }
          var c = document.createElement('canvas');
          c.width = cropW; c.height = cropH;
          var ctx = c.getContext('2d');
          /* White behind the photo. A fresh canvas is transparent, and Fit
             deliberately leaves the sides uncovered — exported as JPEG that
             transparency becomes BLACK, which on a white mug would be two black
             bands either side of the picture. White is also what the bare product
             actually is: unprinted ceramic, unprinted paper. */
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cropW, cropH);
          var box = null;
          if (adjust) box = drawPhotoAdjusted(ctx, img, adjust, 0, 0, cropW, cropH);
          // Source rect stays the crop we chose off the original; only the
          // DESTINATION shrinks when a pixel cap applies, so capping resamples
          // rather than re-cropping.
          else ctx.drawImage(img, sx, sy, srcCropW, srcCropH, 0, 0, cropW, cropH);
          // Brighten/pop the photo for print before the badge goes on top.
          var corr = opts.correction || correctionByKey(ACTIVE_CORRECTION);
          applyCorrection(ctx, cropW, cropH, corr);
          // Same box as the preview path above, so what prints matches what you saw.
          placeBadge(ctx, iconImg, cropW, cropH, scale, Object.assign({}, opts, { box: box }));
          // Stickers are die-cut from a PNG and Prodigi rejects a JPEG for them;
          // everything else stays JPEG so the checkout upload stays small.
          return opts.format === 'png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.92);
        }

  function placeBadge(ctx, iconImg, w, h, scale, opts) {
          var minSide = Math.min(w, h);
          var size = Math.round(minSide * ((opts && opts.wrap) ? WRAP_BADGE_SCALE : scale));
          var pad = Math.round(minSide * 0.025);
          // A kiss-cut sticker is trimmed 2.5mm (30px at 300 DPI) in from the
          // file edge, and the usual 2.5% margin is under that on the smaller
          // sizes — so the badge would be cut through. Take whichever margin is
          // larger, scaled if the asset was capped below its nominal size.
          if (opts && opts.padPx) {
            var nominal = (opts.maxPx && opts.maxPx.w) ? Math.min(opts.maxPx.w, opts.maxPx.h) : minSide;
            pad = Math.max(pad, Math.ceil(opts.padPx * (minSide / nominal)));
          }
          var x = w - size - pad, y = h - size - pad;
          /* Lower right of the PHOTO, the same corner every other product uses. On
             a wrap under 'fit' the photo is letterboxed inside the print area, so
             the box's own corner is bare ceramic — `box` is the rect the photo was
             actually drawn into. */
          if (opts && opts.box && opts.box.w > size && opts.box.h > size) {
            x = Math.round(opts.box.x + opts.box.w - size - pad);
            y = Math.round(opts.box.y + opts.box.h - size - pad);
          }
          /* ...but never past the part of a wrap that faces you. A photo wider than
             the mug's front third has its own corner rotated toward the handle, so
             the badge would print out of sight. Pull it in to the right-hand edge of
             what's visible: still the lower right, still in view. */
          if (opts && opts.wrap) {
            if (opts.faceFrac) {
              var faceRight = w / 2 + (w * opts.faceFrac) / 2;
              x = Math.min(x, Math.round(faceRight - size - pad));
            }
            var bottom = (opts.box && opts.box.h > size) ? (opts.box.y + opts.box.h) : h;
            y = Math.round(bottom - size - Math.max(pad, h * WRAP_BADGE_LIFT));
          }
          if (opts && opts.round) {
            // Centre of the badge on the 45 degree diagonal, far enough in that the
            // whole badge (plus its own half-diagonal) clears the circle's edge.
            var r = minSide / 2;
            var reach = Math.max(0, r - size * 0.71 - pad);
            x = Math.round(w / 2 + reach * 0.707 - size / 2);
            y = Math.round(h / 2 + reach * 0.707 - size / 2);
          }
          ctx.drawImage(iconImg, x, y, size, size);
        }

  async function renderProductMockup(targetCanvas, photoUrl, opts) {
          const mk = opts.mockup;
          const tpl = new Image(); tpl.crossOrigin = 'anonymous';
          await new Promise((res, rej) => { tpl.onload = res; tpl.onerror = rej; tpl.src = mk.template; });
          const maxDim = 900;
          const s = Math.min(1, maxDim / Math.max(tpl.naturalWidth, tpl.naturalHeight));
          const tw = Math.round(tpl.naturalWidth * s), th = Math.round(tpl.naturalHeight * s);
          let r = { x: mk.rect.x * tw, y: mk.rect.y * th, w: mk.rect.w * tw, h: mk.rect.h * th };
          // Landscape orientation: rotate the (portrait) template 90° so the frame
          // itself reads landscape, then place an upright landscape-cropped photo in
          // the rotated opening. (A portrait 8×10 frame turned 90° IS a 10×8.)
          /* A portrait 8x10 frame turned 90 degrees IS a 10x8, so a wide aspect
             means rotate the template. That reasoning does not carry to a product
             with a fixed orientation: a mug's wrap is 2.41 wide, and rotating it
             would stand the mug on its handle. Cutout templates are real product
             photographs and always sit the way they were shot. */
          const landscape = !!(opts.aspect && opts.aspect > 1) && !mk.cutout;
          const ctx = targetCanvas.getContext('2d');
          if (landscape) {
            targetCanvas.width = th; targetCanvas.height = tw;
            ctx.save(); ctx.translate(th, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(tpl, 0, 0, tw, th); ctx.restore();
            r = { x: th - r.y - r.h, y: r.x, w: r.h, h: r.w };
          } else {
            targetCanvas.width = tw; targetCanvas.height = th;
            /* A CUTOUT template is the product photographed with its printed area
               erased to transparency: the art goes UNDERNEATH and the template's
               own pixels mask it. A mug needs this — its print area arcs at top
               and bottom with the curve of the cylinder, and no rectangle can
               describe that shape. Opaque templates keep taking the art on top. */
            if (!mk.cutout) ctx.drawImage(tpl, 0, 0, tw, th);
          }
          // Cover the template's stock sample photo with a neutral placeholder so
          // there's no flash of the sample (leopard) image while the user's photo
          // composites in (the photo load below is async). A cutout template has
          // no stock photo to hide, and filling here would paint a grey block
          // outside the product's silhouette.
          if (!mk.cutout) { ctx.fillStyle = '#e9e9ec'; ctx.fillRect(r.x, r.y, r.w, r.h); }
          // Crop the badged art to the OPENING's exact aspect so the badge always
          // lands in the corner of what's shown (no cover-crop clipping it off).
          /* A wrap keeps its OWN aspect rather than the opening's: a mug's artwork
             runs 229mm round the cylinder while the opening shows only the ~130mm
             facing the camera, so cropping to the opening would squeeze the whole
             panorama onto the front. Cover-cropping the real wrap into the opening
             shows the part you would actually be looking at. */
          const wrapV = opts.art || {};
          const artUrl = await compositeBadgedImage(photoUrl, Object.assign(
            // `adjust` is the crop and reposition from Edit Photo. Without it the
            // preview silently ignores everything done in that dialog while the
            // print file honours it — the worst combination, since what you are
            // shown is not what you would receive.
            { scale: opts.scale, aspect: wrapV.wrap ? opts.aspect : r.w / r.h, adjust: opts.adjust || null }, wrapV));
          const art = new Image(); await new Promise((res, rej) => { art.onload = res; art.onerror = rej; art.src = artUrl; });
          // Reinforce a cast shadow for borderless prints so they read as a physical
          // object lifted off the wall (the template's baked shadow washes out on a
          // white page). Paint a shadowed white rect under the art, then draw the art
          // on top so only the soft halo around the print edges shows.
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
          if (mk.cutout && art.naturalWidth / art.naturalHeight > r.w / r.h) {
            // Cover-fit: fill the opening's height and centre the wrap, so what
            // shows is the middle of the artwork — the face of the mug.
            const dh = r.h, dw = dh * (art.naturalWidth / art.naturalHeight);
            ctx.drawImage(art, r.x + (r.w - dw) / 2, r.y, dw, dh);
          } else {
            ctx.drawImage(art, r.x, r.y, r.w, r.h);
          }
          if (mk.cylinder) {
            // Shade the art like the curved surface it is printed on, or it reads
            // as a flat sticker pasted into a mug-shaped hole.
            const cyl = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
            cyl.addColorStop(0,    'rgba(0,0,0,0.30)');
            cyl.addColorStop(0.10, 'rgba(0,0,0,0.10)');
            cyl.addColorStop(0.32, 'rgba(255,255,255,0.10)');
            cyl.addColorStop(0.62, 'rgba(0,0,0,0.02)');
            cyl.addColorStop(0.88, 'rgba(0,0,0,0.16)');
            cyl.addColorStop(1,    'rgba(0,0,0,0.34)');
            ctx.fillStyle = cyl; ctx.fillRect(r.x, r.y, r.w, r.h);
          }
          ctx.restore();
          if (mk.cutout) ctx.drawImage(tpl, 0, 0, tw, th);
        }

  function roundRectPath(ctx, x, y, w, h, r) {
          ctx.beginPath();
          ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
          ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
          ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
        }

  function placeProduct(ctx, art, box, id, product, frame, st) {
          st = st || pageState();
          /* Frame colour/lightness come from the options passed in, or from the
             page's own helpers when there are some (order.html). create.html has
             neither helper, and calling them bare threw — so the product pane
             there never redrew with the chosen photo. */
          const lightFrame = st.frameHex
            ? (() => { const h = st.frameHex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
                       return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) > 150; })()
            : (typeof isLightFrame === 'function' ? isLightFrame() : false);
          const { x, y, w, h } = box;
          const contact = (id === 'shelf');

          // Shelf: pool a soft contact shadow under the base so it reads as resting on
          // the shelf (not floating). Everything else: a soft cast drop shadow.
          if (contact) {
            const cxb = x + w / 2, cyb = y + h + frame;
            ctx.save();
            const rg = ctx.createRadialGradient(cxb, cyb, w * 0.04, cxb, cyb, w * 0.6);
            rg.addColorStop(0, 'rgba(0,0,0,0.30)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = rg; ctx.translate(cxb, cyb); ctx.scale(1, 0.15);
            ctx.beginPath(); ctx.arc(0, 0, w * 0.6, 0, 2 * Math.PI); ctx.fill();
            ctx.restore();
          }
          ctx.save();
          ctx.shadowColor = contact ? 'rgba(0,0,0,0.16)' : 'rgba(0,0,0,0.22)';
          ctx.shadowBlur = w * (contact ? 0.028 : 0.055);
          ctx.shadowOffsetX = w * (contact ? 0.004 : 0.016);
          ctx.shadowOffsetY = h * (contact ? 0.006 : 0.04);
          const hasFrame = (product === 'framed' || product === 'tile' || product === 'framedcanvas');
          ctx.fillStyle = hasFrame ? (st.frameHex || (typeof frameColorHex === 'function' ? frameColorHex() : '#141414')) : '#ffffff';
          // Tiles have SQUARE corners (like the real product) — no rounding.
          ctx.fillRect(x - frame, y - frame, w + 2 * frame, h + 2 * frame);
          // Light frames (white/natural) need a hairline edge to read against the
          // pale stage background.
          if (hasFrame && lightFrame) {
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = 'rgba(0,0,0,0.14)';
            ctx.lineWidth = Math.max(1, w * 0.003);
            ctx.strokeRect(x - frame, y - frame, w + 2 * frame, h + 2 * frame);
          }
          ctx.restore();
          ctx.save();
          // Mounted framed print: the conservation mount sits between frame and
          // image — fill the opening with mount white, inset the art.
          let ax = x, ay = y, aw = w, ah = h;
          if (product === 'framed' && st.mounted) {
            ctx.fillStyle = '#faf9f6'; ctx.fillRect(x, y, w, h);
            const m = w * 0.13;
            ax = x + m; ay = y + m; aw = w - 2 * m; ah = h - 2 * m;
            ctx.save();
            ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = Math.max(1, w * 0.0035);
            ctx.strokeRect(ax, ay, aw, ah); // mount bevel line
            ctx.restore();
          }
          // Framed canvas: a small shadowed gap between frame and canvas face.
          if (product === 'framedcanvas') {
            ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(x, y, w, h);
            const g = w * 0.022;
            ax = x + g; ay = y + g; aw = w - 2 * g; ah = h - 2 * g;
          }
          if (art) ctx.drawImage(art, ax, ay, aw, ah);
          else { ctx.fillStyle = '#ededed'; ctx.fillRect(ax, ay, aw, ah); if (typeof drawImageIcon === 'function') drawImageIcon(ctx, ax + aw / 2, ay + ah / 2, Math.min(aw, ah) * 0.2); }
          // Acrylic: glossy diagonal sheen + a bright polished edge.
          if (product === 'acrylic') {
            const sheen = ctx.createLinearGradient(x, y, x + w, y + h);
            sheen.addColorStop(0, 'rgba(255,255,255,0.16)');
            sheen.addColorStop(0.35, 'rgba(255,255,255,0.02)');
            sheen.addColorStop(0.55, 'rgba(255,255,255,0.10)');
            sheen.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = sheen; ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1.5, w * 0.005);
            ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
          }
          ctx.restore();
          if (product === 'canvas') { // gallery-wrap depth edge
            ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(x + w - w * 0.014, y, w * 0.014, h);
            ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(x, y + h - h * 0.011, w, h * 0.011);
          }
          if (product === 'framed') { ctx.strokeStyle = lightFrame ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.10)'; ctx.lineWidth = Math.max(1, w * 0.004); ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
        }

  /* The page's own `state` (order.html) when there is one; create.html has none,
     so the product and its options are passed in there. Reading `state` bare
     threw on that page, and the catch kept the sample snapshot on screen. */
  function pageState() { return (typeof state !== 'undefined' && state) ? state : {}; }
  function renderProductOnly(cv, art, aspect, opts) {
          const st = Object.assign({}, pageState(), opts || {});
          const S = 900;
          cv.width = S; cv.height = S;
          const ctx = cv.getContext('2d');
          ctx.clearRect(0, 0, S, S);
          // 0.84 (was 0.62) so the product's on-screen size in the 400px stage
          // matches the storefront cards' cropped mockups (~340px tall).
          const maxW = S * 0.84, maxH = S * 0.84;
          let w = maxW, h = w / aspect;
          if (h > maxH) { h = maxH; w = h * aspect; }
          const frame = (st.productType === 'framed' || st.productType === 'framedcanvas') ? w * 0.055 : (st.productType === 'tile' ? w * 0.05 : 0);
          const x = S / 2 - w / 2, y = S / 2 - h / 2;
          placeProduct(ctx, art, { x, y, w, h }, 'plain', st.productType, frame, st);
        }

  /* ── Ornament back panel ──────────────────────────────────────────────────
     The reverse of the double-sided ornament (Printify 1747, 2.9" round, print
     area 938px). Printify has no insert, so this is where the link lives. It is
     the same brand block as the book / album back cover — wordmark, the
     instruction, the Popcode symbol — with the book's proportions between them
     (logo 10x the type size, symbol 2.9x, gaps ~1.1-1.4x) so it reads as the
     same family, just scaled to a 2.9" disc. The copy is written for the object
     in hand: the photo that plays is on the other side, not "photos with the
     symbol". Everything sits well inside the die-cut circle and clear of the
     hanging hole at the top. Shared by the product page, the create page and
     the print asset, so the preview is the file that prints. */
  const ORNAMENT_BACK_PX = 938;
  const _backImgs = {};
  function loadSameOrigin(src) {
    if (!_backImgs[src]) _backImgs[src] = new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
    });
    return _backImgs[src];
  }
  async function drawOrnamentBack(slug, S) {
    S = S || ORNAMENT_BACK_PX;
    const url = 'popcode.app/' + (slug || 'yourlink');
    try { if (document.fonts) await Promise.all([document.fonts.load("500 40px Inter"), document.fonts.load("700 40px Inter")]); } catch (e) { /* fall back */ }
    const [logo, sym] = await Promise.all([
      loadSameOrigin('/assets/Popcode_logo.png'),
      loadSameOrigin('/assets/popcode_symbol_color.svg'),
    ]);
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, S, S);
    const cx = S / 2, cy = S / 2, R = S / 2;
    const FONT = (w, px) => w + ' ' + Math.round(px) + 'px Inter, system-ui, sans-serif';

    // Type size drives everything, as on the book back.
    const F = S * 0.041;                 // ~9pt on a 2.9" disc
    const lead = F * 1.6;
    const logoW = F * 10, logoH = logoW * logo.height / logo.width;
    const gapLogo = F * 1.35, gapSym = F * 1.15, symW = F * 2.9;
    const lineW = (segs, px) => segs.reduce((w, s) => { x.font = FONT(s.b ? 700 : 500, px); return w + x.measureText(s.t).width; }, 0);
    const chord = (dy) => 2 * Math.sqrt(Math.max(0, (R * 0.80) ** 2 - dy * dy));

    // "Go to <link>" / "on your phone and scan the other side." — or, when a
    // long link won't fit beside "Go to", the link gets a line of its own
    // rather than being shrunk until it can't be read.
    const room = chord(0) * 0.96;
    const tail = [{ t: 'on your phone and scan the other side.' }];
    const lines = lineW([{ t: 'Go to ' }, { t: url, b: true }], F) <= room
      ? [[{ t: 'Go to ' }, { t: url, b: true }], tail]
      : [[{ t: 'Go to' }], [{ t: url, b: true }], tail];
    const textH = lead * (lines.length - 1) + F;
    const blockH = logoH + gapLogo + textH + gapSym + symW;
    let top = cy - blockH / 2 + S * 0.03;   // a touch low: the hole is at the top

    x.drawImage(logo, cx - logoW / 2, top, logoW, logoH);
    let y = top + logoH + gapLogo + F * 0.8;
    x.fillStyle = '#1a1a1a'; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    for (const segs of lines) {
      // Shrink a line only if a very long link still overruns the circle.
      let px = F; const room = chord(y - cy);
      while (lineW(segs, px) > room && px > F * 0.7) px -= 1;
      let lx = cx - lineW(segs, px) / 2;
      for (const s of segs) { x.font = FONT(s.b ? 700 : 500, px); x.fillText(s.t, lx, y); lx += x.measureText(s.t).width; }
      y += lead;
    }
    const symTop = top + logoH + gapLogo + textH + gapSym;
    x.drawImage(sym, cx - symW / 2, symTop, symW, symW);
    return c.toDataURL('image/png');
  }

  window.PopcodePreview = {
    MOCKUPS: MOCKUPS,
    drawOrnamentBack: drawOrnamentBack,
    ORNAMENT_BACK_PX: ORNAMENT_BACK_PX,
    compositeBadgedImage: compositeBadgedImage,
    renderProductMockup: renderProductMockup,
    renderProductOnly: renderProductOnly,
    placeProduct: placeProduct,
    placeBadge: placeBadge,
    drawPhotoAdjusted: drawPhotoAdjusted,
    normalizeAdjust: normalizeAdjust,
    clampPan: clampPan,
    roundRectPath: roundRectPath,
    correctionByKey: correctionByKey,
    applyCorrection: applyCorrection,
    DEFAULT_ADJUST: DEFAULT_ADJUST,
    CORRECTION_PRESETS: CORRECTION_PRESETS,
    ACTIVE_CORRECTION: ACTIVE_CORRECTION,
    WRAP_FACE_FRAC: WRAP_FACE_FRAC,
    WRAP_BADGE_SCALE: WRAP_BADGE_SCALE,
    WRAP_BADGE_LIFT: WRAP_BADGE_LIFT,
  };
})();
