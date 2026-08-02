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
var CODE_VERSION = 7;              // témoin : permet de vérifier quelle version est déployée

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
    // Liens sécurisés « Confirmer / Refuser » depuis l'e-mail administrateur
    if (e && e.parameter && e.parameter.action) {
      return handleAdminAction_(e);
    }
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
      data.notes || "",               // K Notes (optionnel)
      "", "",                         // L / M (agenda) — remplis par la synchro
      "'" + genBookingId_()           // N booking_id (identifiant unique)
    ]);
    // Synchro Google Agenda immédiate (ne JAMAIS bloquer l'enregistrement si l'agenda échoue).
    // NB : la demande est « En attente » → aucun événement ni e-mail n'est créé ici.
    try { syncCalendar_(); } catch (calErr) { /* la réservation est déjà sauvegardée */ }
    // (Optionnel) e-mail admin serveur avec boutons Confirmer/Refuser, si activé.
    try { if (BIZ.adminEmail) notifyAdminNewBooking_(); } catch (aErr) {}
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
    COL_HASH  = 12,   // M Signature de synchro (géré par le script)
    // --- Suivi des e-mails de confirmation (gérés par le script) ---
    COL_BOOKING = 13, // N booking_id (identifiant unique de la réservation)
    COL_MSENT   = 14, // O confirmation_email_sent      (TRUE / vide)
    COL_MAT     = 15, // P confirmation_email_sent_at   (date+heure d'envoi)
    COL_MERR    = 16, // Q confirmation_email_error     (dernier message d'erreur)
    COL_MTRY    = 17; // R confirmation_email_attempts  (nombre de tentatives)

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
  var head = sheet.getRange(1, 1, 1, Math.max(18, sheet.getLastColumn())).getValues()[0];
  if (!head[COL_NOTES])   sheet.getRange(1, COL_NOTES + 1).setValue("Notes");
  if (!head[COL_EVENT])   sheet.getRange(1, COL_EVENT + 1).setValue("ID Agenda");
  if (!head[COL_HASH])    sheet.getRange(1, COL_HASH + 1).setValue("Sync");
  if (!head[COL_BOOKING]) sheet.getRange(1, COL_BOOKING + 1).setValue("booking_id");
  if (!head[COL_MSENT])   sheet.getRange(1, COL_MSENT + 1).setValue("confirmation_email_sent");
  if (!head[COL_MAT])     sheet.getRange(1, COL_MAT + 1).setValue("confirmation_email_sent_at");
  if (!head[COL_MERR])    sheet.getRange(1, COL_MERR + 1).setValue("confirmation_email_error");
  if (!head[COL_MTRY])    sheet.getRange(1, COL_MTRY + 1).setValue("confirmation_email_attempts");
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

    // --- Cas 1 : l'événement NE doit PAS exister ---
    // On ne crée l'événement QUE si le statut est « Confirmé ».
    // « En attente de confirmation », « Annulé », « Refusé », ligne vide → aucun
    // événement (et on supprime celui qui existerait déjà, ex. après un retour en attente).
    if (type !== "confirmed" || !hasCore) {
      if (eventId) {
        try { var ex = cal.getEventById(eventId); if (ex) ex.deleteEvent(); } catch (e) {}
        eventId = ""; hash = ""; dirty = true;
      }
      evCol.push([eventId]); hashCol.push([hash]);
      continue;
    }

    // --- Cas 2 : statut « Confirmé » → l'événement DOIT exister (création ou mise à jour) ---
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
    syncCalendar_();                    // 1) agenda : crée/maj/supprime l'événement
    processConfirmationEmails_();       // 2) e-mails : envoie la confirmation aux clients confirmés
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
  hideTechnicalColumns_();   // n'affiche que les colonnes utiles
  return "Synchro installée. Calendrier : " + getBookingCalendar_().getName();
}

/* ---------- Affichage épuré : masque les colonnes techniques (L→R) ----------
   Garde visibles A→K (Date, Heure, Service, Prénom, Nom, Tél, Email, Statut,
   Notes…). Masque ID Agenda, Sync, booking_id et le suivi des e-mails, dont
   le script a besoin mais qui n'ont pas à encombrer l'affichage. */
