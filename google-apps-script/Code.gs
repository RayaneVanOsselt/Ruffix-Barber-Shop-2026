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
var CODE_VERSION = 4;              // témoin : permet de vérifier quelle version est déployée

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
      "En attente de confirmation",   // J Statut → 🟠 orange tant que non validé
      data.notes || ""                // K Notes (optionnel)
    ]);
    // Synchro Google Agenda immédiate (ne JAMAIS bloquer l'enregistrement si l'agenda échoue).
    try { syncCalendar_(); } catch (calErr) { /* la réservation est déjà sauvegardée */ }
    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* =====================================================================
   =====================================================================
                    INTÉGRATION GOOGLE AGENDA (Calendar)
   =====================================================================
   =====================================================================
   Synchronise la feuille « Reservations » avec un calendrier Google
   Agenda DÉDIÉ (créé automatiquement au 1er lancement) :
     • nouvelle ligne          -> crée un événement ;
     • ligne modifiée          -> met à jour l'événement ;
     • statut « Annulé/Refusé » -> supprime l'événement.

   Chaque réservation retient l'ID de son événement (colonne L) + une
   signature (colonne M) pour retrouver / mettre à jour / supprimer le bon
   événement, sans jamais créer de doublon.

   👉 Installation : voir AGENDA-GOOGLE.md. En résumé, une seule fois :
        Menu « Rufix Agenda » → « 1) Installer la synchro auto ».
   ===================================================================== */

var CAL_NAME  = "Rufix Barber — Réservations";   // nom du calendrier dédié (partageable)
var CAL_PROP  = "RUFIX_CAL_ID";                  // clé de stockage de l'ID du calendrier
var EVENT_TAG = "rufix-resa";                    // marqueur posé sur nos événements

// Colonnes (0-based). A→J déjà utilisées par les réservations ; on ajoute :
var COL_DATE = 1, COL_HEURE = 2, COL_SERVICE = 3, COL_DUREE = 4,
    COL_PRENOM = 5, COL_NOM = 6, COL_TEL = 7, COL_EMAIL = 8, COL_STATUT = 9,
    COL_NOTES = 10,   // K Notes (optionnel)
    COL_EVENT = 11,   // L ID de l'événement Agenda (géré par le script)
    COL_HASH  = 12;   // M Signature de synchro (géré par le script)

/* ---------- Calendrier dédié : le retrouve ou le crée ---------- */
function getBookingCalendar_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(CAL_PROP);
  if (id) {
    var c = CalendarApp.getCalendarById(id);
    if (c) return c;
  }
  // Pas encore mémorisé : on cherche par nom, sinon on le crée.
  var found = CalendarApp.getCalendarsByName(CAL_NAME);
  var cal = (found && found.length) ? found[0]
    : CalendarApp.createCalendar(CAL_NAME, {
        summary: "Réservations du salon Rufix Barber (synchronisé depuis le Google Sheet).",
        color: CalendarApp.Color.BROWN
      });
  props.setProperty(CAL_PROP, cal.getId());
  return cal;
}

/* ---------- S'assure que les en-têtes K/L/M existent ---------- */
function ensureSyncHeaders_(sheet) {
  var head = sheet.getRange(1, 1, 1, Math.max(13, sheet.getLastColumn())).getValues()[0];
  if (!head[COL_NOTES]) sheet.getRange(1, COL_NOTES + 1).setValue("Notes");
  if (!head[COL_EVENT]) sheet.getRange(1, COL_EVENT + 1).setValue("ID Agenda");
  if (!head[COL_HASH])  sheet.getRange(1, COL_HASH + 1).setValue("Sync");
}

/* ---------- Construit le titre / la description de l'événement ---------- */
function eventTitle_(prenom, nom, service) {
  var client = String(prenom || "").trim() + " " + String(nom || "").trim();
  client = client.trim() || "Client";
  return client + " – " + (String(service || "").trim() || "Rendez-vous");
}
function eventDescription_(o) {
  var L = [];
  L.push("Client : " + (o.client || "—"));
  L.push("Service : " + (o.service || "—"));
  L.push("Date : " + o.dateISO);
  L.push("Heure : " + o.heure + " – " + o.heureFin + "  (" + o.dureeMin + " min)");
  if (o.tel)   L.push("Téléphone : " + o.tel);
  if (o.email) L.push("Email : " + o.email);
  if (o.notes) L.push("Notes : " + o.notes);
  L.push("Statut : " + (o.statut || "—"));
  L.push("");
  L.push("[" + EVENT_TAG + "] Événement synchronisé automatiquement depuis le Google Sheet.");
  L.push("Ne modifiez pas cet événement à la main : éditez la ligne dans le Sheet.");
  return L.join("\n");
}

