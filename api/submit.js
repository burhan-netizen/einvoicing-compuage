import { SECTIONS, GROUPS, validate, summaryRows, peopleRecords, groupItems } from '../lib/schema.js';
import { buildInternalPdf, buildSubmissionPdf } from '../lib/pdf.js';
import { COUNTRIES } from '../src/countries.js';

const byCode = Object.fromEntries(COUNTRIES.map(c => [c.code, c.name]));
const countryName = code => byCode[code] || code;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FILE_FIELDS = SECTIONS.flatMap(s => s.fields.filter(f => f.type === 'file'));
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
      <tr><td style="padding:24px 28px 6px"><img src="${origin}/compuage-logo.png" alt="CompuAge Computers L.L.C." height="38" style="display:block;height:38px;width:auto"></td></tr>
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

async function sendEmail(payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Email failed (${r.status}): ${await r.text()}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const { values: raw = {}, files = [], hp } = req.body || {};
  if (hp) return res.status(200).json({ ok: true, ref: makeRef() }); // bot honeypot

  // Server-side validation mirrors the browser. Document fields are judged only by what was actually uploaded.
  const fileByField = Object.fromEntries((Array.isArray(files) ? files : []).map(f => [f.field, f]));
  for (const up of Object.values(fileByField)) {
    if (!BLOB_HOST.test(String(up.url))) return res.status(400).json({ ok: false, error: 'Invalid document link.' });
  }
  const values = { ...raw };
  for (const f of FILE_FIELDS) values[f.name] = fileByField[f.name] ? true : null;
  // People groups: keep at most 50 per group, and judge their ID uploads by what was actually uploaded.
  for (const g of GROUPS()) {
    values[g.name] = (Array.isArray(raw[g.name]) ? raw[g.name] : []).slice(0, 50).map((it, i) => {
      const item = { ...it };
      g.fields.forEach(sf => { if (sf.type === 'file') item[sf.name] = fileByField[`${g.name}.${i}.${sf.name}`] ? true : null; });
      return item;
    });
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
  const docSpecs = FILE_FIELDS.map(f => ({ key: f.name, label: f.label }));
  for (const g of GROUPS()) groupItems(values, g).forEach((it, i) => g.fields.forEach(sf => {
    if (sf.type === 'file') docSpecs.push({ key: `${g.name}.${i}.${sf.name}`, label: `${sf.label}: ${it.fullName || it.name || `${g.itemLabel} ${i + 1}`}` });
  }));
  for (const f of docSpecs) {
    const up = fileByField[f.key];
    if (!up) continue;
    let bytes = null;
    try {
      const r = await fetch(up.url);
      if (!r.ok) throw new Error(String(r.status));
      bytes = new Uint8Array(await r.arrayBuffer());
    } catch (e) { console.error('Document download failed', f.name, e.message); }
    const ext = String(up.url).split('?')[0].split('.').pop().toLowerCase();
    const contentType = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg';
    documents.push({ field: f.key, label: f.label, name: up.name || `${f.label}.${ext}`, url: up.url, ext, contentType, bytes });
  }

  // Build the PDFs. If anything goes wrong here, the email still goes out with the original documents.
  const baseName = safeFile(`${legalName} - ${FORM_NAME} - ${ref}`);
  let internal = null, supplierPdf = null;
  try {
    internal = await buildInternalPdf({ ref, submittedAt, values, rows, documents });
  } catch (e) { console.error('Internal PDF failed', e); }
  try {
    supplierPdf = (await buildSubmissionPdf({ ref, submittedAt, values, rows, documents: documents.map(({ label, name }) => ({ label, name })), mode: 'supplier' })).bytes;
  } catch (e) { console.error('Supplier PDF failed', e); }

  const attachments = [];
  if (internal) attachments.push({ filename: `${baseName}.pdf`, content: Buffer.from(internal.bytes).toString('base64') });
  // Any document that could not be merged into the PDF (or every document, if the PDF failed) is attached as is.
  documents.forEach((d, i) => {
    const merged = internal && internal.documents[i] && !/separately/.test(internal.documents[i].note);
    if (!merged && d.bytes) attachments.push({ filename: safeFile(`${legalName} - ${d.label}.${d.ext}`), content: Buffer.from(d.bytes).toString('base64') });
  });

  const from = process.env.MAIL_FROM || 'CompuAge Supplier Onboarding <onboarding@resend.dev>';
  const to = (process.env.MAIL_TO || 'accounts@compuagedubai.com').split(',').map(s => s.trim()).filter(Boolean);
  const facts = [
    ['Reference', ref],
    ['Submitted', `${uaeTime(submittedAt)} (UAE)`],
    ['Registered in', [val('emirate'), val('country')].filter(Boolean).join(', ')],
    ['Free Zone / authority', val('freeZoneUae') || val('freeZoneOther') || val('freeZoneName') || val('licensingAuthority') || val('licensingAuthorityOther') || val('licensingAuthorityText')],
    ['UAE VAT TRN', val('trn') || `Not registered (${val('vatRegistered')})`],
    ['e-Invoicing phase', val('phase')],
    ['Authorised signatory', (values.signatories || []).map(x => `${x.fullName}, ${x.designation}`).join('; ')],
    ['Primary contact', `${val('contactName')}, ${val('designation')}`],
    ['Email / phone', `${val('email')}  |  ${val('phone')}`],
  ];

  try {
    await sendEmail({
      from, to,
      reply_to: String(values.email).trim(),
      subject: `${legalName} | ${FORM_NAME} (${ref})`,
      html: emailHtml({ origin, eyebrow: 'New supplier submission', title: legalName, facts,
        intro: `A supplier has completed the ${FORM_NAME}. The key details are below.`,
        note: internal
          ? `The full submission is attached as one PDF: <b>${esc(baseName)}.pdf</b>. It contains every answer, the signed declaration and the supporting documents as annexes.`
          : 'The supporting documents are attached. The summary PDF could not be generated this time, so please refer to the details above.' }),
      attachments,
    });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ ok: false, error: 'We could not send your submission right now.' });
  }

  // Everything below is best effort: the submission is already safely with CompuAge.
  const tasks = [];
  if (process.env.SHEET_WEBHOOK_URL) {
    const record = { Reference: ref, 'Submitted at (UAE)': new Date(submittedAt).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' }) };
    for (const s of SECTIONS) for (const f of s.fields) {
      if (f.type === 'group') continue;
      if (f.type === 'file') { const d = fileByField[f.name]; record[f.label] = d ? d.url : ''; continue; }
      // Some labels repeat across UAE and non-UAE variants of a question: keep whichever was answered.
      const row = rows.find(r => r.name === f.name);
      if (!record[f.label]) record[f.label] = row ? row.value : '';
    }
    const { cells, people } = peopleRecords(values, countryName);
    Object.assign(record, cells);
    documents.filter(d => d.field.includes('.')).forEach(d => { record[d.label] = d.url; });
    record['Declaration accepted'] = 'Yes';
    const peopleRows = people.map(p => ({ Reference: ref, Company: legalName, ...p }));
    tasks.push(fetch(process.env.SHEET_WEBHOOK_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.SHEET_SECRET || '', record, people: peopleRows }),
    }).then(async r => {
      const text = await r.text().catch(() => '');
      if (!r.ok || !/"ok":\s*true/.test(text)) console.error('Sheet webhook failed', r.status, text.slice(0, 300));
      else console.log('Sheet row added', ref);
    }).catch(e => console.error('Sheet webhook failed', e.message)));
  } else {
    console.warn('SHEET_WEBHOOK_URL is not set, so no sheet row was added');
  }
  if (process.env.SEND_SUPPLIER_COPY !== 'false') {
    tasks.push(sendEmail({
      from, to: [String(values.email).trim()], reply_to: to[0],
      subject: `Your ${FORM_NAME} has been received (${ref})`,
      html: emailHtml({ origin, eyebrow: 'Submission received', title: 'Thank you, we have received your details',
        intro: `Dear ${esc(values.contactName)}, thank you for completing the ${FORM_NAME} for <b>${esc(legalName)}</b>. Our team will review the information and update your supplier record.`,
        facts: [['Reference', ref], ['Submitted', `${uaeTime(submittedAt)} (UAE)`], ['Company', legalName]],
        note: supplierPdf
          ? `A copy of your answers is attached as a PDF for your records. If anything changes, please reply to this email.`
          : 'If anything changes, please reply to this email.' }),
      attachments: supplierPdf ? [{ filename: `${baseName}.pdf`, content: Buffer.from(supplierPdf).toString('base64') }] : [],
    }).catch(e => console.error('Supplier copy failed', e.message)));
  }
  await Promise.all(tasks);

  return res.status(200).json({ ok: true, ref });
}