function hideTechnicalColumns_() {
  var sheet = getSheet(); if (!sheet) return;
  ensureSyncHeaders_(sheet);
  sheet.hideColumns(COL_EVENT + 1, (COL_MTRY + 1) - (COL_EVENT + 1) + 1); // colonnes 12 → 18 (L → R)
}
function showTechnicalColumns_() {
  var sheet = getSheet(); if (!sheet) return;
  sheet.showColumns(COL_EVENT + 1, (COL_MTRY + 1) - (COL_EVENT + 1) + 1);
}

/* ---------- Menu pratique dans le Google Sheet ---------- */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Rufix Agenda")
    .addItem("1) Installer la synchro auto", "installTriggers")
    .addItem("2) Synchroniser maintenant", "syncReservationsToCalendar")
    .addToUi();
  ui.createMenu("Gestion des réservations")
    .addItem("✅ Confirmer la réservation sélectionnée", "confirmSelectedBooking")
    .addItem("✉️ Envoyer l'e-mail de confirmation", "sendConfirmationForSelected")
    .addItem("🔁 Renvoyer l'e-mail de confirmation", "resendConfirmationForSelected")
    .addSeparator()
    .addItem("🚫 Marquer comme refusée", "refuseSelectedBooking")
    .addItem("🗑️ Annuler la réservation", "cancelSelectedBooking")
    .addSeparator()
    .addItem("⚠️ Voir la dernière erreur d'envoi", "showLastErrorForSelected")
    .addSeparator()
    .addItem("🙈 Masquer les colonnes techniques", "hideTechnicalColumns_")
    .addItem("👁️ Afficher toutes les colonnes", "showTechnicalColumns_")
    .addToUi();
}

/* =====================================================================
   =====================================================================
       CONFIRMATION CLIENT PAR E-MAIL (Apps Script + MailApp)
   =====================================================================
   =====================================================================
   Envoie automatiquement un e-mail au client dès que le statut passe à
   « Confirmé » dans le Google Sheet. Fiable et serveur (ne dépend pas du
   navigateur du client ni du site ouvert). Anti-doublon par colonnes de
   suivi. Voir CONFIRMATION-EMAIL.md pour l'installation.
   ===================================================================== */

var TZ = "Europe/Brussels";   // fuseau horaire (évite tout décalage d'heure / de jour)

// ⚙️ À COMPLÉTER : coordonnées affichées dans les e-mails clients.
var BIZ = {
  name:  "Rufix Barber",
  email: "infos@rufixbarber.com",
  phone: "",                          // ex : "+32 4xx xx xx xx" (vide = masqué)
  site:  "https://rufixbarber.com",
  adminEmail: "",                     // (optionnel) e-mail admin pour la notif serveur + boutons Confirmer/Refuser. Vide = désactivé (EmailJS reste inchangé).
  actionBaseUrl: ""                   // (optionnel) URL /exec du web app pour les liens sécurisés. Vide = auto-détecté.
};

var JOURS_FR = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
var MOIS_FR  = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

/* ------------------------------- Utilitaires ------------------------------- */
function isTrue_(v){ return v === true || String(v).trim().toUpperCase() === "TRUE"; }
function validEmail_(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim()); }
function maskEmail_(s){ s = String(s || ""); var a = s.split("@"); if (a.length !== 2) return "***"; return a[0].slice(0, 2) + "***@" + a[1]; }
function genBookingId_(){ return "RB-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(Math.random() * 46656).toString(36).toUpperCase(); }
function esc_(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, function (c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]; }); }
function readRow_(sheet, rowNum){ return sheet.getRange(rowNum, 1, 1, Math.max(18, sheet.getLastColumn())).getValues()[0]; }
function toast_(msg){ try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, "Rufix", 6); } catch (e) {} }

function frDate_(dateISO){
  var p = String(dateISO || "").split("-"); if (p.length !== 3) return String(dateISO || "");
  var y = +p[0], m = +p[1], d = +p[2];
  var dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();  // date pure → pas de décalage de fuseau
  return JOURS_FR[dow] + " " + d + " " + MOIS_FR[m - 1] + " " + y;
}
function dureeTxt_(min){ min = parseInt(min, 10) || 0; var h = Math.floor(min / 60), m = min % 60; if (h && m) return h + " h " + m; if (h) return h + " heure" + (h > 1 ? "s" : ""); return (m || min) + " minutes"; }

