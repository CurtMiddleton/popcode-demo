/* ─────────────────────────────────────────────────────────────────────────
   Popcode link (slug) helper — shared by create / book / calendar / boardbook.

   The old model handed everyone an unreadable 8-character code. This turns the
   Popcode's own name into its link as the creator types it, so
   "Max Chapter One" becomes popcode.app/maxchapterone. If that link is already
   spoken for we say so plainly and offer near-miss alternatives (hyphenated,
   dated, numbered) they can take with one tap.

   The creator can always edit the link by hand; the moment they do, we stop
   overwriting it from the name.

   Exposes window.PopcodeSlug. Loaded as a plain <script> (no build step).
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // Slugs are the whole public URL space, so keep them short enough to read
  // aloud and long enough to hold a real title. "maxchapterone" is 13.
  var MIN = 3, MAX = 30;

  // Every top-level path this site serves, plus names we don't want claimed.
  // Vercel checks the filesystem before it checks the slug rewrite, so a slug
  // matching a real page would be shadowed by that page and never resolve.
  var RESERVED = new Set([
    'account', 'analytics', 'auth', 'beta-feedback', 'boardbook', 'book',
    'calendar', 'composite', 'config', 'countries', 'create', 'design', 'edit',
    'howto', 'index', 'manage', 'marker-test', 'mockup-a', 'mockup-b',
    'mockup-c', 'montage-music', 'nav', 'order', 'order-success', 'privacy',
    'qr-test', 'reset', 'scan', 'sentry-init', 'shop', 'slug', 'terms', 'view',
    'views', 'audio-wav', 'image-source', 'unsplash-samples',
    'admin', 'api', 'app', 'assets', 'static', 'public', 'vendor', 'video',
    'about', 'dashboard', 'help', 'home', 'login', 'logout', 'new', 'popcode',
    'pricing', 'profile', 'settings', 'signin', 'signup', 'support', 'www'
  ]);

  // ── Text → slug ─────────────────────────────────────────────────────────
  // Split a name into its word tokens, stripping accents so "Café" reads as
  // "cafe" rather than vanishing.
  function words(name) {
    var s = String(name == null ? '' : name);
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  }

  // The default: run the words together. "Max Chapter One" → "maxchapterone".
  function slugify(name) { return words(name).join('').slice(0, MAX); }

  // The alternative we offer when the default is taken.
  function hyphenate(name) {
    return words(name).join('-').slice(0, MAX).replace(/-+$/, '');
  }

  // What a creator is allowed to type by hand. A trailing hyphen survives so
  // "max-" can become "max-2" without the field fighting them mid-word.
  function normalize(raw) {
    return String(raw == null ? '' : raw)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-{2,}/g, '-')
      .replace(/^-+/, '')
      .slice(0, MAX);
  }

  function randomSlug() {
    var a = 'abcdefghijklmnopqrstuvwxyz0123456789', s = '';
    for (var i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }

  function validate(slug) {
    if (!slug) return { ok: false, msg: 'Pick a link for your Popcode' };
    if (slug.length < MIN) return { ok: false, msg: 'At least ' + MIN + ' characters' };
    if (slug.length > MAX) return { ok: false, msg: 'Up to ' + MAX + ' characters' };
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      return { ok: false, msg: 'Letters, numbers and hyphens — no hyphen at either end' };
    }
    if (RESERVED.has(slug)) return { ok: false, msg: '"' + slug + '" is reserved' };
    return { ok: true, msg: '' };
  }

  // ── Availability ────────────────────────────────────────────────────────
  // One round trip per table for the whole candidate list. `experiences` is
  // the legacy single-target format — view.html still falls back to it, so its
  // slugs are live URLs and have to be treated as taken.
  function takenSet(db, list) {
    var out = new Set();
    if (!list || !list.length) return Promise.resolve(out);
    var uniq = Array.from(new Set(list));
    // Goes through an RPC rather than reading the tables: availability has to
    // consider slugs owned by everyone, but the content tables are now scoped
    // to their owner. popcode_slugs_taken is SECURITY DEFINER and answers only
    // for candidates you supply, so it can't be used to enumerate. It covers
    // the legacy `experiences` slugs too — view.html still falls back to them,
    // so they're live URLs and have to count as taken.
    return db.rpc('popcode_slugs_taken', { slugs: uniq }).then(function (r) {
      // A read error can't be read as "free" — that would hand out a slug
      // that fails at insert time. Surface it instead.
      if (r && r.error) throw r.error;
      (r && r.data || []).forEach(function (slug) { out.add(slug); });
      return out;
    });
  }

  function isAvailable(db, slug) {
    return takenSet(db, [slug]).then(function (t) { return !t.has(slug); });
  }

  // Near misses, in the order we'd rather hand them out: the readable
  // hyphenated form first, then a date, then plain numbering, then a random
  // tail that is all but guaranteed to be free.
  function candidates(base, name) {
    var year = new Date().getFullYear();
    var list = [];
    var hy = name ? hyphenate(name) : '';
    if (hy && hy !== base) list.push(hy);
    list.push(base + '-' + year);
    for (var i = 2; i <= 5; i++) list.push(base + '-' + i);
    list.push(base + '-' + Math.random().toString(36).slice(2, 6));
    return list
      .map(function (s) { return s.slice(0, MAX).replace(/-+$/, ''); })
      .filter(function (s) { return validate(s).ok; });
  }

  function suggest(db, base, name, count) {
    var list = candidates(base, name);
    return takenSet(db, list).then(function (taken) {
      var free = [];
      for (var i = 0; i < list.length && free.length < (count || 3); i++) {
        if (!taken.has(list[i]) && free.indexOf(list[i]) === -1) free.push(list[i]);
      }
      return free;
    });
  }

  // ── Shared styling for the suggestion chips ─────────────────────────────
  // Injected once so all four builders get the same affordance without each
  // stylesheet having to know about it.
  function injectStyle() {
    if (document.getElementById('popcode-slug-style')) return;
    var st = document.createElement('style');
    st.id = 'popcode-slug-style';
    st.textContent =
      '.slug-suggests{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}' +
      '.slug-suggest{font:inherit;font-size:13px;font-weight:600;line-height:1;' +
      'padding:7px 12px;border-radius:999px;border:1px solid #d8d8d8;' +
      'background:#fff;color:#1a1a1a;cursor:pointer}' +
      '.slug-suggest:hover{border-color:#1a1a1a}' +
      '.slug-suggest:active{transform:scale(.97)}';
    document.head.appendChild(st);
  }

  /* ── attach ───────────────────────────────────────────────────────────────
     Wires a name field to a slug field.

       db          supabase client
       nameInput   the Popcode / book / calendar title field
       slugInput   the link field (may be visually hidden behind a display row)
       note        element that carries the hint text and suggestion chips
       classes     { base, ok, err } — class names this page's hint uses
       prefix      shown in hint copy, default 'popcode.app/'
       nameLabel   what this page calls its name field ('name', 'title')
       onChange    (slug, status) — for the page's own display/summary refresh

     Returns { get, set, status, isReady, touch, untouch, lock, refresh }.
     `status` is one of: empty | short | invalid | checking | ok | taken | error
     ─────────────────────────────────────────────────────────────────────── */
  function attach(opts) {
    injectStyle();

    var db = opts.db;
    var nameInput = opts.nameInput;
    var slugInput = opts.slugInput;
    var note = opts.note;
    var cls = opts.classes || {};
    var prefix = opts.prefix || 'popcode.app/';
    var nameLabel = opts.nameLabel || 'name';   // what the host page calls its title field
    var onChange = opts.onChange || function () {};

    var touched = !!opts.touched;   // has the creator hand-edited the link?
    var locked = false;             // link is fixed (already-created project)
    var status = 'empty';
    var timer = null, token = 0;

    function setNote(text, kind, chips) {
      if (!note) return;
      note.className = [cls.base || '', kind === 'ok' ? (cls.ok || '') : '', kind === 'err' ? (cls.err || '') : '']
        .filter(Boolean).join(' ');
      note.textContent = text;
      if (chips && chips.length) {
        var wrap = document.createElement('div');
        wrap.className = 'slug-suggests';
        chips.forEach(function (s) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'slug-suggest';
          b.textContent = s;
          b.addEventListener('click', function () { set(s, true); });
          wrap.appendChild(b);
        });
        note.appendChild(wrap);
      }
    }

    function emit() { onChange(current(), status); }
    function current() { return normalize(slugInput.value).replace(/-+$/, ''); }

    function run() {
      if (locked) return;
      var slug = normalize(slugInput.value);
      var trimmed = slug.replace(/-+$/, '');
      if (timer) clearTimeout(timer);
      token++;

      if (!trimmed) {
        status = 'empty';
        setNote(touched ? 'Pick a link for your Popcode.'
                        : 'Your link fills in from the ' + nameLabel + ' above.', '');
        return emit();
      }

      var v = validate(trimmed);
      if (!v.ok) {
        // While the link is still tracking the name, a half-typed name isn't a
        // mistake — don't scold someone mid-word.
        if (!touched && trimmed.length < MIN) {
          status = 'short';
          setNote('Your link: ' + prefix + trimmed + '…', '');
        } else {
          status = 'invalid';
          setNote(v.msg, 'err');
        }
        return emit();
      }

      status = 'checking';
      setNote('Checking ' + prefix + trimmed + '…', '');
      emit();

      var my = token;
      timer = setTimeout(function () {
        takenSet(db, [trimmed]).then(function (taken) {
          if (my !== token) return;                       // a newer keystroke won
          if (!taken.has(trimmed)) {
            status = 'ok';
            setNote(prefix + trimmed + ' is available', 'ok');
            return emit();
          }
          status = 'taken';
          setNote(trimmed + ' is taken — try one of these:', 'err');
          emit();
          return suggest(db, trimmed, nameInput ? nameInput.value : '', 3)
            .then(function (alts) {
              if (my !== token) return;
              setNote(trimmed + ' is taken — try one of these:', 'err', alts);
            });
        }).catch(function () {
          if (my !== token) return;
          status = 'error';
          setNote('Couldn\'t check that link right now — try again', 'err');
          emit();
        });
      }, 350);
    }

    function set(value, asTouched) {
      slugInput.value = normalize(value);
      if (asTouched) touched = true;
      run();
    }

    if (nameInput) {
      nameInput.addEventListener('input', function () {
        if (touched || locked) return;
        slugInput.value = slugify(nameInput.value);
        run();
      });
    }

    slugInput.addEventListener('input', function () {
      if (locked) return;
      touched = true;
      var clean = normalize(slugInput.value);
      // Rewrite the field in place so what's shown is exactly what gets saved.
      if (clean !== slugInput.value) {
        var at = slugInput.selectionStart;
        slugInput.value = clean;
        try { slugInput.setSelectionRange(at - 1, at - 1); } catch (e) {}
      }
      run();
    });

    // Deferred so the first paint can't run before the rest of the host page's
    // script has finished parsing — onChange callbacks routinely touch state
    // declared further down the file, and a synchronous call hits its TDZ.
    setTimeout(run, 0);

    return {
      get: current,
      set: set,
      status: function () { return status; },
      // True once we've confirmed the link is free. `checking` is deliberately
      // not ready — the submit path re-checks anyway.
      isReady: function () { return status === 'ok'; },
      touch: function () { touched = true; },
      untouch: function () { touched = false; },
      lock: function (slug, text) {
        locked = true;
        if (slug) slugInput.value = slug;
        slugInput.disabled = true;
        if (text) setNote(text, '');
        status = 'ok';
        emit();
      },
      // A duplicated project gets its own editable link again.
      unlock: function (slug) {
        locked = false;
        touched = false;
        slugInput.disabled = false;
        slugInput.value = slug || randomSlug();
        run();
      },
      // Submit-time gate: re-validate and re-check, so a link claimed by
      // someone else while this page sat open can't slip through to the insert.
      // Repaints the hint (with fresh suggestions) when it fails.
      ensureFree: function () {
        var slug = current();
        var v = validate(slug);
        if (!v.ok) { status = 'invalid'; setNote(v.msg, 'err'); return Promise.resolve(false); }
        return takenSet(db, [slug]).then(function (t) {
          if (!t.has(slug)) return true;
          run();
          return false;
        }).catch(function () {
          status = 'error';
          setNote('Couldn\'t check that link right now — try again', 'err');
          return false;
        });
      },
      refresh: run
    };
  }

  window.PopcodeSlug = {
    MIN: MIN, MAX: MAX, RESERVED: RESERVED,
    words: words, slugify: slugify, hyphenate: hyphenate, normalize: normalize,
    randomSlug: randomSlug, validate: validate,
    takenSet: takenSet, isAvailable: isAvailable, suggest: suggest,
    attach: attach
  };
})();
