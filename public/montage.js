/* Popcode montage maker — the shared "turn photos into a memory video" builder.
 *
 * Extracted from create.html, which held the original; edit.html carried a
 * near-identical copy (67 of 71 shared functions were byte-identical). Keeping
 * two copies meant montage could only ever exist on the two pages someone had
 * remembered to paste it into — which is why the book, calendar and board-book
 * makers offered Video and Audio but no Montage.
 *
 * Everything here is page-agnostic. The one thing a host page must supply is
 * `onApply(target, file)`: where the finished MP4 goes. That was the only real
 * difference between the two old copies.
 *
 *   PopcodeMontage.init({
 *     db,                                  // Supabase client
 *     getUser: () => currentUser,          // signed-in user, for draft storage
 *     onApply: (target, file) => { ... },  // attach the finished montage
 *     onRendered: () => logActivity(...),  // optional; create.html logs here
 *   });
 *   openMontage(target);                   // `target` is opaque — it is handed
 *                                          // straight back to onApply
 *
 * Requires /dialog.js (popcodeConfirm) and /montage-music.js (MONTAGE_MUSIC).
 * The CSS and the overlay markup are injected on first open, so a page that
 * never opens the builder pays nothing for it.
 */
(function () {
  'use strict';

  var CFG = { db: null, getUser: null, onApply: null, onRendered: null };
  function mtgUser() { try { return CFG.getUser ? CFG.getUser() : null; } catch (e) { return null; } }

  var MTG_CSS = `    /* ── Montage maker (book-maker look: black / white / warm-gray, line icons) ── */
    /* Opened from the per-Popcode media dropdown (Video / Audio / Make a montage).
       The montage choice is admin-only until Shotstack is wired live in prod. */

    .mtg-overlay {
      position: fixed; inset: 0; z-index: 9500; display: none;
      align-items: flex-end; justify-content: center;
      background: rgba(0, 0, 0, .5); backdrop-filter: blur(2px);
    }
    .mtg-overlay.open { display: flex; }
    .mtg-sheet {
      background: #fff; width: 100%; max-width: 640px; max-height: 92vh;
      border-radius: var(--pc-radius-card) var(--pc-radius-card) 0 0; display: flex; flex-direction: column;
      overflow: hidden; box-shadow: var(--pc-shadow-sheet);
      animation: mtgUp .22s ease;
    }
    @keyframes mtgUp { from { transform: translateY(30px); opacity: .6; } to { transform: none; opacity: 1; } }
    @media (min-width: 680px) { .mtg-overlay { align-items: center; } .mtg-sheet { border-radius: var(--pc-radius-card); } }

    .mtg-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 30px 24px 14px; color: #1a1a1a;
    }
    .mtg-title { font-size: 32px; font-weight: 400; color: #1a1a1a; letter-spacing: 0; font-family: 'CooperBT', Georgia, serif; }
    .mtg-close {
      background: #f3f3f3; border: none; color: #1a1a1a; width: 36px; height: 36px;
      border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .mtg-close:hover { background: #ecebe5; }
    .mtg-close:disabled { opacity: .4; cursor: default; }
    .mtg-close svg { width: 18px; height: 18px; }

    .mtg-body { padding: 8px 24px 20px; overflow-y: auto; }
    .mtg-sub { font-size: 14px; color: #8a8a8a; margin: 0 0 20px; line-height: 1.5; font-family: 'Inter', sans-serif; }

    .mtg-strip {
      display: flex; flex-wrap: wrap; gap: 10px; padding: 4px 2px 12px;
    }
    .mtg-empty {
      color: #aaa; font-size: 13px; padding: 26px 12px; text-align: center; width: 100%;
      border: 1px dashed #e0ded6; border-radius: 14px; font-family: 'Inter', sans-serif;
    }
    .mtg-thumb {
      position: relative; flex: 0 0 auto; width: 104px; height: 104px; border-radius: 14px;
      overflow: hidden; background: #ededed; touch-action: none; cursor: grab; user-select: none;
    }
    .mtg-thumb.dragging { opacity: .35; }
    .mtg-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; -webkit-user-drag: none; }
    .mtg-reorder-hint { font-size: 12px; color: #aaa; margin: -4px 0 18px; font-family: 'Inter', sans-serif; }
    .mtg-order {
      position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,.62); color: #fff;
      font-size: 11px; font-weight: 700; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 999px;
      display: flex; align-items: center; justify-content: center;
    }
    .mtg-del {
      position: absolute; top: 5px; right: 5px; width: 22px; height: 22px; border-radius: 50%;
      background: #1a1a1a; color: #fff; border: 2px solid #fff; cursor: pointer; padding: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .mtg-del svg { width: 10px; height: 10px; }
    .mtg-clip {
      position: absolute; left: 6px; bottom: 6px; display: inline-flex; align-items: center; gap: 2px;
      background: rgba(0,0,0,.6); color: #fff; border-radius: 999px; padding: 2px 7px 2px 4px;
      font-size: 11px; font-weight: 700; font-family: 'Inter', sans-serif; pointer-events: none;
    }
    .mtg-clip svg { width: 11px; height: 11px; }
    .mtg-framed { position: absolute; right: 6px; bottom: 6px; width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,.6);
      color: #fff; display: flex; align-items: center; justify-content: center; pointer-events: none; }
    .mtg-framed svg { width: 11px; height: 11px; }
    /* Saved montages: shown when the builder opens empty. */
    .mtg-drafts { margin: 0 0 18px; }
    .mtg-drafts-h { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #1a1a1a; margin: 0 0 10px; font-family: 'Inter', sans-serif; }
    .mtg-drafts-list { display: flex; flex-direction: column; gap: 8px; }
    .mtg-draft { display: flex; align-items: center; gap: 12px; padding: 8px; border: 1px solid #e4e2dc; border-radius: 14px; background: #fff; cursor: pointer; text-align: left; font-family: 'Inter', sans-serif; width: 100%; }
    .mtg-draft:hover { border-color: #cfcbc2; }
    .mtg-draft img { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; flex: none; background: #ededed; }
    .mtg-draft-txt { flex: 1; min-width: 0; }
    .mtg-draft-txt b { display: block; font-size: 14px; color: #1a1a1a; }
    .mtg-draft-txt span { display: block; font-size: 12px; color: #8a8a8a; margin-top: 2px; }
    .mtg-draft-del { flex: none; width: 32px; height: 32px; border-radius: 50%; border: none; background: #f3f3f3; color: #555; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .mtg-draft-del svg { width: 12px; height: 12px; }
    .mtg-foot-btns { display: flex; gap: 8px; align-items: center; }
    .mtg-name-field { margin-bottom: 18px; }
    .mtg-name { width: 100%; box-sizing: border-box; border: 1px solid #e4e2dc; border-radius: 12px; padding: 12px 14px;
      font-size: 16px; font-family: 'Inter', sans-serif; color: #1a1a1a; background: #fff; }
    .mtg-name:focus { outline: none; border-color: #1a1a1a; }
    .mtg-draft-txt b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mtg-foot-btns button { white-space: nowrap; }
    @media (max-width: 460px) { .mtg-foot-btns .mtg-create, .mtg-save-draft { padding-left: 16px; padding-right: 16px; } }
    .mtg-save-draft { border: 1px solid #e4e2dc; background: #fff; color: #1a1a1a; border-radius: 999px; font-weight: 700; font-size: 15px;
      padding: 13px 20px; cursor: pointer; font-family: 'Inter', sans-serif; }
    .mtg-save-draft:hover { border-color: #cfcbc2; }
    .mtg-save-draft:disabled { opacity: .4; cursor: default; }
    /* Framing a photo or clip: the part inside the frame is what plays. */
    .mtg-crop { display: none; flex-direction: column; flex: 1; min-height: 0; padding: 12px 24px 20px; overflow-y: auto; }
    .mtg-crop > *, .mtg-crop > .mtg-crop-stage { flex-shrink: 0; }  /* scroll, don't squash, when the text controls make it tall */
    .mtg-crop-note { font-size: 14px; color: #8a8a8a; font-family: 'Inter', sans-serif; margin: 0 0 12px; text-align: center; }
    .mtg-crop-stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
    /* The preview is the frame itself: the montage's shape on black (aspect and
       width set by mtgDrawFrame), the picture placed inside as it will render. */
    .mtg-crop-pic { position: relative; overflow: hidden; border-radius: 10px; touch-action: none; cursor: grab; user-select: none; line-height: 0;
      background: #000; width: 100%; aspect-ratio: 9 / 16; max-height: 44vh; }
    .mtg-crop-pic img { position: absolute; display: block; max-width: none; max-height: none; -webkit-user-drag: none; pointer-events: none; }
    .mtg-crop-frame { position: absolute; inset: 0; border-radius: 10px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.18); pointer-events: none; container-type: size; }
    /* Text preview: same proportions as mtgCaptionImage, in cqmin/cqw of the frame. Drag it to move it. */
    .mtg-crop-text { position: absolute; transform: translate(-50%, -50%); width: max-content; max-width: 84cqw; text-align: center; color: #fff;
      line-height: 1.15; white-space: pre-line; overflow-wrap: break-word; text-shadow: 0 .3cqmin 2.6cqmin rgba(0,0,0,.55);
      pointer-events: auto; touch-action: none; cursor: move; user-select: none; border-radius: 4px; outline: 1px dashed rgba(255,255,255,.55); outline-offset: 4px; }
    .mtg-crop-text:empty { display: none; }
    .mtg-crop-title { display: block; }
    /* Subhead: MTG_SUB in mtgCaptionImage — 0.42 of the title, tracked .14em,
       a 0.35-title gap above (0.35 / 0.42 = .833em of its own size). */
    .mtg-crop-sub { display: block; font-size: .42em; line-height: 1.3; letter-spacing: .14em; margin-right: -.14em; text-transform: uppercase; }
    .mtg-crop-title + .mtg-crop-sub { margin-top: .833em; }
    .mtg-sub-in { font-size: 14px; letter-spacing: .04em; }
    .mtg-crop-text.dragging { outline-color: #fff; }
    .mtg-text-style { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; }
    #mtg-text-font { justify-content: center; }
    #mtg-text-font button { font-size: 15px; }
    .mtg-text-size { display: flex; align-items: center; gap: 10px; width: min(100%, 320px); color: #8a8a8a; font-family: 'Inter', sans-serif; }
    .mtg-text-size span { font-weight: 700; color: #1a1a1a; }
    .mtg-text-size input { flex: 1; accent-color: #1a1a1a; }
    .mtg-text-tip { font-size: 12px; color: #8a8a8a; margin: 0; }
    .mtg-crop-words { display: flex; flex-direction: column; align-items: center; gap: 10px; margin: 6px auto 12px; width: min(100%, 360px); font-family: 'Inter', sans-serif; }
    .mtg-crop-words .mtg-name { text-align: center; margin: 0; }
    .mtg-texted { font: 700 11px/1 'Inter', sans-serif; }
    .mtg-fit { align-self: center; margin: 14px auto 0; }
    .mtg-crop-zoom { display: flex; align-items: center; gap: 10px; margin: 16px auto 4px; width: min(100%, 320px); color: #8a8a8a; }
    .mtg-crop-zoom svg { width: 18px; height: 18px; flex: none; }
    .mtg-crop-zoom input { flex: 1; accent-color: #1a1a1a; }
    .mtg-crop-time { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 14px; margin: 10px 0 16px; font-family: 'Inter', sans-serif; }
    .mtg-crop-time-l { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #1a1a1a; }
    #mtg-item-sec { min-width: 64px; text-align: center; font-weight: 700; color: #1a1a1a; font-size: 15px; }
    .mtg-crop-time-note { flex-basis: 100%; text-align: center; font-size: 12px; color: #8a8a8a; min-height: 1em; }

    .mtg-add {
      display: inline-flex; align-items: center; gap: 7px; margin: 6px 0 26px;
      background: #1a1a1a; color: #fff; border: 1px solid #1a1a1a; font-weight: 700;
      font-size: 13px; padding: 11px 18px; border-radius: 999px; cursor: pointer;
      font-family: 'Inter', sans-serif;
    }
    .mtg-add:hover { background: #000; }
    .mtg-add svg { width: 15px; height: 15px; }
    .mtg-add input { display: none; }

    .mtg-field { margin-bottom: 24px; }
    .mtg-field > label {
      display: block; font-size: 12px; font-weight: 700; color: #1a1a1a;
      text-transform: uppercase; letter-spacing: .05em; margin-bottom: 10px;
      font-family: 'Inter', sans-serif;
    }

    /* Seconds stepper (− value +) */
    .mtg-stepper { display: inline-flex; align-items: center; border: 1px solid #e4e2dc; border-radius: 999px; overflow: hidden; }
    .mtg-step {
      border: none; background: #fff; color: #1a1a1a; width: 42px; height: 42px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .mtg-step:hover { background: #f3f3f3; }
    .mtg-step:disabled { opacity: .3; cursor: default; }
    .mtg-step svg { width: 16px; height: 16px; }
    #mtg-sec-val { min-width: 64px; text-align: center; font-weight: 700; color: #1a1a1a; font-size: 15px; font-family: 'Inter', sans-serif; }

    .mtg-seg { display: inline-flex; background: #f3f3f3; border-radius: 999px; padding: 4px; gap: 4px; flex-wrap: wrap; }
    .mtg-seg button {
      border: none; background: transparent; color: #8a8a8a; font-weight: 700; font-size: 13px;
      padding: 9px 18px; border-radius: 999px; cursor: pointer; font-family: 'Inter', sans-serif;
    }
    .mtg-seg button.active { background: #fff; color: #1a1a1a; box-shadow: 0 1px 3px rgba(0,0,0,.1); }

    .mtg-music { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 8px; }
    .mtg-track-wrap { position: relative; }
    .mtg-track {
      border: 1px solid #e4e2dc; background: #fff; border-radius: 12px; padding: 10px 14px;
      cursor: pointer; text-align: left; width: 100%; height: 100%; font-family: 'Inter', sans-serif; transition: border-color .12s;
    }
    .mtg-track.has-play { padding-right: 46px; }
    .mtg-track-play { position: absolute; right: 9px; top: 50%; transform: translateY(-50%); width: 30px; height: 30px; border-radius: 50%;
      border: 1px solid #e4e2dc; background: #fff; color: #1a1a1a; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
    .mtg-track-play svg { width: 13px; height: 13px; }
    .mtg-track-play svg path { transform: translateX(1px); }
    .mtg-track-play.playing { background: #1a1a1a; border-color: #1a1a1a; color: #fff; }
    .mtg-track.active + .mtg-track-play:not(.playing) { border-color: rgba(255,255,255,.35); background: rgba(255,255,255,.12); color: #fff; }
    .mtg-track:hover { border-color: #d8d5cd; }
    .mtg-track.active { border-color: #1a1a1a; background: #1a1a1a; }
    .mtg-track.active .mtg-track-name { color: #fff; }
    .mtg-track.active .mtg-track-mood { color: rgba(255,255,255,.7); }
    .mtg-track-name { display: block; font-weight: 700; font-size: 13px; color: #1a1a1a; }
    .mtg-track-mood { display: block; font-size: 11px; color: #999; margin-top: 2px; }

    /* Lives in the footer, which is always on screen, so progress and errors
       are seen without scrolling. */
    .mtg-status { display: none; flex-basis: 100%; order: -1; }
    .mtg-status-msg { display: flex; align-items: center; gap: 8px; }
    .mtg-spin { width: 14px; height: 14px; flex: none; border-radius: 50%; border: 2px solid #ddd; border-top-color: #1a1a1a; animation: mtg-spin .8s linear infinite; }
    @keyframes mtg-spin { to { transform: rotate(360deg); } }
    .mtg-add.busy { opacity: .5; pointer-events: none; }
    .mtg-status.show { display: block; }
    .mtg-status-msg { font-size: 13px; color: #555; font-weight: 600; font-family: 'Inter', sans-serif; }
    .mtg-status.ok .mtg-status-msg { color: #1a1a1a; }
    .mtg-status.err .mtg-status-msg { color: #c92a2a; }
    .mtg-bar-wrap { height: 6px; background: #eee; border-radius: 4px; overflow: hidden; margin-top: 8px; }
    .mtg-bar { height: 100%; background: #1a1a1a; transition: width .3s; }

    .mtg-foot {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;
      padding: 16px 24px; border-top: 1px solid #eee; background: #fff;
    }
    .mtg-est { font-size: 13px; color: #8a8a8a; font-weight: 600; font-family: 'Inter', sans-serif; }
    .mtg-create {
      background: #1a1a1a; color: #fff; border: none;
      font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 999px; cursor: pointer;
      font-family: 'Inter', sans-serif;
    }
    .mtg-create:hover { background: #000; }
    .mtg-create:disabled { opacity: .4; cursor: default; }

    .mtg-preview { display: none; flex-direction: column; flex: 1; min-height: 0; padding: 20px 24px; }
    .mtg-preview-inner { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; min-height: 0; }
    .mtg-preview video { max-width: 100%; max-height: 56vh; border-radius: 14px; background: #000; }
    .mtg-preview-note { font-size: 14px; color: #8a8a8a; font-family: 'Inter', sans-serif; margin: 0; text-align: center; }
    .mtg-save-link { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; color: #2563eb; font-weight: 700; font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif; padding: 4px; }
    .mtg-save-link:hover { text-decoration: underline; }
    .mtg-preview-actions { display: flex; gap: 12px; padding-top: 16px; border-top: 1px solid #eee; }
    .mtg-preview-actions button { flex: 1; border: none; border-radius: 999px; font-weight: 700; font-size: 15px; padding: 14px; cursor: pointer; font-family: 'Inter', sans-serif; }
    .mtg-redo { background: #fff; color: #1a1a1a; border: 1px solid #e4e2dc !important; }
    .mtg-use { background: #1a1a1a; color: #fff; }`;

  var MTG_HTML = `  <div id="mtg-overlay" class="mtg-overlay" aria-hidden="true">
    <div class="mtg-sheet" role="dialog" aria-modal="true" aria-label="Make a montage">
      <div class="mtg-head">
        <div class="mtg-title">Make a montage</div>
        <button type="button" class="mtg-swap" id="mtg-swap" hidden>Play a video or audio instead</button>
        <button type="button" class="mtg-close" id="mtg-close-btn" onclick="closeMontage()" title="Close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="mtg-body" id="mtg-body-scroll">
        <p class="mtg-sub">Pick photos and short videos, set the order, add music. We'll turn them into a memory video and link it to this page's photo.</p>

        <div class="mtg-drafts" id="mtg-drafts" hidden></div>
        <div class="mtg-field mtg-name-field">
          <label for="mtg-name">Name</label>
          <input type="text" id="mtg-name" class="mtg-name" maxlength="60" autocomplete="off"
                 placeholder="e.g. Summer at the lake" oninput="if (montageState) montageState.name = this.value"/>
        </div>
        <div class="mtg-strip" id="mtg-strip"></div>
        <div class="mtg-reorder-hint" id="mtg-reorder-hint" style="display:none;">Drag the photos to reorder them.</div>
        <label class="mtg-add">
          <input type="file" accept="image/*,video/*" multiple onchange="mtgAddPhotos(this)"/>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add photos &amp; videos
        </label>

        <div class="mtg-field">
          <label>Seconds per photo</label>
          <div class="mtg-stepper">
            <button type="button" class="mtg-step" id="mtg-sec-dec" onclick="mtgSecStep(-0.5)" aria-label="Fewer seconds"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
            <span id="mtg-sec-val">3.0s</span>
            <button type="button" class="mtg-step" id="mtg-sec-inc" onclick="mtgSecStep(0.5)" aria-label="More seconds"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
          </div>
        </div>

        <div class="mtg-field">
          <label>Motion</label>
          <div class="mtg-seg" id="mtg-transition">
            <button type="button" data-v="kenburns" class="active">Ken Burns</button>
            <button type="button" data-v="fade">Crossfade</button>
          </div>
        </div>

        <div class="mtg-field">
          <label>Shape</label>
          <div class="mtg-seg" id="mtg-aspect">
            <button type="button" data-v="portrait" class="active">Portrait</button>
            <button type="button" data-v="square">Square</button>
            <button type="button" data-v="landscape">Landscape</button>
          </div>
        </div>

        <div class="mtg-field">
          <label>Music</label>
          <div class="mtg-music" id="mtg-music"></div>
        </div>

      </div>
      <div class="mtg-foot" id="mtg-foot">
        <div class="mtg-status" id="mtg-status" role="status" aria-live="polite"></div>
        <div class="mtg-est" id="mtg-est">Add at least 2 photos</div>
        <div class="mtg-foot-btns">
          <button type="button" class="mtg-save-draft" id="mtg-save-draft" onclick="mtgSaveDraft()" title="Keep this montage to finish or change later">Save draft</button>
          <button type="button" class="mtg-create" id="mtg-create" onclick="mtgCreate()">Create montage</button>
        </div>
      </div>
      <div class="mtg-crop" id="mtg-crop">
        <p class="mtg-crop-note" id="mtg-crop-note">Drag to choose what shows in the frame.</p>
        <div class="mtg-crop-stage"><div class="mtg-crop-pic" id="mtg-crop-pic"><img id="mtg-crop-img" alt="" draggable="false"/><div class="mtg-crop-frame" id="mtg-crop-frame"><div class="mtg-crop-text" id="mtg-crop-text" data-pos="bottom"></div></div></div></div>
        <div class="mtg-seg mtg-fit" id="mtg-fit">
          <button type="button" data-v="fill" class="active">Fill</button>
          <button type="button" data-v="whole">Whole photo</button>
        </div>
        <div class="mtg-crop-zoom" id="mtg-crop-zoom-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          <input type="range" id="mtg-crop-zoom" min="0.3" max="3" step="0.005" value="1" aria-label="Size"/>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/></svg>
        </div>
        <div class="mtg-crop-words">
          <input type="text" class="mtg-name" id="mtg-crop-text-in" maxlength="80" placeholder="Add a title (optional)" autocomplete="off" aria-label="Title on this photo"/>
          <input type="text" class="mtg-name mtg-sub-in" id="mtg-crop-sub-in" maxlength="60" placeholder="Subhead, like a date or place" autocomplete="off" aria-label="Subhead on this photo"/>
          <div class="mtg-text-style" id="mtg-text-style" style="display:none">
            <p class="mtg-text-tip">Drag the text on the photo to move it.</p>
            <div class="mtg-seg" id="mtg-text-font">
              <button type="button" data-v="cooper" style="font-family:'CooperBT',serif">Cooper</button>
              <button type="button" data-v="dmsans" style="font-family:'DM Sans',sans-serif;font-weight:700">DM Sans</button>
              <button type="button" data-v="inter" style="font-family:'Inter',sans-serif;font-weight:700">Inter</button>
              <button type="button" data-v="filson" style="font-family:'FilsonPro',sans-serif;font-weight:700">Filson Pro</button>
              <button type="button" data-v="cormorant" style="font-family:'Cormorant Garamond',serif;font-weight:400;font-size:17px">Cormorant Garamond</button>
              <button type="button" data-v="libre" style="font-family:'Libre Baskerville',serif;font-weight:700;font-size:14px">Libre Baskerville</button>
            </div>
            <label class="mtg-text-size"><span style="font-size:12px">A</span><input type="range" id="mtg-text-size" min="0.045" max="0.16" step="0.005" value="0.075" aria-label="Text size"/><span style="font-size:19px">A</span></label>
          </div>
        </div>
        <div class="mtg-crop-time" id="mtg-crop-time">
          <span class="mtg-crop-time-l">Time on screen</span>
          <div class="mtg-stepper">
            <button type="button" class="mtg-step" id="mtg-item-sec-dec" onclick="mtgItemSecStep(-0.5)" aria-label="Less time"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
            <span id="mtg-item-sec">3.0s</span>
            <button type="button" class="mtg-step" id="mtg-item-sec-inc" onclick="mtgItemSecStep(0.5)" aria-label="More time"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
          </div>
          <span class="mtg-crop-time-note" id="mtg-item-sec-note"></span>
        </div>
        <div class="mtg-preview-actions">
          <button type="button" class="mtg-redo" onclick="mtgResetCrop()">Reset</button>
          <button type="button" class="mtg-use" onclick="mtgHideCrop()">Done</button>
        </div>
      </div>
      <div class="mtg-preview" id="mtg-preview">
        <div class="mtg-preview-inner">
          <video id="mtg-preview-video" playsinline controls muted loop></video>
          <p class="mtg-preview-note">Here's your montage. Use it, or start over to change photos, videos, order, or music.</p>
          <button type="button" class="mtg-save-link" onclick="mtgSaveVideo()"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Save video to your photos</button>
        </div>
        <div class="mtg-preview-actions">
          <button type="button" class="mtg-redo" onclick="mtgRedoPreview()">Start over</button>
          <button type="button" class="mtg-use" onclick="mtgUsePreview()">Use this montage</button>
        </div>
      </div>
    </div>
  </div>`;

  var mtgMounted = false;
  function mtgMount() {
    if (mtgMounted) return;
    mtgMounted = true;
    var st = document.createElement('style');
    st.textContent = MTG_CSS;
    document.head.appendChild(st);
    var host = document.createElement('div');
    host.innerHTML = MTG_HTML;
    while (host.firstChild) document.body.appendChild(host.firstChild);
  }

      // ── Montage maker ───────────────────────────────────────────────────────
      // Builds an Apple-Photos-style memory video from a set of photos, renders
      // it via /api/create-montage (Shotstack), and links the resulting MP4 to
      // this page's photo — flowing through the normal save path unchanged.
      const MTG_MAX_PHOTOS = 100;     // photos + clips combined (matches the API)
      const MTG_MAX_CLIP_SECONDS = 10; // a clip plays its opening seconds, up to this (lib/montage/timeline.mjs)
      const MTG_MAX_SOURCE_SECONDS = 60; // longer videos are refused — trim first
      const MTG_MAX_VIDEO_MB = 200;
      const MTG_END_HOLD = 1.5;          // the last photo rests this much longer (lib/montage/timeline.mjs)
      const MTG_PHOTO_SEC = [1.5, 10];   // a photo's own time on screen, min/max
      let montageState = null;
      let montageBusy = false;
      let montageResult = null; // rendered montage File awaiting the user's confirm
      let mtgDragId = null;     // id of the thumbnail being dragged (mouse reorder)

      // Preview the rendered montage before committing it to the page.
      function mtgShowPreview(file, musicSkipped) {
        montageResult = file;
        const note = document.querySelector('.mtg-preview-note');
        if (note) note.textContent = musicSkipped
          ? "Here's your montage — the chosen music isn't available yet, so it's silent for now. Use it, or start over."
          : "Here's your montage. Use it, or start over to change photos, videos, order, or music.";
        const vid = document.getElementById('mtg-preview-video');
        vid.src = URL.createObjectURL(file);
        document.getElementById('mtg-body-scroll').style.display = 'none';
        document.getElementById('mtg-foot').style.display = 'none';
        document.getElementById('mtg-preview').style.display = 'flex';
        vid.play().catch(() => {}); // autoplay is best-effort; controls are shown regardless
      }
      function mtgHidePreview(discard) {
        const vid = document.getElementById('mtg-preview-video');
        try { vid.pause(); if (vid.src) URL.revokeObjectURL(vid.src); vid.removeAttribute('src'); vid.load(); } catch (e) {}
        document.getElementById('mtg-preview').style.display = 'none';
        document.getElementById('mtg-body-scroll').style.display = '';
        document.getElementById('mtg-foot').style.display = '';
        if (discard) montageResult = null;
      }
      function mtgUsePreview() {
        if (!montageResult || !montageState) return;
        mtgApplyToPage(montageState.page, montageResult);
        montageResult = null; // consumed — don't re-apply on close
        mtgHidePreview(false);
        closeMontage();
      }
      function mtgRedoPreview() {
        mtgHidePreview(true);
        mtgStatus('', null, '');
      }

      // Save the rendered montage MP4 to the device. On iOS/Android the native
      // share sheet offers "Save Video" (to Photos); otherwise fall back to a
      // plain download. Must run in the click gesture for navigator.share(files).
      async function mtgSaveVideo() {
        if (!montageResult) return;
        try {
          if (navigator.canShare && navigator.canShare({ files: [montageResult] })) {
            await navigator.share({ files: [montageResult], title: 'Popcode montage' });
            return;
          }
        } catch (e) { /* user cancelled or share unavailable — fall through to download */ }
        const url = URL.createObjectURL(montageResult);
        const a = document.createElement('a');
        a.href = url; a.download = 'popcode-montage.mp4';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 15000);
      }

      function mtgNewId() {
        return (crypto.randomUUID ? crypto.randomUUID() : 'm' + Date.now() + Math.random().toString(36).slice(2));
      }
      function openMontage(n) {
        if (montageBusy) return;
        montageState = { page: n, photos: [], perSec: 3, transition: 'kenburns', aspect: 'portrait', musicId: 'none',
                         name: '', draftId: mtgNewId(), savedSig: null };
        const swap = document.getElementById('mtg-swap');
        if (swap) swap.hidden = true;   // only edit.html renders this button
        mtgSyncControls();
        mtgRenderStrip();
        mtgStatus('');
        mtgHideCrop();
        mtgHidePreview(true); // reset to the builder view in case a preview was left open
        document.getElementById('mtg-overlay').classList.add('open');
        document.body.style.overflow = 'hidden';
        mtgLoadDraftList();
      }
      // Put the settings controls in line with montageState (new or loaded draft).
      function mtgSyncControls() {
        document.getElementById('mtg-name').value = montageState.name || '';
        mtgSecRender();
        mtgSetSeg('mtg-transition', montageState.transition);
        mtgSetSeg('mtg-aspect', montageState.aspect);
        mtgRenderMusic();
      }
      async function closeMontage() {
        if (montageBusy) return;
        // Unsaved work: offer to keep it as a saved montage before closing.
        if (montageState && montageState.photos.length && !montageResult && mtgSig() !== montageState.savedSig) {
          const keep = await popcodeConfirm('Save it and you can open it again from Make a montage, to change photos, order, framing or music.',
            { title: 'Save this montage?', confirmText: 'Save', cancelText: "Don't save" });
          if (keep && !(await mtgSaveDraft())) return; // save failed: stay open, the error is showing
        }
        // Don't lose a rendered montage the user didn't explicitly "Use": if a
        // preview is still showing on close, keep it by applying it to the page.
        if (montageResult && montageState) mtgApplyToPage(montageState.page, montageResult);
        mtgHidePreview(true); // revoke the preview video + reset
        mtgStopMusic();
        const ov = document.getElementById('mtg-overlay');
        ov.classList.remove('open');
        document.body.style.overflow = '';
        // Release preview object URLs
        if (montageState) montageState.photos.forEach(p => { try { URL.revokeObjectURL(p.url); } catch (e) {} });
        montageState = null;
      }

      function mtgSecStep(delta) {
        if (!montageState) return;
        montageState.perSec = Math.min(5, Math.max(1.5, +(montageState.perSec + delta).toFixed(1)));
        mtgSecRender();
      }
      function mtgSecRender() {
        const v = montageState ? montageState.perSec : 3;
        document.getElementById('mtg-sec-val').textContent = v.toFixed(1) + 's';
        document.getElementById('mtg-sec-dec').disabled = v <= 1.5;
        document.getElementById('mtg-sec-inc').disabled = v >= 5;
        mtgUpdateEstimate();
      }

      function mtgSetSeg(groupId, val) {
        const group = document.getElementById(groupId);
        group.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === val));
        if (montageState) {
          if (groupId === 'mtg-transition') montageState.transition = val;
          if (groupId === 'mtg-aspect') montageState.aspect = val;
          if (groupId === 'mtg-fit') { const it = mtgCropItem(); if (it) { mtgSetCrop(it, 0.5, 0.5, val === 'whole' ? 0 : 1); mtgShowFit(); } }
        }
      }
      // Segmented-control clicks. Delegated on document because the overlay
      // markup is parsed AFTER this script, so the .mtg-seg elements don't exist
      // yet at this point — a direct listener would never attach.
      document.addEventListener('click', e => {
        const btn = e.target.closest('.mtg-seg button');
        if (btn && btn.parentElement) mtgSetSeg(btn.parentElement.id, btn.dataset.v);
      });

      function mtgRenderMusic() {
        const wrap = document.getElementById('mtg-music');
        const tracks = window.MONTAGE_MUSIC || [];
        wrap.innerHTML = tracks.map(t => `
          <div class="mtg-track-wrap">
            <button type="button" class="mtg-track${t.id === montageState.musicId ? ' active' : ''}${t.src ? ' has-play' : ''}" data-id="${t.id}">
              <span class="mtg-track-name">${t.name}</span>
              ${t.mood ? `<span class="mtg-track-mood">${t.mood}</span>` : ''}
            </button>
            ${t.src ? `<button type="button" class="mtg-track-play" data-id="${t.id}" aria-label="Listen to ${t.name}">${MTG_PLAY_ICON}</button>` : ''}
          </div>`).join('');
        wrap.querySelectorAll('.mtg-track').forEach(b => {
          b.addEventListener('click', () => {
            montageState.musicId = b.dataset.id;
            wrap.querySelectorAll('.mtg-track').forEach(x => x.classList.toggle('active', x === b));
          });
        });
        wrap.querySelectorAll('.mtg-track-play').forEach(b => b.addEventListener('click', () => mtgPreviewMusic(b.dataset.id)));
      }
      // Listen to a track before choosing it. One plays at a time; tapping the
      // playing one stops it. Stopped when the builder closes or a render starts.
      const MTG_PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
      const MTG_STOP_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>';
      let mtgMusicAudio = null, mtgMusicPlaying = null;
      function mtgPreviewMusic(id) {
        const was = mtgMusicPlaying;
        mtgStopMusic();
        if (was === id) return;
        const t = (window.MONTAGE_MUSIC || []).find(x => x.id === id);
        if (!t || !t.src) return;
        mtgMusicAudio = mtgMusicAudio || new Audio();
        mtgMusicAudio.src = t.src;
        mtgMusicAudio.onended = mtgStopMusic;
        mtgMusicAudio.play().catch(() => mtgStopMusic());
        mtgMusicPlaying = id;
        const b = document.querySelector(`.mtg-track-play[data-id="${id}"]`);
        if (b) { b.classList.add('playing'); b.innerHTML = MTG_STOP_ICON; b.setAttribute('aria-label', 'Stop'); }
      }
      function mtgStopMusic() {
        if (mtgMusicAudio) { mtgMusicAudio.pause(); mtgMusicAudio.removeAttribute('src'); mtgMusicAudio.load(); }
        mtgMusicPlaying = null;
        document.querySelectorAll('.mtg-track-play.playing').forEach(b => { b.classList.remove('playing'); b.innerHTML = MTG_PLAY_ICON; b.setAttribute('aria-label', 'Listen'); });
      }

      // The picture on a video tile: the first real frame, not black. Seeks
      // to 1.5s (past a montage's fade-in from black), waits until that frame
      // has actually loaded (drawing too early gives black on Safari), and if
      // it's still near-black tries later points. Drawn large enough to stay
      // sharp on the big tiles. Leaves the tile as it was if it can't read it.
      function paintVideoThumb(src, targetId, cors) {
        const v = document.createElement('video');
        if (cors) v.crossOrigin = 'anonymous';
        v.muted = true; v.playsInline = true; v.preload = 'auto';
        let times = [], done = false;
        const finish = () => { if (done) return; done = true; clearTimeout(timer); v.removeAttribute('src'); v.load(); };
        const timer = setTimeout(finish, 20000);
        v.addEventListener('loadedmetadata', () => {
          const D = v.duration || 0;
          times = [1.5, 3, 5, D * 0.3, D * 0.5].filter(t => t > 0 && t < D - 0.05);
          v.currentTime = times.length ? times.shift() : 0;
        });
        v.addEventListener('seeked', () => {
          const grab = () => {
            if (done) return;
            try {
              const W = 480, H = 400, c = document.createElement('canvas'); c.width = W; c.height = H;
              const ctx = c.getContext('2d');
              const sw = v.videoWidth, sh = v.videoHeight;
              if (sw && sh) { const s = Math.max(W / sw, H / sh); ctx.drawImage(v, (W - sw * s) / 2, (H - sh * s) / 2, sw * s, sh * s); }
              else ctx.drawImage(v, 0, 0, W, H);
              const px = ctx.getImageData(0, 0, W, H).data;
              let sum = 0, n = 0;
              for (let i = 0; i < px.length; i += 64) { sum += px[i] + px[i + 1] + px[i + 2]; n++; }
              if (sum / n / 3 < 14 && times.length) { v.currentTime = times.shift(); return; }
              const el = document.getElementById(targetId);
              if (el) el.src = c.toDataURL('image/jpeg', 0.85);
            } catch (e) { /* cross-origin or decode trouble: leave the tile as it was */ }
            finish();
          };
          if (v.readyState >= 2) requestAnimationFrame(() => requestAnimationFrame(grab));
          else v.addEventListener('loadeddata', () => requestAnimationFrame(grab), { once: true });
        });
        v.addEventListener('error', finish);
        v.src = src;
      }

      // Read a video clip's length, size and a thumbnail. Resolves null if the
      // browser can't play it (or takes over 15s), never hangs.
      function mtgProbeVideo(file) {
        return new Promise((resolve) => {
          const url = URL.createObjectURL(file);
          const v = document.createElement('video');
          v.muted = true; v.playsInline = true; v.preload = 'auto';
          let done = false;
          const finish = (val) => { if (done) return; done = true; clearTimeout(timer); v.removeAttribute('src'); v.load(); resolve(val); };
          const timer = setTimeout(() => { URL.revokeObjectURL(url); finish(null); }, 15000);
          // Thumbnail: the first frame that isn't black (clips often fade in),
          // trying a few points, and only once the frame has actually loaded.
          let tries = [];
          v.addEventListener('loadedmetadata', () => {
            if (!isFinite(v.duration) || v.duration <= 0) { URL.revokeObjectURL(url); finish(null); return; }
            const D = v.duration;
            tries = [1.5, 3, D * 0.4].filter(t => t < D - 0.05);
            v.currentTime = Math.min(0.5, D / 2);
          });
          v.addEventListener('seeked', () => {
            const grab = () => {
              let thumb = '';
              try {
                const w = v.videoWidth || 160, h = v.videoHeight || 160, s = 480 / Math.max(w, h);
                const c = document.createElement('canvas');
                c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
                const ctx = c.getContext('2d');
                ctx.drawImage(v, 0, 0, c.width, c.height);
                const px = ctx.getImageData(0, 0, c.width, c.height).data;
                let sum = 0, n = 0;
                for (let i = 0; i < px.length; i += 64) { sum += px[i] + px[i + 1] + px[i + 2]; n++; }
                if (sum / n / 3 < 14 && tries.length) { v.currentTime = tries.shift(); return; }
                thumb = c.toDataURL('image/jpeg', 0.8);
              } catch (e) {}
              finish({ url, duration: v.duration, thumb, w: v.videoWidth, h: v.videoHeight });
            };
            if (v.readyState >= 2) requestAnimationFrame(() => requestAnimationFrame(grab));
            else v.addEventListener('loadeddata', () => requestAnimationFrame(grab), { once: true });
          });
          v.addEventListener('error', () => { URL.revokeObjectURL(url); finish(null); });
          v.src = url;
        });
      }
      async function mtgAddPhotos(input) {
        const files = Array.from(input.files || []);
        input.value = '';
        const problems = [];
        let skipped = 0;
        const addBtn = document.querySelector('.mtg-add');
        if (addBtn) addBtn.classList.add('busy');
        try {
        for (const [i, f] of files.entries()) {
          const of = files.length > 1 ? ` ${i + 1} of ${files.length}` : '';
          if (montageState.photos.length >= MTG_MAX_PHOTOS) { problems.push(`Up to ${MTG_MAX_PHOTOS} photos and videos.`); break; }
          const newId = 'p' + Math.random().toString(36).slice(2, 8);
          const isVid = f.type.startsWith('video/') || /\.(mov|mp4|m4v|webm)$/i.test(f.name);
          if (isVid) {
            if (f.size / (1024 * 1024) > MTG_MAX_VIDEO_MB) { problems.push(`"${f.name}" is over ${MTG_MAX_VIDEO_MB} MB.`); continue; }
            mtgStatus(`Reading video${of}…`, files.length > 1 ? i / files.length * 100 : null, 'busy');
            const probe = await mtgProbeVideo(f);
            if (!probe) { problems.push(`"${f.name}" couldn't be played in this browser. Try Safari, or export it as an MP4.`); continue; }
            if (probe.duration > MTG_MAX_SOURCE_SECONDS) {
              URL.revokeObjectURL(probe.url);
              problems.push(`"${f.name}" is ${Math.round(probe.duration)}s — use clips under a minute (trim it in Photos first).`);
              continue;
            }
            montageState.photos.push({
              id: newId, kind: 'video', file: f, url: probe.url, thumb: probe.thumb,
              seconds: +Math.min(MTG_MAX_CLIP_SECONDS, probe.duration).toFixed(2),
              trimmed: probe.duration > MTG_MAX_CLIP_SECONDS,
              w: probe.w, h: probe.h,
            });
            mtgRenderStrip();
            continue;
          }
          const isImg = f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name);
          if (!isImg) continue;
          mtgStatus(`Adding photo${of}…`, files.length > 1 ? i / files.length * 100 : null, 'busy');
          // Downscale large photos instead of rejecting them (montage sources only
          // need to match the video output size; keeps uploads + render fast).
          const opt = await optimizePhotoDim(f, 1920);
          if (!opt) { skipped++; continue; }
          const url = URL.createObjectURL(opt);
          const dim = await mtgImageSize(url);
          montageState.photos.push({ id: newId, kind: 'image', file: opt, url, w: dim.w, h: dim.h });
          mtgRenderStrip();
        }
        } catch (e) {
          // Never leave "Reading video…" up: say what failed and keep what was added.
          console.error('montage add failed', e);
          problems.push('Something went wrong adding those (' + (e && e.message || e) + ').');
        } finally {
          if (addBtn) addBtn.classList.remove('busy');
        }
        if (skipped) problems.push(`${skipped} photo(s) couldn't be read and were skipped.`);
        mtgStatus(problems.join(' '), null, problems.length ? 'err' : '');
        mtgRenderStrip();
      }

      // Shared photo optimizer (ported from book.html): decode → downscale to
      // maxDim → re-encode JPEG. Returns a File (smaller when it helps), the
      // original when already fine, or null if undecodable and very large.
      const PHOTO_QUALITY = 0.85;
      const PHOTO_HARD_MAX_MB = 25; // only give up on undecodable originals above this
      // ── Safe photo decoding ─────────────────────────────────────
      // JPEG has no alpha channel, so anything transparent — or any source that
      // silently decodes to nothing — re-encodes as SOLID BLACK. That was the
      // "my photos upload as black squares" bug. Every draw below goes onto an
      // opaque white canvas, and every source is probed before it is used.

      function releaseSource(src) {
        if (!src) return;
        src.close?.();
        if (src._url) { URL.revokeObjectURL(src._url); src._url = null; }
      }

      // True when `src` actually paints visible pixels. Catches both a fully
      // transparent image and a decoder that handed back a blank/black bitmap
      // (Safari does this for some HEICs), either of which would become a black
      // square once flattened to JPEG.
      function sourcePaints(src) {
        const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
        if (!w || !h) return false;
        try {
          const probe = document.createElement('canvas');
          probe.width = probe.height = 24;
          const px = probe.getContext('2d', { willReadFrequently: true });
          px.drawImage(src, 0, 0, 24, 24);
          const d = px.getImageData(0, 0, 24, 24).data;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] > 8 && (d[i] > 8 || d[i + 1] > 8 || d[i + 2] > 8)) return true;
          }
          return false;
        } catch (e) { return true; } // couldn't inspect it — assume it's fine
      }

      function loadViaImg(file) {
        return new Promise((res, rej) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          img._url = url;
          img.onload = async () => { if (img.decode) { try { await img.decode(); } catch (e) {} } res(img); };
          img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
          img.src = url;
        });
      }

      // Decode to something drawable, preferring createImageBitmap but falling
      // back to <img> — including when the bitmap decodes blank. Returns null if
      // no path produced usable pixels.
      async function decodeDrawable(file) {
        const paths = [];
        if (typeof createImageBitmap === 'function') {
          paths.push(() => createImageBitmap(file, { imageOrientation: 'from-image' }));
        }
        paths.push(() => loadViaImg(file));
        for (const open of paths) {
          let src = null;
          try { src = await open(); } catch (e) { continue; }
          if (sourcePaints(src)) return src;
          releaseSource(src);
        }
        return null;
      }

      // Draw onto an opaque white background so transparency never flattens to
      // black. Returns false if the draw itself failed.
      function drawOpaque(ctx, src, w, h) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        try { ctx.drawImage(src, 0, 0, w, h); return true; }
        catch (e) { return false; }
      }
      // Print-safe shrink for a photo over the upload limit. Products print from
      // this stored photo, so it must stay big: a 2560px copy (the old fallback)
      // is ~71 DPI on a 24×36 print. Try full print size first, stepping down
      // only as far as the limit forces.
      async function shrinkPhotoForLimit(file, limitMB) {
        for (const [dim, q] of [[6000, 0.92], [6000, 0.85], [4800, 0.85], [3600, 0.85], [2560, 0.85]]) {
          const out = await optimizePhotoDim(file, dim, q);
          if (!out) return null;
          if (out.size / (1024 * 1024) <= limitMB) return out;
        }
        return null;
      }

      async function optimizePhotoDim(file, maxDim, quality) {
        // Keep the original bytes when we can't safely re-encode — an original we
        // can't shrink beats a black square.
        const keepOriginal = () => file.size / (1024 * 1024) <= PHOTO_HARD_MAX_MB ? file : null;
        const src = await decodeDrawable(file);
        if (!src) return keepOriginal();
        const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
        const scale = Math.min(1, maxDim / Math.max(w0, h0));
        const oversized = scale < 1;
        const heavy = file.size / (1024 * 1024) > 3;
        if (!oversized && !heavy) { releaseSource(src); return file; }
        const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        const drew = drawOpaque(ctx, src, w, h);
        releaseSource(src);
        if (!drew) return keepOriginal();
        const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality || PHOTO_QUALITY));
        canvas.width = canvas.height = 0;
        if (!blob) return file;
        const chosen = oversized ? blob : (blob.size < file.size ? blob : file);
        const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + (chosen === blob ? '.jpg' : '');
        return new File([chosen], name, { type: chosen.type || 'image/jpeg' });
      }

      function mtgRenderStrip() {
        const strip = document.getElementById('mtg-strip');
        const photos = montageState.photos;
        if (!photos.length) {
          strip.innerHTML = `<div class="mtg-empty">Nothing yet. Add photos or short videos to build your montage.</div>`;
        } else {
          const X_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
          strip.innerHTML = photos.map((p, i) => `
            <div class="mtg-thumb${mtgDragId === p.id ? ' dragging' : ''}" data-id="${p.id}">
              <img src="${p.kind === 'video' ? p.thumb : p.url}" alt="" draggable="false"${p.crop ? ` style="object-position:${(p.crop.cx * 100).toFixed(1)}% ${(p.crop.cy * 100).toFixed(1)}%"` : ''}/>
              ${p.crop ? '<span class="mtg-framed" title="Framing set"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg></span>' : ''}
              ${mtgHasText(p) ? `<span class="mtg-framed mtg-texted" title="Text: ${escMtgText([p.text, p.sub].filter(Boolean).join(' · '))}" style="right:${p.crop ? 30 : 6}px">T</span>` : ''}
              <span class="mtg-order">${i + 1}</span>
              ${p.kind === 'video' ? `<span class="mtg-clip" title="${p.trimmed ? `Uses the first ${MTG_MAX_CLIP_SECONDS}s` : 'Video clip'}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>${p.seconds.toFixed(0)}s</span>` : ''}
              ${p.kind !== 'video' && p.secs ? `<span class="mtg-clip" title="On screen for ${p.secs}s"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>${p.secs % 1 ? p.secs.toFixed(1) : p.secs}s</span>` : ''}
              <button type="button" class="mtg-del" title="Remove" onclick="mtgRemove(${i})">${X_ICON}</button>
            </div>`).join('');
          photos.forEach(p => {
            const el = strip.querySelector(`.mtg-thumb[data-id="${p.id}"]`);
            if (el) mtgEnableDrag(el, p.id);
          });
        }
        mtgRenderDrafts();
        const hint = document.getElementById('mtg-reorder-hint');
        if (hint) {
          hint.style.display = photos.length > 1 ? 'block' : 'none';
          hint.textContent = photos.some(p => p.kind === 'video')
            ? `Tap one to frame it, add text or change its time, drag to reorder. Videos play up to ${MTG_MAX_CLIP_SECONDS}s each.`
            : 'Tap a photo to frame it, add text or change its time, drag to reorder.';
        }
        mtgUpdateEstimate();
      }

      // Drag-to-reorder for the thumbnail grid (mouse + touch). The grid wraps
      // (no horizontal scroll) and thumbs are touch-action:none, so a touch drag
      // reorders instead of scrolling.
      function mtgMakeGhost(url, x, y) {
        const g = document.createElement('div');
        g.style.cssText = 'position:fixed;width:88px;height:88px;border-radius:14px;transform:translate(-50%,-50%);pointer-events:none;z-index:9700;box-shadow:0 10px 26px rgba(0,0,0,.35);opacity:.92;background-size:cover;background-position:center;';
        g.style.left = x + 'px'; g.style.top = y + 'px';
        g.style.backgroundImage = 'url("' + url + '")';
        document.body.appendChild(g);
        return g;
      }
      function mtgEnableDrag(el, photoId) {
        el.addEventListener('pointerdown', (e) => {
          if (e.target.closest('.mtg-del')) return;              // the remove button owns its taps
          const photo = montageState && montageState.photos.find(p => p.id === photoId);
          if (!photo) return;
          const startX = e.clientX, startY = e.clientY;
          let dragging = false, ghost = null, holdTimer = null;
          const startDrag = (x, y) => {
            if (dragging) return;
            clearTimeout(holdTimer); dragging = true; mtgDragId = photoId;
            ghost = mtgMakeGhost(photo.kind === 'video' ? photo.thumb : photo.url, x, y);
            document.body.style.userSelect = 'none';
            const c = document.querySelector(`.mtg-thumb[data-id="${photoId}"]`);
            if (c) c.classList.add('dragging');
          };
          holdTimer = setTimeout(() => startDrag(startX, startY), 160);
          const move = (ev) => {
            if (!dragging) {
              if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 8) return;
              startDrag(ev.clientX, ev.clientY);
            }
            ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
            const over = document.elementFromPoint(ev.clientX, ev.clientY);
            const overThumb = over && over.closest('.mtg-thumb');
            if (overThumb && overThumb.dataset.id && overThumb.dataset.id !== mtgDragId) {
              const from = montageState.photos.findIndex(p => p.id === mtgDragId);
              const to = montageState.photos.findIndex(p => p.id === overThumb.dataset.id);
              if (from !== -1 && to !== -1) {
                const [it] = montageState.photos.splice(from, 1);
                montageState.photos.splice(to, 0, it);
                mtgRenderStrip();
              }
            }
          };
          const endDrag = () => {
            clearTimeout(holdTimer);
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', endDrag);
            document.removeEventListener('pointercancel', endDrag);
            if (ghost) ghost.remove();
            document.body.style.userSelect = '';
            const wasDragging = dragging;
            mtgDragId = null;
            if (wasDragging) mtgRenderStrip();
            else if (!montageBusy) mtgOpenCrop(photoId);   // a tap, not a drag: frame it
          };
          document.addEventListener('pointermove', move);
          document.addEventListener('pointerup', endDrag);
          document.addEventListener('pointercancel', endDrag);
        });
      }

      function mtgMove(i, dir) {
        const arr = montageState.photos;
        const j = i + dir;
        if (j < 0 || j >= arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]];
        mtgRenderStrip();
      }
      function mtgRemove(i) {
        try { URL.revokeObjectURL(montageState.photos[i].url); } catch (e) {}
        montageState.photos.splice(i, 1);
        mtgRenderStrip();
      }

      function mtgUpdateEstimate() {
        const el = document.getElementById('mtg-est');
        if (!montageState) return;
        const items = montageState.photos;
        const n = items.length;
        if (n < 2) { el.textContent = 'Add at least 2 photos or videos'; return; }
        // Matches lib/montage/timeline.mjs: photos last perSec, clips their own
        // (capped) length, and each join overlaps by the 0.5s crossfade.
        const total = items.reduce((t, p) => t + (p.kind === 'video' ? p.seconds : (p.secs || montageState.perSec)), 0) - (n - 1) * 0.5
          + (items[n - 1].kind === 'video' ? 0 : MTG_END_HOLD);
        const nv = items.filter(p => p.kind === 'video').length, np = n - nv;
        const parts = [];
        if (np) parts.push(`${np} photo${np === 1 ? '' : 's'}`);
        if (nv) parts.push(`${nv} video${nv === 1 ? '' : 's'}`);
        el.textContent = `${parts.join(' · ')} · ~${total.toFixed(0)}s video`;
      }

      function mtgStatus(msg, pct, kind) {
        const el = document.getElementById('mtg-status');
        if (!msg) { el.innerHTML = ''; el.className = 'mtg-status'; return; }
        el.className = 'mtg-status show' + (kind ? ' ' + kind : '');
        el.innerHTML = `<div class="mtg-status-msg">${kind === 'busy' || (typeof pct === 'number' && kind !== 'err' && kind !== 'ok') ? '<span class="mtg-spin"></span>' : ''}${msg}</div>` +
          (typeof pct === 'number' ? `<div class="mtg-bar-wrap"><div class="mtg-bar" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>` : '');
      }

      function mtgMusicUrl(id) {
        const t = (window.MONTAGE_MUSIC || []).find(x => x.id === id);
        return t && t.src ? window.location.origin + t.src : null;
      }

      // Shown instead of Shotstack's billing text when the account is out of
      // credits (the server also sends an alert to top up).
      const MTG_PAUSED = "Montage making is taking a short break. Your montage is saved, so open it from Your saved montages and try again a little later.";
      async function mtgPoll(renderId) {
        const start = Date.now();
        const TIMEOUT_MS = 10 * 60 * 1000; // up to 100 items makes for a long render
        let pollFails = 0;
        while (Date.now() - start < TIMEOUT_MS) {
          // A failed status check isn't a failed render: the render carries on at
          // Shotstack, so keep checking through a few hiccups before giving up.
          let r;
          try {
            const resp = await fetch('/api/montage-status?id=' + encodeURIComponent(renderId));
            r = await resp.json().catch(() => ({ error: `Server error (${resp.status})` }));
          } catch (e) { r = { error: e.message || 'Network error' }; }
          if (r.error) {
            pollFails++;
            if (pollFails >= 6) throw new Error("Couldn't check on the render (" + r.error + '). Your montage is saved, so try Create again.');
            await new Promise(res => setTimeout(res, 3000 * pollFails));
            continue;
          }
          pollFails = 0;
          if (r.status === 'done') {
            // No slug yet — the project is created later, if at all. Logged
            // against the account so an abandoned montage still shows up.
            if (CFG.onRendered) { try { CFG.onRendered(); } catch (e) {} }
            return r;
          }
          if (r.status === 'failed' && r.code === 'out_of_credits') throw Object.assign(new Error('out of credits'), { friendly: MTG_PAUSED });
          if (r.status === 'failed') throw new Error('The render failed' + (r.reason ? ` (${r.reason})` : '') + '. Your montage is saved, so you can change it and try again.');
          const secs = Math.round((Date.now() - start) / 1000);
          mtgStatus(`Rendering your video… (${secs}s)`, 60 + Math.min(30, secs), '');
          await new Promise(res => setTimeout(res, 3000));
        }
        throw new Error('Render timed out. Please try again.');
      }

      async function mtgCreate() {
        if (montageBusy || !montageState) return;
        const st = montageState;
        if (st.photos.length < 2) { mtgStatus('Add at least 2 photos or videos.', null, 'err'); return; }

        montageBusy = true;
        mtgStopMusic();
        const createBtn = document.getElementById('mtg-create');
        const closeBtn = document.getElementById('mtg-close-btn');
        createBtn.disabled = true; closeBtn.disabled = true;

        try {
          // 1. Upload the sources into this montage's saved folder (only the
          //    ones not already there) so the renderer can fetch them.
          await mtgUploadSources(45);
          const urls = [];
          // Every photo is redrawn at the video's size and checked (mtgFramedPhoto),
          // never sent as whatever was uploaded (possibly a 12MP original).
          const needsFraming = p => p.kind === 'image';
          if (st.photos.some(needsFraming)) mtgStatus('Preparing photos…', 48, '');
          const unread = [];
          for (const [i, p] of st.photos.entries()) {
            try { urls.push(needsFraming(p) ? await mtgFramedPhoto(p, st.aspect) : p.remote); }
            catch (e) { unread.push(i + 1); urls.push(null); }
          }
          if (unread.length) throw Object.assign(new Error('unreadable'), { friendly: `${unread.length > 1 ? 'Items' : 'Item'} ${unread.join(', ')} couldn't be read. Remove ${unread.length > 1 ? 'them' : 'it'} and add ${unread.length > 1 ? 'them' : 'it'} again, then Create.` });
          const captions = [];
          if (st.photos.some(p => mtgHasText(p))) mtgStatus('Adding text…', 50, '');
          for (const p of st.photos) captions.push(await mtgCaptionImage(p, st.aspect));

          // 1b. Every file the renderer will fetch must actually be there and be
          //     a picture/video — a missing one renders as a black slide.
          mtgStatus('Checking photos…', 52, '');
          const bad = [];
          await Promise.all(urls.map(async (u, i) => {
            const r = await fetch(u, { method: 'HEAD', cache: 'no-store' }).catch(() => null);
            const type = r && r.headers.get('content-type') || '';
            const empty = r && r.headers.get('content-length') === '0';
            if (!r || !r.ok || empty || !/^(image|video)\//.test(type)) bad.push(i + 1);
          }));
          if (bad.length) {
            if (window.Sentry) Sentry.captureMessage('Montage source unreadable before render: items ' + bad.join(', '));
            throw Object.assign(new Error('unreadable'), { friendly: `${bad.length > 1 ? 'Items' : 'Item'} ${bad.sort((a, b) => a - b).join(', ')} couldn't be read. Remove ${bad.length > 1 ? 'them' : 'it'} and add ${bad.length > 1 ? 'them' : 'it'} again, then Create.` });
          }

          // 2. Kick off the render.
          mtgStatus('Starting render…', 55, '');
          // Everything is uploaded now, so saving the montage is just its
          // recipe. Saved before the render starts, so a failed render never
          // loses it.
          await mtgWriteDraft().catch(e => console.warn('montage save failed', e));

          const startBody = JSON.stringify({
            items: st.photos.map((p, i) => {
              const it = p.kind === 'video'
                ? { type: 'video', url: urls[i], seconds: p.seconds }
                : { type: 'image', url: urls[i], ...(p.secs ? { seconds: p.secs } : {}) };
              const frame = p.kind === 'video' ? mtgVideoFrame(p, st.aspect) : null;
              if (frame) it.frame = frame;
              if (captions[i]) it.caption = captions[i];
              return it;
            }),
            perImageSeconds: st.perSec,
            transition: st.transition,
            musicUrl: mtgMusicUrl(st.musicId),
            aspect: st.aspect,
          });
          // One retry on a server error: Shotstack occasionally answers a good
          // request with a 5xx.
          let startRes;
          for (let attempt = 0; attempt < 2; attempt++) {
            const resp = await fetch('/api/create-montage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: startBody })
              .catch(e => ({ ok: false, status: 0, json: async () => ({ error: e.message || 'Network error' }) }));
            startRes = await resp.json().catch(() => ({ error: `Server error (${resp.status})` }));
            if (!startRes.error || (resp.status && resp.status < 500)) break;
            if (!attempt) { mtgStatus('Starting render… (retrying)', 55, ''); await new Promise(res => setTimeout(res, 4000)); }
          }
          if (startRes.code === 'out_of_credits') throw Object.assign(new Error('out of credits'), { friendly: MTG_PAUSED });
          if (startRes.error) throw new Error("Couldn't start the render (" + startRes.error + '). Your montage is saved, so try Create again.');

          // 3. Poll for completion.
          const done = await mtgPoll(startRes.renderId);

          if (startRes.dryRun || done.dryRun) {
            mtgStatus('✓ Preview mode — the builder works end to end. Connect Shotstack (add SHOTSTACK_API_KEY) to generate the real video.', 100, 'ok');
            montageBusy = false; createBtn.disabled = false; closeBtn.disabled = false;
            return;
          }

          // 4. Pull the finished MP4 into the page (proxy adds CORS), then hand it
          //    to this page's video slot so it saves like any uploaded video.
          mtgStatus('Downloading your video…', 96, '');
          const blob = await fetch('/api/montage-file?url=' + encodeURIComponent(done.url)).then(r => {
            if (!r.ok) throw new Error('Could not download the finished video.');
            return r.blob();
          });
          const file = new File([blob], 'montage.mp4', { type: 'video/mp4' });
          mtgStatus('', null, '');
          montageBusy = false; createBtn.disabled = false; closeBtn.disabled = false;
          mtgShowPreview(file, !!startRes.musicSkipped); // let the user watch it before committing
        } catch (e) {
          console.error('montage error:', e);
          mtgStatus(e.friendly || 'Something went wrong: ' + e.message, null, e.friendly ? 'ok' : 'err');
          montageBusy = false; createBtn.disabled = false; closeBtn.disabled = false;
        }
      }

      // ── Framing: which part of each photo/clip shows in the montage's frame ──
      // Stored as a centre point + zoom (so it survives a change of Shape) and
      // turned into Shotstack's per-side crop fractions at render time.
      const MTG_ASPECT = { portrait: 720 / 1280, square: 1, landscape: 1280 / 720 };
      function mtgImageSize(url) {
        return new Promise(res => {
          const im = new Image();
          im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
          im.onerror = () => res({ w: 0, h: 0 });
          im.src = url;
        });
      }
      // Framing: a centre point (fractions of the source) and a zoom, where
      // z = 1 just fills the frame and smaller zooms out until the whole
      // photo/clip shows with black around it (mtgMinZoom). A photo whose
      // orientation fights the montage's shape (a portrait selfie in a
      // landscape video, or the reverse) starts fully zoomed out, so it isn't
      // cut to a strip. Stored only once the creator changes it.
      function mtgMinZoom(item, aspect) {
        const A = MTG_ASPECT[aspect] || MTG_ASPECT.portrait;
        if (!item.w || !item.h) return 1;
        const r = item.w / item.h;
        return Math.min(1, r / A, A / r);
      }
      function mtgCropOf(item, aspect) {
        if (item.crop) return item.crop;
        const A = MTG_ASPECT[aspect] || MTG_ASPECT.portrait;
        const fights = item.w && item.h && (item.w / item.h - 1) * (A - 1) < 0;
        return { cx: 0.5, cy: 0.5, z: fights || item.fit === 'whole' ? mtgMinZoom(item, aspect) : 1 };
      }
      // Plain fill, centred: nothing to cut or move.
      function mtgIsPlainFill(item, aspect) {
        const c = mtgCropOf(item, aspect);
        return (c.z || 1) === 1 && c.cx === 0.5 && c.cy === 0.5;
      }
      // The visible region, as fractions of the source: { x, y, w, h }. When
      // zoomed out past fill, w or h is over 1 and x/y go negative (black).
      function mtgFrameOf(item, aspect) {
        const A = MTG_ASPECT[aspect] || MTG_ASPECT.portrait;
        if (!item.w || !item.h) return null;
        const c = mtgCropOf(item, aspect);
        const z = Math.min(3, Math.max(mtgMinZoom(item, aspect), c.z || 1));
        let fw, fh;
        if (item.w / item.h > A) { fh = 1; fw = (item.h * A) / item.w; } else { fw = 1; fh = (item.w / A) / item.h; }
        fw /= z; fh /= z;
        // Inside the picture when the frame is smaller; keep the picture inside
        // the frame when it's larger.
        const pos = (p, f) => Math.min(Math.max(0, 1 - f), Math.max(Math.min(0, 1 - f), p - f / 2));
        return { x: pos(c.cx, fw), y: pos(c.cy, fh), w: fw, h: fh, z };
      }
      // A framed photo is cut to its frame here, in the browser, and that image
      // is what renders — it fills the frame exactly (black where zoomed out)
      // and Ken Burns moves over it. (Shotstack's own asset crop trims the
      // placed image and leaves black where it cut, so it isn't used.)
      // Cached per framing.
      // Decode a photo straight at (about) the size the frame needs, which takes
      // a fraction of the memory of a full 12MP decode — Safari runs out and
      // hands back blank images when a montage decodes many full-size photos.
      // Falls back to the plain guarded decode.
      async function mtgDecodeScaled(blob, item, aspect, attempt) {
        const A = MTG_ASPECT[aspect] || MTG_ASPECT.portrait;
        if (!attempt && item.w && item.h && typeof createImageBitmap === 'function') {
          const f = mtgFrameOf(item, aspect);
          const need = (A >= 1 ? 1920 : 1080) / (f.w * item.w);
          const scale = Math.min(1, need * 1.1);
          if (scale < 0.98) {
            try {
              const bm = await createImageBitmap(blob, { resizeWidth: Math.max(2, Math.round(item.w * scale)), resizeHeight: Math.max(2, Math.round(item.h * scale)), resizeQuality: 'high', imageOrientation: 'from-image' });
              if (sourcePaints(bm)) return bm;
              releaseSource(bm);
            } catch (e) { /* option unsupported: fall through */ }
          }
        }
        return decodeDrawable(blob);
      }
      async function mtgFramedPhoto(item, aspect) {
        // 'v2': frames cached before the blank-frame check below may be black,
        // so every saved montage re-frames once.
        const key = 'v3:' + aspect + ':' + JSON.stringify(mtgCropOf(item, aspect));
        if (item.framed && item.framed.key === key) return item.framed.url;
        // Decode with the same guarded path as photo uploads: it orients from
        // EXIF and refuses a decoder that hands back a blank bitmap (Safari
        // does, under memory pressure or with some files). A blank draw used to
        // be uploaded as a solid black slide.
        let blob = item.file || null;
        if (!blob) {
          const r = await fetch(item.remote).catch(() => null);
          if (!r || !r.ok) throw new Error("couldn't read a photo to frame it");
          blob = await r.blob();
        }
        const A = MTG_ASPECT[aspect] || MTG_ASPECT.portrait;
        let out = null;
        for (let attempt = 0; attempt < 2 && !out; attempt++) {
          if (attempt) await new Promise(res => setTimeout(res, 400));
          const src = await mtgDecodeScaled(blob, item, aspect, attempt);
          if (!src) continue;
          const W = src.width || src.naturalWidth, H = src.height || src.naturalHeight;
          const f = mtgFrameOf({ w: W, h: H, crop: mtgCropOf(item, aspect) }, aspect);
          const outW = Math.max(2, Math.round(Math.min(f.w * W, A >= 1 ? 1920 : 1080)));
          const outH = Math.max(2, Math.round(outW / A));
          const c = document.createElement('canvas'); c.width = outW; c.height = outH;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, outW, outH);
          const s = outW / (f.w * W);
          ctx.imageSmoothingQuality = 'high';
          try { ctx.drawImage(src, -f.x * W * s, -f.y * H * s, W * s, H * s); } catch (e) {}
          releaseSource(src);
          // The picture must actually be there: a frame that came out black
          // while the photo itself isn't is a failed draw, not a dark photo.
          if (sourcePaints(c)) out = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
          c.width = c.height = 0; // free the canvas memory now, not at GC
        }
        if (!out) {
          // Better the unframed photo than a black slide.
          console.warn('montage: framing came out blank, using the photo as-is', item.id);
          if (window.Sentry) Sentry.captureMessage('Montage framing came out blank; used unframed photo');
          return item.remote;
        }
        const path = `${mtgDraftDir()}/${item.id}-framed-${aspect}.jpg`;
        const { error } = await CFG.db.storage.from('experiences').upload(path, out, { contentType: 'image/jpeg', upsert: true });
        if (error) throw new Error('Upload failed: ' + error.message);
        // Same path each time it's reframed, so bust any cached copy.
        const url = CFG.db.storage.from('experiences').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
        item.framed = { key, url };
        return url;
      }

      // ── Text on a photo or clip ──
      // Drawn here onto a transparent PNG the size of the finished video, then
      // laid over that photo/clip by the renderer — so it's the site's own
      // font, exactly as previewed in the framing panel, and Ken Burns never
      // moves or crops it. Sizes are fractions of the frame's shorter side;
      // the preview (.mtg-crop-text) uses the same numbers in cqmin.
      const MTG_OUT = { portrait: [720, 1280], square: [720, 720], landscape: [1280, 720] };
      const MTG_TEXT = { line: 1.15, width: 0.84, size: [0.045, 0.16], defSize: 0.075 };
      // Fonts for text: the same set (and weights) as the book/calendar cover
      // titles (COVER_FONTS / COVER_WEIGHT in book.html). `scale` evens out how
      // big each face looks at one size; Google faces load when the framing
      // panel first opens.
      const MTG_FONTS = {
        cooper:    { label: 'Cooper',             family: 'CooperBT',           weight: 400, sub: 400, scale: 1 },
        dmsans:    { label: 'DM Sans',            family: 'DM Sans',            weight: 700, sub: 500, scale: 0.95, gf: 'DM+Sans:wght@500;700' },
        inter:     { label: 'Inter',              family: 'Inter',              weight: 700, sub: 500, scale: 0.92, gf: 'Inter:wght@500;700' },
        filson:    { label: 'Filson Pro',         family: 'FilsonPro',          weight: 700, sub: 500, scale: 0.95 },
        cormorant: { label: 'Cormorant Garamond', family: 'Cormorant Garamond', weight: 400, sub: 600, scale: 1.15, gf: 'Cormorant+Garamond:wght@400;600' },
        libre:     { label: 'Libre Baskerville',  family: 'Libre Baskerville',  weight: 700, sub: 400, scale: 0.88, gf: 'Libre+Baskerville:wght@400;700' },
      };
      function mtgLoadTextFonts() {
        if (document.getElementById('mtg-text-fonts')) return;
        const l = document.createElement('link');
        l.id = 'mtg-text-fonts'; l.rel = 'stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?' + Object.values(MTG_FONTS).filter(f => f.gf).map(f => 'family=' + f.gf).join('&') + '&display=swap';
        document.head.appendChild(l);
      }
      function mtgTextOf(item) { return (item && item.text || '').trim(); }
      function mtgSubOf(item) { return (item && item.sub || '').trim(); }
      function mtgHasText(item) { return !!(mtgTextOf(item) || mtgSubOf(item)); }
      // The subhead (a date, a place): small capitals, widely spaced, under
      // the title — sizes are fractions of the title size. The preview's
      // .mtg-crop-sub uses the same numbers.
      const MTG_SUB = { size: 0.42, track: 0.14, gap: 0.35, line: 1.3 };
      // Where and how an item's text sits: centre as fractions of the frame,
      // font key, size as a fraction of the frame's shorter side. (Older saved
      // montages stored textPos top/middle/bottom.)
      function mtgTextStyle(item) {
        const y0 = { top: 0.15, middle: 0.5, bottom: 0.85 }[item.textPos] || 0.85;
        const font = MTG_FONTS[item.textFont] ? item.textFont : 'cooper';
        const size = Math.min(MTG_TEXT.size[1], Math.max(MTG_TEXT.size[0], Number(item.textSize) || MTG_TEXT.defSize));
        return { x: Number.isFinite(item.textX) ? item.textX : 0.5, y: Number.isFinite(item.textY) ? item.textY : y0, font, size };
      }
      function escMtgText(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
      async function mtgCaptionImage(item, aspect) {
        if (!mtgHasText(item)) return null;
        const st = mtgTextStyle(item);
        const F = MTG_FONTS[st.font];
        const text = mtgTextOf(item), sub = mtgSubOf(item).toUpperCase();
        const key = [aspect, text, sub, st.x, st.y, st.font, st.size].join(':');
        if (item.textImg && item.textImg.key === key) return item.textImg.url;
        const [W, H] = MTG_OUT[aspect] || MTG_OUT.portrait;
        let size = Math.round(Math.min(W, H) * st.size * F.scale);
        mtgLoadTextFonts();
        await Promise.all([document.fonts.load(`${F.weight} ${size}px "${F.family}"`), document.fonts.load(`${F.sub} ${size}px "${F.family}"`)]).catch(() => {});
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        const maxW = W * MTG_TEXT.width;
        // Word-wrap to maxW; `width` measures a run (tracked for the subhead).
        const wrap = (t, width) => {
          const out = [];
          for (const para of t.split(/\n/)) {
            let line = '';
            for (const w of para.split(/\s+/).filter(Boolean)) {
              const next = line ? line + ' ' + w : w;
              if (line && width(next) > maxW) { out.push(line); line = w; } else line = next;
            }
            if (line) out.push(line);
          }
          return out;
        };
        const titleFont = () => `${F.weight} ${size}px "${F.family}", Georgia, serif`;
        const subFont = () => `${F.sub} ${size * MTG_SUB.size}px "${F.family}", Georgia, serif`;
        const tracked = t => ctx.measureText(t).width + size * MTG_SUB.size * MTG_SUB.track * Math.max(0, [...t].length - 1);
        // A single word wider than the line shrinks everything to fit.
        ctx.font = titleFont();
        let fit = Math.max(0, ...text.split(/\s+/).filter(Boolean).map(w => ctx.measureText(w).width / maxW));
        ctx.font = subFont();
        fit = Math.max(fit, ...sub.split(/\s+/).filter(Boolean).map(w => tracked(w) / maxW));
        if (fit > 1) size = Math.floor(size / fit);
        ctx.font = titleFont();
        const lines = text ? wrap(text, t => ctx.measureText(t).width) : [];
        ctx.font = subFont();
        const subLines = sub ? wrap(sub, tracked) : [];
        const lh = size * MTG_TEXT.line, ss = size * MTG_SUB.size, slh = ss * MTG_SUB.line;
        const gap = lines.length && subLines.length ? size * MTG_SUB.gap : 0;
        const blockH = lines.length * lh + gap + subLines.length * slh;
        let y = st.y * H - blockH / 2;
        const cx = st.x * W;
        ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = size * 0.35; ctx.shadowOffsetY = size * 0.04;
        ctx.font = titleFont(); ctx.textAlign = 'center';
        lines.forEach(l => { ctx.fillText(l, cx, y + lh / 2); y += lh; });
        y += gap;
        // Letter by letter, so the tracking works in every browser.
        ctx.font = subFont(); ctx.textAlign = 'left'; ctx.shadowBlur = ss * 0.5;
        const sp = ss * MTG_SUB.track;
        subLines.forEach(l => {
          let x = cx - tracked(l) / 2;
          for (const ch of l) { ctx.fillText(ch, x, y + slh / 2); x += ctx.measureText(ch).width + sp; }
          y += slh;
        });
        const blob = await new Promise(r => c.toBlob(r, 'image/png'));
        if (!blob) throw new Error("couldn't draw a photo's text");
        const path = `${mtgDraftDir()}/${item.id}-text-${aspect}.png`;
        const { error } = await CFG.db.storage.from('experiences').upload(path, blob, { contentType: 'image/png', upsert: true });
        if (error) throw new Error('Upload failed: ' + error.message);
        const url = CFG.db.storage.from('experiences').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
        item.textImg = { key, url };
        return url;
      }
      function mtgDrawText() {
        const item = mtgCropItem();
        const el = document.getElementById('mtg-crop-text');
        if (!item || !el) return;
        const st = mtgTextStyle(item), F = MTG_FONTS[st.font];
        el.innerHTML = (mtgTextOf(item) ? `<span class="mtg-crop-title">${escMtgText(mtgTextOf(item))}</span>` : '')
          + (mtgSubOf(item) ? `<span class="mtg-crop-sub" style="font-weight:${F.sub}">${escMtgText(mtgSubOf(item))}</span>` : '');
        Object.assign(el.style, {
          left: st.x * 100 + '%', top: st.y * 100 + '%',
          fontFamily: `"${F.family}", Georgia, serif`, fontWeight: F.weight,
          fontSize: (st.size * F.scale * 100).toFixed(2) + 'cqmin',
        });
        document.querySelectorAll('#mtg-text-font button').forEach(b => b.classList.toggle('active', b.dataset.v === st.font));
        document.getElementById('mtg-text-size').value = st.size;
        document.getElementById('mtg-text-style').style.display = mtgHasText(item) ? '' : 'none';
      }
      document.addEventListener('input', (e) => {
        const item = mtgCropItem();
        if (!item) return;
        if (e.target.id === 'mtg-crop-text-in') {
          item.text = e.target.value;
          if (!item.text.trim()) delete item.text;
        } else if (e.target.id === 'mtg-crop-sub-in') {
          item.sub = e.target.value;
          if (!item.sub.trim()) delete item.sub;
        } else if (e.target.id === 'mtg-text-size') {
          item.textSize = +e.target.value;
        } else return;
        mtgDrawText();
      });
      document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('#mtg-text-font button');
        const item = b && mtgCropItem();
        if (!item) return;
        item.textFont = b.dataset.v;
        mtgDrawText();
      });
      // Drag the text to place it. Snaps to the centre line when close.
      document.addEventListener('pointerdown', (e) => {
        const el = e.target.closest && e.target.closest('#mtg-crop-text');
        const item = el && mtgCropItem();
        if (!item) return;
        e.preventDefault();
        const box = document.getElementById('mtg-crop-frame').getBoundingClientRect();
        const st = mtgTextStyle(item);
        const start = { px: e.clientX, py: e.clientY, x: st.x, y: st.y };
        el.classList.add('dragging');
        const move = (ev) => {
          let x = Math.min(0.95, Math.max(0.05, start.x + (ev.clientX - start.px) / box.width));
          const y = Math.min(0.95, Math.max(0.05, start.y + (ev.clientY - start.py) / box.height));
          if (Math.abs(x - 0.5) < 0.03) x = 0.5;
          item.textX = +x.toFixed(4); item.textY = +y.toFixed(4); delete item.textPos;
          mtgDrawText();
        };
        const up = () => { el.classList.remove('dragging'); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
        document.addEventListener('pointercancel', up);
      });

      // A framed video clip can't be cut here, so the renderer moves the clip
      // and scales it (below 1 = smaller, black around) until the frame's
      // centre is on screen centre. Offsets are in viewport widths/heights,
      // +y up (Shotstack clip offset).
      function mtgVideoFrame(item, aspect) {
        if (mtgIsPlainFill(item, aspect)) return null;
        const f = mtgFrameOf(item, aspect);
        if (!f) return null;
        const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
        return { x: +((0.5 - cx) / f.w).toFixed(4), y: +((cy - 0.5) / f.h).toFixed(4), scale: +f.z.toFixed(4) };
      }

      let mtgCropId = null;
      function mtgCropItem() { return montageState && montageState.photos.find(p => p.id === mtgCropId); }
      async function mtgOpenCrop(id) {
        const item = montageState && montageState.photos.find(p => p.id === id);
        if (!item) return;
        if (!item.w || !item.h) { const d = await mtgImageSize(item.kind === 'video' ? item.thumb : item.url); item.w = d.w; item.h = d.h; }
        if (!item.w) { mtgStatus("That one can't be framed.", null, 'err'); return; }
        mtgCropId = id;
        document.getElementById('mtg-crop-img').src = item.kind === 'video' ? item.thumb : item.url;
        document.getElementById('mtg-crop-note').textContent = item.kind === 'video'
          ? 'Drag to move it, pinch or slide to size it. The whole clip is framed the same way.'
          : 'Drag to move it, pinch or slide to size it. Add text and set how long it stays on screen.';
        document.getElementById('mtg-crop-time').style.display = item.kind === 'video' ? 'none' : '';
        document.querySelector('#mtg-fit [data-v="whole"]').textContent = item.kind === 'video' ? 'Whole clip' : 'Whole photo';
        mtgItemSecRender();
        document.getElementById('mtg-crop-text-in').value = item.text || '';
        document.getElementById('mtg-crop-sub-in').value = item.sub || '';
        mtgLoadTextFonts();
        document.getElementById('mtg-body-scroll').style.display = 'none';
        document.getElementById('mtg-foot').style.display = 'none';
        document.getElementById('mtg-crop').style.display = 'flex';
        mtgShowFit();
        mtgDrawText();
      }
      // The zoom slider runs from "whole" up to 3x; Fill / Whole are shortcuts.
      function mtgShowFit() {
        const item = mtgCropItem();
        if (!item || !montageState) return;
        const zr = document.getElementById('mtg-crop-zoom');
        zr.min = mtgMinZoom(item, montageState.aspect).toFixed(3);
        zr.value = mtgFrameOf(item, montageState.aspect).z;
        mtgDrawFrame();
      }
      function mtgHideCrop() {
        if (!document.getElementById('mtg-crop')) return;
        document.getElementById('mtg-crop').style.display = 'none';
        if (mtgCropId !== null) {
          document.getElementById('mtg-body-scroll').style.display = '';
          document.getElementById('mtg-foot').style.display = '';
          mtgCropId = null;
          if (montageState) mtgRenderStrip();
        }
      }
      // A photo's own time on screen. Unset means "use Seconds per photo".
      function mtgItemSecStep(delta) {
        const item = mtgCropItem();
        if (!item || !montageState) return;
        const cur = item.secs || montageState.perSec;
        const next = Math.min(MTG_PHOTO_SEC[1], Math.max(MTG_PHOTO_SEC[0], +(cur + delta).toFixed(1)));
        item.secs = next === montageState.perSec ? undefined : next;
        if (!item.secs) delete item.secs;
        mtgItemSecRender();
      }
      function mtgItemSecRender() {
        const item = mtgCropItem();
        if (!item || !montageState) return;
        const v = item.secs || montageState.perSec;
        const isLast = montageState.photos[montageState.photos.length - 1] === item;
        document.getElementById('mtg-item-sec').textContent = v.toFixed(1) + 's';
        document.getElementById('mtg-item-sec-dec').disabled = v <= MTG_PHOTO_SEC[0];
        document.getElementById('mtg-item-sec-inc').disabled = v >= MTG_PHOTO_SEC[1];
        document.getElementById('mtg-item-sec-note').textContent = item.secs
          ? (isLast ? `The last photo also rests ${MTG_END_HOLD}s longer at the end.` : '')
          : (isLast ? `Same as the others, plus a ${MTG_END_HOLD}s rest at the end.` : 'Same as the others.');
      }
      function mtgResetCrop() {
        const item = mtgCropItem();
        if (!item) return;
        delete item.crop;
        delete item.fit;
        delete item.secs;
        mtgItemSecRender();
        mtgShowFit();
      }
      // The preview IS the frame: the montage's shape on black, with the
      // picture placed in it exactly as it will render.
      function mtgDrawFrame() {
        const item = mtgCropItem();
        if (!item) return;
        const A = MTG_ASPECT[montageState.aspect] || MTG_ASPECT.portrait;
        const f = mtgFrameOf(item, montageState.aspect);
        const pic = document.getElementById('mtg-crop-pic');
        pic.style.aspectRatio = String(A);
        pic.style.width = `min(100%, ${(44 * A).toFixed(2)}vh)`;
        const img = document.getElementById('mtg-crop-img');
        img.style.width = 100 / f.w + '%'; img.style.height = 100 / f.h + '%';
        img.style.left = -f.x / f.w * 100 + '%'; img.style.top = -f.y / f.h * 100 + '%';
        const zMin = mtgMinZoom(item, montageState.aspect);
        document.querySelectorAll('#mtg-fit button').forEach(b => b.classList.toggle('active',
          b.dataset.v === 'fill' ? Math.abs(f.z - 1) < 0.005 : Math.abs(f.z - zMin) < 0.005 && zMin < 1));
        document.querySelector('#mtg-fit [data-v="whole"]').disabled = zMin >= 1;
      }
      // Store a framing, keeping the centre where the frame can actually reach
      // so a later drag responds at once instead of first "unwinding".
      function mtgSetCrop(item, cx, cy, z) {
        const zz = Math.min(3, Math.max(mtgMinZoom(item, montageState.aspect), z));
        const f = mtgFrameOf({ w: item.w, h: item.h, crop: { cx, cy, z: zz } }, montageState.aspect);
        item.crop = { cx: +(f.x + f.w / 2).toFixed(4), cy: +(f.y + f.h / 2).toFixed(4), z: +zz.toFixed(4) };
        delete item.fit;
      }
      function mtgZoomTo(item, z) {
        const f = mtgFrameOf(item, montageState.aspect);
        mtgSetCrop(item, f.x + f.w / 2, f.y + f.h / 2, z);
        document.getElementById('mtg-crop-zoom').value = mtgFrameOf(item, montageState.aspect).z;
        mtgDrawFrame();
      }
      document.addEventListener('input', (e) => {
        if (e.target.id !== 'mtg-crop-zoom') return;
        const item = mtgCropItem();
        if (item) mtgZoomTo(item, +e.target.value);
      });
      // Drag to move the picture (it follows the finger); two fingers pinch to
      // size it; a mouse wheel or trackpad zooms too.
      const mtgPtrs = new Map();
      let mtgPinch = null;
      document.addEventListener('pointerdown', (e) => {
        const pic = e.target.closest && !e.target.closest('#mtg-crop-text') && e.target.closest('#mtg-crop-pic');
        const item = pic && mtgCropItem();
        if (!item) return;
        e.preventDefault();
        mtgPtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const box = pic.getBoundingClientRect();
        const begin = () => {
          const f = mtgFrameOf(item, montageState.aspect);
          const pts = [...mtgPtrs.values()];
          const mid = { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length };
          const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
          mtgPinch = { mid, dist, cx: f.x + f.w / 2, cy: f.y + f.h / 2, fw: f.w, fh: f.h, z: f.z };
        };
        begin();
        if (mtgPtrs.size > 1) return; // the first pointer's listeners already run
        const move = (ev) => {
          if (!mtgPtrs.has(ev.pointerId)) return;
          mtgPtrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
          const pts = [...mtgPtrs.values()];
          if (pts.length !== (mtgPinch.dist ? 2 : 1)) begin();
          const mid = { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length };
          let z = mtgPinch.z;
          if (pts.length > 1 && mtgPinch.dist) z = mtgPinch.z * Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / mtgPinch.dist;
          mtgSetCrop(item, mtgPinch.cx - (mid.x - mtgPinch.mid.x) / box.width * mtgPinch.fw,
                           mtgPinch.cy - (mid.y - mtgPinch.mid.y) / box.height * mtgPinch.fh, z);
          document.getElementById('mtg-crop-zoom').value = mtgFrameOf(item, montageState.aspect).z;
          mtgDrawFrame();
        };
        const up = (ev) => {
          mtgPtrs.delete(ev.pointerId);
          if (mtgPtrs.size) { begin(); return; }
          mtgPinch = null;
          document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
        document.addEventListener('pointercancel', up);
      });
      document.addEventListener('wheel', (e) => {
        const pic = e.target.closest && e.target.closest('#mtg-crop-pic');
        const item = pic && mtgCropItem();
        if (!item) return;
        e.preventDefault();
        mtgZoomTo(item, mtgFrameOf(item, montageState.aspect).z * Math.exp(-e.deltaY * 0.0025));
      }, { passive: false });
      // Changing Shape while framing redraws the frame at the new shape.
      document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#mtg-aspect')) setTimeout(mtgShowFit, 0); });

      // ── Saved montages ──
      // Kept in the storage bucket, per account: montage-drafts/{user}/{id}/
      // holds the uploaded photos and clips plus draft.json (order, framing,
      // settings). Rendering uploads into the same folder, so a rendered
      // montage is saved without uploading anything twice.
      function mtgDraftDir(id) { return `montage-drafts/${mtgUser().id}/${id || montageState.draftId}`; }
      function mtgSig() {
        const st = montageState;
        return JSON.stringify([st.photos.map(p => [p.id, p.crop || 0, p.fit || '', p.secs || 0, p.text || '', p.sub || '', p.textPos || '', p.textX || 0, p.textY || 0, p.textFont || '', p.textSize || 0]), st.perSec, st.transition, st.aspect, st.musicId, st.name || '']);
      }
      async function mtgUploadSources(pctSpan) {
        const st = montageState;
        const todo = st.photos.filter(p => !p.remote);
        if (!todo.length) return;
        let uploaded = 0;
        const noun = todo.some(p => p.kind === 'video') ? 'photos and videos' : 'photos';
        mtgStatus(`Uploading ${noun}… (0 of ${todo.length})`, 0, '');
        const one = async (item) => {
          const f = item.file;
          const isVid = item.kind === 'video';
          const ext = ((f.name.split('.').pop() || (isVid ? 'mp4' : 'jpg')).toLowerCase().replace(/[^a-z0-9]/g, '')) || (isVid ? 'mp4' : 'jpg');
          const path = `${mtgDraftDir()}/${item.id}.${ext}`;
          const contentType = f.type || (isVid ? (ext === 'mov' ? 'video/quicktime' : 'video/mp4') : 'image/jpeg');
          const { error } = await CFG.db.storage.from('experiences').upload(path, f, { contentType, upsert: true });
          if (error) throw new Error('Upload failed: ' + error.message);
          item.remote = CFG.db.storage.from('experiences').getPublicUrl(path).data.publicUrl;
          uploaded++;
          mtgStatus(`Uploading ${noun}… (${uploaded} of ${todo.length})`, Math.round((uploaded / todo.length) * pctSpan), '');
        };
        // Capped concurrency: the wait is the slowest few uploads, not the sum.
        let next = 0;
        await Promise.all(Array.from({ length: Math.min(6, todo.length) }, async () => {
          while (next < todo.length) await one(todo[next++]);
        }));
      }
      // A montage with no name gets one on save, so the list never shows two
      // anonymous "31 photos" rows. The creator can change it any time.
      function mtgEnsureName() {
        const st = montageState;
        if (st.name && st.name.trim()) return;
        st.name = 'Montage · ' + new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const el = document.getElementById('mtg-name');
        if (el) el.value = st.name;
      }
      async function mtgWriteDraft() {
        mtgEnsureName();
        const st = montageState;
        const draft = {
          v: 1, id: st.draftId, name: st.name || '', updatedAt: new Date().toISOString(),
          perSec: st.perSec, transition: st.transition, aspect: st.aspect, musicId: st.musicId,
          items: st.photos.map(p => ({ id: p.id, kind: p.kind, url: p.remote, thumb: p.kind === 'video' ? p.thumb : undefined,
                                        seconds: p.seconds, secs: p.secs, trimmed: p.trimmed, w: p.w, h: p.h, crop: p.crop, fit: p.fit, framed: p.framed,
                                        text: p.text, sub: p.sub, textPos: p.textPos, textX: p.textX, textY: p.textY,
                                        textFont: p.textFont, textSize: p.textSize, textImg: p.textImg })),
        };
        const blob = new Blob([JSON.stringify(draft)], { type: 'application/json' });
        const { error } = await CFG.db.storage.from('experiences').upload(`${mtgDraftDir(st.draftId)}/draft.json`, blob, { contentType: 'application/json', upsert: true });
        if (error) throw new Error(error.message);
        st.savedSig = mtgSig();
      }
      async function mtgSaveDraft() {
        if (montageBusy || !montageState) return false;
        if (!mtgUser()) { mtgStatus('Sign in to save a montage.', null, 'err'); return false; }
        if (!montageState.photos.length) { mtgStatus('Add a photo or video first.', null, 'err'); return false; }
        montageBusy = true;
        const btns = ['mtg-save-draft', 'mtg-create', 'mtg-close-btn'].map(id => document.getElementById(id));
        btns.forEach(b => b && (b.disabled = true));
        try {
          await mtgUploadSources(90);
          await mtgWriteDraft();
          mtgStatus('✓ Saved. Open it again any time from Make a montage.', null, 'ok');
          return true;
        } catch (e) {
          console.error('montage save error:', e);
          mtgStatus("Couldn't save: " + e.message, null, 'err');
          return false;
        } finally {
          montageBusy = false;
          btns.forEach(b => b && (b.disabled = false));
        }
      }

      let mtgDrafts = [];
      async function mtgLoadDraftList() {
        const wrap = document.getElementById('mtg-drafts');
        wrap.hidden = true;
        mtgDrafts = [];
        if (!mtgUser()) return;
        const forState = montageState;
        try {
          const dir = `montage-drafts/${mtgUser().id}`;
          const { data, error } = await CFG.db.storage.from('experiences').list(dir, { limit: 100 });
          if (error || !data) return;
          const got = await Promise.all(data.filter(d => !d.id).map(async (d) => {
            const url = CFG.db.storage.from('experiences').getPublicUrl(`${dir}/${d.name}/draft.json`).data.publicUrl;
            try { const r = await fetch(url + '?t=' + Date.now()); return r.ok ? await r.json() : null; } catch (e) { return null; }
          }));
          if (montageState !== forState) return; // closed or reopened meanwhile
          mtgDrafts = got.filter(d => d && Array.isArray(d.items) && d.items.length)
                         .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
          mtgRenderDrafts();
        } catch (e) { console.warn('montage list failed', e); }
      }
      function mtgRenderDrafts() {
        const wrap = document.getElementById('mtg-drafts');
        if (!montageState || montageState.photos.length || !mtgDrafts.length) { wrap.hidden = true; return; }
        const X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        wrap.innerHTML = '<p class="mtg-drafts-h">Your saved montages</p><div class="mtg-drafts-list">' + mtgDrafts.map((d, i) => {
          // A photo makes a better cover than a video's first frame (often black).
          const first = d.items.find(it => it.kind !== 'video') || d.items[0];
          const nv = d.items.filter(it => it.kind === 'video').length, np = d.items.length - nv;
          const parts = [];
          if (np) parts.push(`${np} photo${np === 1 ? '' : 's'}`);
          if (nv) parts.push(`${nv} video${nv === 1 ? '' : 's'}`);
          const when = d.updatedAt ? new Date(d.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
          return `<div class="mtg-draft" role="button" tabindex="0" onclick="mtgOpenDraft(${i})">
              <img src="${esc(first.kind === 'video' ? first.thumb : first.url)}" alt=""/>
              <span class="mtg-draft-txt"><b>${esc(d.name || parts.join(' · '))}</b><span>${d.name ? parts.join(' · ') + ' · ' : ''}Saved ${esc(when)}</span></span>
              <button type="button" class="mtg-draft-del" title="Delete" aria-label="Delete this montage" onclick="event.stopPropagation(); mtgDeleteDraft(${i})">${X}</button>
            </div>`;
        }).join('') + '</div>';
        wrap.hidden = false;
      }
      function mtgOpenDraft(i) { mtgOpenDraftData(mtgDrafts[i]); }
      function mtgOpenDraftData(d) {
        if (!d || !montageState || montageBusy) return;
        Object.assign(montageState, {
          draftId: d.id, name: d.name || '', perSec: d.perSec || 3, transition: d.transition === 'fade' ? 'fade' : 'kenburns',
          aspect: MTG_ASPECT[d.aspect] ? d.aspect : 'portrait', musicId: d.musicId || 'none',
          photos: d.items.map(it => ({ ...it, url: it.url, remote: it.url })),
        });
        montageState.savedSig = mtgSig();
        mtgSyncControls();
        mtgRenderStrip();
        mtgRenderDrafts();
        mtgStatus('');
      }
      async function mtgDeleteDraft(i) {
        const d = mtgDrafts[i];
        if (!d) return;
        const ok = await popcodeConfirm('Its photos and videos are removed from the saved copy. Any Popcode already using this montage keeps playing it.',
          { title: 'Delete this saved montage?', confirmText: 'Delete', danger: true });
        if (!ok) return;
        const dir = mtgDraftDir(d.id);
        const { data } = await CFG.db.storage.from('experiences').list(dir, { limit: 1000 });
        const paths = (data || []).map(f => `${dir}/${f.name}`);
        if (paths.length) await CFG.db.storage.from('experiences').remove(paths);
        mtgDrafts.splice(i, 1);
        mtgRenderDrafts();
      }

      // Drop a finished montage MP4 into a page's video slot, mirroring the DOM
      // updates the normal upload path makes.
      // The host seam: hand the finished montage to whatever media slot
      // this page uses. Everything above is page-agnostic.
      function mtgApplyToPage(target, file) {
        if (CFG.onApply) CFG.onApply(target, file);
      }

  // ── Host interface ──────────────────────────────────────────────────────
  window.PopcodeMontage = {
    init: function (opts) { Object.assign(CFG, opts || {}); },
    isOpen: function () { return !!montageState; },
    // Load a draft the host fetched itself into the open builder.
    openDraft: function (d) { mtgMount(); return mtgOpenDraftData(d); },
  };

  // The injected markup uses inline handlers, which resolve against the global
  // scope — so the handful of entry points it names have to live on window.
  window.openMontage    = function (target) { mtgMount(); return openMontage(target); };
  window.closeMontage   = closeMontage;
  window.mtgAddPhotos   = mtgAddPhotos;
  window.mtgCreate      = mtgCreate;
  window.mtgHideCrop    = mtgHideCrop;
  window.mtgItemSecStep = mtgItemSecStep;
  window.mtgRedoPreview = mtgRedoPreview;
  window.mtgResetCrop   = mtgResetCrop;
  window.mtgSaveDraft   = mtgSaveDraft;
  window.mtgSaveVideo   = mtgSaveVideo;
  window.mtgSecStep     = mtgSecStep;
  window.mtgUsePreview  = mtgUsePreview;
  // The name field writes straight to this, so it needs to be live, not a copy.
  Object.defineProperty(window, 'montageState', {
    configurable: true,
    get: function () { return montageState; },
    set: function (v) { montageState = v; },
  });
})();