/* --------- booking_id : garantit un identifiant unique par réservation --------- */
function ensureBookingId_(sheet, rowNum, r){
  var id = String(r[COL_BOOKING] || "").trim();
  if (!id) { id = genBookingId_(); sheet.getRange(rowNum, COL_BOOKING + 1).setValue("'" + id); r[COL_BOOKING] = id; }
  return id;
}
function findRowByBookingId_(sheet, bookingId){
  bookingId = String(bookingId || "").trim(); if (!bookingId) return -1;
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) { if (String(rows[i][COL_BOOKING] || "").trim() === bookingId) return i + 1; }
  return -1;
}

/* --------- Jeton sécurisé pour les liens Confirmer / Refuser --------- */
function getSecret_(){
  var p = PropertiesService.getScriptProperties();
  var s = p.getProperty("RUFIX_SECRET");
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty("RUFIX_SECRET", s); }
  return s;
}
function makeToken_(bookingId, action){
  var bytes = Utilities.computeHmacSha256Signature(String(bookingId) + "|" + String(action), getSecret_());
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, "").slice(0, 24);
}
function verifyToken_(bookingId, action, token){ return !!token && token === makeToken_(bookingId, action); }
function actionUrl_(bookingId, action){
  var base = BIZ.actionBaseUrl || ScriptApp.getService().getUrl();
  return base + "?action=" + encodeURIComponent(action) + "&id=" + encodeURIComponent(bookingId) + "&token=" + makeToken_(bookingId, action);
}

/* --------- Extraction des données d'une réservation --------- */
function extractData_(r, bookingId){
  var dateISO = normDate(r[COL_DATE], TZ);
  var heure   = normTime(r[COL_HEURE], TZ);
  var dureeMin = Math.max(PAS_MIN, parseInt(r[COL_DUREE], 10) || PAS_MIN);
  var start = Utilities.parseDate(dateISO + " " + heure, TZ, "yyyy-MM-dd HH:mm");
  var end   = new Date(start.getTime() + dureeMin * 60000);
  return {
    bookingId: bookingId,
    prenom: String(r[COL_PRENOM] || "").trim(),
    nom:    String(r[COL_NOM] || "").trim(),
    email:  String(r[COL_EMAIL] || "").trim(),
    tel:    String(r[COL_TEL] || "").trim(),
    service: String(r[COL_SERVICE] || "").trim() || "Rendez-vous",
    dateISO: dateISO, heure: heure, dureeMin: dureeMin,
    dateHuman: frDate_(dateISO),
    heureFin: Utilities.formatDate(end, TZ, "HH:mm"),
    dureeTxt: dureeTxt_(dureeMin),
    start: start, end: end
  };
}

/* --------- « Ajouter à mon calendrier » : fichier .ics + lien Google Agenda --------- */
function icsEsc_(s){ return String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n"); }
function icsUtc_(d){ return Utilities.formatDate(d, "UTC", "yyyyMMdd'T'HHmmss'Z'"); }
function buildIcs_(d){
  var title = BIZ.name + " – " + d.service;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rufix Barber//RDV//FR", "METHOD:PUBLISH", "BEGIN:VEVENT",
    "UID:" + d.bookingId + "@rufixbarber", "DTSTAMP:" + icsUtc_(new Date()),
    "DTSTART:" + icsUtc_(d.start), "DTEND:" + icsUtc_(d.end),
    "SUMMARY:" + icsEsc_(title),
    "DESCRIPTION:" + icsEsc_("Réservation " + d.bookingId + " — " + d.service),
    "LOCATION:" + icsEsc_("Etterbeek"),
    "END:VEVENT", "END:VCALENDAR"
  ].join("\r\n");
}
function gcalLink_(d){
  var title = encodeURIComponent(BIZ.name + " – " + d.service);
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + title +
         "&dates=" + icsUtc_(d.start) + "/" + icsUtc_(d.end) + "&location=" + encodeURIComponent("Etterbeek");
}

