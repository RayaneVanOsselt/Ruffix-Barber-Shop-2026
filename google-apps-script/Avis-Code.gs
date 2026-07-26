/* =====================================================================
   RUFIX BARBER — Backend AVIS (Google Apps Script + Google Sheet DÉDIÉ)
   =====================================================================
   ⚠️ À METTRE DANS UN NOUVEAU GOOGLE SHEET, SÉPARÉ de celui des
   réservations. Ainsi tes réservations ne sont jamais impactées.

   👉 Installation : voir AVIS-GOOGLE-SHEET.md.

   Résumé :
     1. Nouveau Google Sheet (vide, c'est tout — le script crée les
        en-têtes tout seul au 1er appel, sur l'onglet « Avis » ou, à
        défaut, sur le premier onglet du fichier).
     2. Extensions → Apps Script → colle ce code → Enregistrer.
     3. Déployer → Nouveau déploiement → « Application Web »
          - Exécuter en tant que : Moi
          - Qui a accès : Tout le monde
     4. Copie l'URL /exec → js/config.js → reviewsBackend.url
   ===================================================================== */

var SHEET_NAME = "Avis";
var MAX_LEN = 500;                 // longueur max d'un commentaire
var CODE_VERSION = 4;

var HEADERS = ["Horodatage", "Nom", "Note", "Commentaire", "Date", "Heure", "Statut", "Photo", "Vérifié"];

function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }

// Récupère l'onglet « Avis ». S'il n'existe pas, prend le 1er onglet du fichier.
// S'il est vide, écrit automatiquement la ligne d'en-têtes → aucun réglage requis.
function sheet() {
  var s = ss().getSheetByName(SHEET_NAME) || ss().getSheets()[0];
  if (s && s.getLastRow() === 0) s.appendRow(HEADERS);
  return s;
}
function tz() { return ss().getSpreadsheetTimeZone(); }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function isDate(v) { return v && typeof v.getTime === "function" && !isNaN(v.getTime()); }
function normDate(v) { return isDate(v) ? Utilities.formatDate(v, tz(), "dd/MM/yyyy") : String(v || "").trim(); }
function normTime(v) { return isDate(v) ? Utilities.formatDate(v, tz(), "HH:mm") : String(v || "").trim(); }
// Retire toute balise HTML (sécurité anti-injection / XSS côté serveur).
function clean(s) { return String(s || "").replace(/<[^>]*>/g, "").trim(); }

/* ============ GET : liste des avis CONFIRMÉS, du plus récent au plus ancien ============ */
function doGet() {
  try {
    var rows = sheet().getDataRange().getValues();
    var out = [];
    for (var i = 1; i < rows.length; i++) {            // i=1 : on saute l'en-tête
      var nom = clean(rows[i][1]);
      var commentaire = clean(rows[i][3]);
      var statut = String(rows[i][6] || "").toLowerCase();
      if (!nom || !commentaire) continue;
      // On n'affiche QUE les avis « Confirmé » (validés à la main dans la colonne Statut).
      // Tout le reste (« En attente », « Refusé », « Masqué », vide) reste caché du site.
      if (statut.indexOf("confirm") !== 0) continue;
      var horod = rows[i][0];
      // Colonne I « Vérifié » : vide = affiché (car déjà modéré). « non » = pas de badge.
      var vraw = String(rows[i][8] || "").trim().toLowerCase();
      out.push({
        nom: nom,
        note: Math.max(1, Math.min(5, parseInt(rows[i][2], 10) || 5)),
        commentaire: commentaire,
        date: normDate(rows[i][4]),
        heure: normTime(rows[i][5]),
        photo: clean(rows[i][7]),                              // H : URL photo (optionnel)
        verified: !/^(non|no|n|false|faux|0)$/.test(vraw),      // I : badge « Client vérifié »
        ts: isDate(horod) ? horod.getTime() : i
      });
    }
    out.sort(function (a, b) { return b.ts - a.ts; });  // le plus récent d'abord
    return json({ ok: true, version: CODE_VERSION, reviews: out });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ============ POST : enregistrer un nouvel avis ============ */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var d = JSON.parse(e.postData.contents);
    // Validation + nettoyage CÔTÉ SERVEUR (ne jamais faire confiance au client).
    var nom = clean(d.nom).slice(0, 60);
    var note = Math.max(1, Math.min(5, parseInt(d.note, 10) || 0));
    var commentaire = clean(d.commentaire).slice(0, MAX_LEN);
    if (!nom || !commentaire || !note) return json({ ok: false, error: "Champs invalides." });

    var now = new Date();
    // Apostrophe en tête = force le format texte (Sheets ne reformate pas la date/heure).
    sheet().appendRow([
      now,                                              // A Horodatage (created_at)
      nom,                                              // B Nom
      note,                                             // C Note (1-5)
      commentaire,                                      // D Commentaire
      "'" + Utilities.formatDate(now, tz(), "dd/MM/yyyy"), // E Date
      "'" + Utilities.formatDate(now, tz(), "HH:mm"),      // F Heure
      "En attente",                                     // G Statut (à valider : passe à « Confirmé » pour publier)
      "",                                               // H Photo (optionnel, à coller à la main)
      ""                                                // I Vérifié (vide = badge affiché)
    ]);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
