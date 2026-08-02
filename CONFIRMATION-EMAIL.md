# E-mail de confirmation client (Apps Script + MailApp)

Envoie automatiquement un e-mail au client **dès que le statut passe à
« Confirmé »** dans le Google Sheet. 100 % serveur (ne dépend pas du navigateur
du client ni du site ouvert), avec anti-doublon.

## 1. Diagnostic (cause du problème)
- Le site (`js/booking.js`) envoyait un e-mail **au barbier** via EmailJS à la
  réservation, mais le template **client** était vide → **aucun e-mail client**.
- Apps Script n'envoyait **aucun** e-mail. Quand tu confirmais dans le Sheet, le
  créneau se bloquait (couleur/statut) mais **rien n'était envoyé au client**.
- Solution retenue (ton ordre de préférence n°1) : **Apps Script + MailApp**,
  puisque la confirmation se fait dans le Sheet.

## 2. Fichiers modifiés
- [`google-apps-script/Code.gs`](google-apps-script/Code.gs) — tout est là.
  - nouvelles colonnes N→R (booking_id + suivi e-mail) créées automatiquement ;
  - `processConfirmationEmails_()` branché dans le flux de synchro (déclencheur) ;
  - menu **« Gestion des réservations »** ;
  - liens sécurisés Confirmer/Refuser (`doGet ?action=…`) ;
  - fonction centrale `confirmBooking(bookingId, opts)`.
- Le site (`js/*`) **n'est pas modifié** : EmailJS (notif barbier) continue comme avant.

## 3. À configurer (obligatoire)
En haut de la section e-mail de `Code.gs`, objet **`BIZ`** :
```js
var BIZ = {
  name:  "Rufix Barber",
  email: "infos@rufixbarber.com",   // répond-à + pied de page
  phone: "",                        // optionnel
  site:  "https://rufixbarber.com",
  adminEmail: "",                   // optionnel (voir §7)
  actionBaseUrl: ""                 // optionnel (auto-détecté)
};
```
Rien d'autre. **Aucun secret** n'est exposé côté navigateur ; le jeton de sécurité
est généré et stocké côté serveur (Script Properties).

## 4. Colonnes ajoutées (créées automatiquement, ne pas renommer)
`N booking_id` · `O confirmation_email_sent` · `P confirmation_email_sent_at` ·
`Q confirmation_email_error` · `R confirmation_email_attempts`.
`confirmation_email_sent` = **TRUE** si envoyé, vide sinon.

## 5. Installation (5 min)
1. Feuille des réservations → **Extensions → Apps Script**.
2. Recolle **tout** `Code.gs` → 💾 Enregistrer.
3. **Recharge l'onglet** (F5) → menus **« Rufix Agenda »** et **« Gestion des réservations »**.
4. Menu **Rufix Agenda → 1) Installer la synchro auto** (autorise l'accès Gmail/Agenda).
   → cela (ré)installe le déclencheur `onEdit` + le filet d'1 min qui envoient les e-mails.
5. **Déployer → Gérer les déploiements → ✏️ → Nouvelle version → Déployer** (pour le web app).

## 6. Utilisation
- **Automatique** : passe la colonne **Statut** d'une ligne à **`Confirmé`** →
  l'e-mail part tout seul (quelques secondes, ou ≤ 1 min via le filet).
- **Manuel** : menu **Gestion des réservations** :
  - *Confirmer la réservation sélectionnée* → statut Confirmé + couleur + créneau bloqué + e-mail ;
  - *Envoyer l'e-mail de confirmation* → (si Confirmé, non encore envoyé) ;
  - *Renvoyer l'e-mail de confirmation* → doublon **volontaire** (demande confirmation) ;
  - *Marquer comme refusée* / *Annuler* → statut + e-mail dédié au client ;
  - *Voir la dernière erreur d'envoi*.

## 7. (Optionnel) Boutons Confirmer/Refuser dans l'e-mail admin
Renseigne `BIZ.adminEmail`. À chaque nouvelle réservation, Apps Script envoie un
e-mail admin avec 2 boutons **sécurisés par jeton** (`?action=confirm&id=…&token=…`).
⚠️ Si tu l'actives, **désactive la notif EmailJS** (dans `js/config.js`, vide
`emailjs.templateBarbier`) pour éviter un doublon d'e-mail barbier.

## 8. Anti-doublon (5 vérifs avant envoi)
statut = Confirmé · e-mail valide · `confirmation_email_sent` ≠ TRUE · booking_id
présent · pas déjà envoyé. Après succès → `sent=TRUE`, `sent_at` daté, erreur vidée.
Après échec → `sent` reste vide, erreur enregistrée, `attempts++`, réessai possible.

## 9. Sécurité
- Aucun secret dans le navigateur (le jeton vit dans Script Properties, HMAC-SHA256).
- Les liens admin sont vérifiés par jeton ; un jeton invalide affiche « Lien invalide ».
- Les logs ne montrent jamais le jeton complet ni l'e-mail en clair (masqué : `ab***@…`).

## 10. Fuseau horaire
Tout est formaté en **Europe/Brussels** (`TZ`), y compris le `.ics` — le client
reçoit la date/heure exactement comme dans la réservation.

## Tests à faire (menu + logs via « Exécutions »)
Confirmation normale · sans e-mail · e-mail invalide · déjà confirmée · déjà
envoyé (doublon évité) · renvoi manuel · refus · annulation · double-clic
Confirmer · jeton invalide. Chaque étape est tracée dans les logs (Apps Script → Exécutions).
