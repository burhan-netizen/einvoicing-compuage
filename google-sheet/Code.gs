/**
 * CompuAge Computers L.L.C. | UAE e-Invoicing (PEPPOL) Declaration
 * Google Sheet + Apps Script for admin@compuagedubai.com
 *
 * What this does
 *  1. Receives every form submission from the website, logs it (Submissions + People tabs)
 *     and sends the two emails from this Google account: the full PDF to CompuAge and a copy
 *     to the customer / supplier.
 *  2. Sends the invitation email (and later reminders) to everyone in the Recipients tab,
 *     in small batches, within Google's daily sending limit.
 *
 * Setup (once)
 *  - Extensions > Apps Script, paste this file, change SECRET below, Save.
 *  - Reload the sheet. Use the menu "e-Invoicing" > "Set up tabs".
 *  - Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Deploy and authorise.
 *  - Copy the Web app URL into Vercel as SHEET_WEBHOOK_URL, and SECRET into Vercel as SHEET_SECRET.
 *  After changing this code: Deploy > Manage deployments > pencil > Version: New version > Deploy.
 */

const SECRET = 'CHANGE-ME'; // same value as SHEET_SECRET in Vercel
const SITE = 'https://einvoicing-compuage.vercel.app';
const MOF_URL = 'https://mof.gov.ae/einvoicing/';
const COMPANY = 'CompuAge Computers L.L.C.';
const TRN = '100274488400003';

const TAB = { submissions: 'Submissions', people: 'People', recipients: 'Recipients', settings: 'Settings', log: 'Send log' };
const REC_HEADERS = ['ID', 'Company', 'Contact name', 'Email', 'Type', 'Status', 'Invited at', 'Reminders sent', 'Last reminder at', 'Submitted at', 'Reference', 'Notes'];
const SETTINGS = [
  ['Form link', SITE + '/', 'The page the "Submit your details" button opens.'],
  ['Deadline', '', 'Optional, for example: 30 November 2026. Leave blank to leave the date out of the emails.'],
  ['Sender name', COMPANY, 'Shown as the sender name. The emails come from this Google account.'],
  ['Reply-to email', 'admin@compuagedubai.com', 'Where replies to invitations and reminders go.'],
  ['Questions email', 'admin@compuagedubai.com', 'Shown in the email as the contact for questions.'],
  ['Sign-off name', 'Accounts Team', 'First line of the sign-off.'],
  ['Sign-off company', COMPANY, 'Second line of the sign-off.'],
  ['Invitation subject', 'Action required: UAE e-Invoicing (PEPPOL) details for ' + COMPANY, ''],
  ['Reminder subject', 'Reminder: UAE e-Invoicing (PEPPOL) details for ' + COMPANY, ''],
  ['Batch size', 40, 'Emails per run. While sending is on, a run happens every 10 minutes.'],
  ['Keep in reserve', 100, 'Emails per day kept free for form submissions. Sending pauses at this level and resumes the next day.'],
  ['Days between reminders', 3, 'Someone gets a reminder only if this many days have passed since their last email.'],
];

/* ------------------------------------------------------------------ menu */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('e-Invoicing')
    .addItem('Set up tabs', 'setupTabs')
    .addSeparator()
    .addItem('Send test invitation to me', 'sendTestInvitation')
    .addItem('Send test reminder to me', 'sendTestReminder')
    .addSeparator()
    .addItem('Start sending invitations', 'startInvitations')
    .addItem('Start sending reminders', 'startReminders')
    .addItem('Stop sending', 'stopSendingMenu')
    .addSeparator()
    .addItem('Show status', 'showStatus')
    .addToUi();
}

function setupTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rec = ss.getSheetByName(TAB.recipients) || ss.insertSheet(TAB.recipients, 0);
  if (!rec.getLastRow()) {
    rec.getRange(1, 1, 1, REC_HEADERS.length).setValues([REC_HEADERS]);
    styleHeader(rec, REC_HEADERS.length);
    [90, 220, 170, 240, 110, 110, 140, 110, 140, 140, 150, 260].forEach((w, i) => rec.setColumnWidth(i + 1, w));
  }
  const set = ss.getSheetByName(TAB.settings) || ss.insertSheet(TAB.settings);
  if (!set.getLastRow()) {
    set.getRange(1, 1, 1, 3).setValues([['Setting', 'Value', 'Notes']]);
    set.getRange(2, 1, SETTINGS.length, 3).setValues(SETTINGS);
    styleHeader(set, 3);
    [200, 420, 520].forEach((w, i) => set.setColumnWidth(i + 1, w));
  }
  [TAB.submissions, TAB.people].forEach(n => { if (!ss.getSheetByName(n)) ss.insertSheet(n); });
  const log = ss.getSheetByName(TAB.log) || ss.insertSheet(TAB.log);
  if (!log.getLastRow()) { log.getRange(1, 1, 1, 5).setValues([['Time (UAE)', 'Type', 'To', 'Result', 'Details']]); styleHeader(log, 5); }
  toast('Tabs are ready. Paste your contacts into the Recipients tab: Company, Contact name, Email, Type.');
}

/* ----------------------------------------------------- website webhook */

// The website posts here after every submission.
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const data = JSON.parse(e.postData.contents);
    if (SECRET && data.secret !== SECRET) return json({ ok: false, error: 'unauthorised' });
    const emails = Array.isArray(data.emails) ? data.emails : [];
    const notes = [];

    // The email to CompuAge must go out, otherwise the website tells the customer / supplier to try again.
    emails.filter(m => m.required).forEach(m => sendSubmissionEmail(m));
    emails.filter(m => !m.required).forEach(m => {
      try { sendSubmissionEmail(m); } catch (err) { notes.push('Copy email failed: ' + err); }
    });

    // Logging is best effort: the submission has already reached CompuAge by email.
    try {
      const record = data.record || {};
      if (data.match && data.match.invite) record['Invite ID'] = data.match.invite;
      appendRecord(TAB.submissions, record);
      (data.people || []).forEach(p => appendRecord(TAB.people, p));
      if (data.match) markSubmitted(data.match);
    } catch (err) { notes.push('Logging failed: ' + err); }

    return json({ ok: true, notes: notes });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Opening the Web app URL in a browser shows this, as a quick health check.
function doGet() {
  return json({ ok: true, message: 'CompuAge e-Invoicing sheet is connected.', emailsLeftToday: MailApp.getRemainingDailyQuota() });
}

function sendSubmissionEmail(m) {
  const options = { htmlBody: m.html, name: m.name || COMPANY };
  if (m.replyTo) options.replyTo = m.replyTo;
  if (m.attachments && m.attachments.length) {
    options.attachments = m.attachments.map(a => Utilities.newBlob(Utilities.base64Decode(a.base64), a.mimeType, a.name));
  }
  try {
    MailApp.sendEmail(m.to, m.subject, plainText(m.html), options);
    logSend('Submission', m.to, 'Sent', m.subject);
  } catch (err) {
    logSend('Submission', m.to, 'Failed', String(err));
    throw err;
  }
}

function markSubmitted(match) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.recipients);
  if (!sh || sh.getLastRow() < 2) return;
  const col = recCols(sh);
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const wanted = (match.emails || []).map(x => String(x).toLowerCase());
  let idx = match.invite ? rows.findIndex(r => String(r[col['ID']]) === match.invite) : -1;
  if (idx < 0 && wanted.length) idx = rows.findIndex(r => splitEmails(r[col['Email']]).some(x => wanted.indexOf(x) > -1));
  if (idx < 0) return;
  const r = idx + 2;
  setCell(sh, r, col, 'Status', 'Submitted');
  setCell(sh, r, col, 'Submitted at', nowUae());
  const prev = String(rows[idx][col['Reference']] || '');
  setCell(sh, r, col, 'Reference', prev ? prev + ', ' + match.ref : match.ref);
}

/* ------------------------------------------------------ bulk sending */

function startInvitations() { startSending('invite'); }
function startReminders() { startSending('reminder'); }
function stopSendingMenu() { stopSending('Stopped from the menu.'); }

