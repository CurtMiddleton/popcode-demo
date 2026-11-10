/**
 * Popcode outreach sender, GALLERY COPY — for the "Popcode gallery outreach list" sheet.
 * Same as scripts/outreach-sender.gs except: it only watches gallery replies (subject
 * "an audio tour for your next show"), no form/site alerts (the nonprofit copy sends those),
 * 35/day, no extra signature (the gallery emails carry their own), one digest at 16:45,
 * and an "Email template" row for the gallery email.
 *
 * Sends the emails on the "Send list" tab one at a time from YOUR Gmail
 * (whoever authorizes the script, so authorize as curt@popcodeapp.com),
 * spaced out, on weekdays, inside sending hours, up to a daily cap.
 * Plain text, so links stay clean. Ticks "Sent" and records the time.
 *
 * Optional follow-ups: one reply in the same thread, only to people who
 * haven't replied, N days after the first email. OFF until you turn it on in
 * the "Sender settings" tab (and add the Gmail API service — see SETUP).
 *
 * SETUP (once, about 5 minutes)
 *  1. Open the tracker signed in as curt@popcodeapp.com.
 *  2. Extensions → Apps Script. Delete what's there, paste this whole file, click Save.
 *  3. Left sidebar: Services (+) → "Gmail API" → Add.   (needed for follow-ups only)
 *  4. In the function menu at the top choose `setup`, click Run, then Allow
 *     on Google's permission screens ("Advanced" → "Go to … (unsafe)" is normal
 *     for your own script).
 *  That's it. It now sends one email every 5 minutes while Status is RUN.
 *
 * ALERTS + DIGESTS: every 5 minutes (any day, even while PAUSEd) it also looks
 * for replies, bounces, auto-replies and Get started form submissions. A real
 * reply or a form submission is emailed to "Alerts to" within ~5 minutes; the
 * Send list Status column is updated (Replied / Bounced / Auto-reply); and a
 * summary goes out at each "Digest times" slot on weekdays.
 *
 * STOP / START: type PAUSE or RUN in the Status cell on "Sender settings".
 * REMOVE COMPLETELY: run `uninstall` from the Apps Script editor.
 */

var SEND_TAB = 'Send list';
var SETTINGS_TAB = 'Sender settings';
var TZ = 'America/New_York';

// Send list columns (1-based). A–H already exist; I–L are added by setup().
var COL = { NUM: 1, SEND_ON: 2, ORG: 3, TO: 4, SUBJECT: 5, BODY: 6, SENT: 7, NOTES: 8,
            SENT_AT: 9, THREAD: 10, FOLLOWUP_AT: 11, STATUS: 12 };

var DEFAULTS = [
  ['Status', 'RUN', 'RUN to send, PAUSE to stop. Checked before every email.'],
  ['Max new emails per day', 35, 'Combined with the nonprofit sender, keep the total around 85 a day. Raise to 50 once nonprofit batches end.'],
  ['Start time (ET, 24h)', '9:30', ''],
  ['Stop time (ET, 24h)', '16:00', ''],
  ['Weekdays only', true, ''],
  ['Your name (From)', 'Curt Middleton', ''],
  ['Signature', '', 'Blank: the gallery emails already end with your name, postal address and opt-out line.'],
  ['Follow-ups', 'OFF', 'ON to send one follow-up in the same thread to people who have not replied.'],
  ['Follow-up after (days)', 4, ''],
  ['Follow-up text',
   'Hi {first},\n\nJust floating this back up in case it got buried. If a Giving Tuesday thank-you card would help, there\'s still time: send us one phone video and it\'s ready to print five business days later.\n\nYou can see how it works, and get started without a call, here: https://popcode.app/givingtuesday\n\nThanks,\nCurt',
   '{first} becomes their first name. Plain text; links stay clean.'],
  ['Alerts to', 'curt@theworkshop.works', 'Reply/form alerts and digests go here. Blank = off.'],
  ['Reply alerts', 'ON', 'ON = email me within ~5 minutes of a real reply or a Get started form.'],
  ['Digest times (ET, 24h)', '16:45', 'Weekday summaries. Blank = no digests.'],
  ['Email template',
   'Hi {first},\n\n{opener}\n\nIt\'s called Popcode. Pointing a phone at a printed photo instantly plays its video or audio, and customers already use it for photo albums and nonprofit annual reports. Now I\'ve adapted it for {forwhom}: visitors tap a small card at your entrance, point their phone at any work, and hear {who}. There\'s no app and no QR code beside the work. After each stop they can {cta}, and you can see which works people listened to all the way through.\n\nBring your own recordings or notes, or we\'ll write and record the stops for you. We test the tour in the room before the opening, and if it isn\'t working by then, you don\'t pay.\n\n{visit} Or try a demo show first:\nhttps://popcode.app/exhibitions/{link}\n\nBest regards,\n\nCurt Middleton\nFounder, Popcode\n709 Main St, New Rochelle, NY 10801\n\nIf this isn\'t for you, reply "no thanks" and I won\'t write again.',
   'Used by Send list column F via a formula over columns M–S. Edit here to change every row.']
];

