import { SECTIONS, GROUPS, validate, summaryRows, peopleRecords, docSlots, docRows } from '../lib/schema.js';
import { buildInternalPdf, buildSubmissionPdf } from '../lib/pdf.js';
import { COUNTRIES } from '../src/countries.js';

const byCode = Object.fromEntries(COUNTRIES.map(c => [c.code, c.name]));
const countryName = code => byCode[code] || code;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BLOB_HOST = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//i;
const FORM_NAME = 'UAE e-Invoicing (PEPPOL) Declaration';
const safeFile = s => String(s).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);

function makeRef() {
  const ymd = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CA-SUP-${ymd}-${rand}`;
}

const uaeTime = iso => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Short, professional email: headline, a few key facts, and the PDF does the rest.
function emailHtml({ origin, eyebrow, title, intro, facts, note }) {
  const factRows = facts.filter(([, v]) => v).map(([k, v]) => `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #eeeae6;color:#7a7a7a;font-size:13px;width:42%;vertical-align:top">${esc(k)}</td>
      <td style="padding:9px 0;border-bottom:1px solid #eeeae6;color:#141414;font-size:13px;font-weight:600;vertical-align:top">${esc(v)}</td>
    </tr>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#f6f5f3;font-family:Arial,Helvetica,sans-serif;color:#141414">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f3;padding:28px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid #e7e5e2;border-radius:14px;overflow:hidden">
      <tr><td style="height:4px;background:linear-gradient(90deg,#e2231a,#ef5a1e,#f9a51a);background-color:#ef5a1e"></td></tr>
      <tr><td style="padding:24px 28px 6px"><img src="${origin}/compuage-logo.png" alt="CompuAge Computers L.L.C." height="38" style="display:block;height:38px;width:auto"><div style="margin-top:6px;font-size:11.5px;font-weight:700;color:#7a7a7a">TRN: 100274488400003</div></td></tr>
      <tr><td style="padding:14px 28px 0">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#ef5a1e">${esc(eyebrow)}</p>
        <h1 style="margin:0 0 10px;font-size:20px;line-height:1.3">${esc(title)}</h1>
        <p style="margin:0;color:#4a4a4a;font-size:14px;line-height:1.6">${intro}</p>
      </td></tr>
      <tr><td style="padding:16px 28px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${factRows}</table></td></tr>
      <tr><td style="padding:14px 28px 24px">
        <table role="presentation" cellpadding="0" cellspacing="0" style="background:#fff3ec;border:1px solid #fbd6c2;border-radius:10px;width:100%"><tr>
          <td style="padding:12px 14px;font-size:13px;color:#4a4a4a;line-height:1.55">&#128206;&nbsp; ${note}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:14px 28px 20px;border-top:1px solid #eeeae6;font-size:11.5px;color:#7a7a7a">CompuAge Computers L.L.C. &middot; ${FORM_NAME}</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

// All email now goes out from CompuAge's own Google Workspace mailbox, through the Apps Script web app
// attached to the onboarding Google Sheet. One call logs the submission and sends both emails.
async function postToSheet(payload) {
  const url = process.env.SHEET_WEBHOOK_URL;
  if (!url) throw new Error('SHEET_WEBHOOK_URL is not set');
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: process.env.SHEET_SECRET || '', ...payload }) });
  const text = await r.text().catch(() => '');
  let out = null;
  try { out = JSON.parse(text); } catch { /* not JSON */ }
  if (!r.ok || !out || !out.ok) throw new Error(`Sheet webhook failed (${r.status}): ${(out && out.error) || text.slice(0, 300)}`);
  return out;
}

