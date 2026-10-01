/* Product gallery — thumbnails under a product page's mockup.

   The first thumbnail is the live mockup (whatever `renderLive` draws into the
   stage, e.g. the board book with a rotating sample photo); the rest are static
   images from /assets/gallery/{product}/. Tapping a thumbnail swaps the stage;
   on phones the stage also swipes left/right.

     PopcodeGallery.mount(stageEl, {
       renderLive: (el) => window.boardbookMockup(el, photo, { title }),
       renderThumb: (el) => window.boardbookMockup(el, photo, { title }),
       images: [{ src: '/assets/gallery/boardbook/standing.jpg', alt: '…' }, …],
     });

   Static images are made offline (see scripts/boardbook-mockup/) on the Shop's
   #f2f2f2 backdrop, so they sit in the same grey stage as the live mockup. */
(function () {
  const CSS = `
    .pg-thumbs { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
    .pg-thumb { width: 64px; height: 64px; padding: 0; border: 2px solid transparent; border-radius: 10px;
      background: #f2f2f2; overflow: hidden; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: border-color 0.15s; flex-shrink: 0; }
    .pg-thumb:hover { border-color: #d6d3cc; }
    .pg-thumb.active { border-color: #1a1a1a; }
    .pg-thumb:focus-visible { outline: 2px solid #7657FC; outline-offset: 2px; }
    .pg-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .pg-thumb .pg-live { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: none; }
    /* A still fills the whole stage, so its backdrop meets the stage's edges
       instead of showing as a lighter box inside it. */
    .pg-stage { position: relative; overflow: hidden; }
    .pg-stage img.pg-still { position: absolute; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; object-fit: cover; border-radius: inherit; margin: 0; }
    @media (max-width: 420px) { .pg-thumb { width: 56px; height: 56px; } }
  `;
  let styled = false;

  function mount(stage, opts) {
    if (!stage) return null;
    if (!styled) { const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); styled = true; }
    stage.classList.add('pg-stage');
    const images = (opts.images || []).filter(i => i && i.src);
    const slides = [{ live: true }].concat(images);
    let current = 0;

    const row = document.createElement('div');
    row.className = 'pg-thumbs';
    row.setAttribute('role', 'tablist');
    row.setAttribute('aria-label', 'Product images');
    slides.forEach((sl, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pg-thumb';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', sl.live ? 'Your photo on the product' : (sl.alt || 'Product image ' + i));
      if (sl.live) {
        const box = document.createElement('div');
        box.className = 'pg-live';
        b.appendChild(box);
        if (opts.renderThumb) { try { opts.renderThumb(box); } catch (e) {} }
      } else {
        const im = document.createElement('img');
        im.src = sl.src; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
        b.appendChild(im);
      }
      b.addEventListener('click', () => show(i));
      row.appendChild(b);
    });
    // Thumbnails go after the stage, inside the same card.
    stage.insertAdjacentElement('afterend', row);

    function show(i) {
      current = (i + slides.length) % slides.length;
      [...row.children].forEach((b, k) => { b.classList.toggle('active', k === current); b.setAttribute('aria-selected', k === current ? 'true' : 'false'); });
      const sl = slides[current];
      if (sl.live) { stage.innerHTML = ''; opts.renderLive(stage); return; }
      const im = document.createElement('img');
      im.className = 'pg-still'; im.src = sl.src; im.alt = sl.alt || '';
      stage.innerHTML = ''; stage.appendChild(im);
    }

    // Swipe on touch screens (horizontal only; vertical scroll is left alone).
    let x0 = null, y0 = null;
    stage.addEventListener('touchstart', (e) => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
    }, { passive: true });

    // Preload the stills so a tap swaps instantly.
    images.forEach(i => { const p = new Image(); p.src = i.src; });
    show(0);
    return { show };
  }

  window.PopcodeGallery = { mount };
})();
