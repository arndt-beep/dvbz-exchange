/**
 * DVBZ Exchange · Punkte-Abgleich aus dem Vertriebscontrolling
 * Liegt im Google Sheet "Vertriebscontrolling Gideon" unter Erweiterungen → Apps Script.
 *
 * Liest die Blätter "Auswertung Team <Monat> <Jahr>" (Zeilen "Anträge eingereicht", "Abschlüsse",
 * "Weiterempfehlungen", Namen in der Zeile "Mitarbeiter") und schickt die Monatsstände an Supabase.
 * Supabase bucht nur den Zuwachs seit dem letzten Lauf (1 P Antrag, 3 P Abschluss, 2 P Empfehlung).
 *
 * Einmalig: Projekteinstellungen → Skripteigenschaften → SYNC_TOKEN = Abgleich-Schlüssel.
 * Funktionen:
 *   testLesen()        – liest nur und zeigt im Protokoll, was geschickt würde
 *   startpunktSetzen() – merkt sich die aktuellen Stände, ohne Punkte zu buchen (am Launch-Tag)
 *   syncPunkte()       – bucht den Zuwachs (läuft täglich automatisch)
 *   taeglichEinrichten() – legt den täglichen Lauf um 21 Uhr an
 */
const SUPABASE_URL = 'https://tgxgroelyakrqbibbgvn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRneGdyb2VseWFrcnFiaWJiZ3ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyNzU1MzIsImV4cCI6MjEwODg1MTUzMn0.E-8LX2NMdkfxox4qJYO9ALFD5e2NQYuq7uKkRJ2Kp-w'; // öffentlicher Schlüssel der Website
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const ZEILEN = { submitted: 'anträge eingereicht', closings: 'abschlüsse', referrals: 'weiterempfehlungen' };

/** Die zwei neuesten Auswertungsblätter (laufender und vorheriger Monat, falls noch nachgetragen wird). */
function aktuelleBlaetter_() {
  const out = [];
  for (const sh of SpreadsheetApp.getActive().getSheets()) {
    const m = sh.getName().trim().match(/^Auswertung Team (\S+) (\d{4})$/);
    if (!m) continue;
    const idx = MONATE.indexOf(m[1]);
    if (idx < 0) continue;
    out.push({ sheet: sh, period: m[2] + '-' + String(idx + 1).padStart(2, '0') });
  }
  out.sort((a, b) => b.period.localeCompare(a.period));
  return out.slice(0, 2);
}

function zahl_(v) {
  if (typeof v === 'number') return v;
  const n = Number(String(v || '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : 0;
}

/** Liest ein Auswertungsblatt in [{name, submitted, closings, referrals}]. */
function lesen_(sheet) {
  const v = sheet.getDataRange().getValues();
  const label = r => String(v[r][0] || '').trim().toLowerCase();
  const nameRow = v.findIndex((row, r) => label(r).startsWith('mitarbeiter'));
  if (nameRow < 0) throw new Error('Zeile "Mitarbeiter" nicht gefunden in ' + sheet.getName());
  const rowOf = key => v.findIndex((row, r) => label(r) === ZEILEN[key]);
  const rows = { submitted: rowOf('submitted'), closings: rowOf('closings'), referrals: rowOf('referrals') };
  for (const k in rows) if (rows[k] < 0) throw new Error('Zeile "' + ZEILEN[k] + '" nicht gefunden in ' + sheet.getName());
  const out = [];
  for (let c = 2; c < v[nameRow].length; c++) {
    const name = String(v[nameRow][c] || '').trim();
    if (!name) continue;
    out.push({ name, submitted: zahl_(v[rows.submitted][c]), closings: zahl_(v[rows.closings][c]), referrals: zahl_(v[rows.referrals][c]) });
  }
  return out;
}

function senden_(period, rows, baseline) {
  const token = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
  if (!token) throw new Error('Skripteigenschaft SYNC_TOKEN fehlt.');
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/sync_metrics', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY },
    payload: JSON.stringify({ p_token: token, p_period: period, p_rows: rows, p_baseline: !!baseline })
  });
  if (res.getResponseCode() >= 300) throw new Error('Supabase ' + res.getResponseCode() + ': ' + res.getContentText());
  return JSON.parse(res.getContentText());
}

function lauf_(baseline) {
  const log = [];
  for (const b of aktuelleBlaetter_()) {
    const r = senden_(b.period, lesen_(b.sheet), baseline);
    log.push(b.period + ': ' + (baseline ? 'Startpunkt gesetzt' : r.bookings + ' Buchungen, ' + r.points + ' P')
      + (r.unmatched && r.unmatched.length ? ' · nicht zugeordnet: ' + r.unmatched.join(', ') : ''));
  }
  const text = new Date().toLocaleString('de-DE') + ' · ' + log.join(' | ');
  PropertiesService.getScriptProperties().setProperty('LETZTER_LAUF', text);
  console.log(text);
  return text;
}

function syncPunkte() { return lauf_(false); }
function startpunktSetzen() { return lauf_(true); }

function testLesen() {
  for (const b of aktuelleBlaetter_()) {
    const rows = lesen_(b.sheet);
    console.log(b.sheet.getName() + ' → ' + b.period + ' · ' + rows.length + ' Personen');
    rows.forEach(r => console.log('  ' + r.name + ': ' + r.submitted + ' eingereicht, ' + r.closings + ' Abschlüsse, ' + r.referrals + ' Empfehlungen'));
  }
}

function taeglichEinrichten() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncPunkte').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncPunkte').timeBased().everyDays(1).atHour(21).inTimezone('Europe/Berlin').create();
  console.log('Täglicher Abgleich um 21 Uhr eingerichtet.');
}