function startSending(mode) {
  setupTabs();
  const s = settings();
  if (!/^https:\/\//.test(s['Form link'])) return toast('Please put the form link in the Settings tab first.');
  const pending = eligibleRows(mode, s).length;
  if (!pending) return toast(mode === 'invite' ? 'Nobody is waiting for an invitation. New rows need a blank Status.' : 'Nobody needs a reminder right now.');
  const ui = SpreadsheetApp.getUi();
  const label = mode === 'invite' ? 'invitations' : 'reminders';
  const ok = ui.alert('Send ' + label, pending + ' ' + label + ' will be sent in batches of ' + s['Batch size'] +
    ' every 10 minutes, keeping ' + s['Keep in reserve'] + ' emails a day free for form submissions.\n\nEmails left today: ' +
    MailApp.getRemainingDailyQuota() + '.\n\nStart now?', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  removeTriggers();
  PropertiesService.getScriptProperties().setProperties({ mode: mode, startedBy: Session.getEffectiveUser().getEmail(), sentThisRun: '0' });
  ScriptApp.newTrigger('processQueue').timeBased().everyMinutes(10).create();
  processQueue();
}

// Runs every 10 minutes while sending is on.
function processQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const mode = props.getProperty('mode');
    if (!mode) return removeTriggers();
    const s = settings();
    const started = Date.now();
    let allowance = Math.min(num(s['Batch size'], 40), MailApp.getRemainingDailyQuota() - num(s['Keep in reserve'], 100));
    if (allowance <= 0) {
      const today = Utilities.formatDate(new Date(), 'Asia/Dubai', 'yyyy-MM-dd');
      if (props.getProperty('pausedOn') !== today) {
        props.setProperty('pausedOn', today);
        logSend('Batch', '', 'Paused', 'Daily sending limit reached. Sending continues automatically tomorrow.');
      }
      return;
    }

    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.recipients);
    const col = recCols(sh);
    let sent = 0;
    for (const item of eligibleRows(mode, s)) {
      if (allowance <= 0 || Date.now() - started > 4.5 * 60 * 1000) break;
      const r = item.row;
      let id = String(item.values[col['ID']] || '');
      if (!id) { id = newId(); setCell(sh, r, col, 'ID', id); }
      const person = { company: item.values[col['Company']], name: item.values[col['Contact name']], id: id };
      const to = splitEmails(item.values[col['Email']]);
      try {
        const mail = buildInvite(mode, person, s);
        MailApp.sendEmail(to.join(','), mail.subject, mail.text, { htmlBody: mail.html, name: s['Sender name'], replyTo: s['Reply-to email'] });
        if (mode === 'invite') {
          setCell(sh, r, col, 'Status', 'Invited');
          setCell(sh, r, col, 'Invited at', nowUae());
        } else {
          setCell(sh, r, col, 'Status', 'Reminded');
          setCell(sh, r, col, 'Reminders sent', num(item.values[col['Reminders sent']], 0) + 1);
          setCell(sh, r, col, 'Last reminder at', nowUae());
        }
        setCell(sh, r, col, 'Notes', '');
        logSend(mode === 'invite' ? 'Invitation' : 'Reminder', to.join(', '), 'Sent', person.company);
        sent++; allowance -= to.length;
      } catch (err) {
        setCell(sh, r, col, 'Status', 'Error');
        setCell(sh, r, col, 'Notes', String(err).slice(0, 300));
        logSend(mode === 'invite' ? 'Invitation' : 'Reminder', to.join(', '), 'Failed', String(err));
      }
    }
    props.setProperty('sentThisRun', String(num(props.getProperty('sentThisRun'), 0) + sent));
    if (!eligibleRows(mode, s).length) finishRun(mode);
  } finally {
    lock.releaseLock();
  }
}

