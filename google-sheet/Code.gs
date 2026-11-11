// Paste into Extensions > Apps Script of the Google Sheet, then Deploy > New deployment > Web app
// (Execute as: Me, Who has access: Anyone). Copy the Web app URL into Vercel as SHEET_WEBHOOK_URL.
// Optional: set SECRET below and the same value in Vercel as SHEET_SECRET.
const SECRET = '';
const SHEET_NAME = 'Submissions';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const data = JSON.parse(e.postData.contents);
    if (SECRET && data.secret !== SECRET) return json({ ok: false, error: 'unauthorised' });
    const record = data.record || {};
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    let headers = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
    const missing = Object.keys(record).filter(k => headers.indexOf(k) === -1);
    if (missing.length) {
      sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
      headers = headers.concat(missing);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#fff3ec');
      sheet.setFrozenRows(1);
    }
    const row = headers.map(h => (record[h] == null ? '' : String(record[h])));
    sheet.appendRow(row);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
