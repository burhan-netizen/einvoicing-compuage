// Builds the branded submission PDF.
// mode 'internal': answers + every uploaded document appended as annexes (for CompuAge).
// mode 'supplier': answers only (the supplier's own copy).
import { readFileSync } from 'node:fs';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { SECTIONS, DECLARATION } from './schema.js';

const asset = name => readFileSync(new URL(`./assets/${name}`, import.meta.url));

const A4 = [595.28, 841.89];
const M = 48; // page margin
const C = {
  ink: rgb(0.08, 0.08, 0.08), ink2: rgb(0.29, 0.29, 0.29), muted: rgb(0.48, 0.48, 0.48),
  line: rgb(0.91, 0.9, 0.89), soft: rgb(0.965, 0.96, 0.953), brandSoft: rgb(1, 0.953, 0.925),
  brand: rgb(0.937, 0.353, 0.118), red: rgb(0.886, 0.137, 0.102), yellow: rgb(0.976, 0.647, 0.102),
  ok: rgb(0.075, 0.541, 0.322),
};

// Inter covers Latin, Greek and Cyrillic. Anything else (for example Arabic) is replaced so the PDF never fails.
function makeSanitiser(font) {
  return text => [...String(text ?? '')].map(ch => {
    if (ch === '\n' || ch === '\t') return ch;
    try { font.encodeText(ch); return ch; } catch { return '?'; }
  }).join('');
}

function wrap(text, font, size, width) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= width) { line = test; continue; }
      if (line) out.push(line);
      // Break very long words (emails, IDs) across lines.
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width) {
        let i = w.length;
        while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i--;
        out.push(w.slice(0, i)); w = w.slice(i);
      }
      line = w;
    }
    out.push(line);
  }
  return out;
}

