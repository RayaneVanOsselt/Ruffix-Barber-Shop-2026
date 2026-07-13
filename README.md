# Rufix Barber — Site web

Site vitrine **premium** pour un salon de barbier, avec demande de rendez-vous en ligne
(confirmation manuelle par le barbier). 100 % **HTML / CSS / JavaScript** — aucun framework,
aucune étape de build. Il suffit d'ouvrir `index.html` ou de pousser les fichiers sur
GitHub Pages.

---

## 📁 Structure des fichiers

```
.
├── index.html                      ← page principale (one-page)
├── mentions-legales.html           ← page légale
├── politique-confidentialite.html  ← page légale (RGPD)
├── css/
│   ├── base.css                    ← 🎨 variables de marque, reset, typographie
│   ├── components.css              ← navbar, hero, cartes, formulaires, footer…
│   └── animations.css              ← révélations au scroll, prefers-reduced-motion
├── js/
│   ├── config.js                   ← ⭐ TOUTES les données éditables du salon
│   ├── booking.js                  ← calendrier + créneaux + envoi de la demande
│   └── main.js                     ← navigation, scroll, lightbox, FAQ, contact
├── images/                         ← logo, favicon, photos (à remplacer)
├── robots.txt · sitemap.xml        ← SEO
├── CNAME.example                   ← modèle pour un domaine personnalisé
└── .nojekyll                       ← sert les fichiers tels quels sur GitHub Pages
```

Chaque bloc visuel (navbar, hero, carte service, carte avis, item FAQ, footer…) est un
**composant réutilisable** identifié par des classes CSS cohérentes.

---

## ✅ Checklist avant mise en ligne (ordre conseillé)

### 1. Le logo
- Déposez votre logo dans `images/` (idéalement `logo.svg`, sinon `logo.png`).
- S'il s'appelle autrement, remplacez `images/logo.svg` dans `index.html`, le footer et les
  deux pages légales (recherchez `logo.svg`).
