/* Shared Popcode tools: the "Add a Popcode" sheet and "Edit Photo".

   Lifted from calendar.html (which had them from book.html), so a product
   built on this file looks and behaves exactly like the calendar: the same
   Video / Montage / Audio sheet, the same compression of oversized videos,
   the same audio recorder, and the same crop window with fill / fit, zoom,
   drag to reposition, rotate, replace and remove. The card maker uses it
   first; the calendar, book and board book still carry their own copies and
   can move over one at a time.

   Everything is drawn in its own overlay with its own scoped styles, so a
   host page needs no markup or CSS for it.

     PopcodeTools.popcodeSheet({
       current,                // { mediaType, video, audio, existingVideoUrl, existingAudioUrl } or null
       noun: 'card',           // "When someone scans the printed card…"
       onSave(popcode),        // same shape as `current`; null means removed
     });
     PopcodeTools.editPhoto({
       url, adjust, aspect,    // aspect = the slot's width / height
       source: 'Device',
       onSave(adjust), onReplace(file) -> url, onRemove(),
     });
     PopcodeTools.drawPhotoAdjusted(ctx, img, adjust, x, y, w, h)   // the print bake
     PopcodeTools.layoutPhoto(box, img, adjust)                    // the on-screen slot

   Montage needs /montage.js (and its /dialog.js, /montage-music.js); without
   it the Montage option is left out. Audio is normalised to WAV with
   /audio-wav.js when present, so it plays on iPhones. */
