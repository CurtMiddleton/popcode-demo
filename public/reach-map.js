/*
 * Global reach map — analytics.html, Map tab. Admin only.
 *
 *   PopcodeReachMap.load({ db, container, users })
 *
 * Three layers, each toggleable:
 *   Accounts — one pin per account, where it signed up (or, for accounts older
 *              than signup events, where it was first seen signed in).
 *   Popcodes — every photo + video (or audio) pair ever made, all time, read
 *              from collections/collection_items and pinned at the owner's
 *              account place. Counted like the Accounts tab (popcode_used()).
 *   Products — books, board books, calendars, montages (create_* events,
 *              which only exist from 2026-09-09).
 *   Watched  — every time a Popcode was opened, minus the owner's own opens.
 * Plus share lines (creator's place → where their Popcode was watched), country
 * shading, a time slider that replays the growth, and a by-country table.
 *
 * Coordinates: events logged after 2026-09-26 carry Vercel's city-level
 * latitude/longitude (supabase/migrations/2026-09-26-event-coordinates.sql).
 * Older events only have city/region/country text, so those places are looked
 * up once by name (OpenStreetMap Nominatim, 1 request a second, cached in this
 * browser) and pinned as they arrive.
 *
 * No map tiles: the world is drawn from Natural Earth country shapes
 * (world-atlas), so there is no tile provider, key, or usage policy involved.
 */