/* --------- Gabarits d'e-mails (HTML responsive, lisible sur téléphone) --------- */
function emailShell_(preheader, contentHtml){
  return '' +
  '<div style="margin:0;padding:0;background:#f4f2ee;">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + esc_(preheader) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee;padding:24px 12px;"><tr><td align="center">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.08);font-family:Arial,Helvetica,sans-serif;color:#2b2620;">' +
        '<tr><td style="background:#14110f;padding:22px 28px;">' +
          '<div style="font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#f4efe7;">' + esc_(BIZ.name) + '</div>' +
          '<div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c9a24b;margin-top:2px;">Barbier · Etterbeek</div>' +
        '</td></tr>' +
        '<tr><td style="padding:28px;">' + contentHtml + '</td></tr>' +
        '<tr><td style="padding:18px 28px;background:#faf8f4;border-top:1px solid #eee;font-size:12px;color:#8a8378;">' +
          esc_(BIZ.name) +
          (BIZ.email ? ' · <a href="mailto:' + esc_(BIZ.email) + '" style="color:#c9a24b;text-decoration:none;">' + esc_(BIZ.email) + '</a>' : '') +
          (BIZ.phone ? ' · ' + esc_(BIZ.phone) : '') +
          (BIZ.site ? '<br><a href="' + esc_(BIZ.site) + '" style="color:#8a8378;">' + esc_(BIZ.site.replace(/^https?:\/\//, '')) + '</a>' : '') +
        '</td></tr>' +
      '</table>' +
    '</td></tr></table>' +
  '</div>';
}
function infoRow_(label, value){
  return '<tr>' +
    '<td style="padding:8px 0;font-size:13px;color:#8a8378;width:40%;vertical-align:top;">' + esc_(label) + '</td>' +
    '<td style="padding:8px 0;font-size:15px;color:#2b2620;font-weight:bold;">' + esc_(value) + '</td>' +
  '</tr>';
}
function detailsTable_(d){
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">' +
    infoRow_("Prestation", d.service) +
    infoRow_("Date", d.dateHuman) +
    infoRow_("Heure", d.heure + " – " + d.heureFin) +
    infoRow_("Durée", d.dureeTxt) +
    infoRow_("N° de réservation", d.bookingId) +
  '</table>';
}
function ctaButton_(href, label, bg, fg){
  return '<div style="text-align:center;margin:22px 0 4px;"><a href="' + href + '" style="display:inline-block;background:' + bg + ';color:' + fg + ';font-weight:bold;font-size:14px;text-decoration:none;padding:12px 24px;border-radius:999px;">' + esc_(label) + '</a></div>';
}
function signature_(){ return '<p style="margin:18px 0 0;font-size:14px;color:#4a453d;">À bientôt,<br><strong>' + esc_(BIZ.name) + '</strong></p>'; }

function confirmationEmailHtml_(d){
  var body =
    '<h1 style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:#14110f;">Votre rendez-vous est confirmé ✅</h1>' +
    '<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#4a453d;">Bonjour ' + esc_(d.prenom) + ',<br>Votre réservation a bien été confirmée. Voici les informations de votre rendez-vous :</p>' +
    '<div style="background:#faf8f4;border:1px solid #eee;border-radius:12px;padding:16px 18px;">' + detailsTable_(d) + '</div>' +
    ctaButton_(gcalLink_(d), "📅 Ajouter à mon calendrier", "#c9a24b", "#14110f") +
    '<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#4a453d;">Merci de vous présenter quelques minutes avant l\'heure prévue. En cas d\'empêchement, prévenez-nous le plus rapidement possible.</p>' +
    signature_();
  return emailShell_("Votre rendez-vous du " + d.dateHuman + " est confirmé.", body);
}
function refusedEmailHtml_(d){
  var body =
    '<h1 style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:#14110f;">Demande non confirmée</h1>' +
    '<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a453d;">Bonjour ' + esc_(d.prenom) + ',<br>Nous sommes désolés : nous n\'avons pas pu confirmer le créneau demandé.</p>' +
    '<div style="background:#faf8f4;border:1px solid #eee;border-radius:12px;padding:16px 18px;">' + detailsTable_(d) + '</div>' +
    '<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#4a453d;">N\'hésitez pas à choisir un autre créneau, nous serons ravis de vous accueillir.</p>' +
    ctaButton_(esc_(BIZ.site) + "#reservation", "Choisir un autre créneau", "#c9a24b", "#14110f") +
    signature_();
  return emailShell_("Votre demande de rendez-vous n'a pas pu être confirmée.", body);
}
function cancelledEmailHtml_(d){
  var body =
    '<h1 style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:#14110f;">Rendez-vous annulé</h1>' +
    '<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a453d;">Bonjour ' + esc_(d.prenom) + ',<br>Votre rendez-vous suivant a été annulé :</p>' +
    '<div style="background:#faf8f4;border:1px solid #eee;border-radius:12px;padding:16px 18px;">' + detailsTable_(d) + '</div>' +
    '<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#4a453d;">Pour reprogrammer, réservez un nouveau créneau quand vous le souhaitez.</p>' +
    ctaButton_(esc_(BIZ.site) + "#reservation", "Reprendre rendez-vous", "#c9a24b", "#14110f") +
    signature_();
  return emailShell_("Annulation de votre rendez-vous.", body);
}
function modifiedEmailHtml_(dOld, dNew){
  var body =
    '<h1 style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:#14110f;">Modification de votre rendez-vous</h1>' +
    '<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#4a453d;">Bonjour ' + esc_(dNew.prenom) + ',<br>Votre rendez-vous a été modifié.</p>' +
    '<p style="margin:0 0 6px;font-size:13px;color:#8a8378;text-transform:uppercase;letter-spacing:1px;">Ancien rendez-vous</p>' +
    '<div style="background:#faf8f4;border:1px solid #eee;border-radius:12px;padding:14px 18px;opacity:.75;">' + detailsTable_(dOld) + '</div>' +
    '<p style="margin:16px 0 6px;font-size:13px;color:#8a8378;text-transform:uppercase;letter-spacing:1px;">Nouveau rendez-vous</p>' +
    '<div style="background:#faf8f4;border:1px solid #c9a24b;border-radius:12px;padding:14px 18px;">' + detailsTable_(dNew) + '</div>' +
    ctaButton_(gcalLink_(dNew), "📅 Ajouter à mon calendrier", "#c9a24b", "#14110f") +
    signature_();
  return emailShell_("Votre rendez-vous a été modifié.", body);
}

/* --------- Envoi --------- */
function sendClientEmail_(to, subject, html, attachments){
  var opts = { to: to, subject: subject, htmlBody: html, name: BIZ.name };
  if (BIZ.email) opts.replyTo = BIZ.email;
  if (attachments) opts.attachments = attachments;
  MailApp.sendEmail(opts);
}
function sendConfirmationEmail_(d){
  var ics = Utilities.newBlob(buildIcs_(d), "text/calendar; charset=utf-8; method=PUBLISH", "rendez-vous.ics");
  sendClientEmail_(d.email, "Votre rendez-vous est confirmé – " + BIZ.name, confirmationEmailHtml_(d), [ics]);
}

/* =====================================================================
   Traitement d'une ligne : envoie l'e-mail de confirmation (anti-doublon)
   ===================================================================== */
function processConfirmationEmailRow_(sheet, rowNum, r, opts){
  opts = opts || {};
  var bookingId = ensureBookingId_(sheet, rowNum, r);
  var tag = "RDV " + bookingId + " (ligne " + rowNum + ")";
  Logger.log(tag + " : traitement — statut = " + String(r[COL_STATUT] || "").trim());

  if (statutType(r[COL_STATUT]) !== "confirmed") { Logger.log(tag + " : non confirmé → aucun e-mail"); return { ok: false, error: "statut non confirmé" }; }

  var email = String(r[COL_EMAIL] || "").trim();
  if (!validEmail_(email)) {
    sheet.getRange(rowNum, COL_MERR + 1).setValue("E-mail client absent ou invalide");
    Logger.log(tag + " : e-mail invalide (" + maskEmail_(email) + ") → non envoyé");
    return { ok: false, error: "e-mail invalide" };
  }
  if (!opts.force && isTrue_(r[COL_MSENT])) { Logger.log(tag + " : déjà envoyé → doublon évité"); return { ok: true, skipped: true }; }

  var d = extractData_(r, bookingId);
  Logger.log(tag + " : tentative d'envoi à " + maskEmail_(email));
  try {
    sendConfirmationEmail_(d);
    sheet.getRange(rowNum, COL_MSENT + 1).setValue(true);
    sheet.getRange(rowNum, COL_MAT + 1).setValue("'" + Utilities.formatDate(new Date(), TZ, "dd/MM/yyyy HH:mm"));
    sheet.getRange(rowNum, COL_MERR + 1).setValue("");
    Logger.log(tag + " : envoi RÉUSSI");
    return { ok: true };
  } catch (err) {
    var tries = (parseInt(r[COL_MTRY], 10) || 0) + 1;
    sheet.getRange(rowNum, COL_MERR + 1).setValue(String(err).slice(0, 300));
    sheet.getRange(rowNum, COL_MTRY + 1).setValue(tries);
    Logger.log(tag + " : ÉCHEC (" + err + "), tentative " + tries);
    return { ok: false, error: String(err) };
  }
}

/* Parcourt toute la feuille : envoie la confirmation aux « Confirmé » non encore envoyés.
   Appelée dans le flux verrouillé (déclencheur onEdit + filet 1 min). */
function processConfirmationEmails_(){
  var sheet = getSheet(); if (!sheet) return;
  ensureSyncHeaders_(sheet);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (statutType(r[COL_STATUT]) !== "confirmed") continue;
    if (isTrue_(r[COL_MSENT])) continue;
    var email = String(r[COL_EMAIL] || "").trim();
    if (!validEmail_(email)) {
      if (!String(r[COL_MERR] || "").trim()) sheet.getRange(i + 1, COL_MERR + 1).setValue("E-mail client absent ou invalide");
      continue;
    }
    processConfirmationEmailRow_(sheet, i + 1, r, {});
  }
}

/* --------- Statut + couleur de la cellule --------- */
function setStatus_(sheet, rowNum, status){
  sheet.getRange(rowNum, COL_STATUT + 1).setValue(status);
  var t = statutType(status);
  var bg = t === "confirmed" ? "#f4cccc" : (t === "ignore" ? "#e0e0e0" : "#fce5cd");
  try { sheet.getRange(rowNum, COL_STATUT + 1).setBackground(bg); } catch (e) {}
}

/* =====================================================================
   FONCTION CENTRALE — utilisée par le menu, les liens e-mail et le web app
   ===================================================================== */
function confirmBooking(bookingId, opts){
  opts = opts || {};
  var sheet = getSheet();
  var rowNum = findRowByBookingId_(sheet, bookingId);
  if (rowNum < 0) { Logger.log("confirmBooking : réservation " + bookingId + " introuvable"); return { ok: false, error: "Réservation introuvable" }; }
  var r = readRow_(sheet, rowNum);
  var already = statutType(r[COL_STATUT]) === "confirmed";
  Logger.log("confirmBooking " + bookingId + " : ancien statut = " + String(r[COL_STATUT] || "").trim() + " → Confirmé");
  setStatus_(sheet, rowNum, "Confirmé");     // statut + couleur
  syncReservationsToCalendar();              // bloque le créneau (site) + événement agenda + e-mail de confirmation
  r = readRow_(sheet, rowNum);
  var sent = isTrue_(r[COL_MSENT]);
  return { ok: true, bookingId: bookingId, wasAlready: already, emailSent: sent, error: sent ? "" : String(r[COL_MERR] || "") };
}
function changeStatusAndNotify_(bookingId, status, htmlFn, subject){
  var sheet = getSheet();
  var rowNum = findRowByBookingId_(sheet, bookingId);
  if (rowNum < 0) return { ok: false, error: "Réservation introuvable" };
  Logger.log("Statut " + bookingId + " → " + status);
  setStatus_(sheet, rowNum, status);
  syncReservationsToCalendar();              // libère le créneau + supprime l'événement agenda
  var r = readRow_(sheet, rowNum);
  var email = String(r[COL_EMAIL] || "").trim();
  var emailSent = false;
  if (validEmail_(email)) {
    try {
      sendClientEmail_(email, subject + " – " + BIZ.name, htmlFn(extractData_(r, ensureBookingId_(sheet, rowNum, r))), null);
      emailSent = true; Logger.log("E-mail « " + status + " » envoyé à " + maskEmail_(email));
    } catch (err) { Logger.log("Échec e-mail « " + status + " » : " + err); }
  } else { Logger.log("Pas d'e-mail « " + status + " » : adresse invalide"); }
  return { ok: true, emailSent: emailSent };
}
function refuseBooking(bookingId){ return changeStatusAndNotify_(bookingId, "Refusé", refusedEmailHtml_, "Votre demande de rendez-vous n'a pas pu être confirmée"); }
function cancelBooking(bookingId){ return changeStatusAndNotify_(bookingId, "Annulé", cancelledEmailHtml_, "Annulation de votre rendez-vous"); }

/* =====================================================================
   MENU « Gestion des réservations » (actions sur la ligne sélectionnée)
   ===================================================================== */
function activeCtx_(){
  var ui = SpreadsheetApp.getUi();
  var sheet = getSheet();
  var rng = SpreadsheetApp.getActiveRange();
  if (!rng || !sheet || rng.getSheet().getName() !== SHEET_NAME) { ui.alert("Sélectionnez d'abord une ligne dans l'onglet « " + SHEET_NAME + " »."); return null; }
  var rowNum = rng.getRow();
  if (rowNum < 2) { ui.alert("Sélectionnez une ligne de réservation (pas la ligne d'en-têtes)."); return null; }
  ensureSyncHeaders_(sheet);
  var r = readRow_(sheet, rowNum);
  return { ui: ui, sheet: sheet, rowNum: rowNum, r: r, bookingId: ensureBookingId_(sheet, rowNum, r) };
}
function confirmSelectedBooking(){
  var c = activeCtx_(); if (!c) return;
  var res = confirmBooking(c.bookingId, {});
  c.ui.alert(res.ok
    ? (res.emailSent ? "✅ Réservation confirmée. E-mail envoyé au client." : "✅ Confirmée, mais l'e-mail n'a pas pu partir :\n" + (res.error || "raison inconnue") + "\n(voir « Voir la dernière erreur d'envoi »).")
    : ("Erreur : " + res.error));
}
function sendConfirmationForSelected(){
  var c = activeCtx_(); if (!c) return;
  if (statutType(c.r[COL_STATUT]) !== "confirmed") { c.ui.alert("Cette réservation n'est pas « Confirmé ». Utilisez d'abord « Confirmer la réservation sélectionnée »."); return; }
  var res = processConfirmationEmailRow_(c.sheet, c.rowNum, c.r, {});
  c.ui.alert(res.ok ? (res.skipped ? "L'e-mail avait déjà été envoyé (aucun doublon)." : "✅ E-mail de confirmation envoyé.") : ("Échec : " + res.error));
}
function resendConfirmationForSelected(){
  var c = activeCtx_(); if (!c) return;
  if (c.ui.alert("Renvoyer l'e-mail de confirmation ?", "Un e-mail de confirmation sera renvoyé au client (doublon volontaire).", c.ui.ButtonSet.YES_NO) !== c.ui.Button.YES) return;
  var res = processConfirmationEmailRow_(c.sheet, c.rowNum, c.r, { force: true });
  c.ui.alert(res.ok ? "✅ E-mail renvoyé au client." : ("Échec : " + res.error));
}
function refuseSelectedBooking(){
  var c = activeCtx_(); if (!c) return;
  if (c.ui.alert("Marquer comme refusée ?", "Le statut passera à « Refusé », le créneau sera libéré et le client informé par e-mail.", c.ui.ButtonSet.YES_NO) !== c.ui.Button.YES) return;
  var res = refuseBooking(c.bookingId);
  c.ui.alert("Réservation refusée." + (res.emailSent ? " Client informé par e-mail." : ""));
}
function cancelSelectedBooking(){
  var c = activeCtx_(); if (!c) return;
  if (c.ui.alert("Annuler la réservation ?", "Le statut passera à « Annulé », le créneau sera libéré et le client informé par e-mail.", c.ui.ButtonSet.YES_NO) !== c.ui.Button.YES) return;
  var res = cancelBooking(c.bookingId);
  c.ui.alert("Réservation annulée." + (res.emailSent ? " Client informé par e-mail." : ""));
}
function showLastErrorForSelected(){
  var c = activeCtx_(); if (!c) return;
  var sent = isTrue_(c.r[COL_MSENT]);
  c.ui.alert("Réservation " + c.bookingId,
    (sent ? "✅ E-mail envoyé le " + String(c.r[COL_MAT] || "").trim() : "✉️ E-mail pas encore envoyé.") +
    "\n\nDernière erreur : " + (String(c.r[COL_MERR] || "").trim() || "aucune") +
    "\nTentatives : " + (parseInt(c.r[COL_MTRY], 10) || 0), c.ui.ButtonSet.OK);
}

/* =====================================================================
   LIENS SÉCURISÉS depuis l'e-mail admin (doGet ?action=confirm|refuse)
   ===================================================================== */
function handleAdminAction_(e){
  var id = String(e.parameter.id || "").trim();
  var action = String(e.parameter.action || "").trim();
  var token = String(e.parameter.token || "").trim();
  if (!verifyToken_(id, action, token)) { Logger.log("Action admin refusée : jeton invalide (" + id + "/" + action + ")"); return htmlPage_("Lien invalide", "Ce lien n'est pas valide (jeton incorrect ou expiré)."); }
  var sheet = getSheet();
  var rowNum = findRowByBookingId_(sheet, id);
  if (rowNum < 0) return htmlPage_("Réservation introuvable", "Cette réservation n'existe plus.");
  var r = readRow_(sheet, rowNum);
  if (action === "confirm") {
    if (statutType(r[COL_STATUT]) === "confirmed") return htmlPage_("Déjà confirmée", "Cette réservation était déjà confirmée. Aucun doublon n'a été créé.");
    confirmBooking(id, {});
    return htmlPage_("Réservation confirmée ✅", "Le créneau est bloqué et le client a été prévenu par e-mail.");
  }
  if (action === "refuse") {
    refuseBooking(id);
    return htmlPage_("Réservation refusée", "Le créneau a été libéré et le client a été informé.");
  }
  return htmlPage_("Action inconnue", "Action non reconnue.");
}
function htmlPage_(title, msg){
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc_(title) + '</title></head>' +
    '<body style="margin:0;font-family:Arial,sans-serif;background:#14110f;color:#f4efe7;">' +
    '<div style="max-width:460px;margin:14vh auto;background:#1d1a17;border:1px solid rgba(201,162,75,.25);border-radius:16px;padding:34px 28px;text-align:center;">' +
    '<div style="font-family:Georgia,serif;font-size:20px;color:#c9a24b;margin-bottom:10px;">' + esc_(BIZ.name) + '</div>' +
    '<h1 style="font-size:22px;margin:0 0 10px;">' + esc_(title) + '</h1>' +
    '<p style="color:#a89f92;line-height:1.6;margin:0;">' + esc_(msg) + '</p>' +
    '</div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(title);
}

/* --------- (Optionnel) e-mail admin serveur avec boutons Confirmer/Refuser --------- */
function notifyAdminNewBooking_(){
  if (!BIZ.adminEmail) return;
  var sheet = getSheet(); ensureSyncHeaders_(sheet);
  var rowNum = sheet.getLastRow(); if (rowNum < 2) return;
  var r = readRow_(sheet, rowNum);
  var d = extractData_(r, ensureBookingId_(sheet, rowNum, r));
  var body =
    '<h1 style="font-family:Georgia,serif;font-size:20px;color:#14110f;margin:0 0 8px;">Nouvelle demande de rendez-vous</h1>' +
    '<div style="background:#faf8f4;border:1px solid #eee;border-radius:12px;padding:16px 18px;"><table role="presentation" width="100%" style="border-collapse:collapse;">' +
      infoRow_("Client", (d.prenom + " " + d.nom).trim()) +
      infoRow_("E-mail", d.email) + (d.tel ? infoRow_("Téléphone", d.tel) : "") +
      infoRow_("Prestation", d.service) + infoRow_("Date", d.dateHuman) +
      infoRow_("Heure", d.heure + " – " + d.heureFin) + infoRow_("N° réservation", d.bookingId) +
    '</table></div>' +
    '<div style="text-align:center;margin:22px 0 4px;">' +
      '<a href="' + actionUrl_(d.bookingId, "confirm") + '" style="display:inline-block;background:#2e7d32;color:#fff;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:999px;margin:4px;">✅ Confirmer</a> ' +
      '<a href="' + actionUrl_(d.bookingId, "refuse") + '" style="display:inline-block;background:#b23b3b;color:#fff;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:999px;margin:4px;">🚫 Refuser</a>' +
    '</div>' +
    '<p style="font-size:12px;color:#8a8378;text-align:center;margin:8px 0 0;">Boutons sécurisés (jeton unique). Vous pouvez aussi gérer la réservation depuis le Google Sheet.</p>';
  try { MailApp.sendEmail({ to: BIZ.adminEmail, subject: "Nouvelle réservation " + d.bookingId + " – " + (d.prenom + " " + d.nom).trim(), htmlBody: emailShell_("Nouvelle demande de rendez-vous", body), name: BIZ.name }); }
  catch (err) { Logger.log("Échec e-mail admin : " + err); }
}
