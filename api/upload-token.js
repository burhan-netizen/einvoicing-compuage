import crypto from 'node:crypto';

// Gives the browser a short-lived, signed ticket to upload documents straight to
// CompuAge's Google Drive (through the Apps Script web app). The script checks the signature.
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const url = process.env.SHEET_WEBHOOK_URL, secret = process.env.SHEET_SECRET;
  if (!url || !secret) return res.status(500).json({ error: 'Uploads are not configured' });
  const session = crypto.randomBytes(9).toString('hex');
  const exp = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
  const sig = crypto.createHmac('sha256', secret).update(`${session}.${exp}`).digest('hex');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ url, session, exp, sig });
}
