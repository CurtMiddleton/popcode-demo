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

   Or, when the live preview is an element that redraws itself (order.html's
   canvas), pass `liveEl` instead of `renderLive`: stills are laid over it and
   it's hidden, never cleared. `row` puts the thumbnails in a given container
   (default: right after the stage). The returned object has show(i),
   refreshThumb() (redraw the live thumbnail) and destroy().

   Static images are made offline (see scripts/boardbook-mockup/) on the Shop's
   #f2f2f2 backdrop, so they sit in the same grey stage as the live mockup. */
(function () {
  const CSS = `
    /* One row; thumbnails shrink to share it (64px at most). */
    .pg-thumbs { display: flex; gap: 8px; margin-top: 14px; }
    .pg-thumb { flex: 1 1 0; min-width: 0; max-width: 64px; aspect-ratio: 1 / 1; padding: 0; border: 2px solid transparent; border-radius: 10px;
      background: #f2f2f2; overflow: hidden; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: border-color 0.15s; }
    .pg-thumb:hover { border-color: #d6d3cc; }
    .pg-thumb.active { border-color: #1a1a1a; }
    .pg-thumb:focus-visible { outline: 2px solid #7657FC; outline-offset: 2px; }
    .pg-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .pg-thumb .pg-live { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: none; }
    /* A still fills the whole stage, so its backdrop meets the stage's edges
       instead of showing as a lighter box inside it. */
    .pg-stage { position: relative; overflow: hidden; }
    .pg-stage img.pg-still { position: absolute; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; object-fit: cover; border-radius: inherit; margin: 0; }
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
    let liveBox = null;
    row.setAttribute('role', 'tablist');
    row.setAttribute('aria-label', 'Product images');
    slides.forEach((sl, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pg-thumb';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', sl.live ? 'Your photo on the product' : (sl.alt || 'Product image ' + i));
      if (sl.live) {
        liveBox = document.createElement('div');
        liveBox.className = 'pg-live';
        b.appendChild(liveBox);
        refreshThumb();
      } else {
        const im = document.createElement('img');
        im.src = sl.src; im.alt = ''; im.decoding = 'async';
        b.appendChild(im);
      }
      b.addEventListener('click', () => show(i));
      row.appendChild(b);
    });
    // Thumbnails go after the stage, inside the same card (or in opts.row).
    if (opts.row) opts.row.appendChild(row);
    else stage.insertAdjacentElement('afterend', row);

    function refreshThumb() {
      if (!liveBox || !opts.renderThumb) return;
      liveBox.innerHTML = '';
      try { opts.renderThumb(liveBox); } catch (e) {}
    }

    function show(i) {
      current = (i + slides.length) % slides.length;
      [...row.children].forEach((b, k) => { b.classList.toggle('active', k === current); b.setAttribute('aria-selected', k === current ? 'true' : 'false'); });
      const sl = slides[current];
      if (opts.liveEl) {
        stage.querySelectorAll(':scope > img.pg-still').forEach(n => n.remove());
        opts.liveEl.style.visibility = sl.live ? '' : 'hidden';
        if (!sl.live) stage.appendChild(still(sl));
        return;
      }
      // renderLive replaces the stage's content itself (and may be async), so the
      // previous view stays up until the new one is drawn — no blank flash.
      if (sl.live) { stage.querySelectorAll(':scope > img.pg-still').forEach(n => n.remove()); opts.renderLive(stage); }
      else { stage.innerHTML = ''; stage.appendChild(still(sl)); }
    }
    function still(sl) {
      const im = document.createElement('img');
      im.className = 'pg-still'; im.src = sl.src; im.alt = sl.alt || '';
      return im;
    }

    // Swipe on touch screens (horizontal only; vertical scroll is left alone).
    let x0 = null, y0 = null;
    const onStart = (e) => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; };
    const onEnd = (e) => {
      if (x0 == null) return;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
    };
    if (slides.length > 1) {
      stage.addEventListener('touchstart', onStart, { passive: true });
      stage.addEventListener('touchend', onEnd, { passive: true });
    }

    // Preload the stills so a tap swaps instantly.
    images.forEach(i => { const p = new Image(); p.src = i.src; });
    show(0);
    return {
      show, refreshThumb,
      get current() { return current; },
      destroy() {
        stage.removeEventListener('touchstart', onStart);
        stage.removeEventListener('touchend', onEnd);
        stage.querySelectorAll(':scope > img.pg-still').forEach(n => n.remove());
        if (opts.liveEl) opts.liveEl.style.visibility = '';
        stage.classList.remove('pg-stage');
        row.remove();
      },
    };
  }

  /* Each product's stills, after its live mockup. Ours (*.jpg) are suppliers'
     blanks with our sample photos (scripts/boardbook-mockup/,
     scripts/gallery-mockups/); the *.webp are Prodigi's own product photos from
     prodigi.com, chosen for the product itself (edges, backs, binding) and
     never for third-party artwork. Prints have none yet. */
  const G = '/assets/gallery/';
  const IMAGES = {
    boardbook: [
      { src: G + 'boardbook/standing.jpg', alt: 'The board book standing, pages fanned open' },
      { src: G + 'boardbook/spread.jpg', alt: 'The board book open flat, a photo on each page' },
    ],
    book: [
      { src: G + 'book/spread.webp', alt: 'A layflat book open flat, photos running across the spread' },
      { src: G + 'book/spread-bw.webp', alt: 'A black and white spread lying flat' },
      { src: G + 'book/pages.webp', alt: 'Close-up of the thick layflat pages' },
      { src: G + 'book/corner.webp', alt: 'Close-up of the hardcover corner' },
    ],
    calendar: [
      { src: G + 'calendar/paper.webp', alt: 'Close-up of the calendar paper' },
      { src: G + 'calendar/binding.webp', alt: 'Close-up of the wire binding' },
    ],
    ornament: [
      { src: G + 'ornament/tree.jpg', alt: 'The ornament hanging on a Christmas tree' },
      { src: G + 'ornament/hand.jpg', alt: 'The ornament held up by its string' },
    ],
    framed: [
      { src: G + 'framed/wall.jpg', alt: 'A framed print above a sideboard' },
      { src: G + 'framed/bench.jpg', alt: 'A framed print in a bedroom' },
      { src: G + 'framed/books.jpg', alt: 'A framed print beside a plant' },
      { src: G + 'framed/plant.jpg', alt: 'A framed print in a living room' },
    ],
    tile: [
      { src: G + 'tile/edge.webp', alt: 'Close-up of a photo tile edge' },
      { src: G + 'tile/back.webp', alt: 'The back of a photo tile' },
      { src: G + 'tile/pair.webp', alt: 'Two photo tiles' },
    ],
    canvas: [
      { src: G + 'canvas/hung.webp', alt: 'A canvas print' },
      { src: G + 'canvas/back.webp', alt: 'The back of a canvas, with its hanger' },
      { src: G + 'canvas/corner.webp', alt: 'Close-up of a canvas corner' },
    ],
    framedcanvas: [
      { src: G + 'framedcanvas/frames.webp', alt: 'Framed canvas frame colours' },
      { src: G + 'framedcanvas/back.webp', alt: 'The back of a framed canvas' },
      { src: G + 'framedcanvas/corner.webp', alt: 'Close-up of a white framed canvas corner' },
    ],
    acrylic: [
      { src: G + 'acrylic/edge.webp', alt: 'Close-up of the acrylic edge' },
      { src: G + 'acrylic/front.webp', alt: 'An acrylic print, front on' },
    ],
    magnet: [
      { src: G + 'magnet/fridge.webp', alt: 'Photo magnets on a fridge' },
      { src: G + 'magnet/baby.webp', alt: 'A photo magnet' },
      { src: G + 'magnet/single.webp', alt: 'A photo magnet holding a drawing' },
    ],
    sticker: [
      { src: G + 'sticker/peel.webp', alt: 'Peeling stickers off the sheet' },
    ],
    mug: [
      { src: G + 'mug/mug.webp', alt: 'A photo mug' },
      { src: G + 'mug/pair.webp', alt: 'Two photo mugs' },
    ],
  };

  window.PopcodeGallery = { mount, IMAGES };
})();
