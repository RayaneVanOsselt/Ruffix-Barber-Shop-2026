# Synchronisation Réservations → Google Agenda

Chaque réservation de ta feuille **Reservations** est automatiquement créée
dans un **calendrier Google Agenda dédié** — que tu peux partager et consulter
sur tous tes appareils. Modifs et annulations sont répercutées toutes seules,
**sans doublon**.

> Tout est déjà codé dans [`google-apps-script/Code.gs`](google-apps-script/Code.gs)
> (le backend des réservations). Il n'y a rien à programmer — juste à installer.

---

## Ce que ça fait

| Dans la feuille… | …dans Google Agenda |
|---|---|
| Nouvelle ligne de réservation | ✅ Événement **créé** |
| Tu modifies l'heure / la date / le service / les infos | 🔄 Événement **mis à jour** |
| Statut passé à **`Annulé`** ou **`Refusé`** | 🗑️ Événement **supprimé** |

- **Titre** de l'événement : `Prénom Nom – Service`
- **Description** : client, service, date, heure début → fin, durée, téléphone,
  e-mail, notes, statut.
- **Heure de fin** calculée automatiquement à partir de la durée du service.

Le script ajoute 3 colonnes à ta feuille (créées toutes seules) :
`K = Notes`, `L = ID Agenda`, `M = Sync`.
👉 **Ne touche pas aux colonnes L et M** : ce sont elles qui relient chaque
réservation à son événement (pour le retrouver, le modifier ou le supprimer).

---

## Installation (une seule fois, ~3 min)

1. Ouvre le Google Sheet des **réservations** → **Extensions → Apps Script**.
2. Remplace le contenu par la dernière version de
   [`google-apps-script/Code.gs`](google-apps-script/Code.gs) → 💾 **Enregistrer**.
3. **Recharge l'onglet du Google Sheet** (F5). Un nouveau menu apparaît :
   **« Rufix Agenda »**.
4. Menu **Rufix Agenda → « 1) Installer la synchro auto »**.
5. Google demande une autorisation (accès à l'Agenda + au Sheet) → **Autoriser**
   avec ton compte. Relance l'étape 4 si besoin après l'autorisation.

C'est fini. Au premier lancement, le script :
- crée le calendrier **« Rufix Barber — Réservations »** ;
- installe 2 déclencheurs automatiques :
  - **à chaque modification** de la feuille → synchro immédiate ;
  - **toutes les minutes** → filet de sécurité (rattrape les nouvelles résas du site) ;
- synchronise tout de suite les réservations déjà présentes.

### (Optionnel) Synchro *vraiment* instantanée pour les résas du site

La feuille reçoit les résas du site via le **web app**. Pour que l'événement
soit créé **à la seconde** (au lieu de ≤ 1 min via le filet de sécurité),
il faut **redéployer** le web app après avoir collé le nouveau code :
**Déployer → Gérer les déploiements → ✏️ → Nouvelle version → Déployer**.
Sans ce redéploiement, tout fonctionne quand même — juste avec ≤ 1 minute de délai.

---

## Partager le calendrier

Dans **Google Agenda** (calendar.google.com), à gauche, survole
**« Rufix Barber — Réservations »** → **⋮ → Paramètres et partage** :

- **Partager avec des personnes précises** → ajoute une adresse e-mail et choisis
  le droit : *Voir tous les détails* (lecture) ou *Apporter des modifications*.
- Le calendrier est aussi disponible dans l'app Google Agenda sur **ton téléphone**
  (coche-le dans la liste des agendas).

---

## Bon à savoir

- **Aucun doublon** : chaque ligne garde l'ID de son événement (colonne L). Le
  script met à jour l'événement existant au lieu d'en recréer un.
- **Annulation** : passe le **Statut** de la ligne à `Annulé` (ou `Refusé`) →
  l'événement disparaît de l'agenda. (Supprimer la ligne entière du Sheet ne
  supprime pas l'événement : préfère le statut `Annulé`.)
- **Sécurité** : rien n'est exposé publiquement ; la synchro tourne sous ton
  compte Google. Si l'agenda est momentanément indisponible, l'enregistrement
  de la réservation n'est jamais bloqué.
- **Menu → « 2) Synchroniser maintenant »** : force une resynchro à la demande.
