/* =====================================================================
   RUFIX BARBER — Mini-backend (Google Apps Script + Google Sheet)
   =====================================================================
   Rôle : stocker les demandes de rendez-vous dans un Google Sheet pour
   que les créneaux pris disparaissent AUTOMATIQUEMENT du site, pour tous
   les visiteurs. Le salon reste en confirmation manuelle : une demande
   arrive avec le statut « En attente » et bloque déjà le créneau.

   👉 Installation détaillée : voir le fichier BACKEND-GOOGLE-SHEET.md.

   Résumé :
     1. Crée un Google Sheet avec, en ligne 1, ces en-têtes (colonnes A→J) :
        Horodatage | Date | Heure | Service | DureeMin | Prenom | Nom | Telephone | Email | Statut
     2. Extensions → Apps Script, colle ce code.
     3. Déployer → Nouveau déploiement → type « Application Web »
        - Exécuter en tant que : moi
        - Qui a accès : Tout le monde
     4. Copie l'URL /exec et colle-la dans js/config.js → backend.url
   ===================================================================== */

var SHEET_NAME = "Reservations";   // nom de l'onglet du Google Sheet
var PAS_MIN = 15;                  // pas des créneaux (doit correspondre à config.js)

/* ---------- Petits utilitaires ---------- */
function pad2(n) { return (n < 10 ? "0" : "") + n; }

function normDate(v, tz) {
  // Google Sheets peut convertir "2026-07-14" en objet Date : on re-normalise.
  return (v instanceof Date) ? Utilities.formatDate(v, tz, "yyyy-MM-dd") : String(v).trim();
}
function normTime(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, "HH:mm");
  var p = String(v).trim().split(":");
  return p.length >= 2 ? pad2(parseInt(p[0], 10)) + ":" + pad2(parseInt(p[1], 10)) : String(v).trim();
}

// Développe une réservation en tous les créneaux de 15 min qu'elle occupe.
// Ex : 11:00 pour 45 min -> ["11:00","11:15","11:30"].
function slotsForBooking(heure, dureeMin) {
  var n = Math.max(1, Math.ceil(Number(dureeMin) / PAS_MIN));
  var parts = String(heure).split(":");
  var start = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  var out = [];
  for (var k = 0; k < n; k++) {
    var t = start + k * PAS_MIN;
    out.push(pad2(Math.floor(t / 60)) + ":" + pad2(t % 60));
  }
  return out;
}

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

// Renvoie un objet { "AAAA-MM-JJ": Set(["11:00", ...]) } des créneaux occupés,
// en ignorant les lignes annulées/refusées.
function occupiedMap() {
  var sheet = getSheet();
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  var rows = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < rows.length; i++) {         // i=1 : on saute l'en-tête
    var dateISO = normDate(rows[i][1], tz);       // colonne B
    var heure   = normTime(rows[i][2], tz);       // colonne C
    var dureeMin = rows[i][4];                     // colonne E
    var statut  = String(rows[i][9] || "").toLowerCase(); // colonne J
    if (!dateISO || !heure) continue;
    if (statut.indexOf("annul") === 0 || statut.indexOf("refus") === 0) continue;
    if (!map[dateISO]) map[dateISO] = {};
    slotsForBooking(heure, dureeMin).forEach(function (s) { map[dateISO][s] = true; });
  }
  return map;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =====================================================================
   GET : le site demande les créneaux déjà pris.
   - ?date=AAAA-MM-JJ  -> { ok:true, occupied:["11:00","11:15",...] }
   - sans paramètre    -> { ok:true, occupied:["AAAA-MM-JJ HH:MM", ...] }
   ===================================================================== */
function doGet(e) {
  try {
    var map = occupiedMap();
    var date = e && e.parameter && e.parameter.date;
    if (date) {
      return jsonOut({ ok: true, date: date, occupied: Object.keys(map[date] || {}) });
    }
    var all = [];
    Object.keys(map).forEach(function (d) {
      Object.keys(map[d]).forEach(function (h) { all.push(d + " " + h); });
    return jsonOut({ ok: true, occupied: all });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

/* =====================================================================
   POST : le site enregistre une nouvelle demande.
   Corps JSON attendu : { dateISO, heure, service, dureeMin, prenom,
                          nom, telephone, email }
   Réponses :
     { ok:true }                      -> enregistré (créneau bloqué)
     { ok:false, taken:true }         -> créneau déjà pris entre-temps
     { ok:false, error:"..." }        -> autre erreur
   Un verrou (LockService) évite deux réservations simultanées du même créneau.
   ===================================================================== */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var data = JSON.parse(e.postData.contents);
    if (!data.dateISO || !data.heure) return jsonOut({ ok: false, error: "date/heure manquante" });

    // Anti double-réservation : le créneau demandé chevauche-t-il un créneau déjà pris ?
    var map = occupiedMap();
    var dayTaken = map[data.dateISO] || {};
    var wanted = slotsForBooking(data.heure, data.dureeMin || PAS_MIN);
    for (var i = 0; i < wanted.length; i++) {
      if (dayTaken[wanted[i]]) return jsonOut({ ok: false, taken: true });
    }

    getSheet().appendRow([
      new Date(),                     // A Horodatage
      data.dateISO,                   // B Date
      data.heure,                     // C Heure
      data.service || "",             // D Service
      data.dureeMin || "",            // E DureeMin
      data.prenom || "",              // F Prenom
      data.nom || "",                 // G Nom
      "'" + (data.telephone || ""),   // H Telephone (apostrophe = garde le format texte)
      data.email || "",               // I Email
      "En attente"                    // J Statut
    ]);
    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