// ── One-time setup ──────────────────────────────────────────────────────────
function setup() {
  var ss = SpreadsheetApp.getActive();
  var list = ss.getSheetByName(SEND_TAB);
  if (!list) throw new Error('No "' + SEND_TAB + '" tab found.');
  list.getRange(1, COL.SENT_AT, 1, 4).setValues([['Sent at (ET)', 'Thread', 'Follow-up sent', 'Status']]).setFontWeight('bold');

  var st = ss.getSheetByName(SETTINGS_TAB) || ss.insertSheet(SETTINGS_TAB);
  if (st.getLastRow() === 0) {
    st.getRange(1, 1, DEFAULTS.length, 3).setValues(DEFAULTS);
    st.getRange(1, 1, DEFAULTS.length, 1).setFontWeight('bold');
    st.setColumnWidth(1, 220); st.setColumnWidth(2, 460); st.setColumnWidth(3, 420);
    st.getRange(1, 2, DEFAULTS.length, 1).setWrap(true).setVerticalAlignment('top');
  }

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'tick') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(5).create();
  SpreadsheetApp.getActive().toast('Sender installed. It checks every 5 minutes.', 'Popcode', 8);
}

function uninstall() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
}

// ── Runs every 5 minutes: sends at most ONE email (a due follow-up first, else the next new one) ──
function tick() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    ensureSettings_();
    var s = readSettings_();
    var list = SpreadsheetApp.getActive().getSheetByName(SEND_TAB);
    var last = list.getLastRow();
    if (last < 2) return;
    var rows = list.getRange(2, 1, last - 1, COL.STATUS).getValues();

    try { watchInbox_(list, rows, s); } catch (e) { console.error('watchInbox_: ' + e); }
    try { maybeDigest_(s); } catch (e) { console.error('maybeDigest_: ' + e); }

    if (String(s['Status']).trim().toUpperCase() !== 'RUN') return;
    if (!inSendingWindow_(s)) return;
    if (MailApp.getRemainingDailyQuota() < 5) return;
    rows = list.getRange(2, 1, last - 1, COL.STATUS).getValues();   // statuses may have changed

    if (String(s['Follow-ups']).trim().toUpperCase() === 'ON' && sendOneFollowUp_(list, rows, s)) return;
    sendOneNew_(list, rows, s);
  } finally {
    lock.releaseLock();
  }
}

