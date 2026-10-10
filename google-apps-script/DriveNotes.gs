/**
 * DriveNotes.gs  —  Google Apps Script backend for "Notes -> Google Drive"
 * -----------------------------------------------------------------------------
 * This script receives notes from your portfolio's toolbox and appends them to
 * a single Google Docs document stored in your Drive. Nothing is overwritten.
 *
 * ONE-TIME SETUP (about 2 minutes):
 *
 *  1. Create your doc:  https://docs.new  and give it a name, e.g. "Portfolio Notes".
 *     Copy the DOCUMENT ID from the URL:
 *       https://docs.google.com/document/d/<<DOCUMENT_ID>>/edit
 *
 *  2. Go to https://script.google.com  ->  New project.
 *     Replace everything with the code below and set DOC_ID to your id.
 *
 *  3. Deploy  ->  New deployment
 *       - Type:        Web app
 *       - Description: Portfolio Notes
 *       - Execute as:  Me
 *       - Who has access:  Anyone          <-- important
 *     Click Deploy and copy the Web app URL (ends in /exec).
 *
 *  4. In the toolbox  ->  "Notes -> Drive"  tab  ->  expand
 *     "Connect your Google Drive Doc (one-time setup)"  ->  paste the URL
 *     ->  Save URL.
 *
 *  NOTE: because it is deployed as "Anyone", anyone with the link can append
 *  notes to this doc. That is expected for a public portfolio. For extra
 *  privacy, change "Who has access" to "Anyone with Google account" and the
 *  site will need to add user sign-in.
 */

const DOC_ID = 'PASTE_YOUR_GOOGLE_DOC_ID_HERE';

/** Entry point the browser POSTs to. */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const doc = DocumentApp.openById(DOC_ID);
    const body = doc.getBody();

    const stamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd HH:mm:ss'
    );

    // Heading line: [timestamp] Title
    const head = body.appendParagraph('[' + stamp + '] ' + (data.title || 'Note'));
    head.setHeading(DocumentApp.ParagraphHeading.HEADING2);

    // The actual note text
    const lines = String(data.text || '').split('\n');
    for (let i = 0; i < lines.length; i++) {
      body.appendParagraph(lines[i]);
    }
    body.appendParagraph(''); // spacer

    doc.saveAndClose();

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/** Optional: allows a GET /exec?ping=1 connectivity check from the site. */
function doGet() {
  return json({ ok: true, service: 'portfolio-notes', doc: DOC_ID });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