const annexName = i => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
const uaeTime = iso => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export async function buildSubmissionPdf({ ref, submittedAt, values, rows, documents = [], mode = 'internal' }) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(asset('Inter-Regular.ttf'), { subset: true });
  const semi = await doc.embedFont(asset('Inter-SemiBold.ttf'), { subset: true });
  const bold = await doc.embedFont(asset('Inter-Bold.ttf'), { subset: true });
  const logo = await doc.embedPng(asset('compuage-logo.png'));
  const clean = makeSanitiser(regular);
  const legalName = clean(values.legalName);

  doc.setTitle(`${legalName} | UAE e-Invoicing (PEPPOL) Declaration | ${ref}`);
  doc.setAuthor('CompuAge Computers L.L.C.');
  doc.setSubject('UAE e-Invoicing (PEPPOL) Declaration');
  doc.setCreator('CompuAge Supplier Onboarding');
  doc.setCreationDate(new Date(submittedAt));

  const W = A4[0] - M * 2;
  let page, y;

  const brandBar = (p) => {
    const h = 4, third = A4[0] / 3;
    p.drawRectangle({ x: 0, y: A4[1] - h, width: third, height: h, color: C.red });
    p.drawRectangle({ x: third, y: A4[1] - h, width: third, height: h, color: C.brand });
    p.drawRectangle({ x: third * 2, y: A4[1] - h, width: third, height: h, color: C.yellow });
  };

  const newPage = (first = false) => {
    page = doc.addPage(A4);
    brandBar(page);
    const lw = first ? 150 : 104;
    const lh = (logo.height / logo.width) * lw;
    page.drawImage(logo, { x: M, y: A4[1] - 30 - lh, width: lw, height: lh });
    if (first) page.drawText('TRN: 100274488400003', { x: M, y: A4[1] - 30 - lh - 13, size: 8, font: semi, color: C.muted });
    if (first) {
      const t1 = 'UAE E-INVOICING (PEPPOL) DECLARATION';
      page.drawText(t1, { x: A4[0] - M - semi.widthOfTextAtSize(t1, 8.5), y: A4[1] - 44, size: 8.5, font: semi, color: C.brand });
      const t2 = 'Supplier onboarding';
      page.drawText(t2, { x: A4[0] - M - regular.widthOfTextAtSize(t2, 9.5), y: A4[1] - 58, size: 9.5, font: regular, color: C.ink2 });
      y = A4[1] - 30 - lh - 46;
    } else {
      const t = `${legalName}  |  ${ref}`;
      page.drawText(t, { x: A4[0] - M - regular.widthOfTextAtSize(t, 8.5), y: A4[1] - 30 - lh / 2 - 3, size: 8.5, font: regular, color: C.muted });
      y = A4[1] - 30 - lh - 24;
    }
  };
  const ensure = need => { if (y - need < 70) newPage(); };

  // ---------- cover ----------
  newPage(true);
  const nameLines = wrap(legalName, bold, 21, W);
  nameLines.forEach((l, i) => page.drawText(l, { x: M, y: y - i * 26, size: 21, font: bold, color: C.ink }));
  y -= (nameLines.length - 1) * 26;
  y -= 18;
  page.drawText(clean(mode === 'internal'
    ? 'Supplier declaration submitted for the UAE e-Invoicing (PEPPOL) rollout.'
    : 'Your copy of the information submitted to CompuAge Computers L.L.C.'), { x: M, y, size: 10.5, font: regular, color: C.ink2 });
  y -= 26;

  // Summary panel.
  const val = name => (rows.find(r => r.name === name) || {}).value || '';
  const location = [val('emirate'), val('country')].filter(Boolean).join(', ');
  const summary = [
    ['Reference', ref],
    ['Submitted', `${uaeTime(submittedAt)} (UAE)`],
    ['Registered in', location],
    ['UAE VAT TRN', val('trn') || (values.vatRegistered ? `Not provided (VAT: ${values.vatRegistered})` : '')],
    ['e-Invoicing phase', val('phase')],
    ['Authorised signatory', (values.signatories && values.signatories[0]) ? [values.signatories[0].fullName, values.signatories[0].designation].filter(Boolean).join(', ') + (values.signatories.length > 1 ? ` (+${values.signatories.length - 1})` : '') : [val('contactName'), val('designation')].filter(Boolean).join(', ')],
  ];
  const colW = (W - 32) / 2, rowH = 38;
  const panelH = Math.ceil(summary.length / 2) * rowH + 18;
  page.drawRectangle({ x: M, y: y - panelH, width: W, height: panelH, color: C.soft, borderColor: C.line, borderWidth: 0.8 });
  page.drawRectangle({ x: M, y: y - panelH, width: 3, height: panelH, color: C.brand });
  summary.forEach(([k, v], i) => {
    const cx = M + 16 + (i % 2) * (colW + 0) , cy = y - 22 - Math.floor(i / 2) * rowH;
    page.drawText(k.toUpperCase(), { x: cx, y: cy, size: 7.5, font: semi, color: C.muted });
    const vv = wrap(clean(v || 'Not provided'), semi, 10.5, colW - 12)[0];
    page.drawText(vv, { x: cx, y: cy - 14, size: 10.5, font: semi, color: v ? C.ink : C.muted });
  });
  y -= panelH + 26;

  // ---------- sections ----------
  const labelW = W * 0.42, valueX = M + labelW + 12, valueW = W - labelW - 12;
  const drawSectionTitle = title => {
    ensure(60);
    page.drawText(title.toUpperCase(), { x: M, y, size: 8.5, font: bold, color: C.brand });
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.8, color: C.line });
    y -= 16;
  };
  const drawRow = (label, value, opts = {}) => {
    const lLines = wrap(clean(label), regular, 9.5, labelW);
    const vLines = wrap(clean(value || 'Not provided'), opts.font || semi, 9.5, valueW);
    const h = Math.max(lLines.length, vLines.length) * 13;
    ensure(h + 12);
    lLines.forEach((l, i) => page.drawText(l, { x: M, y: y - i * 13, size: 9.5, font: regular, color: C.muted }));
    vLines.forEach((l, i) => page.drawText(l, { x: valueX, y: y - i * 13, size: 9.5, font: opts.font || semi, color: value ? (opts.color || C.ink) : C.muted }));
    y -= h + 4;
    page.drawLine({ start: { x: M, y: y + 2 }, end: { x: M + W, y: y + 2 }, thickness: 0.4, color: C.line, dashArray: [2, 2] });
    y -= 8;
  };

  for (const s of SECTIONS) {
    if (s.id === 'documents') continue;
    const sRows = rows.filter(r => r.section === s.title);
    if (!sRows.length) continue;
    drawSectionTitle(s.title);
    sRows.forEach(r => drawRow(r.label, r.value));
    y -= 10;
  }

  // Documents list.
  drawSectionTitle('Supporting documents');
  if (!documents.length) drawRow('Documents', 'None uploaded');
  documents.forEach(d => drawRow(d.label, d.note ? `${d.name}\n${d.note}` : d.name));
  y -= 10;

  // Declaration.
  const decl = wrap(clean(DECLARATION), regular, 9, W - 40);
  const by = `Accepted electronically by ${clean(values.contactName)}, ${clean(values.designation)}, on ${uaeTime(submittedAt)} (UAE time).`;
  const byLines = wrap(by, semi, 9, W - 40);
  const dh = 34 + decl.length * 12.5 + byLines.length * 12.5 + 10;
  ensure(dh + 10);
  page.drawRectangle({ x: M, y: y - dh, width: W, height: dh, color: C.brandSoft, borderColor: rgb(0.98, 0.84, 0.76), borderWidth: 0.8 });
  // Check mark.
  page.drawCircle({ x: M + 24, y: y - 22, size: 8, color: C.brand });
  page.drawLine({ start: { x: M + 20, y: y - 22 }, end: { x: M + 23, y: y - 25.5 }, thickness: 1.6, color: rgb(1, 1, 1) });
  page.drawLine({ start: { x: M + 23, y: y - 25.5 }, end: { x: M + 28.5, y: y - 18.5 }, thickness: 1.6, color: rgb(1, 1, 1) });
  page.drawText('Supplier declaration', { x: M + 40, y: y - 25.5, size: 10.5, font: bold, color: C.ink });
  let dy = y - 44;
  decl.forEach(l => { page.drawText(l, { x: M + 40, y: dy, size: 9, font: regular, color: C.ink2 }); dy -= 12.5; });
  dy -= 4;
  byLines.forEach(l => { page.drawText(l, { x: M + 40, y: dy, size: 9, font: semi, color: C.ink }); dy -= 12.5; });
  y -= dh + 10;

  const formPages = doc.getPageCount();

  // ---------- annexes ----------
  const annexStart = [];
  const annexNames = [];
  let annexCount = 0;
  const failed = [];
  if (mode === 'internal') {
    for (let i = 0; i < documents.length; i++) {
      const d = documents[i];
      if (d.na) { annexStart.push(null); annexNames.push(null); continue; }
      if (!d.bytes) { failed.push(d); annexStart.push(null); annexNames.push(null); continue; }
      const an = annexName(annexCount++);
      annexNames.push(an);
      const tag = clean(`Annex ${an}: ${d.label}`);
      const start = doc.getPageCount() + 1;
      try {
        // Every annex page is a clean A4 page: brand bar, annex title, then the document scaled to fit.
        const annexPage = (subtitle) => {
          const p = doc.addPage(A4);
          brandBar(p);
          p.drawText(tag, { x: M, y: A4[1] - 40, size: 11, font: bold, color: C.ink });
          p.drawText(clean(subtitle), { x: M, y: A4[1] - 55, size: 8.5, font: regular, color: C.muted });
          const foot = `${legalName}  |  ${ref}`;
          p.drawText(foot, { x: M, y: 26, size: 7.5, font: regular, color: C.muted });
          return p;
        };
        const place = (p, w, h, draw) => {
          const maxW = W, maxH = A4[1] - 72 - 50;
          const s = Math.min(maxW / w, maxH / h, 1.5);
          const iw = w * s, ih = h * s, x = (A4[0] - iw) / 2, yy = A4[1] - 68 - ih;
          p.drawRectangle({ x: x - 1, y: yy - 1, width: iw + 2, height: ih + 2, borderColor: C.line, borderWidth: 1 });
          draw({ x, y: yy, width: iw, height: ih });
        };
        if (d.contentType === 'application/pdf') {
          const src = await PDFDocument.load(d.bytes, { ignoreEncryption: true });
          const embedded = await doc.embedPdf(src, src.getPageIndices());
          embedded.forEach((ep, k) => {
            const p = annexPage(`${d.name}  |  page ${k + 1} of ${embedded.length}`);
            place(p, ep.width, ep.height, box => p.drawPage(ep, box));
          });
        } else {
          const img = d.contentType === 'image/png' ? await doc.embedPng(d.bytes) : await doc.embedJpg(d.bytes);
          const p = annexPage(d.name);
          place(p, img.width, img.height, box => p.drawImage(img, box));
        }
        annexStart.push(start);
      } catch (e) {
        console.error('Could not append document', d.label, e.message);
        failed.push(d); annexStart.push(null);
      }
    }
  }

  // ---------- footers and annex page numbers ----------
  const total = doc.getPageCount();
  doc.getPages().forEach((p, i) => {
    if (i >= formPages) return; // annex pages keep their own look
    const f = `CompuAge Computers L.L.C.  |  UAE e-Invoicing (PEPPOL) Declaration  |  ${ref}`;
    p.drawLine({ start: { x: M, y: 44 }, end: { x: A4[0] - M, y: 44 }, thickness: 0.6, color: C.line });
    p.drawText(f, { x: M, y: 30, size: 7.5, font: regular, color: C.muted });
    const pn = `Page ${i + 1} of ${total}`;
    p.drawText(pn, { x: A4[0] - M - regular.widthOfTextAtSize(pn, 7.5), y: 30, size: 7.5, font: regular, color: C.muted });
  });

  return { bytes: await doc.save(), annexStart, annexNames, failed, formPages, total };
}

// Annex page numbers are only known after the documents are appended, so build once to learn them,
// then again with the references printed in the documents list.
export async function buildInternalPdf(args) {
  const first = await buildSubmissionPdf({ ...args, mode: 'internal' });
  const documents = args.documents.map((d, i) => ({
    ...d,
    note: d.na ? '' : first.annexStart[i] ? `Annex ${first.annexNames[i]}, page ${first.annexStart[i]}` : 'Attached to the email separately',
  }));
  const second = await buildSubmissionPdf({ ...args, documents, mode: 'internal' });
  return { ...second, documents };
}
