// Common Tide demo pages. Amount pickers, the demo "thank you", and a note
// showing the tracking tags the visit arrived with, which is the point of
// the demo: the donation platform sees where the gift came from.
(function () {
  // Amount picker: data-amounts="25,50,100" on .amounts, data-impact on each option.
  document.querySelectorAll('[data-picker]').forEach(function (form) {
    var chips = form.querySelectorAll('.amounts button');
    var freq = form.querySelectorAll('.freq button');
    var impact = form.querySelector('.impact');
    var go = form.querySelector('[data-go]');
    var match = form.hasAttribute('data-match');
    function current() {
      var on = form.querySelector('.amounts button[aria-pressed="true"]');
      return on ? Number(on.getAttribute('data-v')) : 0;
    }
    function monthly() {
      var on = form.querySelector('.freq button[aria-pressed="true"]');
      return on ? on.getAttribute('data-f') === 'monthly' : form.hasAttribute('data-monthly');
    }
    function render() {
      var v = current(), m = monthly(), on = form.querySelector('.amounts button[aria-pressed="true"]');
      if (impact && on) impact.innerHTML = on.getAttribute('data-impact') || '';
      if (go) go.textContent = 'Give $' + v + (m ? ' a month' : '') + (match && !m ? ', matched to $' + v * 2 : '');
    }
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        chips.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        c.setAttribute('aria-pressed', 'true');
        render();
      });
    });
    freq.forEach(function (f) {
      f.addEventListener('click', function () {
        freq.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        f.setAttribute('aria-pressed', 'true');
        render();
      });
    });
    if (go) go.addEventListener('click', function (e) {
      e.preventDefault();
      var t = form.querySelector('[data-thanks-amount]');
      if (t) t.textContent = '$' + current() + (monthly() ? ' a month' : '');
      form.classList.add('done');
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    render();
  });

  // Show the tags this visit arrived with (utm_*), so a demo makes the
  // tracking visible. Nothing is stored or sent.
  var q = new URLSearchParams(location.search), out = [];
  ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { if (q.get(k)) out.push(k.replace('utm_', '') + ' <b>' + q.get(k).replace(/[<>&"]/g, '') + '</b>'); });
  var el = document.getElementById('tags');
  if (el && out.length) { el.innerHTML = 'This visit is tagged: ' + out.join(' · '); el.hidden = false; }
})();
