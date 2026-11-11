import { SECTIONS, DECLARATION, validate, summaryRows, isShown, isRequired } from '../lib/schema.js';
import { COUNTRIES } from '../src/countries.js';

const byCode = Object.fromEntries(COUNTRIES.map(c => [c.code, c.name]));
const countryName = code => byCode[code] || code;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FILE_FIELDS = SECTIONS.flatMap(s => s.fields.filter(f => f.type === 'file'));
const BLOB_HOST = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//i;

function makeRef() {
  const d = new Date();
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CA-SUP-${ymd}-${rand}`;
}

function emailHtml({ title, intro, rows, docs, ref, origin }) {
  const groups = [];
  for (const r of rows) {
    let g = groups.find(x => x.section === r.section);
    if (!g) groups.push(g = { section: r.section, rows: [] });
    g.rows.push(r);
  }
  const table = groups.map(g => `
    <tr><td colspan="2" style="padding:22px 0 8px;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ef5a1e">${esc(g.section)}</td></tr>
    ${g.rows.map(r => `<tr>
      <td style="padding:9px 12px 9px 0;border-bottom:1px solid #eeeae6;color:#7a7a7a;font-size:14px;width:44%;vertical-align:top">${esc(r.label)}</td>
      <td style="padding:9px 0;border-bottom:1px solid #eeeae6;color:#141414;font-size:14px;font-weight:600;vertical-align:top;white-space:pre-line">${r.value ? esc(r.value) : '<span style="color:#b0aca7;font-weight:400">Not provided</span>'}</td>
    </tr>`).join('')}`).join('');
  const docRows = docs.length ? `
    <tr><td colspan="2" style="padding:22px 0 8px;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ef5a1e">Supporting documents</td></tr>
    ${docs.map(d => `<tr>
      <td style="padding:9px 12px 9px 0;border-bottom:1px solid #eeeae6;color:#7a7a7a;font-size:14px">${esc(d.label)}</td>
      <td style="padding:9px 0;border-bottom:1px solid #eeeae6;font-size:14px;font-weight:600">${d.url ? `<a href="${esc(d.url)}" style="color:#ef5a1e">${esc(d.name)}</a>` : esc(d.name)}</td>
    </tr>`).join('')}` : '';
  return `<!doctype html><html><body style="margin:0;background:#f6f5f3;font-family:Arial,Helvetica,sans-serif;color:#141414">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f3;padding:28px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e7e5e2;border-radius:14px;overflow:hidden">
      <tr><td style="height:4px;background:linear-gradient(90deg,#e2231a,#ef5a1e,#f9a51a);background-color:#ef5a1e"></td></tr>
      <tr><td style="padding:24px 28px 8px"><img src="${origin}/compuage-logo.png" alt="CompuAge Computers L.L.C." height="40" style="display:block;height:40px;width:auto"></td></tr>
      <tr><td style="padding:12px 28px 4px">
        <h1 style="margin:0 0 8px;font-size:21px;line-height:1.3">${esc(title)}</h1>
        <p style="margin:0;color:#4a4a4a;font-size:14.5px;line-height:1.55">${intro}</p>
        <p style="margin:14px 0 0;display:inline-block;background:#f6f5f3;border:1px solid #e7e5e2;border-radius:8px;padding:7px 12px;font-size:13px;font-weight:700">Reference: ${esc(ref)}</p>
      </td></tr>
      <tr><td style="padding:4px 28px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${table}${docRows}
        <tr><td colspan="2" style="padding:22px 0 8px;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ef5a1e">Supplier declaration</td></tr>
        <tr><td colspan="2" style="padding:4px 0 0;font-size:13px;color:#4a4a4a;line-height:1.55">&#10003; Confirmed and agreed: ${esc(DECLARATION)}</td></tr>
      </table></td></tr>
      <tr><td style="padding:16px 28px 22px;border-top:1px solid #eeeae6;font-size:12px;color:#7a7a7a">CompuAge Computers L.L.C. &middot; UAE e-Invoicing supplier onboarding</td></tr>
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
  const values = { ...raw };
  for (const f of FILE_FIELDS) {
    const up = fileByField[f.name];
    if (up && !BLOB_HOST.test(String(up.url))) return res.status(400).json({ ok: false, error: 'Invalid document link.' });
    values[f.name] = up ? true : null;
  }
  const errors = validate(values);
  if (!values.declaration) errors.declaration = 'Declaration not accepted';
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, error: 'Some required details are missing. Please review the form.', errors });

  const ref = makeRef();
  const submittedAt = new Date().toISOString();
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const rows = summaryRows(values, countryName);
  const docs = FILE_FIELDS.filter(f => fileByField[f.name]).map(f => ({ label: f.label, ...fileByField[f.name] }));
  const legalName = String(values.legalName).trim();

  // Attach the documents to the accounts email.
  const attachments = [];
  for (const d of docs) {
    try {
      const r = await fetch(d.url);
      if (!r.ok) throw new Error(String(r.status));
      const buf = Buffer.from(await r.arrayBuffer());
      const ext = d.url.split('?')[0].split('.').pop();
      attachments.push({ filename: `${legalName} - ${d.label}.${ext}`.replace(/[\\/:*?"<>|]/g, ''), content: buf.toString('base64') });
    } catch (e) {
      console.error('Attachment fetch failed', d.field, e.message);
    }
  }

  const from = process.env.MAIL_FROM || 'CompuAge Supplier Onboarding <onboarding@resend.dev>';
  const to = (process.env.MAIL_TO || 'accounts@compuagedubai.com').split(',').map(s => s.trim()).filter(Boolean);

  try {
    await sendEmail({
      from, to,
      reply_to: String(values.email).trim(),
      subject: `${legalName} | Supplier e-Invoicing form (${ref})`,
      html: emailHtml({ title: legalName, ref, origin, rows, docs,
        intro: `A new supplier e-Invoicing onboarding form was submitted on ${new Date(submittedAt).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short' })} (UAE time). The supporting documents are attached.` }),
      attachments,
    });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ ok: false, error: 'We could not send your submission right now.' });
  }

  // Everything below is best effort: the submission is already safely with the accounts team.
  const tasks = [];
  if (process.env.SHEET_WEBHOOK_URL) {
    const record = { Reference: ref, 'Submitted at (UAE)': new Date(submittedAt).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' }) };
    for (const s of SECTIONS) for (const f of s.fields) {
      if (f.type === 'file') { const d = fileByField[f.name]; record[f.label] = d ? d.url : ''; continue; }
      // Some labels repeat across UAE and non-UAE variants of a question: keep whichever was answered.
      const row = rows.find(r => r.name === f.name);
      if (!record[f.label]) record[f.label] = row ? row.value : '';
    }
    record['Declaration accepted'] = 'Yes';
    tasks.push(fetch(process.env.SHEET_WEBHOOK_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.SHEET_SECRET || '', record }),
    }).then(r => { if (!r.ok) console.error('Sheet webhook failed', r.status); }).catch(e => console.error('Sheet webhook failed', e.message)));
  }
  if (process.env.SEND_SUPPLIER_COPY !== 'false') {
    tasks.push(sendEmail({
      from, to: [String(values.email).trim()], reply_to: to[0],
      subject: `We received your supplier e-Invoicing form (${ref})`,
      html: emailHtml({ title: 'Thank you, we have received your details', ref, origin, rows, docs: docs.map(d => ({ label: d.label, name: d.name })),
        intro: `Dear ${esc(values.contactName)}, thank you for completing the CompuAge supplier e-Invoicing form for <b>${esc(legalName)}</b>. A copy of your answers is below for your records. If anything changes, please write to <a href="mailto:${esc(to[0])}" style="color:#ef5a1e">${esc(to[0])}</a>.` }),
    }).catch(e => console.error('Supplier copy failed', e.message)));
  }
  await Promise.all(tasks);

  return res.status(200).json({ ok: true, ref });
}
