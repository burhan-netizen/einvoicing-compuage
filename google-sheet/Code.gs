/**
 * CompuAge Computers L.L.C. | UAE e-Invoicing (PEPPOL) Declaration
 * Google Sheet + Apps Script for admin@compuagedubai.com
 *
 * What this does
 *  1. Receives every form submission from the website, logs it (Submissions + People tabs)
 *     and sends the two emails from this Google account: the full PDF to CompuAge and a copy
 *     to the customer / supplier.
 *     Uploaded documents are saved in Google Drive: My Drive > CompuAge e-Invoicing Documents.
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
const SITE = 'https://e-invoicing.compuagedubai.com';
const MOF_URL = 'https://mof.gov.ae/einvoicing/';
const COMPANY = 'CompuAge Computers L.L.C.';
const TRN = '100274488400003';

// The logo travels inside each email (not loaded from the website), so it shows even when
// Gmail or Outlook block outside images.
const LOGO_B64 = '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';
function logoBlob() { return Utilities.newBlob(Utilities.base64Decode(LOGO_B64), 'image/png', 'compuage-logo.png'); }

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
  docsFolder('Incoming'); docsFolder('Submissions');
  toast('Tabs are ready. Paste your contacts into the Recipients tab: Company, Contact name, Email, Type.');
}

/* ----------------------------------------------------- website webhook */

// The website posts here: document uploads from the browser, file reads and submissions from the server.
function doPost(e) {
  let data;
  try { data = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'bad request' }); }
  if (data.action === 'upload') return handleUpload(data);
  if (SECRET && data.secret !== SECRET) return json({ ok: false, error: 'unauthorised' });
  if (data.action === 'file') return handleFile(data);
  if (data.action === 'start') return handleStart(data);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const emails = Array.isArray(data.emails) ? data.emails : [];
    const notes = [];
    const record = data.record || {};

    // Put the documents and the full PDF into the company's own Drive folder.
    let pdfFile = null, folder = null;
    try {
      if (data.folder) {
        const name = String(data.folder.name || 'Submission').slice(0, 200);
        // Fast path: the documents were uploaded straight into this submission's own folder,
        // so it only needs a name and a move into "Submissions".
        try {
          if (data.folder.folderId) {
            const f = DriveApp.getFolderById(data.folder.folderId);
            if (String(f.getDescription() || '').indexOf('cmpg-session:') === 0) { f.setName(name); f.moveTo(docsFolder('Submissions')); folder = f; }
          }
        } catch (err) { notes.push('Folder move failed: ' + err); }
        if (!folder) {
          folder = docsFolder('Submissions').createFolder(name);
          (data.folder.ids || []).forEach(id => {
            try { const f = DriveApp.getFileById(id); if (isOurUpload(f)) f.moveTo(folder); } catch (err) { notes.push('Move failed: ' + id); }
          });
        }
        if (data.pdf && data.pdf.base64) pdfFile = folder.createFile(Utilities.newBlob(Utilities.base64Decode(data.pdf.base64), 'application/pdf', data.pdf.name));
      }
    } catch (err) { notes.push('Drive folder failed: ' + err); }
    const pdfUrl = pdfFile ? pdfFile.getUrl() : '';
    record['Full submission PDF'] = pdfUrl ? hyperlink(pdfUrl, 'Open PDF') : '';
    record['Documents folder'] = folder ? hyperlink(folder.getUrl(), 'Open folder') : '';

    // The email to CompuAge must go out, otherwise the website tells the customer / supplier to try again.
    const prep = m => {
      m.html = String(m.html).split('{{PDF_URL}}').join(pdfUrl || '#');
      if (m.attachPdf && data.pdf && data.pdf.base64) {
        m.attachments = [{ name: data.pdf.name, mimeType: 'application/pdf', base64: data.pdf.base64 }].concat(m.attachments || []);
      }
      return m;
    };
    emails.filter(m => m.required).forEach(m => sendSubmissionEmail(prep(m)));
    emails.filter(m => !m.required).forEach(m => {
      try { sendSubmissionEmail(prep(m)); } catch (err) { notes.push('Copy email failed: ' + err); }
    });

    // Logging is best effort: the submission has already reached CompuAge by email.
    try {
      if (data.match && data.match.invite) record['Invite ID'] = data.match.invite;
      appendRecord(TAB.submissions, record);
      appendRecords(TAB.people, data.people || []);
      if (data.match) markSubmitted(data.match);
    } catch (err) { notes.push('Logging failed: ' + err); }

    return json({ ok: true, notes: notes, pdfUrl: pdfUrl });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------- documents in Google Drive */

const UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const UPLOAD_MAX = 10.5 * 1024 * 1024;
const SLOT_RE = /^(tradeLicenceFile|vatCertFile|ctCertFile|ejariFile|(owners|signatories)\.\d{1,2}\.(passport|visa|eid))$/;

