# Blocage automatique des créneaux — Google Sheet (gratuit)

Ce guide branche ton site à un **Google Sheet** qui sert de mini-agenda : dès
qu'une personne demande un créneau, il s'inscrit dans le Sheet et **disparaît
automatiquement du site pour tous les autres visiteurs**. Le salon reste en
**confirmation manuelle** (chaque demande arrive avec le statut « En attente »).

- 100 % gratuit, rien à installer, ton site reste sur GitHub Pages.
- Tu gardes un tableau clair de toutes tes demandes dans Google Sheets.

> ⚙️ Tant que le champ `backend.url` de `js/config.js` est vide, le site
> fonctionne à l'ancienne (blocage manuel). Suis ce guide pour activer l'automatique.

---

## Étape 1 — Créer le Google Sheet

1. Va sur <https://sheets.google.com> → **Feuille de calcul vierge**.
2. En bas, **renomme l'onglet** (double-clic sur « Feuille 1 ») en : **`Reservations`**
   *(exactement ce mot, avec un R majuscule, sans accent).*
3. Sur la **ligne 1**, mets ces **10 en-têtes**, une par colonne (A → J) :

   | A | B | C | D | E | F | G | H | I | J |
   |---|---|---|---|---|---|---|---|---|---|
   | Horodatage | Date | Heure | Service | DureeMin | Prenom | Nom | Telephone | Email | Statut |

---

## Étape 2 — Ajouter le script

1. Dans le Sheet : menu **Extensions → Apps Script**.
2. Efface le contenu par défaut, puis **colle tout le contenu** du fichier
   [`google-apps-script/Code.gs`](google-apps-script/Code.gs) de ton projet.
3. Clique sur l'icône **💾 Enregistrer**.

---

## Étape 3 — Déployer en « Application Web »

1. En haut à droite : **Déployer → Nouveau déploiement**.
2. Clique sur la roue crantée ⚙️ → choisis **Application Web**.
3. Règle :
   - **Description** : `Rufix Barber` (peu importe)
   - **Exécuter en tant que** : **Moi**
   - **Qui a accès** : **Tout le monde**  ⚠️ (indispensable pour que le site puisse écrire)
4. Clique **Déployer**.
5. Google demande une autorisation la première fois :
   **Autoriser l'accès** → choisis ton compte → « Paramètres avancés » →
   « Accéder à … (non sécurisé) » → **Autoriser**. *(C'est ton propre script, c'est normal.)*
6. Copie l'**URL de l'application Web** : elle se termine par **`/exec`**.

---

## Étape 4 — Coller l'URL dans le site

Dans **`js/config.js`**, section `backend`, colle l'URL :

```js
backend: {
  url: "https://script.google.com/macros/s/AKfy....../exec"
}
```

Enregistre, puis **mets le site à jour en ligne** (commit sur GitHub, comme d'habitude).
C'est tout : le blocage automatique est actif. 🎉

---

## Comment ça marche au quotidien

- Un client demande un créneau → une ligne apparaît dans ton Sheet avec le statut
  **« En attente »**, et le créneau **disparaît du site** immédiatement (pour tous).
- Tu reçois toujours l'email EmailJS de la demande.
- Tu confirmes le client (en répondant à son email). Tu peux, si tu veux, écrire
  **« Confirmé »** dans la colonne **Statut** pour t'y retrouver.

### Refuser / annuler un rendez-vous (libérer le créneau)
Pour **re-libérer** un créneau (client qui annule, ou demande refusée) :
- Écris **`Annulé`** ou **`Refusé`** dans la colonne **Statut** de la ligne,
  **ou** supprime simplement la ligne.
- Le créneau **redevient disponible** sur le site automatiquement.

### Bloquer un créneau à la main (sans passer par le site)
Tu peux aussi ajouter toi-même une ligne dans le Sheet (Date, Heure, Service,
DureeMin) pour bloquer un moment — pratique pour un rendez-vous pris par téléphone.
`DureeMin` = durée en minutes (Coupe = 45, Barbe = 30, Coupe + barbe = 60).

---

## Important à savoir

- **Confirmation toujours manuelle** : le Sheet bloque le créneau, mais c'est
  toujours toi qui valides le rendez-vous auprès du client. Rien n'est confirmé
  automatiquement côté client.
- **Anti double-réservation** : si deux personnes visent le même créneau en même
  temps, le script en accepte une seule et affiche à l'autre « créneau déjà pris ».
- **Si le Sheet est injoignable** (rare), le site ne bloque pas le client : la
  demande part quand même par email, et tu gères manuellement. Aucune demande n'est perdue.
- **Après avoir modifié le script** (`Code.gs`), il faut **redéployer** :
  Déployer → **Gérer les déploiements** → ✏️ → **Version : Nouvelle version** → Déployer.
  (L'URL `/exec` reste la même.)
