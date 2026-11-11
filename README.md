# CompuAge supplier e-Invoicing onboarding form

Static form (public/) with two Vercel functions (api/). Questions live in lib/schema.js.

## Environment variables (Vercel > Project > Settings > Environment Variables)

| Name | Value |
| --- | --- |
| RESEND_API_KEY | Resend API key |
| MAIL_FROM | Sender on a domain verified in Resend, e.g. `CompuAge Supplier Onboarding <suppliers@magolabs.in>` |
| MAIL_TO | `accounts@compuagedubai.com` (comma separate for more) |
| SHEET_WEBHOOK_URL | Apps Script web app URL (see google-sheet/Code.gs) |
| SHEET_SECRET | Optional, must match SECRET in Code.gs |
| SEND_SUPPLIER_COPY | `false` to stop sending the supplier a copy |
| BLOB_READ_WRITE_TOKEN | Added automatically when a Blob store is connected (Storage > Create > Blob) |

## Local build

npm install && npm run build