function sendOneNew_(list, rows, s) {
  var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var sentToday = rows.filter(function (r) {
    return r[COL.SENT_AT - 1] && Utilities.formatDate(new Date(r[COL.SENT_AT - 1]), TZ, 'yyyy-MM-dd') === today;
  }).length;
  if (sentToday >= Number(s['Max new emails per day'] || 50)) return false;

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var to = String(r[COL.TO - 1] || '').trim();
    if (!to || r[COL.SENT - 1] === true || r[COL.STATUS - 1]) continue;
    if (!dueToday_(r[COL.SEND_ON - 1])) continue;
    var rowNum = i + 2;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { list.getRange(rowNum, COL.STATUS).setValue('Skipped: bad address'); continue; }
    try {
      var body = String(r[COL.BODY - 1]).replace(/\s+$/, '') + (s['Signature'] ? '\n\n' + s['Signature'] : '');
      var msg = GmailApp.createDraft(to, String(r[COL.SUBJECT - 1]), body, { name: s['Your name (From)'] }).send();
      list.getRange(rowNum, COL.SENT).setValue(true);
      list.getRange(rowNum, COL.SENT_AT).setValue(new Date()).setNumberFormat('yyyy-mm-dd hh:mm');
      list.getRange(rowNum, COL.THREAD).setValue(msg.getThread().getId());
      list.getRange(rowNum, COL.STATUS).setValue('Sent');
    } catch (e) {
      list.getRange(rowNum, COL.STATUS).setValue('Error: ' + String(e.message || e).slice(0, 120));
    }
    return true;   // one email per run, success or not
  }
  return false;
}

function sendOneFollowUp_(list, rows, s) {
  var me = Session.getEffectiveUser().getEmail().toLowerCase();
  var waitMs = Number(s['Follow-up after (days)'] || 4) * 864e5;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i], rowNum = i + 2;
    if (r[COL.SENT - 1] !== true || !r[COL.THREAD - 1] || r[COL.FOLLOWUP_AT - 1]) continue;
    var status = String(r[COL.STATUS - 1] || '');
    if (/Replied|Bounced|No follow-up/.test(status)) continue;
    if (!r[COL.SENT_AT - 1] || Date.now() - new Date(r[COL.SENT_AT - 1]).getTime() < waitMs) continue;

    var thread;
    try { thread = GmailApp.getThreadById(String(r[COL.THREAD - 1])); } catch (e) { thread = null; }
    if (!thread) { list.getRange(rowNum, COL.STATUS).setValue('No follow-up: thread not found'); continue; }

    // Anyone other than me in the thread = a reply (or a bounce / auto-reply). Never follow up then.
    var msgs = thread.getMessages(), other = null;
    msgs.forEach(function (m) { if (m.getFrom().toLowerCase().indexOf(me) === -1) other = m; });
    if (other) {
      var bounced = /mailer-daemon|postmaster/i.test(other.getFrom());
      list.getRange(rowNum, COL.STATUS).setValue(bounced ? 'Bounced' : 'Replied (check inbox)');
      continue;
    }

    var first = (String(r[COL.BODY - 1]).match(/^Hi ([^,\n]+),/) || [, 'there'])[1];
    var text = String(s['Follow-up text']).replace(/\{first\}/g, first) + (s['Signature'] ? '\n\n' + s['Signature'] : '');
    var orig = msgs[0];
    try {
      sendReplyInThread_(thread.getId(), String(r[COL.TO - 1]).trim(), orig.getSubject(), orig.getHeader('Message-ID'), text, s['Your name (From)'], me);
      list.getRange(rowNum, COL.FOLLOWUP_AT).setValue(new Date()).setNumberFormat('yyyy-mm-dd hh:mm');
      list.getRange(rowNum, COL.STATUS).setValue('Followed up');
    } catch (e) {
      list.getRange(rowNum, COL.STATUS).setValue('Follow-up error: ' + String(e.message || e).slice(0, 100));
    }
    return true;
  }
  return false;
}