(function () {
  if (window.PopcodeTools) return;

  const MAX_VIDEO_MB = 200;
  const IC_X = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const formatMB = (bytes) => (bytes / (1024 * 1024)).toFixed(1) + ' MB';

  // ── Styles, scoped to the overlay ───────────────────────────────────────
  const CSS = `
  .pct-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: none; z-index: 8500; align-items: flex-end; justify-content: center; }
  .pct-overlay.visible { display: flex; }
  .pct-sheet { background: #fff; width: 100%; max-width: 520px; border-radius: 22px 22px 0 0; padding: 26px 24px 32px; max-height: 90vh; overflow-y: auto; font-family: 'Inter', sans-serif; color: #1a1a1a; }
  .pct-sheet.wide { max-width: 960px; }
  @media (min-width: 620px) { .pct-overlay { align-items: center; } .pct-sheet { border-radius: 22px; } }
  .pct-sheet h2 { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
  .pct-sheet .sheet-sub { font-size: 13px; color: #888; margin: 0 0 18px; line-height: 1.5; }
  .pct-sheet .sheet-actions { display: flex; gap: 12px; margin-top: 22px; }
  .pct-sheet .sheet-actions button { flex: 1; padding: 14px; border-radius: 14px; font-size: 15px; font-weight: 700; font-family: 'Inter', sans-serif; cursor: pointer; border: none; }
  .pct-sheet .btn-secondary { background: #efefef; color: #1a1a1a; }
  .pct-sheet .btn-primary { background: #1a1a1a; color: white; width: auto; }
  .pct-sheet .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .pct-sheet .btn-danger-ghost { background: white; color: #d33; border: 1px solid #f0cccc !important; }
  .pct-sheet .mini-btn { border: 1px solid #e0ded8; background: white; color: #1a1a1a; border-radius: 999px; padding: 7px 13px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; }
  .pct-sheet .pop-media-toggle { display: inline-flex; background: #ececec; border-radius: 999px; padding: 3px; margin-bottom: 16px; }
  .pct-sheet .pop-media-toggle button { background: transparent; border: none; padding: 8px 20px; font-size: 13px; font-weight: 700; color: #666; border-radius: 999px; cursor: pointer; font-family: 'Inter', sans-serif; }
  .pct-sheet .pop-media-toggle button.active { background: white; color: #1a1a1a; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .pct-sheet .drop-zone { border: 2px dashed #d6d6d6; border-radius: 14px; padding: 26px 16px; text-align: center; cursor: pointer; position: relative; background: #fafafa; transition: border-color 0.12s, background 0.12s; }
  .pct-sheet .drop-zone:hover { border-color: #7657FC; background: #f6f3ff; }
  .pct-sheet .drop-zone input[type=file] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .pct-sheet .dz-icon { width: 46px; height: 46px; margin: 0 auto 10px; display: block; }
  .pct-sheet .dz-title { font-size: 14px; font-weight: 700; color: #1a1a1a; }
  .pct-sheet .dz-sub { font-size: 12px; color: #999; margin-top: 3px; }
  .pct-sheet .media-preview video { width: 100%; border-radius: 12px; max-height: 260px; background: #000; display: block; }
  .pct-sheet .compress-status { font-size: 12px; color: #555; font-weight: 600; margin-top: 10px; }
  .pct-sheet .compress-bar-wrap { background: #e8e8e8; border-radius: 99px; height: 5px; margin-top: 6px; overflow: hidden; }
  .pct-sheet .compress-bar { height: 100%; background: #1a1a1a; border-radius: 99px; width: 0%; transition: width 0.2s; }
  .pct-sheet .warn-banner { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 10px 12px; font-size: 12px; color: #555; line-height: 1.5; margin-top: 10px; }
  .pct-sheet .warn-banner a { color: #1a1a1a; font-weight: 700; }
  .pct-sheet .audio-panel { text-align: center; padding: 10px 0 4px; }
  .pct-sheet .audio-rec-btn { background: #1a1a1a; color: white; border: none; border-radius: 999px; padding: 13px 26px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; }
  .pct-sheet .audio-rec-btn.stop { background: #dc2626; }
  .pct-sheet .audio-time { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; margin: 14px 0; color: #1a1a1a; }
  .pct-sheet .rec-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #dc2626; margin-right: 8px; vertical-align: middle; animation: pct-rec-pulse 1s infinite; }
  @keyframes pct-rec-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  .pct-sheet .audio-player-row { display: flex; align-items: center; justify-content: center; gap: 14px; margin: 12px 0; }
  .pct-sheet .audio-play-btn { width: 56px; height: 56px; border-radius: 50%; background: #1a1a1a; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .pct-sheet .ep-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .pct-sheet .ep-x { border: none; background: transparent; cursor: pointer; color: #444; padding: 4px; display: flex; }
  .pct-sheet .ep-grid { display: flex; flex-direction: column; gap: 18px; }
  @media (min-width: 720px) { .pct-sheet .ep-grid { flex-direction: row; align-items: flex-start; } .pct-sheet .ep-preview { flex: 1 1 0; min-width: 0; } .pct-sheet .ep-side { flex: 0 0 340px; } }
  .pct-sheet .ep-stage { position: relative; width: 100%; aspect-ratio: 4 / 3; max-height: 56vh; margin: 0 auto; overflow: hidden; background: #f4f3f0; border-radius: 10px; touch-action: none; cursor: grab; }
  .pct-sheet .ep-stage:active { cursor: grabbing; }
  .pct-sheet .ep-img { position: absolute; max-width: none; transform-origin: center center; user-select: none; -webkit-user-drag: none; will-change: transform; z-index: 1; }
  .pct-sheet .ep-window { position: absolute; z-index: 2; pointer-events: none; box-shadow: 0 0 0 3000px rgba(247,246,242,0.66); border: 1.5px solid rgba(255,255,255,0.92); outline: 1px solid rgba(0,0,0,0.14); }
  .pct-sheet .ep-thirds { position: absolute; inset: 0; display: none; pointer-events: none; background-image: linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px); background-size: 33.333% 33.333%; }
  .pct-sheet .ep-hint { text-align: center; font-size: 12px; color: #999; margin-top: 8px; }
  .pct-sheet .ep-quality { display: flex; align-items: center; justify-content: space-between; background: #f2f0ea; border-radius: 12px; padding: 14px 16px; font-weight: 700; color: #444; margin-bottom: 12px; }
  .pct-sheet .ep-quality b { font-size: 18px; color: #1a1a1a; }
  .pct-sheet .ep-quality.good { background: #eaf7ee; } .pct-sheet .ep-quality.good b { color: #1a7f45; }
  .pct-sheet .ep-quality.warn { background: #fdecec; } .pct-sheet .ep-quality.warn b { color: #d33; }
  .pct-sheet .ep-stat { display: flex; align-items: center; justify-content: space-between; padding: 9px 4px; border-bottom: 1px solid #f2f0ea; font-weight: 600; color: #777; font-size: 15px; }
  .pct-sheet .ep-stat b { color: #1a1a1a; }
  .pct-sheet .ep-btns { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 16px; }
  .pct-sheet .ep-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 2px; border: 1px solid #e6e3db; border-radius: 12px; background: #fff; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 11.5px; font-weight: 600; color: #1a1a1a; }
  .pct-sheet .ep-btn:hover { background: #fafafa; }
  .pct-sheet .ep-btn.active { border-color: #7657FC; background: #f3f0ff; color: #5b3fd6; }
  .pct-sheet .ep-btn.ep-danger { color: #d33; }
  .pct-sheet .ep-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
  .pct-sheet .ep-foot button { padding: 12px 28px; border-radius: 14px; font-size: 15px; font-weight: 700; font-family: 'Inter', sans-serif; cursor: pointer; border: none; }
  `;

  let overlay = null, sheet = null;
  function ensureOverlay() {
    if (overlay) return;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    overlay = document.createElement('div');
    overlay.className = 'pct-overlay';
    sheet = document.createElement('div');
    sheet.className = 'pct-sheet';
    overlay.appendChild(sheet);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
  }
  function open(html, wide) {
    ensureOverlay();
    sheet.className = 'pct-sheet' + (wide ? ' wide' : '');
    sheet.innerHTML = html;
    overlay.classList.add('visible');
  }
  function close() {
    if (recorder) { try { recorder.mediaRecorder.stop(); } catch (e) {} }
    if (overlay) overlay.classList.remove('visible');
  }
  const q = (sel) => sheet.querySelector(sel);

  // ── Photo adjust: one model for the crop window, the page and the print ──
  const DEFAULT_ADJUST = () => ({ fit: 'fill', scale: 1, ox: 0, oy: 0, rot: 0 });
  function normalizeAdjust(a) {
    if (!a || typeof a !== 'object') return DEFAULT_ADJUST();
    return {
      fit: a.fit === 'fit' ? 'fit' : 'fill',
      scale: Math.max(1, Math.min(3, +a.scale || 1)),
      ox: Math.max(-80, Math.min(80, +a.ox || 0)),
      oy: Math.max(-80, Math.min(80, +a.oy || 0)),
      rot: ((Math.round((+a.rot || 0) / 90) * 90) % 360 + 360) % 360,
    };
  }
  // A 1–10 print-quality score from the photo's pixel size and current zoom.
  function printQuality(w, h, scale) {
    if (!w || !h) return 10;
    return Math.max(1, Math.min(10, Math.round(Math.min(w, h) / (scale || 1) / 170)));
  }
  // Clamp the pan so the photo always covers the crop box.
  function clampPan(a, boxW, boxH, iw, ih) {
    if (!iw || !ih || !boxW || !boxH) return a;
    const fitScale = a.fit === 'fit' ? Math.min(boxW / iw, boxH / ih) : Math.max(boxW / iw, boxH / ih);
    const rotated = (a.rot % 180) !== 0;
    const imgW = (rotated ? ih : iw) * fitScale * a.scale;
    const imgH = (rotated ? iw : ih) * fitScale * a.scale;
    const maxOx = Math.max(0, (imgW - boxW) / (2 * boxW) * 100);
    const maxOy = Math.max(0, (imgH - boxH) / (2 * boxH) * 100);
    a.ox = Math.max(-maxOx, Math.min(maxOx, a.ox));
    a.oy = Math.max(-maxOy, Math.min(maxOy, a.oy));
    return a;
  }
  // Lay an <img> out inside its slot `box` with the adjust applied.
  function layoutPhoto(box, img, adjust) {
    const a = normalizeAdjust(adjust);
    const W = box.clientWidth, H = box.clientHeight, iw = img.naturalWidth, ih = img.naturalHeight;
    if (!W || !H || !iw || !ih) return false;
    clampPan(a, W, H, iw, ih);
    const fitScale = a.fit === 'fit' ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih);
    const imgW = iw * fitScale, imgH = ih * fitScale;
    Object.assign(img.style, {
      width: imgW + 'px', height: imgH + 'px', maxWidth: 'none', objectFit: 'fill',
      left: ((W - imgW) / 2 + a.ox / 100 * W) + 'px', top: ((H - imgH) / 2 + a.oy / 100 * H) + 'px',
      transform: `scale(${a.scale}) rotate(${a.rot}deg)`, transformOrigin: 'center center',
    });
    return true;
  }
  // The print bake: draw `img` into (x, y, w, h) with the same geometry.
  function drawPhotoAdjusted(ctx, img, adjust, x, y, w, h) {
    const a = normalizeAdjust(adjust);
    const iw = img.naturalWidth, ih = img.naturalHeight;
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
  }

  // ── Edit Photo ──────────────────────────────────────────────────────────
  let ep = null;   // { opts, url, a, gridOn, iw, ih }
  function epIcon(name) {
    const o = 'width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    const P = {
      fill: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
      fit: '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="10" y1="14" x2="3" y2="21"/>',
      grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
      rotate: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
      replace: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
      remove: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
      zin: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>',
      zout: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>',
    };
    return `<svg ${o}>${P[name] || ''}</svg>`;
  }
  function editPhoto(opts) {
    ep = { opts, url: opts.url, a: normalizeAdjust(opts.adjust), gridOn: false, iw: 0, ih: 0 };
    renderEditPhoto();
  }
  function renderEditPhoto() {
    const btn = (act, label) => `<button class="ep-btn${act === 'remove' ? ' ep-danger' : ''}" data-act="${act}">${epIcon(act)}<span>${label}</span></button>`;
    const hasRemove = typeof ep.opts.onRemove === 'function';
    open(`
      <div class="ep-head"><h2>Edit Photo</h2><button class="ep-x" id="ep-close" aria-label="Close">${IC_X}</button></div>
      <div class="ep-grid">
        <div class="ep-preview">
          <div class="ep-stage" id="ep-stage">
            <img class="ep-img" id="ep-img" src="${esc(ep.url)}" draggable="false" alt=""/>
            <div class="ep-window" id="ep-window"><div class="ep-thirds" id="ep-thirds"></div></div>
          </div>
          <div class="ep-hint">Drag the photo to reposition — the faded area is the rest of your photo</div>
        </div>
        <div class="ep-side">
          <div class="ep-quality" id="ep-quality"><span>Print Quality</span><b id="ep-q">—</b></div>
          <div class="ep-stat"><span>Scale</span><b id="ep-scale">100%</b></div>
          <div class="ep-stat"><span>Dimensions</span><b id="ep-dims">—</b></div>
          <div class="ep-stat"><span>Source</span><b>${esc(ep.opts.source || 'Device')}</b></div>
          <div class="ep-btns">
            ${btn('fill', 'Fill')}${btn('fit', 'Fit')}${btn('grid', 'Grid')}${btn('rotate', 'Rotate')}
            ${btn('replace', 'Replace')}${hasRemove ? btn('remove', 'Remove') : ''}${btn('zin', 'Zoom In')}${btn('zout', 'Zoom Out')}
          </div>
        </div>
      </div>
      <div class="ep-foot"><button class="btn-secondary" id="ep-cancel">Cancel</button><button class="btn-primary" id="ep-save">Save</button></div>
    `, true);
    const img = q('#ep-img');
    const setDims = () => { ep.iw = img.naturalWidth; ep.ih = img.naturalHeight; updateEp(); };
    if (img.complete && img.naturalWidth) setDims(); else img.addEventListener('load', setDims);
    q('#ep-close').addEventListener('click', close);
    q('#ep-cancel').addEventListener('click', close);
    q('#ep-save').addEventListener('click', () => { const a = { ...ep.a }; close(); ep.opts.onSave && ep.opts.onSave(a); });
    sheet.querySelectorAll('.ep-btn').forEach((b) => b.addEventListener('click', () => epAction(b.dataset.act)));
    enableEpPan();
    requestAnimationFrame(updateEp);
  }
  // The window is the slot's shape; the photo is drawn at its full fit size
  // behind it, then panned, scaled and rotated.
  function layoutEp() {
    const stage = q('#ep-stage'), win = q('#ep-window'), img = q('#ep-img');
    if (!stage || !win || !img) return;
    const SW = stage.clientWidth, SH = stage.clientHeight;
    if (!SW || !SH) return;
    const ar = ep.opts.aspect || 1, pad = 0.86;
    let ww, wh;
    if (SW / SH > ar) { wh = SH * pad; ww = wh * ar; } else { ww = SW * pad; wh = ww / ar; }
    const wx = (SW - ww) / 2, wy = (SH - wh) / 2;
    Object.assign(win.style, { left: wx + 'px', top: wy + 'px', width: ww + 'px', height: wh + 'px' });
    ep._ww = ww; ep._wh = wh;
    const iw = ep.iw, ih = ep.ih;
    if (iw && ih) {
      const a = ep.a;
      clampPan(a, ww, wh, iw, ih);
      const fitScale = a.fit === 'fit' ? Math.min(ww / iw, wh / ih) : Math.max(ww / iw, wh / ih);
      const imgW = iw * fitScale, imgH = ih * fitScale;
      Object.assign(img.style, { width: imgW + 'px', height: imgH + 'px', left: (wx + ww / 2 - imgW / 2) + 'px', top: (wy + wh / 2 - imgH / 2) + 'px' });
      img.style.transform = `translate(${a.ox / 100 * ww}px, ${a.oy / 100 * wh}px) scale(${a.scale}) rotate(${a.rot}deg)`;
    }
  }
  function updateEp() {
    if (!q('#ep-img')) return;
    const a = ep.a;
    layoutEp();
    q('#ep-scale').textContent = Math.round(a.scale * 100) + '%';
    q('#ep-dims').textContent = ep.iw ? `${ep.iw} × ${ep.ih}` : '—';
    const score = printQuality(ep.iw, ep.ih, a.scale);
    q('#ep-q').textContent = score + '/10';
    q('#ep-quality').classList.toggle('good', score >= 8);
    q('#ep-quality').classList.toggle('warn', score <= 4);
    q('#ep-thirds').style.display = ep.gridOn ? 'block' : 'none';
    const set = (act, on) => { const el = sheet.querySelector(`.ep-btn[data-act="${act}"]`); if (el) el.classList.toggle('active', on); };
    set('fill', a.fit === 'fill'); set('fit', a.fit === 'fit'); set('grid', ep.gridOn);
  }
  function epAction(act) {
    const a = ep.a;
    if (act === 'fill') a.fit = 'fill';
    else if (act === 'fit') a.fit = 'fit';
    else if (act === 'grid') ep.gridOn = !ep.gridOn;
    else if (act === 'rotate') a.rot = (a.rot + 90) % 360;
    else if (act === 'zin') a.scale = Math.min(3, Math.round((a.scale + 0.1) * 10) / 10);
    else if (act === 'zout') a.scale = Math.max(1, Math.round((a.scale - 0.1) * 10) / 10);
    else if (act === 'remove') { close(); ep.opts.onRemove(); return; }
    else if (act === 'replace') {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.addEventListener('change', async () => {
        const f = inp.files[0];
        if (!f) return;
        const url = await ep.opts.onReplace(f);
        if (url) { ep.url = url; ep.a = DEFAULT_ADJUST(); ep.gridOn = false; renderEditPhoto(); }
      });
      inp.click();
      return;
    }
    updateEp();
  }
  function enableEpPan() {
    const stage = q('#ep-stage'), win = q('#ep-window');
    stage.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const a = ep.a, rect = win.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY, ox0 = a.ox, oy0 = a.oy;
      const move = (ev) => {
        a.ox = Math.max(-80, Math.min(80, ox0 + (ev.clientX - sx) / rect.width * 100));
        a.oy = Math.max(-80, Math.min(80, oy0 + (ev.clientY - sy) / rect.height * 100));
        updateEp();
      };
      const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      // iOS cancels a touch it takes over; without this the next touch pans from stale coordinates.
      document.addEventListener('pointercancel', up);
    });
  }
  window.addEventListener('resize', () => { if (overlay && overlay.classList.contains('visible') && q('#ep-stage')) updateEp(); });

  // ── Add a Popcode: Video / Montage / Audio ──────────────────────────────
  let pop = null;   // { opts, had, mediaType, video, audio, existingVideoUrl, existingAudioUrl }
  let montageReady = false;
  function popcodeSheet(opts) {
    const c = opts.current || {};
    pop = {
      opts, had: !!(c.video || c.audio || c.existingVideoUrl || c.existingAudioUrl),
      mediaType: c.mediaType || 'video', video: c.video || null, audio: c.audio || null,
      existingVideoUrl: c.existingVideoUrl || null, existingAudioUrl: c.existingAudioUrl || null,
    };
    // The montage builder is shared (/montage.js); what it renders goes into
    // this Popcode's video slot, so montage needs no media type of its own.
    if (!montageReady && window.PopcodeMontage && opts.db) {
      window.PopcodeMontage.init({
        db: opts.db,
        getUser: opts.getUser || (() => null),
        onApply: (target, file) => {
          const st = target || pop;
          if (!st) return;
          st.video = file; st.mediaType = 'video'; st.existingVideoUrl = null; st.isMontage = true;
          renderPopcodeSheet();
        },
        onRendered: opts.onMontageRendered,
      });
      montageReady = true;
    }
    renderPopcodeSheet();
  }
  const popHasMedia = (s) => (s.mediaType === 'video' ? !!(s.video || s.existingVideoUrl) : !!(s.audio || s.existingAudioUrl));
  function renderPopcodeSheet() {
    const s = pop;
    const noun = s.opts.noun || 'photo';
    const montage = !!(window.PopcodeMontage && montageReady);
    open(`
      <h2>${s.had ? 'Edit' : 'Add a'} Popcode</h2>
      <p class="sheet-sub">Link a video${montage ? ', a montage you build from photos,' : ''} or an audio clip. When someone scans the printed ${esc(noun)}, it plays automatically.</p>
      <div class="pop-media-toggle">
        <button data-mode="video" class="${s.mediaType === 'video' ? 'active' : ''}">Video</button>
        ${montage ? '<button data-mode="montage">Montage</button>' : ''}
        <button data-mode="audio" class="${s.mediaType === 'audio' ? 'active' : ''}">Audio</button>
      </div>
      <div id="pop-body"></div>
      <div class="sheet-actions">
        ${s.had ? '<button class="btn-danger-ghost" id="pop-unlink">Remove Popcode</button>' : '<button class="btn-secondary" id="pop-cancel">Cancel</button>'}
        <button class="btn-primary" id="pop-save" ${popHasMedia(s) ? '' : 'disabled'}>Save Popcode</button>
      </div>
    `);
    sheet.querySelectorAll('.pop-media-toggle button').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.mode === 'montage') { close(); window.openMontage(s); return; }
      s.mediaType = b.dataset.mode; renderPopcodeSheet();
    }));
    q('#pop-save').addEventListener('click', () => {
      if (!popHasMedia(s)) return;
      const isVideo = s.mediaType === 'video';
      const out = {
        mediaType: s.mediaType,
        video: isVideo ? s.video : null,
        audio: isVideo ? null : s.audio,
        existingVideoUrl: isVideo && !s.video ? s.existingVideoUrl : null,
        existingAudioUrl: !isVideo && !s.audio ? s.existingAudioUrl : null,
      };
      close(); s.opts.onSave(out);
    });
    const unlink = q('#pop-unlink');
    if (unlink) unlink.addEventListener('click', () => { close(); s.opts.onSave(null); });
    const cancel = q('#pop-cancel');
    if (cancel) cancel.addEventListener('click', close);
    renderPopBody();
  }
  function renderPopBody() {
    const s = pop, body = q('#pop-body');
    if (s.mediaType === 'video') {
      if (s.video || s.existingVideoUrl) {
        const src = s.video ? URL.createObjectURL(s.video) : s.existingVideoUrl;
        const caption = s.video ? `${esc(s.video.name || 'video')} · ${formatMB(s.video.size)}` : 'Current video';
        body.innerHTML = `
          <div class="media-preview">
            <video src="${esc(src)}" controls playsinline muted></video>
            <div class="compress-status">${caption}</div>
            <button class="mini-btn" id="pop-video-change" style="margin-top:10px">Choose a different video</button>
          </div>`;
        q('#pop-video-change').addEventListener('click', () => { s.video = null; s.existingVideoUrl = null; renderPopBody(); });
      } else {
        body.innerHTML = `
          <div class="drop-zone">
            <input type="file" accept="video/*" id="pop-video-input"/>
            <img class="dz-icon" src="/assets/video.png" alt=""/>
            <div class="dz-title">Choose a video</div>
            <div class="dz-sub">Up to ${MAX_VIDEO_MB} MB · large files can be compressed</div>
          </div>
          <div id="pop-video-msg"></div>`;
        q('#pop-video-input').addEventListener('change', (e) => handleVideoPick(e.target));
      }
    } else if (s.audio || s.existingAudioUrl) {
      const src = s.audio ? URL.createObjectURL(s.audio) : s.existingAudioUrl;
      body.innerHTML = `
        <div class="audio-panel">
          <div class="audio-player-row">
            <button class="audio-play-btn" id="pop-audio-play"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
            <div class="audio-time" id="pop-audio-dur" style="margin:0">0:00</div>
          </div>
          <audio id="pop-audio-el" src="${esc(src)}" preload="metadata"></audio>
          <button class="mini-btn" id="pop-audio-rerec">${s.audio ? 'Re-record' : 'Record a new clip'}</button>
          <div class="compress-status">${s.audio ? formatMB(s.audio.size) : 'Current audio'}</div>
        </div>`;
      wireAudioPreview();
      q('#pop-audio-rerec').addEventListener('click', () => { s.audio = null; s.existingAudioUrl = null; renderPopBody(); });
    } else {
      body.innerHTML = `
        <div class="audio-panel">
          <div class="audio-time" id="pop-audio-elapsed">0:00</div>
          <button class="audio-rec-btn" id="pop-audio-rec">● Record</button>
          <div class="dz-sub" style="margin-top:12px">Tap record and speak. Tap again to stop.</div>
        </div>`;
      q('#pop-audio-rec').addEventListener('click', toggleRecord);
    }
    const save = q('#pop-save');
    if (save) save.disabled = !popHasMedia(s);
  }

  // Video pick + compress (create.html → book.html → calendar.html → here).
  function canCompressVideo() {
    try {
      const canvas = document.createElement('canvas');
      if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') return false;
      return ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].some((t) => MediaRecorder.isTypeSupported(t));
    } catch (e) { return false; }
  }
  // Re-encodes through a canvas. The canvas stream has no sound, so the
  // video's own audio is routed in too (Web Audio, not the speakers); if the
  // browser won't allow that, it falls back to a silent copy as before.
  function compressVideo(file, onProgress) {
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t));
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const srcUrl = URL.createObjectURL(file);
      video.src = srcUrl; video.playsInline = true;
      let actx = null;
      const finish = () => { URL.revokeObjectURL(srcUrl); if (actx) actx.close().catch(() => {}); };
      video.onloadedmetadata = () => {
        const scale = Math.min(1, 1280 / Math.max(video.videoWidth || 1, video.videoHeight || 1));
        const w = Math.max(2, Math.round(video.videoWidth * scale / 2) * 2);
        const h = Math.max(2, Math.round(video.videoHeight * scale / 2) * 2);
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        const stream = canvas.captureStream(30);
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          actx = new AC();
          const dest = actx.createMediaStreamDestination();
          actx.createMediaElementSource(video).connect(dest);
          dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
        } catch (e) {
          video.muted = true;   // no audio routing: a silent copy, as before
        }
        const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        rec.onstop = () => { finish(); resolve(new Blob(chunks, { type: mimeType.split(';')[0] })); };
        rec.onerror = (e) => { finish(); reject(e.error || new Error('Compression error')); };
        let animId;
        const draw = () => { if (!video.ended && !video.paused) { ctx.drawImage(video, 0, 0, w, h); onProgress && onProgress(video.currentTime / (video.duration || 1)); animId = requestAnimationFrame(draw); } };
        video.onended = () => { cancelAnimationFrame(animId); rec.stop(); };
        rec.start(200);
        if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
        video.play().then(draw).catch(() => {
          // Autoplay with sound refused: carry on silent rather than fail.
          video.muted = true;
          video.play().then(draw).catch((e) => { finish(); reject(e); });
        });
      };
      video.onerror = () => { finish(); reject(new Error('Could not load video for compression')); };
      video.load();
    });
  }
  async function handleVideoPick(input) {
    const file = input.files[0];
    if (!file) return;
    const sizeMB = file.size / (1024 * 1024);
    const msg = q('#pop-video-msg');
    if (sizeMB <= MAX_VIDEO_MB) { pop.video = file; renderPopBody(); return; }
    if (!canCompressVideo()) {
      msg.innerHTML = `<div class="warn-banner">${sizeMB.toFixed(1)} MB — over the ${MAX_VIDEO_MB} MB limit. Compress free at <a href="https://clideo.com/compress-video" target="_blank" rel="noopener">clideo.com</a>, then choose it again.</div>`;
      input.value = '';
      return;
    }
    const ask = window.popcodeConfirm
      ? await window.popcodeConfirm(`It's ${sizeMB.toFixed(1)} MB, and the limit is ${MAX_VIDEO_MB} MB. We can compress it for you — it can take a minute.`, { title: 'This video is too big', confirmText: 'Compress it', cancelText: 'Choose another video' })
      : true;
    if (!ask) { input.value = ''; return; }
    msg.innerHTML = '<div class="compress-status">Compressing… 0%</div><div class="compress-bar-wrap"><div class="compress-bar" id="pct-cbar"></div></div>';
    let compressed = null;
    try {
      compressed = await compressVideo(file, (p) => {
        const bar = q('#pct-cbar');
        if (bar) bar.style.width = Math.round(p * 100) + '%';
        const st = msg.querySelector('.compress-status');
        if (st) st.textContent = `Compressing… ${Math.round(p * 100)}%`;
      });
    } catch (e) { compressed = null; }
    const cMB = compressed ? compressed.size / (1024 * 1024) : Infinity;
    if (compressed && cMB <= MAX_VIDEO_MB) {
      pop.video = new File([compressed], (file.name || 'video').replace(/\.[^.]+$/, '.webm'), { type: compressed.type });
      renderPopBody();
    } else {
      msg.innerHTML = `<div class="warn-banner">Still too large${cMB < Infinity ? ' (' + cMB.toFixed(0) + ' MB)' : ''}. Compress further at <a href="https://clideo.com/compress-video" target="_blank" rel="noopener">clideo.com</a>, then choose it again.</div>`;
      input.value = '';
    }
  }

  // Audio record.
  let recorder = null;
  function pickAudioMime() {
    if (typeof MediaRecorder === 'undefined') return null;
    for (const c of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus']) {
      if (MediaRecorder.isTypeSupported(c)) {
        return { mime: c, ext: c.startsWith('audio/mp4') ? 'm4a' : c.startsWith('audio/ogg') ? 'ogg' : 'webm' };
      }
    }
    return { mime: '', ext: 'webm' };
  }
  async function toggleRecord() {
    if (recorder) {
      if (recorder.timerId) clearInterval(recorder.timerId);
      try { recorder.mediaRecorder.stop(); } catch (e) {}
      return;
    }
    const pick = pickAudioMime();
    if (!pick) { alert('Audio recording is not supported in this browser.'); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { alert('Microphone access was denied. Enable it in your browser settings and try again.'); return; }
    const mr = new MediaRecorder(stream, pick.mime ? { mimeType: pick.mime } : {});
    const chunks = [];
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mr.onstop = async () => {
      const blob = new Blob(chunks, { type: pick.mime || mr.mimeType || 'audio/webm' });
      stream.getTracks().forEach((t) => t.stop());
      if (recorder && recorder.timerId) clearInterval(recorder.timerId);
      recorder = null;
      // iOS can't play webm/opus — normalise to WAV so it plays on every device.
      const norm = window.normalizeAudio ? await window.normalizeAudio(blob, pick.ext) : { blob, ext: pick.ext };
      pop.audio = new File([norm.blob], `audio.${norm.ext}`, { type: norm.blob.type });
      if (overlay.classList.contains('visible')) renderPopBody();
    };
    mr.start();
    recorder = { mediaRecorder: mr, startTs: Date.now(), timerId: null };
    const recBtn = q('#pop-audio-rec');
    if (recBtn) { recBtn.textContent = '■ Stop'; recBtn.classList.add('stop'); }
    recorder.timerId = setInterval(() => {
      if (!recorder) return;
      const s = Math.floor((Date.now() - recorder.startTs) / 1000);
      const el = q('#pop-audio-elapsed');
      if (el) el.innerHTML = `<span class="rec-dot"></span>${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }, 250);
  }
  function wireAudioPreview() {
    const audio = q('#pop-audio-el'), btn = q('#pop-audio-play'), dur = q('#pop-audio-dur');
    if (!audio || !btn) return;
    const play = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    const pause = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
    const fmt = (s) => (s && isFinite(s)) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00';
    audio.addEventListener('loadedmetadata', () => { dur.textContent = fmt(audio.duration); });
    audio.addEventListener('play', () => { btn.innerHTML = pause; });
    audio.addEventListener('pause', () => { btn.innerHTML = play; });
    audio.addEventListener('timeupdate', () => { if (!audio.paused) dur.textContent = fmt(audio.currentTime); });
    audio.addEventListener('ended', () => { dur.textContent = fmt(audio.duration); btn.innerHTML = play; });
    btn.addEventListener('click', () => { if (audio.paused) audio.play(); else audio.pause(); });
  }

  window.PopcodeTools = {
    popcodeSheet, editPhoto, close,
    DEFAULT_ADJUST, normalizeAdjust, clampPan, layoutPhoto, drawPhotoAdjusted, printQuality,
  };
})();
