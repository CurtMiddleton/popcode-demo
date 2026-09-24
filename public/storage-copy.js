/* Re-home a design's stored assets into its own slug folder.
 *
 * Duplicating a book / calendar / board book copies the DB row but leaves every
 * photo, video and audio URL pointing at the ORIGINAL's `{slug}/` folder in the
 * `experiences` bucket. That is fine until someone deletes the original —
 * manage.html's delete removes the whole `{slug}/` folder, which silently guts
 * every copy ever made from it.
 *
 * So at save time each asset URL is checked: if the object lives somewhere other
 * than this design's own folder, it is copied there — SERVER SIDE, via Supabase
 * Storage's copy API, so nothing is downloaded or re-uploaded through the
 * browser (videos are up to 200 MB) — and the new URL is stored instead.
 *
 * It is self-gating. In an ordinary edit or a brand-new design every path is
 * already under the design's own slug, so `remap` returns the URL untouched and
 * makes no network call. It is also self-healing: re-saving a copy made before
 * this existed moves its assets across then.
 *
 * Failure is never fatal. If a copy fails the original URL is kept, which is
 * exactly how duplicates behaved before — a save must not be lost over this.
 */
(function () {
  'use strict';

  var MARKER = '/storage/v1/object/public/';

  /* The object path inside `bucket` for a Supabase public URL, or null when the
     URL isn't one of ours (a blob:, an Unsplash sample, another bucket). */
  function pathInBucket(bucket, url) {
    if (typeof url !== 'string' || !url) return null;
    var prefix = MARKER + bucket + '/';
    var i = url.indexOf(prefix);
    if (i < 0) return null;
    var rest = url.slice(i + prefix.length);
    var q = rest.search(/[?#]/);
    var path = q < 0 ? rest : rest.slice(0, q);
    if (!path) return null;
    try { path = decodeURIComponent(path); } catch (e) { /* keep it as-is */ }
    return path;
  }

  /* Everything after the leading folder: `{old}/book/cover.jpg` -> `book/cover.jpg`,
     so it lands at the same relative place under the new slug. */
  function tailOf(path) {
    var i = path.indexOf('/');
    return i < 0 ? path : path.slice(i + 1);
  }

  function alreadyHome(path, toSlug) {
    return path === toSlug || path.indexOf(toSlug + '/') === 0;
  }

  /* A remapper bound to one destination design.
     remap(url) -> Promise<url>, memoised so a photo used twice copies once. */
  function makeRemapper(db, bucket, toSlug, opts) {
    var onError = (opts && opts.onError) || function () {};
    var store = db.storage.from(bucket);
    var cache = Object.create(null);
    var copied = 0;

    function publicUrl(path) {
      return store.getPublicUrl(path).data.publicUrl;
    }

    function remap(url) {
      if (!url) return Promise.resolve(url);
      if (cache[url]) return cache[url];

      var path = pathInBucket(bucket, url);
      // Not ours, or already in this design's folder — leave it alone. This is
      // the ordinary-edit path, and it costs nothing.
      if (!path || alreadyHome(path, toSlug)) {
        cache[url] = Promise.resolve(url);
        return cache[url];
      }

      var dest = toSlug + '/' + tailOf(path);
      // Start the chain INSIDE a promise: a client that throws synchronously
      // (bad state, an SDK change) must still become a rejection we can swallow,
      // or it escapes remap() and takes the whole save down with it.
      cache[url] = Promise.resolve().then(function () {
        return store.copy(path, dest);
      }).then(function (res) {
        if (res && res.error) {
          // A destination that already exists is a half-finished save being
          // retried, and is the object we wanted anyway.
          var status = String((res.error.statusCode != null ? res.error.statusCode : res.error.status) || '');
          if (status === '409' || /exist|duplicate/i.test(String(res.error.message || ''))) return publicUrl(dest);
          throw res.error;
        }
        copied++;
        return publicUrl(dest);
      }).catch(function (err) {
        // Keep the shared file rather than losing the save.
        try { onError(err, { from: path, to: dest }); } catch (e) { /* never throw from the reporter */ }
        return url;
      });
      return cache[url];
    }

    remap.copiedCount = function () { return copied; };
    return remap;
  }

  window.PopcodeStorageCopy = {
    makeRemapper: makeRemapper,
    pathInBucket: pathInBucket,
  };
})();
