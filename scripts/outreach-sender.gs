/**
 * Popcode outreach sender — Google Apps Script for the "Popcode Nonprofit Tracker" sheet.
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
  ['Max new emails per day', 50, 'Keep it at or under 50 to protect deliverability.'],
  ['Start time (ET, 24h)', '9:30', ''],
  ['Stop time (ET, 24h)', '16:00', ''],
  ['Weekdays only', true, ''],
  ['Your name (From)', 'Curt Middleton', ''],
  ['Signature', '--\nCurt Middleton\nFounder, Popcode · popcode.app\n709 Main St, New Rochelle, NY 10801',
   'Added under every email. Keep the postal address (required for commercial email).'],
  ['Follow-ups', 'OFF', 'ON to send one follow-up in the same thread to people who have not replied.'],
  ['Follow-up after (days)', 4, ''],
  ['Follow-up text',
   'Hi {first},\n\nJust floating this back up in case it got buried. If a Giving Tuesday thank-you card would help, there\'s still time: send us one phone video and it\'s ready to print five business days later.\n\nYou can see how it works, and get started without a call, here: https://popcode.app/givingtuesday\n\nThanks,\nCurt',
   '{first} becomes their first name. Plain text; links stay clean.']
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
    var s = readSettings_();
    if (String(s['Status']).trim().toUpperCase() !== 'RUN') return;
    if (!inSendingWindow_(s)) return;
    if (MailApp.getRemainingDailyQuota() < 5) return;

    var list = SpreadsheetApp.getActive().getSheetByName(SEND_TAB);
    var last = list.getLastRow();
    if (last < 2) return;
    var rows = list.getRange(2, 1, last - 1, COL.STATUS).getValues();

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
      var body = String(r[COL.BODY - 1]).replace(/\s+$/, '') + '\n\n' + s['Signature'];
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
    var text = String(s['Follow-up text']).replace(/\{first\}/g, first) + '\n\n' + s['Signature'];
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