// A real reply in the same thread (In-Reply-To/References), via the Gmail API advanced service.
function sendReplyInThread_(threadId, to, subject, messageId, text, fromName, fromEmail) {
  var subj = /^re:/i.test(subject) ? subject : 'Re: ' + subject;
  var raw = [
    'From: ' + encodeHeader_(fromName) + ' <' + fromEmail + '>',
    'To: ' + to,
    'Subject: ' + encodeHeader_(subj),
    messageId ? 'In-Reply-To: ' + messageId : '',
    messageId ? 'References: ' + messageId : '',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Utilities.base64Encode(text, Utilities.Charset.UTF_8)
  ].filter(function (l, i) { return l !== '' || i === 8; }).join('\r\n');
  Gmail.Users.Messages.send({ raw: Utilities.base64EncodeWebSafe(raw, Utilities.Charset.UTF_8), threadId: threadId }, 'me');
}

function encodeHeader_(v) {
  return /^[\x20-\x7e]*$/.test(v) ? v : '=?UTF-8?B?' + Utilities.base64Encode(v, Utilities.Charset.UTF_8) + '?=';
}


// ── Replies, bounces, form submissions → tracker Status, alerts, event log ───
var WATCH = [
  { kind: 'mail', q: 'subject:("audio tour for your next show") -from:me newer_than:2d' },
  { kind: 'mail', q: 'from:(mailer-daemon OR postmaster) "audio tour for your next show" newer_than:2d' }
];