- Remplacez aussi `images/favicon.svg` (icône de l'onglet).

### 2. Les couleurs de marque
- Ouvrez **`css/base.css`** → bloc `:root` tout en haut (encadré « CHARTE GRAPHIQUE »).
- Modifiez uniquement ces variables ; tout le site se met à jour automatiquement :
  | Variable | Rôle |
  |---|---|
  | `--color-bg` | fond principal (anthracite/noir) |
  | `--color-surface` | cartes et encarts |
  | `--color-text` | texte principal |
  | `--color-muted` | texte secondaire |
  | `--color-accent` | couleur d'accent (or/laiton) |
  | `--color-accent-hover` | accent au survol |
- ⚠️ Aucune couleur n'est codée en dur ailleurs : **ne changez que ce bloc**.

### 3. Les informations du salon
- Ouvrez **`js/config.js`** — c'est le **seul fichier à éditer au quotidien**.
- Remplacez chaque `[PLACEHOLDER]` : `ville`, `adresse`, `codePostal`, `telephone`,
  `email`, `instagram`, `facebook`, `mapsEmbed`, `mapsLink`, `siteUrl`.
- Ces valeurs se propagent automatiquement dans la page (contact, footer…).

### 4. Le SEO / la ville
- Dans **`index.html`**, remplacez `[VILLE]` (titre, meta description, Open Graph, JSON-LD).
- Vérifiez le bloc `application/ld+json` (données Google) : nom, adresse, téléphone, horaires, `geo`.
- Remplacez `https://rufixbarber.example.com/` par votre vraie URL dans :
  `index.html` (canonical + Open Graph), `robots.txt`, `sitemap.xml`.

### 5. Les horaires & disponibilités
- Dans **`js/config.js`** :
  - `horaires` : heures d'ouverture par jour (`ouvert: true/false`, `debut`, `fin`, `pause`).
  - `joursFermes` : dates entières fermées (vacances, fériés), format `"AAAA-MM-JJ"`.
  - `creneauxBloques` : heures précises déjà prises, `{ date: "AAAA-MM-JJ", heure: "HH:MM" }`.
- Le calendrier et les créneaux de 15 min se recalculent tout seuls.

### 6. Les photos
- Remplacez les fichiers de `images/` par vos vraies photos (mêmes noms = rien d'autre à changer).
- Conseil : compressez-les (format **WebP** recommandé, largeur ~1600 px pour le hero,
  ~800 px pour les cartes). Gardez un `alt` en français descriptif.
- Sources des photos de démonstration (Unsplash, libres de droits) — **voir plus bas**.

### 7. Les avis clients
- Dans `index.html`, section `id="avis"` : remplacez les 3 avis de démonstration par de vrais avis.

### 8. EmailJS (envoi des demandes par email) — voir section dédiée ci-dessous.

---

## ✉️ Configurer EmailJS

Sans backend, l'envoi d'email se fait côté client via **EmailJS** (offre gratuite suffisante).
**Tant qu'EmailJS n'est pas configuré, le site bascule automatiquement sur un repli `mailto`**
(ouverture de la messagerie du client pré-remplie vers l'email du salon). Le site fonctionne
donc dès le premier jour, même sans EmailJS.

Pour activer l'envoi automatique :

1. Créez un compte gratuit sur <https://www.emailjs.com>.
2. **Email Services** → ajoutez votre boîte mail → notez le **Service ID** (`service_xxx`).
3. **Email Templates** → créez un template pour le barbier (la demande à valider) →
   notez le **Template ID** (`template_xxx`). Variables utilisables dans le template :
   `{{service}} {{date}} {{heure}} {{prenom}} {{nom}} {{telephone}} {{email}} {{prix}} {{duree}}`.
   (Optionnel) créez un 2ᵉ template de courtoisie envoyé **au client** (« demande reçue,
   en attente de confirmation »).
4. **Account** → copiez votre **Public Key**.
5. Collez ces valeurs dans `js/config.js` → objet `emailjs` :
   ```js
   emailjs: {
     publicKey:       "votre_public_key",
     serviceId:       "service_xxx",
     templateBarbier: "template_xxx",   // demande envoyée au barbier
     templateClient:  "template_yyy"    // (optionnel) accusé au client
   }
   ```

### Changer de fournisseur (Formspree, Google Form, mailto…)
L'envoi est isolé dans **une seule fonction** `sendReservation(payload)` de `js/booking.js`.
Pour utiliser Formspree ou un Google Form, remplacez le contenu de cette fonction — le reste
du code ne change pas. Le repli `mailto` reste disponible comme filet de sécurité.

---

## ⚠️ Limite importante (site statique)

GitHub Pages ne sert que des fichiers statiques : il n'y a **pas de serveur**. Il est donc
**impossible de verrouiller un créneau en temps réel** entre plusieurs visiteurs. La
disponibilité est pilotée par `config.js`, que le propriétaire édite à la main (jours fermés,
créneaux bloqués). Chaque demande étant **confirmée manuellement** par le barbier, cela reste
cohérent avec le fonctionnement d'un salon privé.

👉 **Évolution recommandée** : brancher **Google Calendar** ou un petit backend pour retirer
automatiquement les créneaux réservés.

---

## 🚀 Déployer sur GitHub Pages

1. Créez un dépôt GitHub (ex. `rufix-barber`) et poussez tous ces fichiers à la racine :
   ```bash
   git init
   git add .
   git commit -m "Site Rufix Barber"
   git branch -M main
   git remote add origin https://github.com/VOTRE-COMPTE/rufix-barber.git
   git push -u origin main
   ```
2. Sur GitHub : **Settings → Pages → Build and deployment → Source : Deploy from a branch**,
   branche `main`, dossier `/ (root)`, puis **Save**.
3. Le site est en ligne sous quelques minutes à l'adresse
   `https://VOTRE-COMPTE.github.io/rufix-barber/`.
   Tous les chemins sont **relatifs** : le site fonctionne aussi bien à la racine d'un domaine
   que dans un sous-dossier `/rufix-barber/`.

### Domaine personnalisé (optionnel)
- Renommez `CNAME.example` en **`CNAME`** et mettez-y votre domaine (ex. `www.rufixbarber.be`),
  une seule ligne, sans `http`.
- Chez votre registrar, faites pointer le domaine vers GitHub Pages (enregistrements DNS).
- Renseignez ce domaine dans **Settings → Pages → Custom domain**, et cochez **Enforce HTTPS**.

### Test en local
Ouvrez simplement `index.html` dans un navigateur, ou lancez un petit serveur :
```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

---

## 🖼️ Sources des photos de démonstration (Unsplash — libres de droits)

À remplacer par vos propres visuels. Photos issues d'Unsplash (licence gratuite) :

| Fichier | Source Unsplash |
|---|---|
| `hero-barbershop.jpg` / `og-share.jpg` | https://unsplash.com/photos/photo-1585747860715-2ba37e788b70 |
| `salon-interieur.jpg` | https://unsplash.com/photos/photo-1512690459411-b9245aed614b |
| `service-coupe.jpg` / `galerie-1.jpg` | https://unsplash.com/photos/photo-1503951914875-452162b0f3f1 |
| `service-barbe.jpg` | https://unsplash.com/photos/photo-1599351431202-1e0f0137899a |
| `service-coupe-barbe.jpg` | https://unsplash.com/photos/photo-1621605815971-fbc98d665033 |
| `galerie-2.jpg` | https://unsplash.com/photos/photo-1596728325488-58c87691e9af |
| `galerie-3.jpg` | https://unsplash.com/photos/photo-1605497788044-5a32c7078486 |
| `galerie-4.jpg` | https://unsplash.com/photos/photo-1622286342621-4bd786c2447c |
| `galerie-5.jpg` | https://unsplash.com/photos/photo-1503443207922-dff7d543fd0e |
| `galerie-6.jpg` | https://unsplash.com/photos/photo-1517832606299-7ae9b720a186 |

> 💡 Les images sont livrées en **JPEG optimisé**. Pour un poids encore plus léger, convertissez-les
> en **WebP** (ex. via <https://squoosh.app>) puis mettez à jour les extensions dans le HTML.

---

## 🧩 Récapitulatif : « où changer quoi »

| Je veux changer… | Fichier |
|---|---|
| Couleurs / charte | `css/base.css` (bloc `:root`) |
| Logo / favicon | `images/logo.svg`, `images/favicon.svg` |
| Adresse, téléphone, email, réseaux | `js/config.js` (`salon`) |
| Horaires, jours fermés, créneaux pris | `js/config.js` (`horaires`, `joursFermes`, `creneauxBloques`) |
| Prix / durées des services | `js/config.js` (`services`) **et** cartes dans `index.html` |
| Envoi des emails | `js/config.js` (`emailjs`) |
| Ville / SEO | `index.html` (`[VILLE]`, JSON-LD) |
| Avis clients | `index.html` (section `#avis`) |
| Textes des pages légales | `mentions-legales.html`, `politique-confidentialite.html` |

Bonne mise en ligne ✂️
