// Undo / redo for the product builders (board book, photo book, calendar).
//
// Snapshot-based: each builder supplies capture() (a copy of its design state),
// restore(snapshot) and signature(snapshot) (the JSON-able part used to tell
// whether anything actually changed). The builder calls note() whenever it
// re-renders; changes are committed after a short pause, so a burst of edits
// (typing a title, dragging a photo) becomes one undo step.
//
//   const history = PopcodeUndo({ capture, restore, signature, onChange });
//   history.note();   // after any render
//   history.reset();  // once the design is loaded — the starting point
(function () {
  window.PopcodeUndo = function (opts) {
    const LIMIT = 80;
    let past = [], future = [], cur = null, curSig = null, timer = null, restoring = false;
    const sig = (s) => JSON.stringify(opts.signature(s));
    const changed = () => opts.onChange && opts.onChange(past.length > 0, future.length > 0);

    function commit() {
      timer = null;
      const s = opts.capture();
      const g = sig(s);
      if (cur === null) { cur = s; curSig = g; return; }
      if (g === curSig) { cur = s; return; }   // nothing the user would see changed
      past.push(cur);
      if (past.length > LIMIT) past.shift();
      future = [];
      cur = s; curSig = g;
      changed();
    }
    function note() {
      if (restoring) return;
      clearTimeout(timer);
      timer = setTimeout(commit, 350);
    }
    function flush() { if (timer) { clearTimeout(timer); commit(); } }
    function apply(s) {
      restoring = true;
      try { opts.restore(s); } finally { restoring = false; }
      // Anything the restore rendered is the new baseline, not a new step.
      clearTimeout(timer); timer = null;
      changed();
    }
    function undo() {
      flush();
      if (!past.length) return false;
      future.push(cur); cur = past.pop(); curSig = sig(cur);
      apply(cur);
      return true;
    }
    function redo() {
      flush();
      if (!future.length) return false;
      past.push(cur); cur = future.pop(); curSig = sig(cur);
      apply(cur);
      return true;
    }
    function reset() {
      clearTimeout(timer); timer = null;
      past = []; future = [];
      cur = opts.capture(); curSig = sig(cur);
      changed();
    }

    // ⌘Z / Ctrl+Z undo, ⇧⌘Z / Ctrl+Y redo. Text fields keep their own undo.
    document.addEventListener('keydown', (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== 'z' && k !== 'y') return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      if (opts.enabled && !opts.enabled()) return;
      e.preventDefault();
      if (k === 'y' || e.shiftKey) redo(); else undo();
    });

    return { note, undo, redo, reset, flush };
  };

  // Shallow copy of a photo, deep enough that later edits to its crop or
  // Popcode don't reach back into the snapshot. Files and blob URLs are shared.
  window.PopcodeUndo.clonePhoto = function (p) {
    if (!p) return p;
    return Object.assign({}, p, {
      adjust: p.adjust ? Object.assign({}, p.adjust) : p.adjust,
      popcode: p.popcode ? Object.assign({}, p.popcode) : p.popcode,
    });
  };
  // What of a photo counts as a visible change (not its upload bookkeeping).
  window.PopcodeUndo.photoSig = function (p) {
    if (!p) return null;
    const pc = p.popcode;
    const f = (x) => x ? [x.name, x.size] : null;
    return {
      a: p.adjust || null,
      pc: pc ? [pc.mediaType, f(pc.video), f(pc.audio), pc.existingVideoUrl || null, pc.existingAudioUrl || null] : null,
      u: p.file ? [p.file.name, p.file.size] : (p.existingUrl || p.url || null),
    };
  };
  // A restored photo keeps what saving has since learned about it (where it's
  // stored), so undoing past a save doesn't force a re-upload.
  window.PopcodeUndo.restorePhotos = function (photos, entries) {
    const live = new Map(photos);
    photos.clear();
    entries.forEach(([id, snap]) => {
      const p = window.PopcodeUndo.clonePhoto(snap);
      const now = live.get(id);
      if (now && now.file === p.file) { p.existingUrl = now.existingUrl; p._uploadedFile = now._uploadedFile; }
      photos.set(id, p);
    });
  };
})();