function eligibleRows(mode, s) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.recipients);
  if (!sh || sh.getLastRow() < 2) return [];
  const col = recCols(sh);
  const gapMs = num(s['Days between reminders'], 3) * 86400000;
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const out = [];
  values.forEach((v, i) => {
    const emails = splitEmails(v[col['Email']]);
    const status = String(v[col['Status']] || '').trim();
    if (!emails.length) {
      if (String(v[col['Email']] || '').trim() && !status) { sh.getRange(i + 2, col['Status'] + 1).setValue('Check email'); sh.getRange(i + 2, col['Notes'] + 1).setValue('This email address does not look valid.'); }
      return;
    }
    if (mode === 'invite' && status === '') out.push({ row: i + 2, values: v });
    if (mode === 'reminder' && (status === 'Invited' || status === 'Reminded') && !v[col['Submitted at']]) {
      const last = parseUae(v[col['Last reminder at']]) || parseUae(v[col['Invited at']]);
      if (!last || Date.now() - last >= gapMs) out.push({ row: i + 2, values: v });
    }
  });
  return out;
}

function finishRun(mode) {
  const props = PropertiesService.getScriptProperties();
  const sent = props.getProperty('sentThisRun') || '0';
  const owner = props.getProperty('startedBy');
  stopSending('All ' + (mode === 'invite' ? 'invitations' : 'reminders') + ' sent (' + sent + ' this run).');
  if (owner) MailApp.sendEmail(owner, 'e-Invoicing ' + (mode === 'invite' ? 'invitations' : 'reminders') + ' finished',
    sent + ' emails were sent. Open the sheet to see who has submitted: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
}

function stopSending(reason) {
  removeTriggers();
  PropertiesService.getScriptProperties().deleteProperty('mode');
  logSend('Batch', '', 'Stopped', reason || '');
  toast(reason || 'Sending stopped.');
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'processQueue').forEach(t => ScriptApp.deleteTrigger(t));
}

