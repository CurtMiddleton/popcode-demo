/* Where the "Image to scan" comes from — one menu, every source in it.
 *
 *   openImageSourceMenu({ onPick(imageFile) {}, onPickMany(imageFiles) {},
 *                         current, aspect })
 *
 * With `current` (the photo already on the page: a File, Blob or URL) the menu
 * leads with "Crop & zoom", which hands a cropped copy to onPick exactly as if
 * it had been picked fresh. `aspect` (w/h) adds a "Fits your product" shape.
 *
 * Tapping the scan-image tile opens this instead of going straight to the OS
 * picker, so "Frame from video" sits alongside the camera and the photo library
 * rather than hiding behind a second control.
 *
 * Every row is a real <label> around a real <input type="file">. That is not
 * cosmetic: iOS Safari silently refuses a programmatic .click() on a file input
 * outside a direct tap handler, so nothing here may open a picker from JS.
 *
 * "Photo Library" and "Choose File" are one row, because on iOS they are two
 * rows of Apple's own sheet and a web page cannot open that sheet pre-narrowed
 * to one of them — listing them separately would just show Apple's sheet twice.
 */
(function () {
  const MAX_DIM = 2560; // matches create.html's photo downscale target

  const IC_LIBRARY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
  const IC_CAMERA  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  // Film strip with a scrub playhead through it — a frame being picked out of a video.
  const IC_FRAME   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
    + '<rect x="3" y="6" width="18" height="12" rx="1.3"/>'
    + '<line x1="3" y1="8.7" x2="21" y2="8.7"/><line x1="3" y1="15.3" x2="21" y2="15.3"/>'
    + '<line x1="5.7" y1="6" x2="5.7" y2="8.7"/><line x1="5.7" y1="15.3" x2="5.7" y2="18"/>'
    + '<line x1="12.6" y1="6" x2="12.6" y2="8.7"/><line x1="12.6" y1="15.3" x2="12.6" y2="18"/>'
    + '<line x1="17.4" y1="6" x2="17.4" y2="8.7"/><line x1="17.4" y1="15.3" x2="17.4" y2="18"/>'
    + '<line x1="8.4" y1="4.4" x2="8.4" y2="19.6"/>'
    + '<path d="M8.4 3.3 L10.9 0.4 L5.9 0.4 Z" fill="currentColor" stroke="none"/>'
    + '<path d="M8.4 20.7 L5.9 23.6 L10.9 23.6 Z" fill="currentColor" stroke="none"/></svg>';
  const IC_VIDEO   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10.5L22 7v10l-6-3.5z"/></svg>';
  const IC_MONTAGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="3" width="13" height="13" rx="2"/><path d="M16 19v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h1"/><path d="M8 12.5l3-3 4 4"/><circle cx="13" cy="7.5" r="1.2"/></svg>';
  const IC_AUDIO   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10.5a7 7 0 0 0 14 0"/><line x1="12" y1="17.5" x2="12" y2="21"/><line x1="8.5" y1="21" x2="15.5" y2="21"/></svg>';

  const IC_CROP    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>';
  const IC_ROTATE  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';

  let injected = false;
  function injectStyles() {
    if (injected) return;
    injected = true;
    const css = document.createElement('style');
    css.textContent = `
      .vfr-overlay {
        position: fixed; inset: 0; z-index: 9600; display: none;
        align-items: flex-end; justify-content: center;
        background: rgba(0,0,0,.5); backdrop-filter: blur(2px);
      }
      .vfr-overlay.open { display: flex; }
      .vfr-sheet {
        background: #fff; width: 100%; max-width: 640px; max-height: 92vh;
        border-radius: 22px 22px 0 0; display: flex; flex-direction: column;
        overflow: hidden; box-shadow: 0 -10px 44px rgba(0,0,0,.22);
        animation: vfrUp .22s ease;
      }
      @keyframes vfrUp { from { transform: translateY(30px); opacity: .6; } to { transform: none; opacity: 1; } }
      @media (min-width: 680px) { .vfr-overlay { align-items: center; } .vfr-sheet { border-radius: 22px; } }
      .vfr-head { display: flex; align-items: center; justify-content: space-between; padding: 30px 24px 14px; }
      .vfr-title { font-size: 32px; font-weight: 400; color: #1a1a1a; font-family: 'CooperBT', Georgia, serif; }
      .vfr-close {
        background: #f3f3f3; border: none; color: #1a1a1a; width: 36px; height: 36px;
        border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;
      }
      .vfr-close:hover { background: #ecebe5; }
      .vfr-close svg { width: 18px; height: 18px; }
      .vfr-body { padding: 8px 24px 20px; overflow-y: auto; }
      .vfr-sub { font-size: 14px; color: #8a8a8a; margin: 0 0 20px; line-height: 1.5; font-family: 'Inter', sans-serif; }
      .vfr-stage {
        background: #111; border-radius: 16px; overflow: hidden; display: flex;
        align-items: center; justify-content: center; min-height: 200px; max-height: 46vh;
      }
      .vfr-stage video { max-width: 100%; max-height: 46vh; display: block; }
      .vfr-scrub { width: 100%; margin: 20px 0 4px; accent-color: #1a1a1a; }
      .vfr-times {
        display: flex; justify-content: space-between; font-size: 12px; color: #8a8a8a;
        font-family: 'Inter', sans-serif; font-variant-numeric: tabular-nums;
      }
      .vfr-steps { display: flex; justify-content: center; gap: 10px; margin: 16px 0 4px; }
      .vfr-step {
        background: #f3f3f3; border: none; border-radius: 999px; padding: 8px 16px;
        font-size: 12px; font-weight: 700; color: #1a1a1a; cursor: pointer; font-family: 'Inter', sans-serif;
      }
      .vfr-step:hover { background: #ecebe5; }
      .vfr-tip { font-size: 12px; color: #aaa; margin: 14px 0 0; line-height: 1.5; font-family: 'Inter', sans-serif; text-align: center; }
      .vfr-foot {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 16px 24px 24px; border-top: 1px solid #f0efea;
      }
      .vfr-btn {
        border-radius: 999px; font-size: 14px; font-weight: 700; padding: 13px 22px;
        cursor: pointer; font-family: 'Inter', sans-serif; border: 1px solid transparent;
      }
      .vfr-btn[disabled] { opacity: .4; cursor: default; }
      .vfr-again { background: #fff; color: #1a1a1a; border-color: #e4e2dc; }
      .vfr-again input { display: none; }
      .vfr-use { background: #1a1a1a; color: #fff; flex: 1; max-width: 260px; }

      .ism-list { padding: 0 16px 12px; }
      .ism-row {
        display: flex; align-items: center; gap: 14px; width: 100%;
        background: none; border: none; font: inherit; -webkit-appearance: none; appearance: none;
        padding: 15px 12px; border-radius: 14px; cursor: pointer;
        font-family: 'Inter', sans-serif; text-align: left;
      }
      .ism-row:hover { background: #f9f9f9; }
      .ism-row:active { background: #f0efea; }
      .ism-row input { display: none; }
      .ism-icon {
        flex: 0 0 auto; width: 42px; height: 42px; border-radius: 50%;
        background: #f3f3f3; color: #1a1a1a;
        display: flex; align-items: center; justify-content: center;
      }
      .ism-icon svg { width: 22px; height: 22px; }
      .ism-text { min-width: 0; flex: 1; }
      .ism-name { display: block; font-size: 15px; font-weight: 700; color: #1a1a1a; line-height: 1.3; }
      .ism-desc { display: block; font-size: 12.5px; color: #8a8a8a; line-height: 1.4; margin-top: 2px; }

      .pcr-stage {
        position: relative; background: #111; border-radius: 16px; overflow: hidden;
        height: min(52vh, 440px); touch-action: none; cursor: grab; user-select: none;
      }
      .pcr-stage:active { cursor: grabbing; }
      .pcr-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
      .pcr-shapes { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 14px; }
      .pcr-shape {
        background: #f3f3f3; border: 1px solid transparent; border-radius: 999px; padding: 7px 14px;
        font-size: 12.5px; font-weight: 700; color: #1a1a1a; cursor: pointer; font-family: 'Inter', sans-serif;
      }
      .pcr-shape.on { background: #fff; border-color: #1a1a1a; }
      .pcr-tools { display: flex; align-items: center; gap: 12px; margin: 16px 0 4px; }
      .pcr-zoom { flex: 1; accent-color: #1a1a1a; }
      .pcr-rot {
        flex: 0 0 auto; background: #f3f3f3; border: none; border-radius: 999px; padding: 8px 14px;
        font-size: 12px; font-weight: 700; color: #1a1a1a; cursor: pointer; font-family: 'Inter', sans-serif;
        display: flex; align-items: center; gap: 6px;
      }
      .pcr-rot svg { width: 15px; height: 15px; }
      .pcr-rot:hover, .pcr-shape:hover { background: #ecebe5; }
      .pcr-info { font-size: 12px; color: #8a8a8a; margin: 10px 0 0; text-align: center; font-family: 'Inter', sans-serif; font-variant-numeric: tabular-nums; }
      .pcr-info.warn { color: #b45309; }
    `;
    document.head.appendChild(css);
  }

  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  // Shared sheet for both tiles: a titled list where each row either opens a
  // file picker (rows with an `accept`) or runs an action.
  //
  // A file row must be a real <label> around a real <input type="file">. That
  // is not cosmetic: iOS Safari silently refuses a programmatic .click() on a
  // file input outside a direct tap handler, so nothing here may open a picker
  // from JS.
  function openMenu(title, rows) {
    injectStyles();

    const ov = document.createElement('div');
    ov.className = 'vfr-overlay open';
    ov.innerHTML = `
      <div class="vfr-sheet" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="vfr-head">
          <div class="vfr-title">${title}</div>
          <button type="button" class="vfr-close" title="Close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="ism-list">
          ${rows.map((r, i) => r.accept ? `
            <label class="ism-row" data-i="${i}">
              <input type="file" accept="${r.accept}"${r.capture ? ` capture="${r.capture}"` : ''}${r.runMany ? ' multiple' : ''}/>
              <span class="ism-icon">${r.icon}</span>
              <span class="ism-text"><span class="ism-name">${r.name}</span><span class="ism-desc">${r.desc}</span></span>
            </label>` : `
            <button type="button" class="ism-row" data-i="${i}">
              <span class="ism-icon">${r.icon}</span>
              <span class="ism-text"><span class="ism-name">${r.name}</span><span class="ism-desc">${r.desc}</span></span>
            </button>`).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(ov);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function close() {
      document.body.style.overflow = prevOverflow;
      ov.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    ov.querySelector('.vfr-close').addEventListener('click', close);
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });

    ov.querySelectorAll('.ism-row').forEach(el => {
      const row = rows[Number(el.dataset.i)];
      const input = el.querySelector('input');
      if (input) {
        input.addEventListener('change', function () {
          const files = this.files ? Array.from(this.files) : [];
          this.value = ''; // so re-picking the same file still fires
          if (!files.length) return;
          close();
          if (row.runMany && files.length > 1) row.runMany(files);
          else row.run(files[0]);
        });
      } else {
        el.addEventListener('click', () => { close(); row.run(); });
      }
    });
  }

  // Where the scan image comes from. Photo Library and Choose File are one row
  // on purpose: on iOS they are two rows of Apple's own sheet, and a page cannot
  // open that sheet pre-narrowed to one of them.
  //
  // opts.onPickMany(files), when given, lets the library row take several
  // images at once (one page each); picking just one still calls onPick.
  window.openImageSourceMenu = function openImageSourceMenu(opts) {
    opts = opts || {};
    const pick = (f) => { if (opts.onPick) opts.onPick(f); };
    const many = opts.onPickMany ? (fs) => opts.onPickMany(fs) : null;
    const crop = opts.current ? [{ name: 'Crop & zoom', desc: 'Zoom in, crop or rotate this photo', icon: IC_CROP,
      run: () => window.openPhotoCropper(opts.current, { aspect: opts.aspect, onPick: pick }) }] : [];
    openMenu(many ? 'Images to scan' : 'Image to scan', crop.concat([
      { name: 'Photo Library or File', desc: many ? 'Pick one photo, or several at once' : 'Pick a photo you already have',
        icon: IC_LIBRARY, accept: 'image/*', run: pick, runMany: many },
      { name: 'Take Photo', desc: 'Shoot one with the camera now', icon: IC_CAMERA, accept: 'image/*', capture: 'environment', run: pick },
      { name: 'Frame from Video', desc: 'Scrub a video and grab a still from it', icon: IC_FRAME, accept: 'video/*',
        run: (videoFile) => showSheet(videoFile, { onPick: pick }) }
    ]));
  };

  // What plays when the image is scanned.
  window.openMediaSourceMenu = function openMediaSourceMenu(opts) {
    opts = opts || {};
    openMenu('Plays when scanned', [
      { name: 'Video', desc: 'Upload a video from your phone', icon: IC_VIDEO, accept: 'video/*',
        run: (f) => { if (opts.onVideo) opts.onVideo(f); } },
      { name: 'Montage', desc: 'Turn photos into a memory video', icon: IC_MONTAGE,
        run: () => { if (opts.onMontage) opts.onMontage(); } },
      { name: 'Audio', desc: 'Record a voice message', icon: IC_AUDIO,
        run: () => { if (opts.onAudio) opts.onAudio(); } }
    ]);
  };

  // Open the frame sheet for a video the caller already has in hand.
  //
  // There is deliberately no "open the file picker for you" entry point: iOS
  // Safari refuses a programmatic .click() on a file input unless it happens
  // inside a direct tap handler, and it fails silently when it refuses. Callers
  // put a real <label> around a real <input type="file"> — a tap on the label
  // forwards activation natively — and hand us the File from its change event.
  window.openFrameSheet = function openFrameSheet(file, opts) {
    injectStyles();
    showSheet(file, opts || {});
  };

  function showSheet(file, opts) {
    const url = URL.createObjectURL(file);

    const ov = document.createElement('div');
    ov.className = 'vfr-overlay open';
    ov.innerHTML = `
      <div class="vfr-sheet" role="dialog" aria-modal="true" aria-label="Frame from video">
        <div class="vfr-head">
          <div class="vfr-title">Frame from video</div>
          <button type="button" class="vfr-close" title="Close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="vfr-body">
          <p class="vfr-sub">Scrub to the moment you want. That frame becomes the image people point their camera at.</p>
          <div class="vfr-stage"><video playsinline muted preload="auto"></video></div>
          <input class="vfr-scrub" type="range" min="0" max="1000" value="0" step="1" aria-label="Scrub through the video"/>
          <div class="vfr-times"><span class="vfr-cur">0:00</span><span class="vfr-dur">0:00</span></div>
          <div class="vfr-steps">
            <button type="button" class="vfr-step" data-step="-1">− Frame</button>
            <button type="button" class="vfr-step" data-step="1">+ Frame</button>
          </div>
          <p class="vfr-tip">Pick a sharp, well-lit moment — blurry frames are harder for the camera to recognize.</p>
        </div>
        <div class="vfr-foot">
          <label class="vfr-btn vfr-again">Different video<input type="file" accept="video/*"/></label>
          <button type="button" class="vfr-btn vfr-use" disabled>Use this frame</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);

    const video = ov.querySelector('video');
    const scrub = ov.querySelector('.vfr-scrub');
    const curEl = ov.querySelector('.vfr-cur');
    const durEl = ov.querySelector('.vfr-dur');
    const useBtn = ov.querySelector('.vfr-use');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function close() {
      document.body.style.overflow = prevOverflow;
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {}
      URL.revokeObjectURL(url);
      ov.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') { close(); if (opts.onCancel) opts.onCancel(); } }
    document.addEventListener('keydown', onKey);

    ov.querySelector('.vfr-close').addEventListener('click', () => { close(); if (opts.onCancel) opts.onCancel(); });
    ov.addEventListener('click', (e) => { if (e.target === ov) { close(); if (opts.onCancel) opts.onCancel(); } });
    ov.querySelector('.vfr-again input').addEventListener('change', function () {
      const next = this.files && this.files[0];
      if (!next) return;
      close();
      showSheet(next, opts);
    });

    // Some containers (notably webm written by MediaRecorder) report an infinite
    // duration until you seek past the end, which leaves the scrubber dead.
    function resolveDuration() {
      if (isFinite(video.duration)) return Promise.resolve();
      return new Promise((done) => {
        const onUpdate = () => {
          if (!isFinite(video.duration)) return;
          video.removeEventListener('durationchange', onUpdate);
          video.currentTime = 0;
          done();
        };
        video.addEventListener('durationchange', onUpdate);
        try { video.currentTime = 1e101; } catch (e) { done(); }
        setTimeout(() => { video.removeEventListener('durationchange', onUpdate); done(); }, 3000);
      });
    }

    video.addEventListener('loadedmetadata', async () => {
      // iOS won't seek — and draws a blank frame to canvas — until the element
      // has actually decoded something. A muted inline play/pause primes it.
      try { await video.play(); video.pause(); } catch (e) {}
      await resolveDuration();
      durEl.textContent = isFinite(video.duration) ? fmt(video.duration) : '—';
      // Start a little way in — the very first frame is often a blurry lens-open.
      seek(Math.min((video.duration || 0) * 0.1, 1));
    }, { once: true });
    video.addEventListener('seeked', () => {
      curEl.textContent = fmt(video.currentTime);
      if (video.duration) scrub.value = String(Math.round((video.currentTime / video.duration) * 1000));
      useBtn.disabled = false;
    });
    video.addEventListener('error', () => {
      alert("That video couldn't be opened in the browser. Try a different one.");
      close();
      if (opts.onCancel) opts.onCancel();
    });

    function seek(t) {
      if (!isFinite(video.duration)) return;
      video.currentTime = Math.max(0, Math.min(video.duration - 0.03, t));
    }
    scrub.addEventListener('input', () => {
      if (!isFinite(video.duration)) return;
      seek((Number(scrub.value) / 1000) * video.duration);
    });
    ov.querySelectorAll('.vfr-step').forEach(b => {
      b.addEventListener('click', () => seek(video.currentTime + Number(b.dataset.step) / 30));
    });

    useBtn.addEventListener('click', () => {
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) { alert('That frame isn’t ready yet — give it a moment and try again.'); return; }
      const scale = Math.min(1, MAX_DIM / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      try {
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch (e) {
        alert("That frame couldn't be captured on this device. Try a different video.");
        return;
      }
      const at = fmt(video.currentTime).replace(':', 'm') + 's';
      const base = (file.name || 'video').replace(/\.[^.]+$/, '');
      canvas.toBlob((blob) => {
        if (!blob) { alert("That frame couldn't be captured. Try a different moment."); return; }
        const out = new File([blob], `${base}-${at}.jpg`, { type: 'image/jpeg' });
        close();
        if (opts.onPick) opts.onPick(out);
      }, 'image/jpeg', 0.92);
    });

    video.src = url;
    video.load();
  }
  /* Crop & zoom for the scan image — the same photo becomes the print, so this
     is where a product's photo gets framed. `src` is a File, Blob or URL (a
     stored photo, loaded crossOrigin like edit.html's other canvas reads).
     The photo is drawn on a canvas under a fixed crop window: drag to move,
     pinch / wheel / slider to zoom, rotate in quarter turns. The window always
     stays covered, so the result never has empty edges. opts.onPick gets a
     JPEG File of what's inside the window. */
  window.openPhotoCropper = function openPhotoCropper(src, opts) {
    opts = opts || {};
    injectStyles();
    const isBlob = typeof src !== 'string';
    const url = isBlob ? URL.createObjectURL(src) : src;
    const baseName = ((isBlob && src.name) || 'photo').replace(/\.[^.]+$/, '');

    const ov = document.createElement('div');
    ov.className = 'vfr-overlay open';
    ov.innerHTML = `
      <div class="vfr-sheet" role="dialog" aria-modal="true" aria-label="Crop and zoom">
        <div class="vfr-head">
          <div class="vfr-title">Crop &amp; zoom</div>
          <button type="button" class="vfr-close" title="Close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="vfr-body">
          <p class="vfr-sub">Drag to move, pinch or slide to zoom. What's inside the frame is what gets printed and scanned.</p>
          <div class="pcr-shapes"></div>
          <div class="pcr-stage"><canvas></canvas></div>
          <div class="pcr-tools">
            <input class="pcr-zoom" type="range" min="100" max="400" value="100" step="1" aria-label="Zoom"/>
            <button type="button" class="pcr-rot">${IC_ROTATE}Rotate</button>
          </div>
          <p class="pcr-info">&nbsp;</p>
        </div>
        <div class="vfr-foot">
          <button type="button" class="vfr-btn vfr-again">Cancel</button>
          <button type="button" class="vfr-btn vfr-use" disabled>Use this crop</button>
        </div>
      </div>`;
    document.body.appendChild(ov);

    const stage = ov.querySelector('.pcr-stage');
    const cv = stage.querySelector('canvas');
    const ctx = cv.getContext('2d');
    const zoomEl = ov.querySelector('.pcr-zoom');
    const info = ov.querySelector('.pcr-info');
    const useBtn = ov.querySelector('.vfr-use');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function close() {
      document.body.style.overflow = prevOverflow;
      if (isBlob) URL.revokeObjectURL(url);
      window.removeEventListener('resize', draw);
      document.removeEventListener('keydown', onKey);
      ov.remove();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    ov.querySelector('.vfr-close').addEventListener('click', close);
    ov.querySelector('.vfr-again').addEventListener('click', close);
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });

    // src: the photo at working size (≤ MAX_DIM, as create.html stores it),
    // turned by `rot` quarter turns. cx/cy: the source point at the window's
    // centre. zoom: on top of the cover fit.
    let base = null, rotated = null, rot = 0, zoom = 1, cx = 0, cy = 0, aspect = null;
    let win = { x: 0, y: 0, w: 0, h: 0 }, scale = 1;

    function buildRotated() {
      const q = rot % 2 === 1;
      const c = document.createElement('canvas');
      c.width = q ? base.height : base.width;
      c.height = q ? base.width : base.height;
      const g = c.getContext('2d');
      g.translate(c.width / 2, c.height / 2);
      g.rotate(rot * Math.PI / 2);
      g.drawImage(base, -base.width / 2, -base.height / 2);
      rotated = c;
      cx = c.width / 2; cy = c.height / 2;
    }
    function clamp() {
      const hw = win.w / 2 / scale, hh = win.h / 2 / scale;
      cx = Math.max(hw, Math.min(rotated.width - hw, cx));
      cy = Math.max(hh, Math.min(rotated.height - hh, cy));
    }
    function layout() {
      const dpr = window.devicePixelRatio || 1;
      const SW = stage.clientWidth, SH = stage.clientHeight;
      if (cv.width !== Math.round(SW * dpr) || cv.height !== Math.round(SH * dpr)) {
        cv.width = Math.round(SW * dpr); cv.height = Math.round(SH * dpr);
      }
      const a = aspect || rotated.width / rotated.height;
      const pad = 0.86;
      let ww, wh;
      if (SW / SH > a) { wh = SH * pad; ww = wh * a; } else { ww = SW * pad; wh = ww / a; }
      win = { x: (SW - ww) / 2, y: (SH - wh) / 2, w: ww, h: wh };
      scale = Math.max(ww / rotated.width, wh / rotated.height) * zoom;
      clamp();
    }
    function draw() {
      if (!rotated) return;
      layout();
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const SW = stage.clientWidth, SH = stage.clientHeight;
      ctx.clearRect(0, 0, SW, SH);
      const dx = win.x + win.w / 2 - cx * scale, dy = win.y + win.h / 2 - cy * scale;
      ctx.drawImage(rotated, dx, dy, rotated.width * scale, rotated.height * scale);
      // Dim everything outside the window, then outline it with a thirds grid.
      ctx.fillStyle = 'rgba(17,17,17,.62)';
      ctx.beginPath(); ctx.rect(0, 0, SW, SH); ctx.rect(win.x, win.y, win.w, win.h); ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < 3; i++) {
        ctx.moveTo(win.x + win.w * i / 3, win.y); ctx.lineTo(win.x + win.w * i / 3, win.y + win.h);
        ctx.moveTo(win.x, win.y + win.h * i / 3); ctx.lineTo(win.x + win.w, win.y + win.h * i / 3);
      }
      ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.strokeRect(win.x, win.y, win.w, win.h);
      const ow = Math.round(win.w / scale), oh = Math.round(win.h / scale);
      info.textContent = ow + ' × ' + oh + ' px' + (Math.max(ow, oh) < 1000 ? ' · zoomed in a lot, this may print soft' : '');
      info.classList.toggle('warn', Math.max(ow, oh) < 1000);
      zoomEl.value = String(Math.round(zoom * 100));
    }
    function setZoom(z, fx, fy) {
      // Zoom about a point on the stage (the pinch centre), else the window centre.
      z = Math.max(1, Math.min(4, z));
      if (fx != null) {
        const wcx = win.x + win.w / 2, wcy = win.y + win.h / 2;
        const px = cx + (fx - wcx) / scale, py = cy + (fy - wcy) / scale;
        const ns = scale * z / zoom;
        cx = px - (fx - wcx) / ns; cy = py - (fy - wcy) / ns;
      }
      zoom = z; draw();
    }

    // Shapes: the product's own (when the Shop sent one), the photo's, and the
    // common print shapes. Portrait/landscape follow the photo's orientation.
    const shapesEl = ov.querySelector('.pcr-shapes');
    function shapes() {
      const land = rotated.width > rotated.height;
      const list = [];
      if (opts.aspect) list.push({ label: 'Fits your product', a: opts.aspect });
      list.push({ label: 'Original', a: null }, { label: 'Square', a: 1 },
        land ? { label: '4:3', a: 4 / 3 } : { label: '3:4', a: 3 / 4 },
        land ? { label: '5:4', a: 5 / 4 } : { label: '4:5', a: 4 / 5 });
      return list;
    }
    function renderShapes() {
      shapesEl.innerHTML = '';
      shapes().forEach(sh => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'pcr-shape' + (sh.a === aspect ? ' on' : '');
        b.textContent = sh.label;
        b.addEventListener('click', () => { aspect = sh.a; renderShapes(); draw(); });
        shapesEl.appendChild(b);
      });
    }

    zoomEl.addEventListener('input', () => setZoom(Number(zoomEl.value) / 100));
    ov.querySelector('.pcr-rot').addEventListener('click', () => {
      if (!base) return;
      rot = (rot + 1) % 4; zoom = 1;
      // A product shape stays as it is; a free shape turns with the photo.
      if (aspect && aspect !== opts.aspect) aspect = 1 / aspect;
      buildRotated(); renderShapes(); draw();
    });

    // Drag with one pointer, pinch with two.
    const pts = new Map();
    let last = null;
    stage.addEventListener('pointerdown', (e) => {
      stage.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      last = null;
    });
    stage.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId) || !rotated) return;
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        cx -= (e.clientX - prev.x) / scale; cy -= (e.clientY - prev.y) / scale;
        draw();
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const r = stage.getBoundingClientRect();
        if (last) setZoom(zoom * d / last, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        last = d;
      }
    });
    const lift = (e) => { pts.delete(e.pointerId); last = null; };
    stage.addEventListener('pointerup', lift);
    stage.addEventListener('pointercancel', lift);
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      setZoom(zoom * Math.exp(-e.deltaY / 400), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    window.addEventListener('resize', draw);

    const img = new Image();
    if (!isBlob) img.crossOrigin = 'anonymous';
    img.onload = () => {
      const s = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
      base = document.createElement('canvas');
      base.width = Math.round(img.naturalWidth * s); base.height = Math.round(img.naturalHeight * s);
      base.getContext('2d').drawImage(img, 0, 0, base.width, base.height);
      buildRotated();
      aspect = opts.aspect || null;
      renderShapes(); draw();
      useBtn.disabled = false;
    };
    img.onerror = () => { alert("That photo couldn't be opened for cropping. Try picking it again."); close(); };
    img.src = url;

    useBtn.addEventListener('click', () => {
      if (!rotated) return;
      const ow = Math.round(win.w / scale), oh = Math.round(win.h / scale);
      const out = document.createElement('canvas');
      out.width = ow; out.height = oh;
      try {
        out.getContext('2d').drawImage(rotated, cx - ow / 2, cy - oh / 2, ow, oh, 0, 0, ow, oh);
      } catch (e) { alert("That photo couldn't be cropped on this device."); return; }
      useBtn.disabled = true;
      try { out.toBlob((blob) => {
        if (!blob) { useBtn.disabled = false; alert("That crop couldn't be saved. Try again."); return; }
        const file = new File([blob], baseName + '-cropped.jpg', { type: 'image/jpeg' });
        close();
        if (opts.onPick) opts.onPick(file);
      }, 'image/jpeg', 0.92); }
      // A stored photo served without CORS headers taints the canvas.
      catch (e) { useBtn.disabled = false; alert("That photo couldn't be cropped here. Pick it again from your library, then crop it."); }
    });
  };
})();
