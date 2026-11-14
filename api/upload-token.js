import crypto from 'node:crypto';

// Gives the browser a short-lived, signed ticket to upload documents straight to
// CompuAge's Google Drive (through the Apps Script web app). Each submission gets its own
// Drive folder up front, so nothing has to be moved file by file at the end.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const url = process.env.SHEET_WEBHOOK_URL, secret = process.env.SHEET_SECRET;
  if (!url || !secret) return res.status(500).json({ error: 'Uploads are not configured' });
  const session = crypto.randomBytes(9).toString('hex');
  const exp = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
  let folder = '';
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret, action: 'start', session }) });
    const d = await r.json().catch(() => null);
    if (d && d.ok && /^[A-Za-z0-9_-]{10,80}$/.test(d.folderId || '')) folder = d.folderId;
  } catch (e) { console.error('Could not create the upload folder', e.message); }
  const sig = crypto.createHmac('sha256', secret).update(`${session}.${exp}${folder ? `.${folder}` : ''}`).digest('hex');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ url, session, exp, sig, folder });
}