(function () {
  'use strict';

  var LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
  var LEAFLET_JS  = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
  var TOPOJSON_JS = 'https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js';
  var WORLD_JSON  = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

  var COLORS = { accounts: '#7657FC', popcodes: '#E0457B', products: '#E39B1B', watched: '#1F8FD1' };
  var LABELS = { accounts: 'Accounts', popcodes: 'Popcodes', products: 'Products', watched: 'Watched' };
  var PRODUCT_LABELS = { create_book: 'Books', create_boardbook: 'Board books',
    create_calendar: 'Calendars', create_montage: 'Montages' };
  // A creator and a viewer in the same metro area isn't a trip worth a line.
  var MIN_LINE_KM = 80;
  var GEO_CACHE_KEY = 'pc-reach-geo-v1';
  var DAY = 86400000;

  // world-atlas ids are ISO 3166-1 numeric; Vercel sends alpha-2.
  var ISO_NUM = '4:AF,8:AL,12:DZ,16:AS,20:AD,24:AO,660:AI,10:AQ,28:AG,32:AR,51:AM,533:AW,36:AU,40:AT,31:AZ,44:BS,48:BH,50:BD,52:BB,112:BY,56:BE,84:BZ,204:BJ,60:BM,64:BT,68:BO,70:BA,72:BW,74:BV,76:BR,86:IO,96:BN,100:BG,854:BF,108:BI,116:KH,120:CM,124:CA,132:CV,136:KY,140:CF,148:TD,152:CL,156:CN,162:CX,166:CC,170:CO,174:KM,178:CG,180:CD,184:CK,188:CR,384:CI,191:HR,192:CU,196:CY,203:CZ,208:DK,262:DJ,212:DM,214:DO,218:EC,818:EG,222:SV,226:GQ,232:ER,233:EE,231:ET,238:FK,234:FO,242:FJ,246:FI,250:FR,254:GF,258:PF,260:TF,266:GA,270:GM,268:GE,276:DE,288:GH,292:GI,300:GR,304:GL,308:GD,312:GP,316:GU,320:GT,324:GN,624:GW,328:GY,332:HT,334:HM,336:VA,340:HN,344:HK,348:HU,352:IS,356:IN,360:ID,364:IR,368:IQ,372:IE,376:IL,380:IT,388:JM,392:JP,400:JO,398:KZ,404:KE,296:KI,408:KP,410:KR,414:KW,417:KG,418:LA,428:LV,422:LB,426:LS,430:LR,434:LY,438:LI,440:LT,442:LU,446:MO,450:MG,454:MW,458:MY,462:MV,466:ML,470:MT,584:MH,474:MQ,478:MR,480:MU,175:YT,484:MX,583:FM,498:MD,492:MC,496:MN,500:MS,504:MA,508:MZ,104:MM,516:NA,520:NR,524:NP,528:NL,540:NC,554:NZ,558:NI,562:NE,566:NG,570:NU,574:NF,580:MP,807:MK,578:NO,512:OM,586:PK,585:PW,275:PS,591:PA,598:PG,600:PY,604:PE,608:PH,612:PN,616:PL,620:PT,630:PR,634:QA,638:RE,642:RO,643:RU,646:RW,654:SH,659:KN,662:LC,666:PM,670:VC,882:WS,674:SM,678:ST,682:SA,686:SN,690:SC,694:SL,702:SG,703:SK,705:SI,90:SB,706:SO,710:ZA,239:GS,724:ES,144:LK,729:SD,740:SR,744:SJ,748:SZ,752:SE,756:CH,760:SY,158:TW,762:TJ,834:TZ,764:TH,626:TL,768:TG,772:TK,776:TO,780:TT,788:TN,792:TR,795:TM,796:TC,798:TV,800:UG,804:UA,784:AE,826:GB,840:US,581:UM,858:UY,860:UZ,548:VU,862:VE,704:VN,92:VG,850:VI,876:WF,732:EH,887:YE,894:ZM,716:ZW,248:AX,535:BQ,531:CW,831:GG,833:IM,832:JE,499:ME,652:BL,663:MF,688:RS,534:SX,728:SS';
  var NUM_TO_A2 = {};
  ISO_NUM.split(',').forEach(function (p) { var kv = p.split(':'); NUM_TO_A2[+kv[0]] = kv[1]; });
  // Shapes world-atlas leaves without an ISO id.
  var NAME_TO_A2 = { 'Kosovo': 'XK', 'Somaliland': 'SO', 'N. Cyprus': 'CY' };

  var regionNames = null;
  try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { /* old browser */ }
  function countryName(cc) {
    if (!cc) return 'Unknown';
    try { return (regionNames && regionNames.of(cc)) || cc; } catch (e) { return cc; }
  }
  function flag(cc) {
    if (!cc || !/^[A-Z]{2}$/i.test(cc)) return '';
    return cc.toUpperCase().replace(/./g, function (c) { return String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0)); });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(ms) {
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function km(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function placeLabel(p) {
    return (p.city ? p.city + ', ' : '') + countryName(p.country);
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  var libsPromise = null;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = function () { reject(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }
  function loadLibs() {
    if (!libsPromise) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = LEAFLET_CSS;
      document.head.appendChild(l);
      libsPromise = Promise.all([
        loadScript(LEAFLET_JS), loadScript(TOPOJSON_JS),
        fetch(WORLD_JSON).then(function (r) { if (!r.ok) throw new Error('World shapes: HTTP ' + r.status); return r.json(); }),
      ]).then(function (res) { return res[2]; })
        .catch(function (e) { libsPromise = null; throw e; });
    }
    return libsPromise;
  }

  // Rows from get_reach_events; before that migration runs, fall back to the
  // Activity tab's RPC (no coordinates — every place gets looked up by name).
  // Supabase returns at most 1000 rows a request (max-rows) whatever max_rows
  // says, and without an error, so every read pages until a short page.
  async function allPages(db, fn, args) {
    var PAGE = 1000, out = [], from = 0;
    for (;;) {
      var r = await db.rpc(fn, args).range(from, from + PAGE - 1);
      if (r.error) throw r.error;
      var batch = r.data || [];
      out = out.concat(batch);
      if (batch.length < PAGE) return out;
      from += PAGE;
    }
  }

  async function allTableRows(db, table, cols) {
    var PAGE = 1000, out = [], from = 0;
    for (;;) {
      var r = await db.from(table).select(cols).range(from, from + PAGE - 1);
      if (r.error) throw r.error;
      var batch = r.data || [];
      out = out.concat(batch);
      if (batch.length < PAGE) return out;
      from += PAGE;
    }
  }

  async function fetchEvents(db) {
    try {
      return { rows: await allPages(db, 'get_reach_events', { max_rows: 200000 }), migrated: true };
    } catch (e) {
      console.warn('get_reach_events unavailable, falling back:', e.message);
    }
    var f = await allPages(db, 'get_events_with_users', { days_back: 0, max_rows: 200000 });
    var rows = f.map(function (e) {
      return {
        slug: e.slug, event_type: e.event_type, user_id: e.user_id, created_at: e.created_at,
        city: e.city, region: e.region, country: e.country,
        latitude: e.latitude, longitude: e.longitude,
        visitor: (e.ip_address || '') + '|' + (e.user_agent || ''),
      };
    });
    return { rows: rows, migrated: false };
  }

  // ── Places ──────────────────────────────────────────────────────────────
  function placeKey(e) {
    return [(e.city || '').trim(), (e.region || '').trim(), (e.country || '').trim().toUpperCase()].join('|');
  }
  function readGeoCache() {
    try { return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function writeGeoCache(c) {
    try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(c)); } catch (e) { /* private mode */ }
  }
  async function geocode(key) {
    var parts = key.split('|'), city = parts[0], region = parts[1], cc = parts[2];
    var base = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1';
    var urls = [];
    if (city) {
      // US/CA region codes ("OR", "BC") disambiguate; elsewhere they are often
      // numeric and only confuse the search.
      var q = city + (region && /^[A-Z]{2}$/.test(region) && (cc === 'US' || cc === 'CA') ? ', ' + region : '');
      urls.push(base + '&q=' + encodeURIComponent(q) + (cc ? '&countrycodes=' + cc.toLowerCase() : ''));
    }
    if (cc) urls.push(base + '&country=' + encodeURIComponent(cc));
    for (var i = 0; i < urls.length; i++) {
      var res = await fetch(urls[i], { headers: { 'Accept-Language': 'en' } });
      if (!res.ok) throw new Error('Nominatim HTTP ' + res.status);
      var j = await res.json();
      if (j && j[0]) return { lat: +j[0].lat, lon: +j[0].lon, approx: !city || i > 0 };
      if (i < urls.length - 1) await sleep(1100);
    }
    return null;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ── State ───────────────────────────────────────────────────────────────
  var S = null;

  function createState(opts, world, fetched, cols) {
    return {
      opts: opts, world: world, migrated: fetched.migrated, rows: fetched.rows,
      cols: cols, users: opts.users || [],
      show: { accounts: true, popcodes: true, products: true, watched: true, lines: true, shade: true },
      through: Date.now(), minT: Date.now(), maxT: Date.now(),
      coords: {}, pending: [], geocoding: false, geoFailed: 0,
      map: null, layers: {}, playing: null, countryRowsAll: false,
    };
  }

  // Coordinates for every place: exact ones from the rows themselves (averaged
  // per place), then this browser's lookup cache. Whatever is left is queued.
  function resolvePlaces() {
    var sums = {}, keys = {};
    S.rows.forEach(function (e) {
      var k = placeKey(e);
      e._key = k;
      keys[k] = true;
      if (e.latitude != null && e.longitude != null) {
        var s = sums[k] || (sums[k] = { lat: 0, lon: 0, n: 0 });
        s.lat += +e.latitude; s.lon += +e.longitude; s.n++;
      }
    });
    var cache = readGeoCache();
    S.pending = [];
    Object.keys(keys).forEach(function (k) {
      if (sums[k]) { S.coords[k] = { lat: sums[k].lat / sums[k].n, lon: sums[k].lon / sums[k].n }; return; }
      if (k === '||') return; // nothing to go on
      if (cache[k] !== undefined) { if (cache[k]) S.coords[k] = cache[k]; return; }
      S.pending.push(k);
    });
  }

  async function runGeocoder() {
    if (S.geocoding || !S.pending.length) return;
    S.geocoding = true;
    var cache = readGeoCache(), sinceDraw = 0;
    while (S.pending.length && S === currentState) {
      var k = S.pending.shift();
      try {
        var c = await geocode(k);
        cache[k] = c; // null too: don't ask again for a place OSM doesn't know
        if (c) S.coords[k] = c; else S.geoFailed++;
        writeGeoCache(cache);
      } catch (e) {
        console.warn('geocode failed', k, e);
        S.geoFailed++;
      }
      if (++sinceDraw >= 4 || !S.pending.length) { sinceDraw = 0; rebuild(); }
      await sleep(1100); // Nominatim policy: at most one request a second
    }
    S.geocoding = false;
    rebuild();
  }
  var currentState = null;

  // ── Model ───────────────────────────────────────────────────────────────
  // Turns rows into dated items per layer. Rebuilt when new coordinates land.
  function buildModel() {
    var ownerOf = {}, nameOf = {};
    S.cols.forEach(function (c) { ownerOf[c.slug] = c.user_id; nameOf[c.slug] = c.name || c.slug; });
    var userById = {};
    S.users.forEach(function (u) { userById[u.id] = u; });

    function at(e) {
      var c = S.coords[e._key];
      if (!c) return null;
      return { key: e._key, lat: c.lat, lon: c.lon, city: e.city, country: (e.country || '').toUpperCase() };
    }

    // Accounts: the signup event's place, else the first place seen signed in.
    var acctEvt = {};
    S.rows.forEach(function (e) {
      if (!e.user_id || !S.coords[e._key]) return;
      var cur = acctEvt[e.user_id];
      var rank = e.event_type === 'signup' ? 0 : 1;
      var curRank = cur && (cur.event_type === 'signup' ? 0 : 1);
      if (!cur || rank < curRank || (rank === curRank && e.created_at < cur.created_at)) acctEvt[e.user_id] = e;
    });
    var accounts = [], acctPlace = {};
    Object.keys(acctEvt).forEach(function (uid) {
      var e = acctEvt[uid], p = at(e);
      if (!p) return;
      var u = userById[uid];
      acctPlace[uid] = p;
      accounts.push({
        t: Date.parse((u && u.created_at) || e.created_at), place: p, uid: uid,
        name: u ? (u.full_name || u.email || uid.slice(0, 8)) : uid.slice(0, 8),
      });
    });

    // Popcodes: same rule as popcode_used() / the Accounts tab — one per
    // distinct (project, photo) with a video or audio behind it. Dated by the
    // project, placed at its owner's account place.
    var colById = {};
    S.cols.forEach(function (c) { colById[c.id] = c; });
    var popcodes = [], seen = {}, popTotal = 0;
    S.items.forEach(function (it) {
      if (!it.video_url && !it.audio_url) return;
      var k = it.collection_id + '|' + it.target_index;
      if (seen[k]) return;
      seen[k] = 1;
      var col = colById[it.collection_id];
      if (!col || !col.user_id) return;
      popTotal++;
      var p = acctPlace[col.user_id];
      if (p) popcodes.push({ t: Date.parse(col.created_at), place: p, name: col.name || col.slug });
    });

    var products = [], watched = [], lines = {};
    S.rows.forEach(function (e) {
      var t = Date.parse(e.created_at);
      if (/^create_/.test(e.event_type)) {
        if (e.event_type === 'create_project') return; // counted as Popcodes above, all time
        var p = at(e);
        if (p) products.push({ t: t, place: p, type: e.event_type });
        return;
      }
      if (e.event_type !== 'scan_open') return;
      var owner = ownerOf[e.slug];
      if (owner && e.user_id === owner) return; // the creator checking their own
      var v = at(e);
      if (!v) return;
      watched.push({ t: t, place: v, slug: e.slug, name: nameOf[e.slug] || e.slug, visitor: e.visitor });
      var o = owner && acctPlace[owner];
      if (o && o.key !== v.key) {
        var d = km(o, v);
        if (d >= MIN_LINE_KM) {
          var lk = o.key + '>' + v.key;
          var L = lines[lk] || (lines[lk] = { from: o, to: v, km: d, items: [] });
          L.items.push({ t: t, name: nameOf[e.slug] || e.slug });
        }
      }
    });

    var all = accounts.concat(popcodes, products, watched).filter(function (x) { return isFinite(x.t); });
    // A slider left at "today" stays at today when late geocodes rebuild this.
    var atEnd = !S.model || S.through >= S.maxT;
    S.minT = all.length ? Math.min.apply(null, all.map(function (x) { return x.t; })) : Date.now();
    S.maxT = Date.now();
    if (atEnd) S.through = S.maxT;
    S.model = { accounts: accounts, popcodes: popcodes, popTotal: popTotal, products: products, watched: watched,
      lines: Object.keys(lines).map(function (k) { return lines[k]; }) };
  }

  // Everything visible through the slider's date, grouped by place.
  function aggregate() {
    var T = S.through, places = {}, countries = {};
    function P(p) {
      return places[p.key] || (places[p.key] = { p: p, accounts: [], popcodesN: 0, popProjects: {}, products: {}, productsN: 0, watchedN: 0, visitors: {}, projects: {}, first: Infinity });
    }
    function C(cc) {
      return countries[cc] || (countries[cc] = { cc: cc, accounts: 0, popcodes: 0, products: 0, watched: 0, visitors: {}, first: Infinity });
    }
    S.model.accounts.forEach(function (a) {
      if (a.t > T) return;
      var g = P(a.place); g.accounts.push(a.name); g.first = Math.min(g.first, a.t);
      var c = C(a.place.country); c.accounts++; c.first = Math.min(c.first, a.t);
    });
    S.model.popcodes.forEach(function (x) {
      if (x.t > T) return;
      var g = P(x.place); g.popcodesN++; g.popProjects[x.name] = (g.popProjects[x.name] || 0) + 1; g.first = Math.min(g.first, x.t);
      var c = C(x.place.country); c.popcodes++; c.first = Math.min(c.first, x.t);
    });
    S.model.products.forEach(function (x) {
      if (x.t > T) return;
      var g = P(x.place); g.products[x.type] = (g.products[x.type] || 0) + 1; g.productsN++; g.first = Math.min(g.first, x.t);
      var c = C(x.place.country); c.products++; c.first = Math.min(c.first, x.t);
    });
    S.model.watched.forEach(function (x) {
      if (x.t > T) return;
      var g = P(x.place); g.watchedN++; g.visitors[x.visitor] = 1; g.projects[x.name] = (g.projects[x.name] || 0) + 1; g.first = Math.min(g.first, x.t);
      var c = C(x.place.country); c.watched++; c.visitors[x.visitor] = 1; c.first = Math.min(c.first, x.t);
    });
    var lines = S.model.lines.map(function (L) {
      var n = L.items.filter(function (i) { return i.t <= T; }).length;
      return n ? { from: L.from, to: L.to, km: L.km, n: n, names: L.items.map(function (i) { return i.name; }) } : null;
    }).filter(Boolean);
    return { places: places, countries: countries, lines: lines };
  }

  // What a place or country holds on the visible layers. Places carry lists
  // and *N counts, countries carry plain counts.
  function layerCount(g, k) {
    if (k === 'accounts') return Array.isArray(g.accounts) ? g.accounts.length : g.accounts;
    return g[k + 'N'] != null ? g[k + 'N'] : (g[k] || 0);
  }
  function visibleCount(g) {
    return ['accounts', 'popcodes', 'products', 'watched'].reduce(function (n, k) {
      return n + (S.show[k] ? layerCount(g, k) : 0);
    }, 0);
  }

  // ── Drawing ─────────────────────────────────────────────────────────────
  function radius(n) { return Math.min(28, 4 + 3.6 * Math.sqrt(n)); }

  function curve(a, b) {
    // A gentle arc: quadratic bezier with its control point pushed sideways.
    // Stays on the one drawn world rather than taking the short way across
    // the date line, which would run off the edge of the map.
    var lon2 = b.lon;
    var mx = (a.lon + lon2) / 2, my = (a.lat + b.lat) / 2;
    var dx = lon2 - a.lon, dy = b.lat - a.lat;
    var cx = mx - dy * 0.25, cy = my + dx * 0.25;
    var pts = [];
    for (var i = 0; i <= 24; i++) {
      var t = i / 24, u = 1 - t;
      pts.push([u * u * a.lat + 2 * u * t * cy + t * t * b.lat, u * u * a.lon + 2 * u * t * cx + t * t * lon2]);
    }
    return pts;
  }

  function popupHtml(g) {
    var h = '<div class="rm-pop"><div class="rm-pop-title">' + flag(g.p.country) + ' ' + esc(placeLabel(g.p)) + '</div>';
    if (g.accounts.length) {
      h += '<div class="rm-pop-row"><span class="rm-dot" style="background:' + COLORS.accounts + '"></span><b>' +
        g.accounts.length + '</b> account' + (g.accounts.length === 1 ? '' : 's') + '</div>' +
        '<div class="rm-pop-sub">' + g.accounts.slice(0, 6).map(esc).join(', ') + (g.accounts.length > 6 ? ' +' + (g.accounts.length - 6) + ' more' : '') + '</div>';
    }
    if (g.popcodesN) {
      var tp = Object.keys(g.popProjects).sort(function (a, b) { return g.popProjects[b] - g.popProjects[a]; });
      h += '<div class="rm-pop-row"><span class="rm-dot" style="background:' + COLORS.popcodes + '"></span><b>' + g.popcodesN + '</b> Popcode' + (g.popcodesN === 1 ? '' : 's') +
        ' in ' + tp.length + ' project' + (tp.length === 1 ? '' : 's') + '</div>' +
        '<div class="rm-pop-sub">' + tp.slice(0, 4).map(function (n) { return esc(n) + ' (' + g.popProjects[n] + ')'; }).join(', ') + (tp.length > 4 ? ' +' + (tp.length - 4) + ' more' : '') + '</div>';
    }
    if (g.productsN) {
      h += '<div class="rm-pop-row"><span class="rm-dot" style="background:' + COLORS.products + '"></span><b>' + g.productsN + '</b> product' + (g.productsN === 1 ? '' : 's') + '</div>' +
        '<div class="rm-pop-sub">' + Object.keys(g.products).map(function (k) { return g.products[k] + ' ' + esc(PRODUCT_LABELS[k] || k); }).join(' · ') + '</div>';
    }
    if (g.watchedN) {
      var nv = Object.keys(g.visitors).length;
      var top = Object.keys(g.projects).sort(function (a, b) { return g.projects[b] - g.projects[a]; }).slice(0, 4);
      h += '<div class="rm-pop-row"><span class="rm-dot" style="background:' + COLORS.watched + '"></span><b>' + g.watchedN + '</b> open' + (g.watchedN === 1 ? '' : 's') +
        ' · ' + nv + ' viewer' + (nv === 1 ? '' : 's') + '</div>' +
        '<div class="rm-pop-sub">' + top.map(function (n) { return esc(n) + ' (' + g.projects[n] + ')'; }).join(', ') + '</div>';
    }
    if (isFinite(g.first)) h += '<div class="rm-pop-foot">First activity ' + fmtDate(g.first) + '</div>';
    return h + '</div>';
  }

  function draw(agg) {
    var L = window.L, map = S.map;
    ['lines', 'pins'].forEach(function (k) { if (S.layers[k]) map.removeLayer(S.layers[k]); });

    // Country shading: log-scaled so one busy country doesn't wash out the rest.
    var maxC = 1;
    Object.keys(agg.countries).forEach(function (cc) { maxC = Math.max(maxC, visibleCount(agg.countries[cc])); });
    S.layers.countries.eachLayer(function (layer) {
      var c = agg.countries[layer.feature._a2], n = c ? visibleCount(c) : 0;
      var a = n && S.show.shade ? 0.12 + 0.5 * Math.log(1 + n) / Math.log(1 + maxC) : 0;
      layer.setStyle({ fillColor: n && S.show.shade ? '#7657FC' : '#ffffff', fillOpacity: n && S.show.shade ? a : 1 });
    });

    var lines = L.layerGroup();
    if (S.show.lines) {
      agg.lines.forEach(function (ln) {
        L.polyline(curve(ln.from, ln.to), {
          color: '#7657FC', weight: Math.min(4, 1 + Math.log(ln.n)), opacity: 0.38, interactive: true,
        }).bindTooltip(esc(placeLabel(ln.from)) + ' → ' + esc(placeLabel(ln.to)) + '<br>' +
          Math.round(ln.km).toLocaleString() + ' km · ' + ln.n + ' open' + (ln.n === 1 ? '' : 's'), { sticky: true })
          .addTo(lines);
      });
    }
    lines.addTo(map);

    // Pins: per place, one circle per visible layer, biggest underneath.
    var pins = L.layerGroup();
    Object.keys(agg.places).forEach(function (k) {
      var g = agg.places[k];
      var parts = [];
      ['watched', 'popcodes', 'products', 'accounts'].forEach(function (k) {
        var n = layerCount(g, k);
        if (S.show[k] && n) parts.push([k, n]);
      });
      if (!parts.length) return;
      parts.sort(function (a, b) { return b[1] - a[1]; });
      var html = popupHtml(g);
      parts.forEach(function (pt) {
        L.circleMarker([g.p.lat, g.p.lon], {
          radius: radius(pt[1]), color: '#ffffff', weight: 1.2,
          fillColor: COLORS[pt[0]], fillOpacity: 0.72,
        }).bindPopup(html, { maxWidth: 280 }).addTo(pins);
      });
    });
    pins.addTo(map);
    S.layers.lines = lines; S.layers.pins = pins;
  }

  function stats(agg) {
    var el = S.opts.container.querySelector('.rm-stats');
    var cc = Object.keys(agg.countries).filter(function (c) { return c && visibleCount(agg.countries[c]); });
    var cities = Object.keys(agg.places).filter(function (k) { return agg.places[k].p.city && visibleCount(agg.places[k]); });
    var nAcct = 0, nPop = 0, nProd = 0, nOpens = 0, viewers = {};
    Object.keys(agg.places).forEach(function (k) {
      var g = agg.places[k];
      nAcct += g.accounts.length; nPop += g.popcodesN; nProd += g.productsN; nOpens += g.watchedN;
      Object.keys(g.visitors).forEach(function (v) { viewers[v] = 1; });
    });
    var far = agg.lines.slice().sort(function (a, b) { return b.km - a.km; })[0];
    var newest = cc.map(function (c) { return agg.countries[c]; }).sort(function (a, b) { return b.first - a.first; })[0];
    var totalAccts = S.users.filter(function (u) { return !u.created_at || Date.parse(u.created_at) <= S.through; }).length;

    function card(v, label, sub, color, layer) {
      return '<div class="card rm-card' + (layer && !S.show[layer] ? ' rm-off' : '') + '"><div class="card-value"' + (color ? ' style="color:' + color + '"' : '') + '>' + v + '</div>' +
        '<div class="card-label">' + label + '</div>' + (sub ? '<div class="rm-card-sub">' + sub + '</div>' : '') + '</div>';
    }
    el.innerHTML =
      card(cc.length, 'Countries', cities.length + ' cities' + (newest ? ' · newest ' + flag(newest.cc) + ' ' + esc(countryName(newest.cc)) : '')) +
      card(nAcct, 'Accounts placed', totalAccts ? 'of ' + totalAccts + ' accounts' : '', COLORS.accounts, 'accounts') +
      card(nPop, 'Popcodes', S.through >= S.maxT && S.model.popTotal > nPop ? 'of ' + S.model.popTotal + ' made (rest unplaced)' : 'photo + video pairs', COLORS.popcodes, 'popcodes') +
      card(nProd, 'Products', 'books, calendars, montages', COLORS.products, 'products') +
      card(Object.keys(viewers).length, 'Viewers', nOpens + ' opens', COLORS.watched, 'watched') +
      card(far ? Math.round(far.km).toLocaleString() + '<span style="font-size:16px"> km</span>' : '—', 'Farthest share',
        far ? esc(far.from.city || countryName(far.from.country)) + ' → ' + esc(far.to.city || countryName(far.to.country)) : 'Creator → viewer', null, 'lines');
  }

  function countryTable(agg) {
    var el = S.opts.container.querySelector('.rm-countries');
    var rows = Object.keys(agg.countries).map(function (c) { return agg.countries[c]; })
      .filter(function (c) { return c.cc && (c.accounts || c.popcodes || c.products || c.watched); })
      .sort(function (a, b) { return (b.accounts + b.popcodes + b.products + b.watched) - (a.accounts + a.popcodes + a.products + a.watched); });
    if (!rows.length) { el.innerHTML = '<p class="empty" style="padding:16px">Nothing placed yet.</p>'; return; }
    var shown = S.countryRowsAll ? rows : rows.slice(0, 12);
    el.innerHTML = '<table class="rm-table"><thead><tr><th>Country</th>' +
      '<th title="Accounts"><span class="rm-dot" style="background:' + COLORS.accounts + '"></span></th>' +
      '<th title="Popcodes"><span class="rm-dot" style="background:' + COLORS.popcodes + '"></span></th>' +
      '<th title="Products"><span class="rm-dot" style="background:' + COLORS.products + '"></span></th>' +
      '<th title="Viewers (opens)"><span class="rm-dot" style="background:' + COLORS.watched + '"></span></th></tr></thead><tbody>' +
      shown.map(function (c) {
        return '<tr><td>' + flag(c.cc) + ' ' + esc(countryName(c.cc)) + '</td><td>' + (c.accounts || '') + '</td><td>' + (c.popcodes || '') + '</td><td>' + (c.products || '') + '</td>' +
          '<td>' + (c.watched ? Object.keys(c.visitors).length + ' <span class="muted">(' + c.watched + ')</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>' +
      (rows.length > 12 ? '<button class="btn btn-sm btn-quiet rm-more" type="button">' + (S.countryRowsAll ? 'Show fewer' : 'All ' + rows.length + ' countries') + '</button>' : '');
    var more = el.querySelector('.rm-more');
    if (more) more.onclick = function () { S.countryRowsAll = !S.countryRowsAll; render(); };
  }

  function note() {
    var el = S.opts.container.querySelector('.rm-note');
    var bits = [];
    if (S.pending.length) bits.push('<span class="spinner rm-spin"></span>Placing ' + S.pending.length + ' older location' + (S.pending.length === 1 ? '' : 's') + ' by city name…');
    if (!S.migrated) bits.push('Run <code>supabase/migrations/2026-09-26-event-coordinates.sql</code> so new events carry exact coordinates.');
    if (S.geoFailed) bits.push(S.geoFailed + ' place' + (S.geoFailed === 1 ? '' : 's') + ' couldn\'t be found by name.');
    bits.push('Locations come from IP addresses, so they are the nearest city, not a street.');
    el.innerHTML = bits.join(' ');
  }

  function sliderSync() {
    var c = S.opts.container, sl = c.querySelector('.rm-slider');
    var span = Math.max(1, Math.ceil((S.maxT - S.minT) / DAY));
    sl.max = span;
    sl.value = Math.round((Math.min(S.through, S.maxT) - S.minT) / DAY);
    c.querySelector('.rm-through').textContent = S.through >= S.maxT - DAY ? 'Today' : 'Through ' + fmtDate(S.through);
    c.querySelector('.rm-start').textContent = fmtDate(S.minT);
  }

  function render() {
    if (!S || !S.model) return;
    var agg = aggregate();
    draw(agg); stats(agg); countryTable(agg); note(); sliderSync();
  }
  function rebuild() { if (S && S.map) { buildModel(); render(); } }

  // ── Shell ───────────────────────────────────────────────────────────────
  function shellHtml() {
    function chip(k) {
      return '<button type="button" class="rm-chip active" data-k="' + k + '"><span class="rm-dot" style="background:' + COLORS[k] + '"></span>' + LABELS[k] + '</button>';
    }
    return '<div class="rm-stats cards"></div>' +
      '<div class="rm-toolbar">' +
        '<div class="rm-chips">' + chip('accounts') + chip('popcodes') + chip('products') + chip('watched') +
          '<span class="rm-sep"></span>' +
          '<button type="button" class="rm-chip active" data-k="lines"><span class="rm-line"></span>Share lines</button>' +
          '<button type="button" class="rm-chip active" data-k="shade"><span class="rm-shade"></span>Shade countries</button>' +
        '</div>' +
        '<div class="rm-time">' +
          '<button type="button" class="btn btn-sm btn-quiet rm-play" aria-label="Replay growth">▶ Replay</button>' +
          '<span class="rm-start muted"></span>' +
          '<input type="range" class="rm-slider" min="0" max="1" step="1" aria-label="Show activity through date">' +
          '<b class="rm-through"></b>' +
        '</div>' +
      '</div>' +
      '<div class="rm-body">' +
        '<div class="rm-map-wrap"><div class="rm-map"></div></div>' +
        '<div class="rm-side"><div class="section-title" style="margin-bottom:10px">By country</div><div class="rm-countries table-wrap"></div></div>' +
      '</div>' +
      '<p class="rm-note muted"></p>';
  }

  function wire() {
    var c = S.opts.container;
    c.querySelectorAll('.rm-chip').forEach(function (b) {
      b.onclick = function () {
        var k = b.dataset.k; S.show[k] = !S.show[k];
        b.classList.toggle('active', S.show[k]);
        render();
      };
    });
    var sl = c.querySelector('.rm-slider');
    sl.oninput = function () {
      stop();
      var v = +sl.value;
      S.through = v >= +sl.max ? S.maxT : S.minT + v * DAY + DAY - 1;
      render();
    };
    c.querySelector('.rm-play').onclick = function () {
      if (S.playing) { stop(); return; }
      var span = S.maxT - S.minT, start = performance.now(), dur = Math.min(12000, Math.max(4000, span / DAY * 60));
      this.textContent = '❚❚ Pause';
      var btn = this;
      var last = 0;
      function step(now) {
        var f = Math.min(1, (now - start) / dur);
        if (now - last > 70 || f === 1) { last = now; S.through = S.minT + span * f; render(); }
        if (f < 1 && S.playing) S.playing = requestAnimationFrame(step);
        else { S.playing = null; btn.textContent = '▶ Replay'; }
      }
      S.playing = requestAnimationFrame(step);
    };
  }
  function stop() {
    if (S && S.playing) { cancelAnimationFrame(S.playing); S.playing = null; }
    var b = S && S.opts.container.querySelector('.rm-play');
    if (b) b.textContent = '▶ Replay';
  }

  // Russia and Fiji cross the date line; drawn as-is, their rings jump from
  // +180 to -180 and smear a stripe across the whole map. Keep each ring
  // continuous, then clip to the map: anything past ±180 is simply off-edge.
  function unwrap(geom) {
    if (!geom) return;
    var polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
    polys.forEach(function (poly) {
      poly.forEach(function (ring) {
        for (var i = 1; i < ring.length; i++) {
          var d = ring[i][0] - ring[i - 1][0];
          if (d > 180) ring[i][0] -= 360; else if (d < -180) ring[i][0] += 360;
        }
      });
    });
  }

  function buildMap(world) {
    var L = window.L;
    var el = S.opts.container.querySelector('.rm-map');
    var map = L.map(el, {
      worldCopyJump: true, minZoom: 1, maxZoom: 9, zoomSnap: 0.5,
      attributionControl: true, preferCanvas: true,
    });
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('Natural Earth · place names © OpenStreetMap');
    var fc = window.topojson.feature(world, world.objects.countries);
    fc.features = fc.features.filter(function (f) { return f.id !== '010'; }); // Antarctica
    fc.features.forEach(function (f) {
      f._a2 = NUM_TO_A2[+f.id] || NAME_TO_A2[f.properties.name] || null;
      unwrap(f.geometry);
    });
    S.layers.countries = L.geoJSON(fc, {
      style: { color: '#d8d4ea', weight: 0.7, fillColor: '#ffffff', fillOpacity: 1 },
      onEachFeature: function (f, layer) {
        layer.bindTooltip(function () { return esc(countryName(f._a2) || f.properties.name); }, { sticky: true, className: 'rm-tip' });
      },
    }).addTo(map);
    map.fitBounds([[-50, -150], [72, 165]]);
    S.map = map;
  }

  async function load(opts) {
    var c = opts.container;
    if (currentState && currentState.opts.container === c && currentState.map) {
      // Already built: the tab was hidden, so Leaflet needs to re-measure.
      setTimeout(function () { currentState.map.invalidateSize(); }, 0);
      return;
    }
    c.innerHTML = '<div class="table-wrap"><div class="loading-msg" style="padding:24px"><div class="spinner"></div>Loading the map…</div></div>';
    try {
      var got = await Promise.all([
        loadLibs(), fetchEvents(opts.db),
        allTableRows(opts.db, 'collections', 'id, slug, name, user_id, created_at'),
        Promise.resolve(opts.users),
        allTableRows(opts.db, 'collection_items', 'collection_id, target_index, video_url, audio_url'),
      ]);
      opts.users = got[3] || [];
      S = currentState = createState(opts, got[0], got[1], got[2]);
      S.items = got[4] || [];
      c.innerHTML = shellHtml();
      buildMap(got[0]);
      wire();
      resolvePlaces();
      buildModel();
      S.through = S.maxT;
      render();
      runGeocoder();
    } catch (e) {
      console.error('reach map error:', e);
      currentState = null;
      c.innerHTML = '<div class="table-wrap"><div class="empty" style="padding:20px">Could not load the map: ' + esc(e.message || String(e)) +
        '<br><span style="font-size:11px;color:#aaa">If this names <code>get_reach_events</code>, run <code>supabase/migrations/2026-09-26-event-coordinates.sql</code> in Supabase.</span></div></div>';
    }
  }

  window.PopcodeReachMap = { load: load };
})();