function showStatus() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.recipients);
  const counts = {};
  if (sh && sh.getLastRow() > 1) {
    const col = recCols(sh);
    sh.getRange(2, col['Status'] + 1, sh.getLastRow() - 1, 1).getValues().forEach(r => {
      const k = String(r[0] || 'Not sent yet'); counts[k] = (counts[k] || 0) + 1;
    });
  }
  const mode = PropertiesService.getScriptProperties().getProperty('mode');
  const lines = Object.keys(counts).map(k => k + ': ' + counts[k]);
  SpreadsheetApp.getUi().alert('e-Invoicing status',
    (lines.join('\n') || 'No recipients yet.') + '\n\nEmails left today: ' + MailApp.getRemainingDailyQuota() +
    '\nSending: ' + (mode ? (mode === 'invite' ? 'invitations in progress' : 'reminders in progress') : 'off'),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function sendTestInvitation() { sendTest('invite'); }
function sendTestReminder() { sendTest('reminder'); }
function sendTest(mode) {
  setupTabs();
  const s = settings();
  const me = Session.getEffectiveUser().getEmail();
  const mail = buildInvite(mode, { company: 'Sample Trading L.L.C.', name: 'Ahmed', id: 'TEST' }, s);
  MailApp.sendEmail(me, '[TEST] ' + mail.subject, mail.text, { htmlBody: mail.html, name: s['Sender name'], replyTo: s['Reply-to email'] });
  logSend('Test', me, 'Sent', mail.subject);
  toast('Test ' + (mode === 'invite' ? 'invitation' : 'reminder') + ' sent to ' + me);
}

/* ------------------------------------------------- invitation email */

function buildInvite(mode, p, s) {
  const reminder = mode === 'reminder';
  const link = s['Form link'] + (s['Form link'].indexOf('?') > -1 ? '&' : '?') + 'r=' + encodeURIComponent(p.id);
  const deadline = String(s['Deadline'] || '').trim();
  const greeting = p.name ? 'Dear ' + esc(p.name) + ',' : 'Dear Sir / Madam,';
  const forCo = p.company ? ' for <b>' + esc(p.company) + '</b>' : '';
  const by = deadline ? ' by <b>' + esc(deadline) + '</b>' : '';
  const q = esc(s['Questions email']);

  const intro = reminder
    ? '<p style="margin:0 0 14px">This is a friendly reminder that we have not yet received your UAE e-Invoicing (PEPPOL) details' + forCo + '. Completing the form now helps us keep invoicing and payments with you running smoothly once e-invoicing goes live.</p>' +
      '<p style="margin:0 0 4px">Please complete the declaration' + by + '. It takes about 10 minutes.</p>'
    : '<p style="margin:0 0 14px">The UAE Ministry of Finance is introducing mandatory electronic invoicing, in phases, through the PEPPOL network. Once it applies, invoices between businesses are exchanged in a structured digital format through Accredited Service Providers (ASPs), instead of as PDF or paper copies.</p>' +
      '<p style="margin:0 0 14px">To prepare, we are updating our Customer / Supplier records. Please complete our short <b>UAE e-Invoicing (PEPPOL) Declaration</b>' + forCo + by + '. It takes about 10 minutes.</p>';

  const keep = ['Trade licence', 'VAT registration certificate (if registered)', 'Corporate Tax certificate (if available)',
    'Ejari / tenancy contract', 'Passport, visa and Emirates ID of each owner and authorised signatory',
    'Your PEPPOL ID and ASP details, if already appointed'];

  const html = '<!doctype html><html><body style="margin:0;background:#f6f5f3;font-family:Arial,Helvetica,sans-serif;color:#141414">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f3;padding:28px 12px"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid #e7e5e2;border-radius:14px;overflow:hidden">' +
    '<tr><td style="height:4px;background:linear-gradient(90deg,#e2231a,#ef5a1e,#f9a51a);background-color:#ef5a1e"></td></tr>' +
    '<tr><td style="padding:24px 28px 6px"><img src="' + SITE + '/compuage-logo.png" alt="' + COMPANY + '" height="38" style="display:block;height:38px;width:auto">' +
    '<div style="margin-top:6px;font-size:11.5px;font-weight:700;color:#7a7a7a">TRN: ' + TRN + '</div></td></tr>' +
    '<tr><td style="padding:14px 28px 0">' +
    '<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#ef5a1e">' + (reminder ? 'Reminder' : 'Action required') + '</p>' +
    '<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">UAE e-Invoicing (PEPPOL) Declaration</h1>' +
    '<div style="font-size:14px;line-height:1.65;color:#2e2e2e"><p style="margin:0 0 14px">' + greeting + '</p>' + intro + '</div>' +
    '</td></tr>' +
    '<tr><td align="left" style="padding:18px 28px 6px">' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#ef5a1e">' +
    '<a href="' + link + '" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">Submit your details</a>' +
    '</td></tr></table>' +
    '<p style="margin:10px 0 0;font-size:12px;color:#7a7a7a;word-break:break-all">Or open: <a href="' + link + '" style="color:#ef5a1e">' + esc(link) + '</a></p>' +
    '</td></tr>' +
    '<tr><td style="padding:18px 28px 0"><p style="margin:0 0 8px;font-size:13.5px;font-weight:700">Please keep these ready to upload</p>' +
    '<ul style="margin:0;padding-left:18px;font-size:13.5px;line-height:1.7;color:#2e2e2e">' + keep.map(k => '<li>' + k + '</li>').join('') + '</ul></td></tr>' +
    '<tr><td style="padding:18px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff3ec;border:1px solid #fbd6c2;border-radius:10px"><tr>' +
    '<td style="padding:12px 14px;font-size:13px;color:#4a4a4a;line-height:1.55"><b>Please note:</b> CompuAge will never ask for bank account details, card numbers or passwords through this form or by email. If anything looks unusual, contact us at <a href="mailto:' + q + '" style="color:#ef5a1e">' + q + '</a>.</td>' +
    '</tr></table></td></tr>' +
    '<tr><td style="padding:16px 28px 0;font-size:13px;line-height:1.6;color:#4a4a4a">To learn more about UAE e-invoicing, visit the Ministry of Finance page: <a href="' + MOF_URL + '" style="color:#ef5a1e">mof.gov.ae/einvoicing</a>. For questions about this form, reply to this email or write to <a href="mailto:' + q + '" style="color:#ef5a1e">' + q + '</a>.</td></tr>' +
    '<tr><td style="padding:18px 28px 24px;font-size:14px;line-height:1.6;color:#2e2e2e">Kind regards,<br><b>' + esc(s['Sign-off name']) + '</b><br>' + esc(s['Sign-off company']) + '</td></tr>' +
    '<tr><td style="padding:14px 28px 20px;border-top:1px solid #eeeae6;font-size:11.5px;line-height:1.55;color:#7a7a7a">' + COMPANY + ' &middot; Dubai, United Arab Emirates &middot; TRN ' + TRN + '<br>You are receiving this because you are a customer or supplier of CompuAge Computers L.L.C. If this should go to a colleague, please forward it or reply with their email.</td></tr>' +
    '</table></td></tr></table></body></html>';

  const subject = reminder ? s['Reminder subject'] : s['Invitation subject'];
  return { subject: subject, html: html, text: plainText(html) };
}

/* ------------------------------------------------------------ helpers */

function settings() {
  const out = {};
  SETTINGS.forEach(r => { out[r[0]] = r[1]; });
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.settings);
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => {
      const k = String(r[0]).trim();
      if (k && r[1] !== '' && r[1] != null) out[k] = r[1] instanceof Date ? Utilities.formatDate(r[1], 'Asia/Dubai', 'd MMMM yyyy') : r[1];
    });
    // A deliberately blank deadline stays blank.
    const row = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().find(r => String(r[0]).trim() === 'Deadline');
    if (row && (row[1] === '' || row[1] == null)) out['Deadline'] = '';
  }
  out['Form link'] = String(out['Form link']).trim();
  return out;
}

