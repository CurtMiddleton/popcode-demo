/* Popcode dialogs — the designed replacement for the browser's alert(),
 * confirm() and prompt() boxes.
 *
 *   popcodeDialog({ title, message, confirmText, cancelText, danger, value })
 *     → Promise: true / false for a choice, or resolves when dismissed.
 *   popcodeConfirm(message, { title, confirmText, cancelText, danger }) → Promise<boolean>
 *   popcodeCopyLink(url, title)  — shows the link with a Copy button (the
 *     clipboard-failed fallback that used to be prompt()).
 *
 * Loading this file also replaces window.alert, so every existing alert(...)
 * on the page renders designed. The replacement doesn't block the way the
 * browser's did, which is fine for the usual `alert(...); return;` — but code
 * that navigates straight after an alert must wait:
 *   popcodeDialog({ message }).then(() => location.href = ...)
 *
 * A message with a blank line in it ("Title.\n\nMore detail") shows the first
 * part as the title.
 */
(function () {
  'use strict';
  if (window.popcodeDialog) return;

  var css = '' +
    '.pcd-overlay{position:fixed;inset:0;z-index:10000;background:rgba(20,16,32,.45);display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;transition:opacity .15s ease}' +
    '.pcd-overlay.on{opacity:1}' +
    '.pcd-box{background:#fff;border-radius:24px;width:100%;max-width:400px;padding:28px 26px 22px;box-shadow:0 24px 60px rgba(0,0,0,.22);transform:translateY(8px) scale(.98);transition:transform .15s ease;font-family:Inter,system-ui,sans-serif;color:#1a1a1a;text-align:center}' +
    '.pcd-overlay.on .pcd-box{transform:none}' +
    '.pcd-title{font-family:CooperBT,Georgia,serif;font-weight:400;font-size:24px;line-height:1.2;letter-spacing:-.01em;margin:0 0 10px}' +
    '.pcd-msg{font-size:15px;line-height:1.55;color:#555;margin:0;white-space:pre-line}' +
    '.pcd-title+.pcd-msg{margin-top:0}' +
    '.pcd-field{margin-top:16px;width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #e3e3e3;border-radius:12px;font:16px Inter,system-ui,sans-serif;color:#1a1a1a;background:#f9f9f9;text-align:left}' +
    '.pcd-actions{display:flex;flex-direction:column;gap:8px;margin-top:22px}' +
    '.pcd-btn{padding:14px;border-radius:999px;border:none;background:#1a1a1a;color:#fff;font:700 15px Inter,system-ui,sans-serif;cursor:pointer}' +
    '.pcd-btn:hover{opacity:.9}' +
    '.pcd-btn.danger{background:#c92a2a}' +
    '.pcd-btn.ghost{background:transparent;color:#777;font-weight:600;font-size:14px;padding:10px}' +
    '.pcd-btn.ghost:hover{color:#1a1a1a;opacity:1}';
  function injectCss() {
    if (document.getElementById('pcd-css')) return;
    var s = document.createElement('style'); s.id = 'pcd-css'; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  var queue = Promise.resolve();   // one dialog at a time, in order

  function popcodeDialog(opts) {
    opts = opts || {};
    var run = function () { return new Promise(function (resolve) { open(opts, resolve); }); };
    var p = queue.then(run, run);
    queue = p.catch(function () {});
    return p;
  }

  function open(opts, resolve) {
    injectCss();
    var title = opts.title, message = opts.message == null ? '' : String(opts.message);
    // "Headline.\n\nDetail" → headline as the title.
    if (!title && message.indexOf('\n\n') > 0) {
      var i = message.indexOf('\n\n');
      title = message.slice(0, i); message = message.slice(i + 2);
    }
    var isChoice = !!opts.cancelText;

    var ov = document.createElement('div');
    ov.className = 'pcd-overlay';
    ov.setAttribute('role', isChoice ? 'alertdialog' : 'dialog');
    ov.setAttribute('aria-modal', 'true');
    var box = document.createElement('div'); box.className = 'pcd-box'; ov.appendChild(box);
    if (title) { var h = document.createElement('h3'); h.className = 'pcd-title'; h.textContent = title; box.appendChild(h); }
    if (message) { var m = document.createElement('p'); m.className = 'pcd-msg'; m.textContent = message; box.appendChild(m); }
    var field = null;
    if (opts.value != null) {
      field = document.createElement('input');
      field.className = 'pcd-field'; field.readOnly = true; field.value = opts.value;
      field.addEventListener('focus', function () { field.select(); });
      box.appendChild(field);
    }
    var actions = document.createElement('div'); actions.className = 'pcd-actions'; box.appendChild(actions);
    var ok = document.createElement('button');
    ok.type = 'button'; ok.className = 'pcd-btn' + (opts.danger ? ' danger' : '');
    ok.textContent = opts.confirmText || 'OK';
    actions.appendChild(ok);
    var cancel = null;
    if (isChoice) {
      cancel = document.createElement('button');
      cancel.type = 'button'; cancel.className = 'pcd-btn ghost'; cancel.textContent = opts.cancelText;
      actions.appendChild(cancel);
    }

    var prevFocus = document.activeElement;
    function close(result) {
      document.removeEventListener('keydown', onKey, true);
      ov.classList.remove('on');
      setTimeout(function () { ov.remove(); }, 150);
      try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) {}
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(isChoice ? false : true); }
      else if (e.key === 'Enter' && document.activeElement !== cancel) { e.preventDefault(); ok.click(); }
      else if (e.key === 'Tab') {   // keep focus inside the dialog
        var f = [field, ok, cancel].filter(Boolean), idx = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(idx + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
      }
    }
    ok.addEventListener('click', function () {
      if (opts.onConfirm && opts.onConfirm(ok) === false) return;   // e.g. Copy stays open
      close(true);
    });
    if (cancel) cancel.addEventListener('click', function () { close(false); });
    ov.addEventListener('click', function (e) { if (e.target === ov) close(isChoice ? false : true); });
    document.addEventListener('keydown', onKey, true);

    (document.body || document.documentElement).appendChild(ov);
    // Force a style flush, then fade in. Not requestAnimationFrame: a hidden or
    // background tab never runs it, which left the dialog stuck invisible.
    void ov.offsetWidth;
    ov.classList.add('on');
    (field || ok).focus();
  }

  function popcodeConfirm(message, o) {
    o = o || {};
    return popcodeDialog({ title: o.title, message: message, confirmText: o.confirmText || 'OK',
                           cancelText: o.cancelText || 'Cancel', danger: !!o.danger });
  }

  function popcodeCopyLink(url, title) {
    return popcodeDialog({
      title: title || 'Copy this link', value: url, confirmText: 'Copy', cancelText: 'Done',
      onConfirm: function (btn) {
        var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1500); };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () {});
          else { var f = btn.parentNode.parentNode.querySelector('.pcd-field'); f.select(); document.execCommand('copy'); done(); }
        } catch (e) {}
        return false;   // stay open; Done closes
      },
    });
  }

  window.popcodeDialog = popcodeDialog;
  window.popcodeConfirm = popcodeConfirm;
  window.popcodeCopyLink = popcodeCopyLink;
  // Every alert(...) on the page, designed. Kept as the original for debugging.
  window.__nativeAlert = window.alert;
  window.alert = function (msg) { popcodeDialog({ message: msg }); };
})();
