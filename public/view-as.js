/* Read-only "view as" for admins: see My Projects, My Orders and Account the
   way a customer sees them, to help them with what they're describing.

   Opened from Analytics -> Accounts ("View as") with ?as=<user id>&as_email=…
   A page that supports it calls, once it has the session:

     const va = PopcodeViewAs.init(db, session);
     // va.active: true when an admin is viewing someone else's account
     // va.user:   { id, email, user_metadata } to use in place of session.user

   While active, nothing can be changed: every insert / update / upsert /
   delete, storage upload / remove, write RPC and POST to /api/ is refused here
   (and RLS refuses them too: 2026-10-28-admin-view-as.sql only grants SELECT).
   Links to My Projects / My Orders / Account keep the ?as=, and links into the
   editors, shop and cart are blocked, because those would act as the admin.
   Without ?as=, or for anyone but an admin, init() does nothing. */
(function () {
  if (window.PopcodeViewAs) return;

  var ADMIN_EMAILS = ['curtmid@gmail.com', 'curt@theworkshop.works'];
  var KEEP = ['/manage.html', '/orders.html', '/account.html'];
  var BLOCK = ['/create.html', '/edit.html', '/book.html', '/calendar.html', '/boardbook.html',
    '/order.html', '/cart.html', '/shop.html', '/pricing.html', '/design.html', '/postcard.html'];
  // Reads the pages make through rpc(); anything else is treated as a write.
  var READ_RPCS = ['popcode_quota_as', 'get_view_events_as', 'popcode_quota', 'get_my_view_events'];
  var state = { active: false, user: null };

  function toast(msg) {
    var t = document.getElementById('va-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'va-toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10000;background:#1a1a1a;color:#fff;padding:10px 16px;border-radius:20px;font:500 14px Inter,system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.2);max-width:calc(100% - 32px);text-align:center';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.style.display = 'none'; }, 3200);
  }

  var REFUSED = { data: null, error: { message: 'Read-only view: changes are turned off.' }, count: null };

  // A query builder that accepts any chain (.eq().select().single()…) and
  // resolves to an error, so page code carries on as if the write failed.
  function refused() {
    toast('Read-only view: changes are turned off.');
    var p = new Proxy(function () {}, {
      get: function (_, k) {
        if (k === 'then') return function (res, rej) { return Promise.resolve(REFUSED).then(res, rej); };
        if (k === 'catch' || k === 'finally') return function (f) { return Promise.resolve(REFUSED)[k](f); };
        return function () { return p; };
      },
      apply: function () { return p; },
    });
    return p;
  }

  function guard(db) {
    var from = db.from.bind(db);
    var WRITES = ['insert', 'update', 'upsert', 'delete'];
    db.from = function (table) {
      var q = from(table);
      return new Proxy(q, {
        get: function (t, k) {
          if (WRITES.indexOf(k) >= 0) return function () { return refused(); };
          var v = t[k];
          return typeof v === 'function' ? v.bind(t) : v;
        },
      });
    };
    var rpc = db.rpc.bind(db);
    db.rpc = function (name) {
      return READ_RPCS.indexOf(name) >= 0 ? rpc.apply(null, arguments) : refused();
    };
    var sfrom = db.storage.from.bind(db.storage);
    db.storage.from = function (bucket) {
      var b = sfrom(bucket);
      ['upload', 'update', 'remove', 'move', 'copy'].forEach(function (m) {
        b[m] = function () { toast('Read-only view: changes are turned off.'); return Promise.resolve(REFUSED); };
      });
      return b;
    };
    db.auth.updateUser = function () { toast('Read-only view: changes are turned off.'); return Promise.resolve(REFUSED); };
    var f = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (method !== 'GET' && /^(https?:\/\/[^/]+)?\/api\//.test(url) && new URL(url, location.href).origin === location.origin) {
        toast('Read-only view: changes are turned off.');
        return Promise.resolve(new Response(JSON.stringify({ error: 'Read-only view' }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
      }
      return f(input, init);
    };
  }

  function withAs(href) {
    var u = new URL(href, location.href);
    u.searchParams.set('as', state.user.id);
    if (state.user.email) u.searchParams.set('as_email', state.user.email);
    return u.pathname + u.search + u.hash;
  }

  function links() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var u = new URL(a.getAttribute('href'), location.href);
      if (u.origin !== location.origin) return;
      if (KEEP.indexOf(u.pathname) >= 0) { a.setAttribute('href', withAs(u.href)); return; }
      if (BLOCK.indexOf(u.pathname) >= 0) {
        e.preventDefault(); e.stopPropagation();
        toast('Not available in read-only view.');
      }
    }, true);
  }

  function banner() {
    var b = document.createElement('div');
    b.id = 'va-banner';
    b.style.cssText = 'position:sticky;top:0;z-index:9999;width:100%;box-sizing:border-box;align-self:stretch;background:#5b21b6;color:#fff;padding:9px 16px;font:500 14px Inter,system-ui,sans-serif;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;text-align:center';
    var who = document.createElement('span');
    who.textContent = 'Viewing as ' + (state.user.email || state.user.id) + ' · read only';
    var nav = document.createElement('span');
    nav.style.cssText = 'display:flex;gap:10px';
    [['Projects', '/manage.html'], ['Orders', '/orders.html'], ['Account', '/account.html']].forEach(function (l) {
      var a = document.createElement('a');
      a.href = withAs(l[1]); a.textContent = l[0];
      a.style.cssText = 'color:#fff;text-decoration:underline' + (location.pathname === l[1] ? ';font-weight:700' : '');
      nav.appendChild(a);
    });
    var exit = document.createElement('a');
    exit.href = '/analytics.html'; exit.textContent = 'Exit';
    exit.style.cssText = 'color:#5b21b6;background:#fff;border-radius:14px;padding:3px 12px;text-decoration:none;font-weight:600';
    b.appendChild(who); b.appendChild(nav); b.appendChild(exit);
    document.body.insertBefore(b, document.body.firstChild);
    document.title = '[' + (state.user.email || 'View as') + '] ' + document.title;
  }

  function init(db, session) {
    if (state.active) return state;
    var qs = new URLSearchParams(location.search);
    var id = qs.get('as');
    var email = session && session.user && String(session.user.email || '').toLowerCase();
    if (!id || !/^[0-9a-f-]{36}$/i.test(id) || ADMIN_EMAILS.indexOf(email) < 0 || id === session.user.id) return state;
    state.active = true;
    state.user = { id: id, email: qs.get('as_email') || '', user_metadata: {} };
    guard(db);
    links();
    banner();
    return state;
  }

  window.PopcodeViewAs = { init: init, get active() { return state.active; }, get user() { return state.user; } };
})();
