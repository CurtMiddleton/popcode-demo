// The scan badge's colour, chosen per Popcode (collections.symbol_color).
//
// window.PopcodeSymbol.normalize(c)          -> 'color' | 'black' | 'white' ('color' for anything else)
// window.PopcodeSymbol.url(c)                -> the badge SVG for that colour
// window.PopcodeSymbol.picker(el, value, fn) -> draws the three-way picker into el;
//                                               fn(colour) on change. Returns { get, set }.
// window.PopcodeSymbol.missingColumn(err)    -> true when a Supabase error is only
//                                               "symbol_color doesn't exist yet"
//
// The column arrives by migration (supabase/migrations/2026-10-06-symbol-color.sql).
// Pages read and write it tolerantly so a deploy that lands before the migration
// still works — every Popcode just stays on the colour symbol.
(function () {
  var FILES = { color: 'popcode_symbol_color.svg', black: 'popcode_symbol_k.svg', white: 'popcode_symbol_w.svg' };
  var LABELS = { color: 'Color', black: 'Black', white: 'White' };
  var ORDER = ['color', 'black', 'white'];

  function normalize(c) { return FILES[c] ? c : 'color'; }
  function url(c) { return '/assets/' + FILES[normalize(c)]; }
  function missingColumn(err) {
    return !!err && /symbol_color/.test((err.message || '') + ' ' + (err.details || '') + ' ' + (err.hint || ''));
  }

  var styled = false;
  function addStyles() {
    if (styled) return; styled = true;
    var s = document.createElement('style');
    s.textContent =
      '.sym-picker { display:inline-flex; background:#eee; border-radius:16px; padding:3px; gap:2px; }' +
      '.sym-picker button { display:inline-flex; align-items:center; gap:6px; border:none; background:none; border-radius:14px;' +
      '  padding:5px 12px 5px 6px; font:500 13px Inter, system-ui, sans-serif; color:#666; cursor:pointer; }' +
      '.sym-picker button.active { background:#fff; color:#1a1a1a; font-weight:600; box-shadow:0 1px 4px rgba(0,0,0,0.12); }' +
      // A hairline ring so the white badge shows against the white chip.
      '.sym-picker img { width:20px; height:20px; border-radius:50%; box-shadow:0 0 0 1px rgba(0,0,0,0.3); display:block; }';
    document.head.appendChild(s);
  }

  function picker(el, value, onChange) {
    addStyles();
    var current = normalize(value);
    el.classList.add('sym-picker');
    el.setAttribute('role', 'radiogroup');
    el.setAttribute('aria-label', 'Symbol color');
    el.innerHTML = ORDER.map(function (c) {
      return '<button type="button" role="radio" data-symbol="' + c + '"><img src="' + url(c) + '" alt=""/>' + LABELS[c] + '</button>';
    }).join('');
    function paint() {
      el.querySelectorAll('button').forEach(function (b) {
        var on = b.dataset.symbol === current;
        b.classList.toggle('active', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      });
    }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-symbol]');
      if (!b || b.dataset.symbol === current) return;
      current = b.dataset.symbol;
      paint();
      if (onChange) onChange(current);
    });
    paint();
    return {
      get: function () { return current; },
      set: function (c) { current = normalize(c); paint(); },
    };
  }

  window.PopcodeSymbol = { COLORS: ORDER, normalize: normalize, url: url, picker: picker, missingColumn: missingColumn };
})();