// Gmail accepts up to 25 MB of attachments per email (base64 counted). Bigger PDFs are shared as a link instead.
const ATTACH_LIMIT = 17 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const { values: raw = {}, files = [], hp, invite } = req.body || {};
  if (hp) return res.status(200).json({ ok: true, ref: makeRef() }); // bot honeypot

  // Server-side validation mirrors the browser. Documents are judged only by what was actually uploaded.
  const uploads = (Array.isArray(files) ? files : []).filter(f => f && typeof f.field === 'string');
  for (const up of uploads) {
    if (!BLOB_HOST.test(String(up.url))) return res.status(400).json({ ok: false, error: 'Invalid document link.' });
  }
  const values = { ...raw };
  for (const g of GROUPS()) values[g.name] = (Array.isArray(raw[g.name]) ? raw[g.name] : []).slice(0, 50);
  const rawDocs = raw.docs && typeof raw.docs === 'object' ? raw.docs : {};
  values.docs = {};
  for (const slot of docSlots(values)) {
    const mine = uploads.filter(u => u.field === slot.key).sort((x, y) => (x.n || 0) - (y.n || 0)).slice(0, slot.max || 1);
    const d = rawDocs[slot.key] || {};
    values.docs[slot.key] = { files: mine, na: !!(slot.allowNA && d.na && !mine.length), reason: String(d.reason || '').slice(0, 300) };
  }
  const errors = validate(values);
  if (!values.declaration) errors.declaration = 'Declaration not accepted';
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, error: 'Some required details are missing. Please review the form.', errors });

  const ref = makeRef();
  const submittedAt = new Date().toISOString();
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const rows = summaryRows(values, countryName);
  const legalName = String(values.legalName).trim();
  const val = name => (rows.find(r => r.name === name) || {}).value || '';

  // Download the uploaded documents once; they go inside the PDF as annexes.
  const documents = [];
  for (const slot of docSlots(values)) {
    const d = values.docs[slot.key];
    const label = `${slot.group}: ${slot.label}`;
    // Sheet column: same for every company (no person names), e.g. "Owner / Partner 1: Passport copy".
    const col = `${String(slot.group).replace(/^(.*?\d+):.*$/, '$1')}: ${slot.label}`;
    if (d.na) { documents.push({ field: slot.key, label, col, name: `Not applicable: ${d.reason}`, na: true }); continue; }
    for (const [n, up] of d.files.entries()) {
      let bytes = null;
      try {
        const r = await fetch(up.url);
        if (!r.ok) throw new Error(String(r.status));
        bytes = new Uint8Array(await r.arrayBuffer());
      } catch (e) { console.error('Document download failed', slot.key, e.message); }
      const ext = String(up.url).split('?')[0].split('.').pop().toLowerCase();
      const contentType = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg';
      documents.push({ field: slot.key, col: n ? `${col} (${n + 1})` : col, label: d.files.length > 1 ? `${label} (${n + 1} of ${d.files.length})` : label, name: up.name || `${slot.label}.${ext}`, url: up.url, ext, contentType, bytes });
    }
  }

  // Build the PDFs. If anything goes wrong here, the email still goes out with the original documents.
  const baseName = safeFile(`${legalName} - ${FORM_NAME} - ${ref}`);
  let internal = null, supplierPdf = null;
  try {
    internal = await buildInternalPdf({ ref, submittedAt, values, rows, documents });
  } catch (e) { console.error('Internal PDF failed', e); }
  try {
    supplierPdf = (await buildSubmissionPdf({ ref, submittedAt, values, rows, documents: documents.map(({ label, name, na }) => ({ label, name, na })), mode: 'supplier' })).bytes;
  } catch (e) { console.error('Supplier PDF failed', e); }

  const attachments = [];
  // The full PDF is always stored, so the sheet can link to it. Small ones are also attached to the email.
  let pdfUrl = '', bigPdfUrl = '';
  if (internal) {
    try {
      const { put } = await import('@vercel/blob');
      const blob = await put(`submissions/${ref}/${baseName}.pdf`, Buffer.from(internal.bytes), { access: 'public', contentType: 'application/pdf', addRandomSuffix: true });
      pdfUrl = blob.url;
    } catch (e) { console.error('PDF upload failed', e.message); }
    if (internal.bytes.length > ATTACH_LIMIT && pdfUrl) bigPdfUrl = pdfUrl;
    else attachments.push({ name: `${baseName}.pdf`, mimeType: 'application/pdf', base64: Buffer.from(internal.bytes).toString('base64') });
  }
  // Any document that could not be merged into the PDF (or every document, if the PDF failed) is attached as is.
  let attachedBytes = internal && !bigPdfUrl ? internal.bytes.length : 0;
  const looseLinks = [];
  documents.forEach((d, i) => {
    const merged = d.na || (internal && internal.documents[i] && !/separately/.test(internal.documents[i].note));
    if (merged || !d.bytes) return;
    if (attachedBytes + d.bytes.length > ATTACH_LIMIT) { looseLinks.push(d); return; }
    attachedBytes += d.bytes.length;
    attachments.push({ name: safeFile(`${legalName} - ${d.label}.${d.ext}`), mimeType: d.contentType, base64: Buffer.from(d.bytes).toString('base64') });
  });

  const to = (process.env.MAIL_TO || 'admin@compuagedubai.com').split(',').map(s => s.trim()).filter(Boolean);
  const senderName = process.env.MAIL_SENDER_NAME || 'CompuAge Computers L.L.C.';
  const facts = [
    ['Reference', ref],
    ['Submitted', `${uaeTime(submittedAt)} (UAE)`],
    ['Registered in', [val('emirate'), val('country')].filter(Boolean).join(', ')],
    ['Free Zone / authority', val('freeZoneUae') || val('freeZoneOther') || val('freeZoneName') || val('licensingAuthority') || val('licensingAuthorityOther') || val('licensingAuthorityText')],
    ['UAE VAT TRN', val('trn') || `Not registered (${val('vatRegistered')})`],
    ['e-Invoicing phase', val('phase')],
    ['Authorised signatory', (values.signatories || []).map(x => `${x.fullName}, ${x.designation}`).join('; ')],
    ['Primary contact', `${val('contactName')}, ${val('designation')}`],
    ['Documents', `${documents.filter(d => !d.na).length} files attached${documents.some(d => d.na) ? `, ${documents.filter(d => d.na).length} marked not applicable` : ''}`],
    ['Company email / mobile', `${val('companyEmail')}  |  ${val('mobile')}`],
    ['Primary contact email', val('email')],
  ];

  const linkNote = bigPdfUrl
    ? `The full submission PDF is larger than an email can carry, so it is available here: <a href="${bigPdfUrl}">${esc(baseName)}.pdf</a>. It contains every answer, the signed declaration and the supporting documents as annexes.`
    : internal
      ? `The full submission is attached as one PDF: <b>${esc(baseName)}.pdf</b>. It contains every answer, the signed declaration and the supporting documents as annexes.`
      : 'The supporting documents are attached. The summary PDF could not be generated this time, so please refer to the details above.';
  const extraLinks = looseLinks.length ? `<br><br>Documents too large to attach: ${looseLinks.map(d => `<a href="${d.url}">${esc(d.label)}</a>`).join(', ')}` : '';
  const emails = [{
    to: to.join(','), name: senderName, replyTo: String(values.email).trim(),
    subject: `${legalName} | ${FORM_NAME} (${ref})`,
    html: emailHtml({ origin, eyebrow: 'New customer / supplier submission', title: legalName, facts,
      intro: `A customer / supplier has completed the ${FORM_NAME}. The key details are below.`, note: linkNote + extraLinks }),
    attachments,
    required: true,
  }];
  if (process.env.SEND_SUPPLIER_COPY !== 'false') {
    emails.push({
      to: String(values.email).trim(), name: senderName, replyTo: to[0],
      subject: `Your ${FORM_NAME} has been received (${ref})`,
      html: emailHtml({ origin, eyebrow: 'Submission received', title: 'Thank you, we have received your details',
        intro: `Dear ${esc(values.contactName)}, thank you for completing the ${FORM_NAME} for <b>${esc(legalName)}</b>. Our team will review the information and update your Customer / Supplier record.`,
        facts: [['Reference', ref], ['Submitted', `${uaeTime(submittedAt)} (UAE)`], ['Company', legalName]],
        note: supplierPdf ? 'A copy of your answers is attached as a PDF for your records. If anything changes, please reply to this email.' : 'If anything changes, please reply to this email.' }),
      attachments: supplierPdf ? [{ name: `${baseName}.pdf`, mimeType: 'application/pdf', base64: Buffer.from(supplierPdf).toString('base64') }] : [],
    });
  }

  const record = { Reference: ref, 'Submitted at (UAE)': new Date(submittedAt).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' }) };
  for (const s of SECTIONS) for (const f of s.fields) {
    if (f.type === 'group' || f.type === 'docs') continue;
    // Some labels repeat across UAE and non-UAE variants of a question: keep whichever was answered.
    const row = rows.find(r => r.name === f.name);
    if (!record[f.label]) record[f.label] = row ? row.value : '';
  }
  const { cells, people } = peopleRecords(values, countryName);
  Object.assign(record, cells);
  // Clickable links in the sheet: the full PDF first, then one column per document.
  const link = (url, text) => `=HYPERLINK("${String(url).replace(/"/g, '%22')}","${text}")`;
  record['Full submission PDF'] = pdfUrl ? link(pdfUrl, 'Open PDF') : '';
  for (const d of documents) record[`Doc: ${d.col}`] = d.na ? d.name : link(d.url, 'Open file');
  record['Declaration accepted'] = 'Yes';
  const peopleRows = people.map(p => ({ Reference: ref, Company: legalName, ...p }));
  const match = {
    invite: String(invite || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40),
    emails: [values.email, values.companyEmail].map(x => String(x || '').trim().toLowerCase()).filter(Boolean),
    ref, company: legalName,
  };

  try {
    await postToSheet({ record, people: peopleRows, emails, match });
    console.log('Submission logged and emailed', ref);
  } catch (e) {
    console.error(e.message);
    return res.status(502).json({ ok: false, error: 'We could not send your submission right now. Please try again in a minute.' });
  }

  return res.status(200).json({ ok: true, ref });
}
