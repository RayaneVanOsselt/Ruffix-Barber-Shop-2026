# Système d'avis — Google Sheet DÉDIÉ (séparé des réservations)

Ce système permet à tes clients de laisser un avis (nom, note ⭐ 1-5, commentaire)
depuis le site. L'avis s'enregistre dans un **nouveau** Google Sheet — **différent
de celui des réservations** — et s'affiche automatiquement en carrousel sur le site.

> ✅ Tes réservations ne sont **jamais** touchées : c'est un fichier + un
> déploiement 100 % séparés.

---

## Étape 1 — Créer le nouveau Google Sheet

1. Va sur [sheets.new](https://sheets.new) (nouveau fichier).
2. Renomme-le par ex. **« Rufix Barber — Avis »**.
3. Renomme l'onglet du bas (par défaut « Feuille 1 ») en **`Avis`** (exactement, avec la majuscule).
4. En **ligne 1**, mets ces 7 en-têtes, une par colonne (A → G) :

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Horodatage | Nom | Note | Commentaire | Date | Heure | Statut |

---

## Étape 2 — Coller le script

1. Dans ce fichier : menu **Extensions → Apps Script**.
2. Efface le code par défaut, colle **tout** le contenu de
   [`google-apps-script/Avis-Code.gs`](google-apps-script/Avis-Code.gs).
3. Clique sur **💾 Enregistrer**.

---

## Étape 3 — Déployer en application web

1. En haut à droite : **Déployer → Nouveau déploiement**.
2. Roue crantée ⚙️ → **Application Web**.
3. Réglages :
   - **Description** : `Avis Rufix`
   - **Exécuter en tant que** : **Moi**
   - **Qui a accès** : **Tout le monde**
4. **Déployer** → autorise l'accès (choisis ton compte Google, « Autoriser »).
5. Copie l'**URL de l'application web** (elle se termine par `/exec`).

> ⚠️ **À chaque fois que tu modifies le script**, il faut refaire
> **Déployer → Gérer les déploiements → ✏️ modifier → Nouvelle version**,
> sinon l'ancienne version reste en ligne.

---

## Étape 4 — Brancher le site

Ouvre [`js/config.js`](js/config.js), section **`reviewsBackend`**, et colle l'URL :

```js
reviewsBackend: {
  url: "https://script.google.com/macros/s/AKfy..../exec"
}
```

Enregistre, puis mets le site en ligne. C'est tout : le formulaire et le
carrousel se remplissent automatiquement. 🎉

---

## Comment ça marche au quotidien — MODÉRATION

Chaque avis est **vérifié par toi avant d'être visible sur le site**. Rien ne
s'affiche automatiquement.

1. Un client remplit le formulaire → il voit le message *« Votre avis a bien été
   reçu. Il sera vérifié puis publié. »*
2. La ligne arrive dans la feuille `Avis` avec le **Statut `En attente`**.
   → l'avis **n'apparaît PAS** encore sur le site.
3. Tu lis l'avis dans la feuille. Dans la colonne **Statut** (colonne G) :

   | Tu écris… | Effet sur le site |
   |---|---|
   | **`Confirmé`** | ✅ L'avis est **publié** (visible dans le carrousel). |
   | **`En attente`** | ⏳ En attente de ta validation (caché) — c'est la valeur de départ. |
   | **`Refusé`** ou **`Masqué`** (ou n'importe quoi d'autre) | 🚫 Reste caché du site. |

> 💡 Astuce : pour valider vite, remplace `En attente` par `Confirmé` sur la
> ligne, et l'avis apparaît en quelques secondes (au prochain chargement de la page).

## Sécurité intégrée

- Le nom et le commentaire sont **nettoyés** (balises HTML retirées) côté serveur
  ET **échappés** côté site → aucune injection de code possible.
- Note forcée entre **1 et 5**, commentaire limité à **500 caractères**.
- Verrou (`LockService`) pour éviter deux écritures simultanées.