function recCols(sh) {
  let headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(h => String(h).trim());
  const missing = REC_HEADERS.filter(h => headers.indexOf(h) === -1);
  if (missing.length) {
    sh.getRange(1, headers.filter(String).length + 1, 1, missing.length).setValues([missing]);
    headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  }
  const col = {};
  headers.forEach((h, i) => { if (h && col[h] === undefined) col[h] = i; });
  return col;
}

function setCell(sh, row, col, header, value) { sh.getRange(row, col[header] + 1).setValue(value); }

function appendRecord(name, record) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  let headers = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  const missing = Object.keys(record).filter(k => headers.indexOf(k) === -1);
  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
    styleHeader(sheet, headers.length);
  }
  sheet.appendRow(headers.map(h => (record[h] == null ? '' : String(record[h]))));
}

function logSend(type, to, result, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(TAB.log) || ss.insertSheet(TAB.log);
    if (!sh.getLastRow()) { sh.getRange(1, 1, 1, 5).setValues([['Time (UAE)', 'Type', 'To', 'Result', 'Details']]); styleHeader(sh, 5); }
    sh.appendRow([nowUae(), type, to, result, String(details || '').slice(0, 500)]);
  } catch (err) { console.error(err); }
}

function styleHeader(sh, n) {
  sh.getRange(1, 1, 1, n).setFontWeight('bold').setBackground('#fff3ec');
  sh.setFrozenRows(1);
}

function splitEmails(v) {
  return String(v || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(x));
}

function nowUae() { return Utilities.formatDate(new Date(), 'Asia/Dubai', 'yyyy-MM-dd HH:mm'); }
function parseUae(v) {
  if (v instanceof Date) return v.getTime();
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 4, +m[5]) : 0; // UAE is UTC+4
}
function newId() { return Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase(); }
function num(v, d) { const n = Number(v); return isFinite(n) && String(v).trim() !== '' ? n : d; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function plainText(html) {
  return String(html).replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g, (m, href, txt) => (txt === href || href.indexOf('mailto:') === 0 ? txt : txt + ' (' + href + ')')).replace(/<(br|\/p|\/li|\/tr|\/h1)[^>]*>/g, '\n')
    .replace(/<li[^>]*>/g, '- ').replace(/<[^>]+>/g, '').replace(/&middot;/g, '|').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#\d+;/g, '').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}
function toast(msg) { try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'e-Invoicing', 8); } catch (err) { console.log(msg); } }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
