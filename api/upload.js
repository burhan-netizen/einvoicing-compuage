import { handleUpload } from '@vercel/blob/client';
import { FILE_TYPES, MAX_FILE_MB } from '../lib/schema.js';

// Issues short-lived client upload tokens so documents go straight from the browser to Vercel Blob.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const json = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async pathname => {
        if (!/^suppliers\/[a-z0-9-]+\/(tradeLicenceFile|vatCertFile|ctCertFile|ejariFile|(owners|signatories|accountDept)\.\d{1,2}\.(passport|visa|eid))-\d\.(pdf|jpg|jpeg|png)$/.test(pathname)) {
          throw new Error('Invalid file name');
        }
        return {
          allowedContentTypes: FILE_TYPES,
          maximumSizeInBytes: MAX_FILE_MB * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(json);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}
