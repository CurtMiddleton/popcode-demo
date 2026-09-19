// Hero placement tuner — loaded by index.html ONLY when ?tune is in the URL,
// so it costs an ordinary visitor nothing but one regex test.
//
// What it is for: each scene in the hero reel is placed by four numbers, and a
// phone wants different ones from a desktop. Describing a placement in words
// costs a round trip per scene and lands close but not right. This puts the
// numbers under your thumb on the device you are actually looking at, then
// hands back the exact lines to paste into POPCODE_SCENES and the CSS.
//
//   popcode.app/?tune=1
//
// It writes phone-only values (hSm / xSm / ySm / rotSm) and the three phone
// globals. Desktop placement is untouched.
(function () {
  'use strict';

  var SCENES = window.POPCODE_SCENES;
  var reel = window.popcodeReel;
  if (!SCENES || !reel) { return; }

  var hero = document.querySelector('.hero');
  if (!hero) { return; }

  // Read the value the page is currently using for a scene, phone variant
  // first, so the sliders open where the design is rather than at zero.
  function num(v, dflt) {
    var n = parseFloat(v);
    return isNaN(n) ? dflt : n;
  }
  function sceneVal(word, key, dflt) {
    var sc = SCENES[word] || {};
    return num(sc[key + 'Sm'] != null ? sc[key + 'Sm'] : sc[key], dflt);
  }
  // The globals live as custom properties on .hero, with the CSS fallback used
  // until something sets them — so read the computed value, not the inline one.
  function heroVar(name, dflt) {
    var v = getComputedStyle(hero).getPropertyValue(name);
    return v.trim() ? num(v, dflt) : dflt;
  }

  var FIELDS = [
    { key: 'h',   label: 'Height',   unit: '%',   min: 40,  max: 200, step: 1,   scene: true },
    { key: 'x',   label: 'Across',   unit: '%',   min: -90, max: 90,  step: 1,   scene: true },
    { key: 'y',   label: 'Up/down',  unit: '%',   min: -90, max: 90,  step: 1,   scene: true },
    { key: 'rot', label: 'Tilt',     unit: 'deg', min: -20, max: 20,  step: 0.5, scene: true },
    { key: 'stage-rise',  label: 'Stage rise',  unit: 'px', min: -220, max: 60,  step: 2 },
    { key: 'art-inset',   label: 'Art inset',   unit: 'px', min: -80,  max: 200, step: 2 },
    { key: 'phone-inset', label: 'Phone inset', unit: 'px', min: -40,  max: 200, step: 2 },
  ];

  var word = reel.words[0];
  var state = {};   // per-scene: { albums: {h,x,y,rot}, … }
  var globals = {
    'stage-rise':  heroVar('--stage-rise', -66),
    'art-inset':   heroVar('--art-inset', 20),
    'phone-inset': heroVar('--phone-inset', 34),
  };
  reel.words.forEach(function (w) {
    state[w] = {
      h:   sceneVal(w, 'h', 90),
      x:   sceneVal(w, 'x', 0),
      y:   sceneVal(w, 'y', 0),
      rot: sceneVal(w, 'rot', -7),
    };
  });

  // ── Panel ──────────────────────────────────────────────────────────────
  var css = document.createElement('style');
  css.textContent = [
    '.ht { position: fixed; left: 8px; right: 8px; bottom: 8px; z-index: 9600;',
    '      background: rgba(18,16,28,.93); color: #fff; border-radius: 14px;',
    '      font: 500 12px/1.3 -apple-system, BlinkMacSystemFont, "Inter", sans-serif;',
    '      padding: 10px 12px 12px; box-shadow: 0 10px 34px rgba(0,0,0,.4);',
    '      -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }',
    '.ht.min { padding-bottom: 10px; }',
    '.ht.min .ht-body { display: none; }',
    '.ht-top { display: flex; align-items: center; gap: 8px; }',
    '.ht-ttl { font-weight: 800; letter-spacing: .02em; flex: 1 1 auto; }',
    '.ht-vw { opacity: .6; font-variant-numeric: tabular-nums; }',
    '.ht-btn { -webkit-appearance: none; appearance: none; border: 0; cursor: pointer;',
    '          background: rgba(255,255,255,.15); color: #fff; border-radius: 999px;',
    '          font: 700 12px/1 inherit; padding: 7px 11px; }',
    '.ht-btn.go { background: #fff; color: #17131f; }',
    '.ht-chips { display: flex; gap: 5px; margin: 9px 0 4px; flex-wrap: wrap; }',
    '.ht-chip { -webkit-appearance: none; appearance: none; border: 0; cursor: pointer;',
    '           background: rgba(255,255,255,.13); color: #fff; border-radius: 999px;',
    '           font: 700 11px/1 inherit; padding: 7px 9px; }',
    '.ht-chip.on { background: #7c3aed; }',
    '.ht-row { display: flex; align-items: center; gap: 9px; margin-top: 7px; }',
    '.ht-lab { flex: 0 0 82px; opacity: .75; }',
    '.ht-row input[type=range] { flex: 1 1 auto; min-width: 0; accent-color: #8b5cf6; height: 26px; }',
    '.ht-num { flex: 0 0 56px; text-align: right; font-weight: 700;',
    '          font-variant-numeric: tabular-nums; }',
    '.ht-sep { height: 1px; background: rgba(255,255,255,.14); margin: 10px 0 2px; }',
    // While a slider is under your thumb the panel is in the way of the thing
    // you are judging, so it drops out of sight and comes back on release.
    '.ht.peek { opacity: .16; }',
    '.ht-out { width: 100%; height: 108px; margin-top: 9px; display: none; resize: none;',
    '          background: #0c0a12; color: #d7d2e6; border: 1px solid rgba(255,255,255,.16);',
    '          border-radius: 8px; padding: 7px; font: 11px/1.45 ui-monospace, Menlo, monospace; }',
  ].join('\n');
  document.head.appendChild(css);

  var el = document.createElement('div');
  el.className = 'ht';
  el.innerHTML =
    '<div class="ht-top">' +
      '<span class="ht-ttl">Hero placement</span>' +
      '<span class="ht-vw" id="ht-vw"></span>' +
      '<button class="ht-btn" id="ht-reset">Reset</button>' +
      '<button class="ht-btn go" id="ht-copy">Copy</button>' +
      '<button class="ht-btn" id="ht-min">–</button>' +
    '</div>' +
    '<div class="ht-body">' +
      '<div class="ht-chips" id="ht-chips"></div>' +
      '<div id="ht-scene"></div>' +
      '<div class="ht-sep"></div>' +
      '<div id="ht-global"></div>' +
      '<textarea class="ht-out" id="ht-out" readonly></textarea>' +
    '</div>';
  document.body.appendChild(el);

  var rows = {};
  function addRow(host, f) {
    var r = document.createElement('div');
    r.className = 'ht-row';
    r.innerHTML = '<span class="ht-lab">' + f.label + '</span>' +
      '<input type="range" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '">' +
      '<span class="ht-num"></span>';
    var input = r.querySelector('input'), out = r.querySelector('.ht-num');
    var peek = function (on) { el.classList.toggle('peek', on); };
    input.addEventListener('pointerdown', function () { peek(true); });
    ['pointerup', 'pointercancel', 'blur', 'change'].forEach(function (ev) {
      input.addEventListener(ev, function () { peek(false); });
    });
    input.addEventListener('input', function () {
      var v = parseFloat(input.value);
      if (f.scene) { state[word][f.key] = v; } else { globals[f.key] = v; }
      out.textContent = v + f.unit;
      apply();
    });
    host.appendChild(r);
    rows[f.key] = { input: input, out: out, f: f };
  }
  FIELDS.filter(function (f) { return f.scene; })
        .forEach(function (f) { addRow(document.getElementById('ht-scene'), f); });
  FIELDS.filter(function (f) { return !f.scene; })
        .forEach(function (f) { addRow(document.getElementById('ht-global'), f); });

  reel.words.forEach(function (w) {
    var c = document.createElement('button');
    c.className = 'ht-chip';
    c.textContent = w;
    c.addEventListener('click', function () { go(w); });
    document.getElementById('ht-chips').appendChild(c);
  });

  // ── Apply ──────────────────────────────────────────────────────────────
  // Written back onto the scene objects, then re-applied through the page's own
  // renderer — so what the sliders show is what the page does, not a parallel
  // implementation that could drift from it.
  function apply() {
    var st = state[word], sc = SCENES[word];
    sc.hSm = st.h + '%'; sc.xSm = st.x + '%'; sc.ySm = st.y + '%'; sc.rotSm = st.rot + 'deg';
    hero.style.setProperty('--stage-rise', globals['stage-rise'] + 'px');
    hero.style.setProperty('--art-inset', globals['art-inset'] + 'px');
    hero.style.setProperty('--phone-inset', globals['phone-inset'] + 'px');
    if (window.popcodeApplyArt) window.popcodeApplyArt(word);
  }

  function syncInputs() {
    FIELDS.forEach(function (f) {
      var v = f.scene ? state[word][f.key] : globals[f.key];
      rows[f.key].input.value = v;
      rows[f.key].out.textContent = v + f.unit;
    });
    [].forEach.call(document.querySelectorAll('.ht-chip'), function (c) {
      c.classList.toggle('on', c.textContent === word);
    });
    document.getElementById('ht-vw').textContent =
      window.innerWidth + '×' + window.innerHeight;
  }

  function go(w) {
    word = w;
    reel.go(w);
    syncInputs();
    apply();
  }

  // ── Output ─────────────────────────────────────────────────────────────
  function report() {
    var lines = ['Hero placement — ' + window.innerWidth + '×' + window.innerHeight + ' viewport', ''];
    reel.words.forEach(function (w) {
      var st = state[w];
      lines.push(w + ': hSm ' + st.h + '%, xSm ' + st.x + '%, ySm ' + st.y + '%, rotSm ' + st.rot + 'deg');
    });
    lines.push('');
    lines.push('globals: stage-rise ' + globals['stage-rise'] + 'px, art-inset ' +
               globals['art-inset'] + 'px, phone-inset ' + globals['phone-inset'] + 'px');
    return lines.join('\n');
  }

  document.getElementById('ht-copy').addEventListener('click', function () {
    var text = report(), out = document.getElementById('ht-out');
    out.value = text;
    out.style.display = 'block';
    // Clipboard needs a gesture and a secure context; both hold on a tap on
    // popcode.app. Where it is refused the textarea is the fallback — it is on
    // screen either way so the text can always be selected by hand.
    var done = function (ok) {
      var b = document.getElementById('ht-copy');
      b.textContent = ok ? 'Copied' : 'Select ↓';
      setTimeout(function () { b.textContent = 'Copy'; }, 1600);
    };
    try {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } catch (e) { done(false); }
  });

  document.getElementById('ht-reset').addEventListener('click', function () {
    reel.words.forEach(function (w) {
      delete SCENES[w].hSm; delete SCENES[w].xSm; delete SCENES[w].ySm; delete SCENES[w].rotSm;
      state[w] = { h: sceneVal(w, 'h', 90), x: sceneVal(w, 'x', 0),
                   y: sceneVal(w, 'y', 0), rot: sceneVal(w, 'rot', -7) };
    });
    hero.style.removeProperty('--stage-rise');
    hero.style.removeProperty('--art-inset');
    hero.style.removeProperty('--phone-inset');
    globals = { 'stage-rise': heroVar('--stage-rise', -66),
                'art-inset': heroVar('--art-inset', 20),
                'phone-inset': heroVar('--phone-inset', 34) };
    document.getElementById('ht-out').style.display = 'none';
    syncInputs();
    apply();
  });

  document.getElementById('ht-min').addEventListener('click', function () {
    el.classList.toggle('min');
    document.getElementById('ht-min').textContent = el.classList.contains('min') ? '+' : '–';
  });

  window.addEventListener('resize', syncInputs);

  reel.pause();
  go(word);
})();