function watchInbox_(list, rows, s) {
  var props = PropertiesService.getScriptProperties();
  var seen = JSON.parse(props.getProperty('seen') || '{}');
  var events = JSON.parse(props.getProperty('events') || '[]');
  var me = Session.getEffectiveUser().getEmail().toLowerCase();
  var alertsOn = String(s['Reply alerts']).trim().toUpperCase() === 'ON' && String(s['Alerts to'] || '').indexOf('@') > 0;
  var cutoff = Date.now() - 2 * 864e5;

  var threadRow = {}, addrRow = {};
  rows.forEach(function (r, i) {
    if (r[COL.THREAD - 1]) threadRow[String(r[COL.THREAD - 1])] = i;
    if (r[COL.TO - 1]) addrRow[String(r[COL.TO - 1]).trim().toLowerCase()] = i;
  });

  var changed = false;
  WATCH.forEach(function (w) {
    GmailApp.search(w.q, 0, 50).forEach(function (thread) {
      thread.getMessages().forEach(function (m) {
        var id = m.getId();
        if (seen[id] || m.getDate().getTime() < cutoff) return;
        seen[id] = Date.now(); changed = true;
        var from = m.getFrom(), fromAddr = (from.match(/<([^>]+)>/) || [, from])[1].trim().toLowerCase();
        if (w.kind === 'mail' && fromAddr === me) return;
        var subj = m.getSubject() || '';
        var type = w.kind === 'form' ? (/TEST/.test(subj) ? null : 'form')
                 : w.kind === 'site' ? (/^Lead:/.test(subj) ? 'demo click' : 'link opened')
                 : classify_(m, from, subj);
        if (!type) return;

        // Which Send list row?  Same thread, same sender, or (bounces) the address quoted in the bounce.
        var idx = threadRow[thread.getId()];
        if (idx === undefined) idx = addrRow[fromAddr];
        if (idx === undefined && type === 'bounce') {
          var body = m.getPlainBody().toLowerCase();
          Object.keys(addrRow).some(function (a) { if (body.indexOf(a) !== -1) { idx = addrRow[a]; return true; } return false; });
        }
        var org = idx !== undefined ? String(rows[idx][COL.ORG - 1]) : (w.kind === 'form' ? subj.replace(/^(Ready to start|Question):\s*/, '') : from.replace(/<.*>/, '').replace(/"/g, '').trim());

        if (idx !== undefined && (type === 'reply' || type === 'bounce' || type === 'auto')) {
          var cur = String(rows[idx][COL.STATUS - 1] || '');
          var next = type === 'reply' ? 'Replied (check inbox)' : type === 'bounce' ? 'Bounced' : 'Auto-reply';
          if (!/Replied|Bounced/.test(cur) && cur !== next) {
            list.getRange(idx + 2, COL.STATUS).setValue(next);
            rows[idx][COL.STATUS - 1] = next;
          }
        }

        var site = type === 'link opened' || type === 'demo click';
        events.push({ t: type, at: m.getDate().getTime(), org: String(org).slice(0, 50),
                      who: site ? '' : fromAddr.slice(0, 50),
                      snip: site ? subj.replace(/^(Outreach link opened|Lead):\s*/, '').slice(0, 60) : replyText_(m).replace(/\s+/g, ' ').slice(0, 110) });

        // Alert only for fresh messages: the first run after installing sees 2 days of mail and must not replay it.
        if (alertsOn && (type === 'reply' || type === 'form') && m.getDate().getTime() > Date.now() - 2 * 36e5) {
          var link = 'https://mail.google.com/mail/?authuser=' + me + '#all/' + thread.getId();
          MailApp.sendEmail({
            to: s['Alerts to'], name: 'Popcode outreach',
            subject: (type === 'form' ? 'Get started form: ' : 'Gallery reply from ') + org,
            body: (type === 'form' ? 'Someone filled in the Get started form on popcode.app/givingtuesday.\n\n' : 'A gallery replied to your outreach.\n\n') +
                  'From: ' + from + '\nSubject: ' + subj + '\n\n' + replyText_(m).slice(0, 1500) +
                  '\n\nOpen in Gmail (curt@popcodeapp.com): ' + link
          });
        }
      });
    });
  });

  if (changed) {
    Object.keys(seen).forEach(function (k) { if (seen[k] < Date.now() - 5 * 864e5) delete seen[k]; });
    props.setProperty('seen', JSON.stringify(seen));
    // Script properties hold at most ~9 KB per value: keep the newest events that fit.
    var keep = events.slice(-40), json = JSON.stringify(keep);
    while (json.length > 8500 && keep.length) { keep.shift(); json = JSON.stringify(keep); }
    props.setProperty('events', json);
  }
}

function classify_(m, from, subj) {
  if (/mailer-daemon|postmaster/i.test(from) || /undeliverable|delivery status notification|returned mail|failure notice|delivery has failed|could not be delivered/i.test(subj)) return 'bounce';
  var auto = String(m.getHeader('Auto-Submitted') || '').toLowerCase();
  if ((auto && auto !== 'no') || m.getHeader('X-Autoreply') || m.getHeader('X-Autorespond') ||
      /automatic reply|auto[- ]?reply|autoreply|out of (the )?office|away from (the )?office|thank you for (contacting|your (message|email|inquiry))/i.test(subj)) return 'auto';
  var head = replyText_(m).slice(0, 500);
  if (/out of (the )?office|no longer with|thank you for contacting|your (inquiry|message) (has been|will be) (received|forwarded)|auto(mated|matic)? (reply|response)|limited access to email|will (respond|reply|return your email) (as soon as|when i return|upon my return)/i.test(head)) return 'auto';
  return 'reply';
}

// The new text of a reply, without the quoted original underneath.
function replyText_(m) {
  var t = String(m.getPlainBody() || '').replace(/\r/g, '');
  t = t.split(/\nOn [^\n]{5,200}wrote:|\n-{2,} ?Original Message|\nFrom: [^\n]+\nSent: |\n>/)[0];
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

// ── Digests at the "Digest times" slots, weekdays ────────────────────────────
function maybeDigest_(s) {
  var slots = String(s['Digest times (ET, 24h)'] || '').split(/[,;]/).map(function (x) { return toMins_(x.trim(), -1); })
    .filter(function (x) { return x >= 0; }).sort(function (a, b) { return a - b; });
  if (!slots.length || String(s['Alerts to'] || '').indexOf('@') < 1) return;
  var now = new Date();
  if (Number(Utilities.formatDate(now, TZ, 'u')) > 5) return;
  var mins = Number(Utilities.formatDate(now, TZ, 'H')) * 60 + Number(Utilities.formatDate(now, TZ, 'm'));
  var ymd = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  var props = PropertiesService.getScriptProperties();
  for (var i = 0; i < slots.length; i++) {
    if (mins < slots[i] || mins >= slots[i] + 60) continue;
    var key = 'digest_' + ymd + '_' + slots[i];
    if (props.getProperty(key)) return;
    props.setProperty(key, '1');
    var label = i === 0 ? 'Morning' : i === slots.length - 1 ? 'End of day' : 'Midday';
    sendDigest_(s, label, Number(props.getProperty('lastDigestAt') || (Date.now() - 864e5)), i === 0);
    props.setProperty('lastDigestAt', String(Date.now()));
    return;
  }
}

function sendDigest_(s, label, since, isMorning) {
  var props = PropertiesService.getScriptProperties();
  var events = JSON.parse(props.getProperty('events') || '[]').filter(function (e) { return e.at > since; });
  var list = SpreadsheetApp.getActive().getSheetByName(SEND_TAB);
  var rows = list.getLastRow() > 1 ? list.getRange(2, 1, list.getLastRow() - 1, COL.STATUS).getValues() : [];
  var ymd = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var sentToday = 0, dueLeft = 0, sentAll = 0, total = 0, replies = 0, bounces = 0;
  rows.forEach(function (r) {
    if (!r[COL.TO - 1]) return;
    total++;
    var st = String(r[COL.STATUS - 1] || '');
    if (r[COL.SENT - 1] === true) {
      sentAll++;
      if (r[COL.SENT_AT - 1] && Utilities.formatDate(new Date(r[COL.SENT_AT - 1]), TZ, 'yyyy-MM-dd') === ymd) sentToday++;
    } else if (!st && dueToday_(r[COL.SEND_ON - 1])) dueLeft++;
    if (/Replied/.test(st)) replies++;
    if (/Bounced/.test(st)) bounces++;
  });
  var cap = Number(s['Max new emails per day'] || 50);
  dueLeft = Math.min(dueLeft, Math.max(0, cap - sentToday));
  var running = String(s['Status']).trim().toUpperCase() === 'RUN';
  var when = Utilities.formatDate(new Date(since), TZ, 'EEE h:mm a');

  function block(title, arr, fmt) { return arr.length ? '\n' + title + ' (' + arr.length + ')\n' + arr.map(fmt).join('\n') + '\n' : ''; }
  var by = function (t) { return events.filter(function (e) { return e.t === t; }); };
  var oneLine = function (x) { return String(x || '').replace(/\s+/g, ' ').slice(0, 160); };

  var out = [];
  out.push('Popcode outreach: ' + label.toLowerCase() + ' summary, ' + Utilities.formatDate(new Date(), TZ, 'EEE MMM d') + '\n');
  var news = by('reply').length + by('form').length;
  out.push(news ? 'Since ' + when + ': ' + by('reply').length + ' repl' + (by('reply').length === 1 ? 'y' : 'ies') + ', ' + by('form').length + ' Get started form' + (by('form').length === 1 ? '' : 's') + '.'
                : 'No replies or form submissions since ' + when + '.');
  out.push(block('Replies', by('reply'), function (e) { return '• ' + e.org + ' (' + e.who + '): "' + oneLine(e.snip) + '…"'; }));
  out.push(block('Get started forms', by('form'), function (e) { return '• ' + e.org; }));
  out.push(block('Auto-replies (no action unless a new contact is named)', by('auto'), function (e) { return '• ' + e.org + ': ' + oneLine(e.snip); }));
  out.push(block('Bounces (bad address)', by('bounce'), function (e) { return '• ' + e.org; }));
  var opened = by('link opened'), clicks = by('demo click');
  if (opened.length || clicks.length) out.push('\nWebsite: ' + opened.length + ' outreach link' + (opened.length === 1 ? '' : 's') + ' opened' +
    (opened.length ? ' (' + opened.map(function (e) { return e.snip; }).join('; ') + ')' : '') +
    (clicks.length ? ', ' + clicks.length + ' Book-a-demo click' + (clicks.length === 1 ? '' : 's') : '') + '.\n');

  out.push('\nSending: ' + (running ? 'RUNNING' : 'PAUSED') + '. Sent today: ' + sentToday + '. Still due today: ' + dueLeft + '.');
  if (isMorning && running && dueLeft) {
    var start = Math.max(toMins_(s['Start time (ET, 24h)'], 570), Number(Utilities.formatDate(new Date(), TZ, 'H')) * 60 + Number(Utilities.formatDate(new Date(), TZ, 'm')));
    var end = start + dueLeft * 5;
    out.push('Today\'s plan: ' + dueLeft + ' emails, one every 5 minutes, done about ' + Math.floor(end / 60 > 12 ? end / 60 - 12 : end / 60) + ':' + ('0' + end % 60).slice(-2) + (end >= 720 ? ' PM' : ' AM') + '.');
  }
  out.push('Send list so far: ' + sentAll + ' of ' + total + ' sent, ' + replies + ' replied, ' + bounces + ' bounced.');
  out.push('\nTracker: ' + SpreadsheetApp.getActive().getUrl());

  MailApp.sendEmail({ to: s['Alerts to'], name: 'Popcode outreach',
    subject: (news ? 'NEW: ' : '') + 'Gallery outreach ' + label.toLowerCase() + ': ' + (news ? news + ' new' : 'no new replies') + ', ' + sentToday + ' sent today',
    body: out.join('\n').replace(/\n{3,}/g, '\n\n') });
}

// Adds any setting rows that a newer version of this script introduced.
function ensureSettings_() {
  var st = SpreadsheetApp.getActive().getSheetByName(SETTINGS_TAB);
  if (!st) return;
  var have = {};
  if (st.getLastRow()) st.getRange(1, 1, st.getLastRow(), 1).getValues().forEach(function (r) { have[r[0]] = 1; });
  DEFAULTS.forEach(function (d) {
    if (!have[d[0]]) { st.appendRow(d); st.getRange(st.getLastRow(), 1).setFontWeight('bold'); }
  });
}

// Send yourself a sample digest now (run from the editor to preview).
function testDigest() {
  ensureSettings_();
  sendDigest_(readSettings_(), 'Test', Date.now() - 864e5, true);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function readSettings_() {
  var st = SpreadsheetApp.getActive().getSheetByName(SETTINGS_TAB);
  var out = {};
  DEFAULTS.forEach(function (d) { out[d[0]] = d[1]; });
  if (st && st.getLastRow()) st.getRange(1, 1, st.getLastRow(), 2).getValues().forEach(function (r) { if (r[0]) out[r[0]] = r[1]; });
  return out;
}

function inSendingWindow_(s) {
  var now = new Date();
  var dow = Number(Utilities.formatDate(now, TZ, 'u'));          // 1 = Mon … 7 = Sun
  if (s['Weekdays only'] !== false && String(s['Weekdays only']).toUpperCase() !== 'FALSE' && dow > 5) return false;
  var mins = Number(Utilities.formatDate(now, TZ, 'H')) * 60 + Number(Utilities.formatDate(now, TZ, 'm'));
  return mins >= toMins_(s['Start time (ET, 24h)'], 570) && mins < toMins_(s['Stop time (ET, 24h)'], 960);
}

function toMins_(v, dflt) {
  if (v instanceof Date) return v.getHours() * 60 + v.getMinutes();
  var m = String(v).match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : dflt;
}

// "Send on" may be a date, or text like "Tue 11/10". Blank = send any day.
function dueToday_(v) {
  if (v === '' || v === null) return true;
  var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd') <= today;
  var m = String(v).match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (!m) return true;
  var y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : today.slice(0, 4);
  var ymd = y + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);   // compared as text: no timezone shifts
  return ymd <= today;
}
