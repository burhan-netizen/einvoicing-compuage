// Paste into Extensions > Apps Script of the Google Sheet, then Deploy > New deployment > Web app
// (Execute as: Me, Who has access: Anyone). Copy the Web app URL into Vercel as SHEET_WEBHOOK_URL,
// and put the same password as SECRET below into Vercel as SHEET_SECRET.
// After changing this code: Deploy > Manage deployments > pencil > Version: New version > Deploy (the URL stays the same).
const SECRET = 'CHANGE-ME'; // use the same value as SHEET_SECRET in Vercel
const SHEET_NAME = 'Submissions';
const PEOPLE_SHEET = 'People';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const data = JSON.parse(e.postData.contents);
    if (SECRET && data.secret !== SECRET) return json({ ok: false, error: 'unauthorised' });
    appendRecord(SHEET_NAME, data.record || {});
    (data.people || []).forEach(p => appendRecord(PEOPLE_SHEET, p));
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Quick health check: opening the /exec link in a browser shows this.
function doGet() {
  return json({ ok: true, message: 'CompuAge supplier sheet is connected.' });
}

function appendRecord(name, record) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  let headers = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  const missing = Object.keys(record).filter(k => headers.indexOf(k) === -1);
  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#fff3ec');
    sheet.setFrozenRows(1);
  }
  sheet.appendRow(headers.map(h => (record[h] == null ? '' : String(record[h]))));
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
