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
var CODE_VERSION = 3;              // témoin : permet de vérifier quelle version est déployée

/* ---------------------------------------------------------------------
   STATUTS (colonne J du Sheet) — pilotent la couleur sur le site :
     "Confirmé" / "Validé"      -> 🔴 ROUGE : créneau BLOQUÉ
     "Annulé"  / "Refusé"       -> 🟢 VERT  : créneau libéré (ignoré)
     tout le reste ("En attente", vide…) -> 🟠 ORANGE : demande reçue,
        en attente de votre validation, le créneau n'est PAS encore bloqué.
--------------------------------------------------------------------- */
function statutType(statut) {
  var s = String(statut || "").toLowerCase().trim();
  if (s.indexOf("annul") === 0 || s.indexOf("refus") === 0) return "ignore";
  if (s.indexOf("confirm") === 0 || s.indexOf("valid") === 0) return "confirmed";
  return "pending";
}

/* ---------- Petits utilitaires ---------- */
function pad2(n) { return (n < 10 ? "0" : "") + n; }

// Détection robuste d'une date : « instanceof Date » n'est pas fiable dans
// Apps Script (les objets viennent d'un autre contexte) → on teste la méthode.
function isDate(v) {
  return v && typeof v.getTime === "function" && !isNaN(v.getTime());
}

function normDate(v, tz) {
  // Google Sheets peut convertir "2026-07-14" en objet Date : on re-normalise.
  if (isDate(v)) return Utilities.formatDate(v, tz, "yyyy-MM-dd");
  return String(v).trim();
}

function normTime(v, tz) {
  if (isDate(v)) return Utilities.formatDate(v, tz, "HH:mm");
  // Sheets peut aussi stocker une heure en fraction de journée (0,5 = 12:00).
  if (typeof v === "number") {
    var mins = Math.round(v * 24 * 60);
    return pad2(Math.floor(mins / 60) % 24) + ":" + pad2(mins % 60);
  }
  var p = String(v).trim().split(":");
  if (p.length < 2) return String(v).trim();
  return pad2(parseInt(p[0], 10)) + ":" + pad2(parseInt(p[1], 10));
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

// Renvoie { confirmed: {"AAAA-MM-JJ": {"11:00":true}}, pending: {...} }
// - confirmed : rendez-vous validés  -> bloquent le créneau (rouge)
// - pending   : demandes en attente  -> n'empêchent PAS de réserver (orange)
// Les lignes annulées / refusées sont ignorées.
function bookingMaps() {
  var sheet = getSheet();
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  var rows = sheet.getDataRange().getValues();
  var res = { confirmed: {}, pending: {} };
  for (var i = 1; i < rows.length; i++) {         // i=1 : on saute l'en-tête
    var dateISO = normDate(rows[i][1], tz);       // colonne B
    var heure   = normTime(rows[i][2], tz);       // colonne C
    var dureeMin = rows[i][4];                     // colonne E
    var type    = statutType(rows[i][9]);          // colonne J
    if (!dateISO || !heure || type === "ignore") continue;
    var bucket = res[type];
    if (!bucket[dateISO]) bucket[dateISO] = {};
    slotsForBooking(heure, dureeMin).forEach(function (s) { bucket[dateISO][s] = true; });
  }
  return res;
}

// Aplatit une map en tableau ["AAAA-MM-JJ HH:MM", ...]
function flatten(map) {
  var out = [];
  Object.keys(map).forEach(function (d) {
    Object.keys(map[d]).forEach(function (h) { out.push(d + " " + h); });
  });
  return out;
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
    var m = bookingMaps();
    var date = e && e.parameter && e.parameter.date;
    if (date) {
      return jsonOut({
        ok: true, version: CODE_VERSION, date: date,
        confirmed: Object.keys(m.confirmed[date] || {}),   // 🔴 bloqués
        pending:   Object.keys(m.pending[date]   || {}),   // 🟠 en attente
        occupied:  Object.keys(m.confirmed[date] || {})    // compatibilité
      });
    }
    return jsonOut({
      ok: true, version: CODE_VERSION,
      confirmed: flatten(m.confirmed),
      pending:   flatten(m.pending),
      occupied:  flatten(m.confirmed)                      // compatibilité
    });
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

    // Anti double-réservation : on ne refuse QUE si un rendez-vous CONFIRMÉ
    // occupe déjà le créneau. Une demande en attente (orange) ne bloque pas.
    var m = bookingMaps();
    var dayTaken = m.confirmed[data.dateISO] || {};
    var wanted = slotsForBooking(data.heure, data.dureeMin || PAS_MIN);
    for (var i = 0; i < wanted.length; i++) {
      if (dayTaken[wanted[i]]) return jsonOut({ ok: false, taken: true });
    }

    // L'apostrophe force le format TEXTE : Sheets ne transforme plus
    // "2026-07-22" en date ni "14:00" en heure (source de bugs de lecture).
    getSheet().appendRow([
      new Date(),                     // A Horodatage
      "'" + data.dateISO,             // B Date   (texte "AAAA-MM-JJ")
      "'" + data.heure,               // C Heure  (texte "HH:MM")
      data.service || "",             // D Service
      data.dureeMin || "",            // E DureeMin
      data.prenom || "",              // F Prenom
      data.nom || "",                 // G Nom
      "'" + (data.telephone || ""),   // H Telephone (apostrophe = garde le format texte)
      data.email || "",               // I Email
      "En attente de confirmation"    // J Statut → 🟠 orange tant que non validé
    ]);
    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