/* ---------- Signature d'une ligne (pour détecter les changements) ---------- */
function rowHash_(title, start, end, desc) {
  var raw = title + "|" + start.getTime() + "|" + end.getTime() + "|" + desc;
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

/* =====================================================================
   CŒUR DE LA SYNCHRO — réconcilie la feuille avec le calendrier.
   (sans verrou : appelé soit sous le verrou de doPost, soit via le
    wrapper verrouillé syncReservationsToCalendar)
   ===================================================================== */
function syncCalendar_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone();
  var sheet = getSheet();
  if (!sheet) return;
  ensureSyncHeaders_(sheet);

  var cal = getBookingCalendar_();
  var rng = sheet.getDataRange();
  var rows = rng.getValues();
  // On écrit L (ID) et M (hash) en une fois à la fin : on prépare 2 colonnes.
  var evCol = [], hashCol = [], dirty = false;

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var eventId = String(r[COL_EVENT] || "").trim();
    var hash    = String(r[COL_HASH] || "").trim();

    var dateISO = normDate(r[COL_DATE], tz);
    var heure   = normTime(r[COL_HEURE], tz);
    var type    = statutType(r[COL_STATUT]);
    var hasCore = dateISO && heure && (String(r[COL_NOM] || "").trim() || String(r[COL_PRENOM] || "").trim());

    // --- Cas 1 : l'événement NE doit PAS exister (annulé / refusé / ligne vide) ---
    if (type === "ignore" || !hasCore) {
      if (eventId) {
        try { var ex = cal.getEventById(eventId); if (ex) ex.deleteEvent(); } catch (e) {}
        eventId = ""; hash = ""; dirty = true;
      }
      evCol.push([eventId]); hashCol.push([hash]);
      continue;
    }

    // --- Cas 2 : l'événement DOIT exister (création ou mise à jour) ---
    var dureeMin = Math.max(PAS_MIN, parseInt(r[COL_DUREE], 10) || PAS_MIN);
    var start = Utilities.parseDate(dateISO + " " + heure, tz, "yyyy-MM-dd HH:mm");
    var end   = new Date(start.getTime() + dureeMin * 60000);
    var client = (String(r[COL_PRENOM] || "").trim() + " " + String(r[COL_NOM] || "").trim()).trim();
    var title = eventTitle_(r[COL_PRENOM], r[COL_NOM], r[COL_SERVICE]);
    var desc = eventDescription_({
      client: client, service: r[COL_SERVICE], dateISO: dateISO, heure: heure,
      heureFin: Utilities.formatDate(end, tz, "HH:mm"), dureeMin: dureeMin,
      tel: String(r[COL_TEL] || "").trim(), email: String(r[COL_EMAIL] || "").trim(),
      notes: String(r[COL_NOTES] || "").trim(), statut: String(r[COL_STATUT] || "").trim()
    });
    var sig = rowHash_(title, start, end, desc);

    if (!eventId) {
      // Création
      var ev = cal.createEvent(title, start, end, { description: desc, location: "Etterbeek" });
      ev.setTag("app", EVENT_TAG);
      eventId = ev.getId(); hash = sig; dirty = true;
    } else if (sig !== hash) {
      // Mise à jour (ou re-création si l'événement a été supprimé à la main)
      var cur = null;
      try { cur = cal.getEventById(eventId); } catch (e) {}
      if (!cur) {
        var ev2 = cal.createEvent(title, start, end, { description: desc, location: "Etterbeek" });
        ev2.setTag("app", EVENT_TAG);
        eventId = ev2.getId();
      } else {
        cur.setTitle(title);
        cur.setTime(start, end);
        cur.setDescription(desc);
      }
      hash = sig; dirty = true;
    }

    evCol.push([eventId]); hashCol.push([hash]);
  }

  // Écriture groupée des colonnes L et M (seulement si quelque chose a changé)
  if (dirty && evCol.length) {
    sheet.getRange(2, COL_EVENT + 1, evCol.length, 1).setValues(evCol);
    sheet.getRange(2, COL_HASH + 1, hashCol.length, 1).setValues(hashCol);
  }
}

/* ---------- Wrapper VERROUILLÉ (déclencheurs + lancement manuel) ---------- */
function syncReservationsToCalendar() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    syncCalendar_();
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Déclencheur d'édition manuelle (modif / annulation) ---------- */
function onEditSync_(e) {
  // On resynchronise dès qu'une cellule de la feuille des réservations change.
  try {
    if (e && e.range && e.range.getSheet().getName() !== SHEET_NAME) return;
  } catch (err) {}
  syncReservationsToCalendar();
}

/* =====================================================================
   INSTALLATION AUTOMATIQUE DES DÉCLENCHEURS (à lancer UNE fois)
   - onEditSync_            : synchro immédiate quand on édite la feuille ;
   - syncReservationsToCalendar : filet de sécurité toutes les minutes.
   Relançable sans risque : les anciens déclencheurs identiques sont retirés.
   ===================================================================== */
function installTriggers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var keep = ["onEditSync_", "syncReservationsToCalendar"];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (keep.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  // Édition manuelle → synchro instantanée
  ScriptApp.newTrigger("onEditSync_").forSpreadsheet(ss).onEdit().create();
  // Filet de sécurité (nouvelles résas du site, changements ratés) toutes les minutes
  ScriptApp.newTrigger("syncReservationsToCalendar").timeBased().everyMinutes(1).create();
  // Première synchro immédiate + on garantit l'existence du calendrier
  syncReservationsToCalendar();
  return "Synchro installée. Calendrier : " + getBookingCalendar_().getName();
}

/* ---------- Menu pratique dans le Google Sheet ---------- */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Rufix Agenda")
    .addItem("1) Installer la synchro auto", "installTriggers")
    .addItem("2) Synchroniser maintenant", "syncReservationsToCalendar")
    .addToUi();
}