// Browser upload: checked against a short-lived ticket signed by the website, then saved to Drive.
function handleUpload(d) {
  try {
    const signed = d.session + '.' + d.exp + (d.folder ? '.' + d.folder : '');
    const expected = Utilities.computeHmacSha256Signature(signed, SECRET)
      .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
    if (!d.sig || d.sig !== expected || Number(d.exp) < Date.now()) return json({ ok: false, error: 'Upload link expired. Please refresh the page and try again.' });
    if (!/^[a-f0-9]{10,40}$/.test(String(d.session)) || !SLOT_RE.test(String(d.slot)) || UPLOAD_TYPES.indexOf(d.mimeType) < 0) return json({ ok: false, error: 'File not accepted' });
    const bytes = Utilities.base64Decode(String(d.base64 || ''));
    if (!bytes.length || bytes.length > UPLOAD_MAX) return json({ ok: false, error: 'File is empty or larger than 10 MB' });
    const name = String(d.name || 'document').replace(/[\\/:*?"<>|]+/g, '').slice(0, 120);
    let target = null;
    if (d.folder) {
      target = DriveApp.getFolderById(String(d.folder));
      if (target.getDescription() !== 'cmpg-session:' + d.session) return json({ ok: false, error: 'File not accepted' });
    }
    const file = (target || docsFolder('Incoming')).createFile(Utilities.newBlob(bytes, d.mimeType, d.slot + '-' + (Number(d.n) || 0) + ' - ' + name));
    file.setDescription('cmpg-upload:' + d.session);
    return json({ ok: true, id: file.getId() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// Called by the website when someone starts uploading: one folder per submission.
function handleStart(d) {
  try {
    if (!/^[a-f0-9]{10,40}$/.test(String(d.session))) return json({ ok: false, error: 'bad session' });
    const f = docsFolder('Incoming').createFolder('In progress - ' + d.session);
    f.setDescription('cmpg-session:' + d.session);
    return json({ ok: true, folderId: f.getId() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// Server read-back, so the website can put the documents inside the PDF.
function handleFile(d) {
  try {
    const f = DriveApp.getFileById(String(d.id));
    if (!isOurUpload(f)) return json({ ok: false, error: 'not found' });
    const blob = f.getBlob();
    return json({ ok: true, mimeType: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function isOurUpload(f) { return String(f.getDescription() || '').indexOf('cmpg-upload:') === 0; }

// "CompuAge e-Invoicing Documents" in My Drive, with "Incoming" and "Submissions" inside.
function docsFolder(sub) {
  const props = PropertiesService.getScriptProperties();
  const key = 'folder_' + sub;
  const cached = props.getProperty(key);
  if (cached) { try { return DriveApp.getFolderById(cached); } catch (err) { /* recreate below */ } }
  let rootId = props.getProperty('folder_root'), root = null;
  if (rootId) { try { root = DriveApp.getFolderById(rootId); } catch (err) { root = null; } }
  if (!root) { root = DriveApp.createFolder('CompuAge e-Invoicing Documents'); props.setProperty('folder_root', root.getId()); }
  const it = root.getFoldersByName(sub);
  const folder = it.hasNext() ? it.next() : root.createFolder(sub);
  props.setProperty(key, folder.getId());
  return folder;
}

function hyperlink(url, text) { return '=HYPERLINK("' + String(url).replace(/"/g, '%22') + '","' + text + '")'; }

// Opening the Web app URL in a browser shows this, as a quick health check.
function doGet() {
  return json({ ok: true, message: 'CompuAge e-Invoicing sheet is connected.', emailsLeftToday: MailApp.getRemainingDailyQuota() });
}

function sendSubmissionEmail(m) {
  const html = String(m.html).replace(/https?:\/\/[^"']*\/compuage-logo\.png/g, 'cid:logo');
  const options = { htmlBody: html, name: m.name || COMPANY, inlineImages: { logo: logoBlob() } };
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
        MailApp.sendEmail(to.join(','), mail.subject, mail.text, { htmlBody: mail.html, name: s['Sender name'], replyTo: s['Reply-to email'], inlineImages: { logo: logoBlob() } });
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
  MailApp.sendEmail(me, '[TEST] ' + mail.subject, mail.text, { htmlBody: mail.html, name: s['Sender name'], replyTo: s['Reply-to email'], inlineImages: { logo: logoBlob() } });
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
    '<tr><td style="padding:24px 28px 6px"><img src="cid:logo" alt="' + COMPANY + '" width="147" height="38" style="display:block;height:38px;width:147px">' +
    '<div style="margin-top:6px;font-size:11.5px;font-weight:700;color:#7a7a7a">TRN: ' + TRN + '</div></td></tr>' +
    '<tr><td style="padding:14px 28px 0">' +
    '<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#ef5a1e">' + (reminder ? 'Reminder' : 'Action required') + '</p>' +
    '<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">UAE e-Invoicing (PEPPOL) Declaration</h1>' +
    '<div style="font-size:14px;line-height:1.65;color:#2e2e2e"><p style="margin:0 0 14px">' + greeting + '</p>' + intro + '</div>' +
    '</td></tr>' +
    '<tr><td align="left" style="padding:18px 28px 6px">' +
    // Outlook desktop (Word engine) ignores padding and rounded corners on links, so it gets a
    // VML button of its own; every other email app gets the normal HTML button.
    '<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="' + link + '" ' +
    'style="height:48px;v-text-anchor:middle;width:240px;" arcsize="21%" stroke="f" fillcolor="#ef5a1e"><w:anchorlock/>' +
    '<center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Submit your details</center></v:roundrect><![endif]-->' +
    '<!--[if !mso]><!-- -->' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#ef5a1e" style="border-radius:10px;background:#ef5a1e;padding:14px 28px">' +
    '<a href="' + link + '" style="display:inline-block;font-family:Arial,sans-serif;font-size:16px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none">Submit your details</a>' +
    '</td></tr></table>' +
    '<!--<![endif]-->' +
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

function appendRecord(name, record) { appendRecords(name, [record]); }

// Adds any new column headers once, then writes all rows in a single call.
function appendRecords(name, records) {
  if (!records.length) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  let headers = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  const missing = [];
  records.forEach(r => Object.keys(r).forEach(k => { if (headers.indexOf(k) === -1 && missing.indexOf(k) === -1) missing.push(k); }));
  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
    styleHeader(sheet, headers.length);
  }
  const rows = records.map(r => headers.map(h => (r[h] == null ? '' : String(r[h]))));
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
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
