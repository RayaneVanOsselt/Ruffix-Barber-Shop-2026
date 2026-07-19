/* =====================================================================
   RUFIX BARBER — FICHIER DE CONFIGURATION CENTRAL
   =====================================================================
   👉 C'EST LE SEUL FICHIER À MODIFIER pour gérer le salon au quotidien.
      Aucune connaissance en code n'est nécessaire : changez uniquement
      les valeurs entre guillemets ou les nombres. Ne touchez pas aux
      noms à gauche des deux-points (ex : "telephone").

   Sommaire :
     1. INFOS DU SALON (nom, adresse, téléphone, email, réseaux…)
     2. HORAIRES D'OUVERTURE (par jour de la semaine)
     3. JOURS FERMÉS / VACANCES (dates entières bloquées)
     4. CRÉNEAUX INDISPONIBLES (heures précises déjà prises)
     5. SERVICES (prix et durées)
     6. RÉGLAGES DE RÉSERVATION (pas de temps, délais…)
     7. EMAILJS (envoi des demandes par email)
   ===================================================================== */

const CONFIG = {

  /* -------------------------------------------------------------------
     1. INFOS DU SALON
     -------------------------------------------------------------------
     Remplacez chaque [PLACEHOLDER] par la vraie information.
     La VILLE est utilisée pour le référencement (SEO) : changez-la ici,
     elle se met à jour partout automatiquement.
  ------------------------------------------------------------------- */
  salon: {
    nom:        "Rufix Barber",
    slogan:     "L'art de la coupe masculine",
    ville:      "[VILLE]",                          // ex : "Bruxelles"
    adresse:    "[Rue et numéro]",                  // ex : "Rue de la Coupe 12"
    codePostal: "[Code postal]",                    // ex : "1000"
    telephone:  "[+32 4XX XX XX XX]",               // affiché ET cliquable
    email:      "vanosselt.rayane@gmail.com",       // email public du salon
    // Position sur la carte Google Maps (voir README pour générer le lien).
    // Laissez tel quel pour une position fictive, ou collez votre propre iframe src.
    mapsEmbed:  "https://www.google.com/maps?q=Grand-Place%2C%20Bruxelles&output=embed",
    // Lien "Itinéraire" (bouton) — ouvre Google Maps avec l'adresse.
    mapsLink:   "https://www.google.com/maps/search/?api=1&query=Rufix+Barber",
    // --- Réseaux sociaux (URL nettoyées des paramètres de suivi) ---
    instagram:      "https://www.instagram.com/rufixbarber",   // compte du salon
    instagramPerso: "https://www.instagram.com/rufiiix___",    // compte personnel
    tiktok:         "https://www.tiktok.com/@rufixbarber",     // TikTok du salon
    facebook:       "",                                        // pas de page Facebook (laisser vide = icône masquée)
    // Adresse du site en ligne (sert au SEO / partages). À adapter après mise en ligne.
    siteUrl:    "https://rufixbarber.example.com/"
  },

  /* -------------------------------------------------------------------
     2. HORAIRES D'OUVERTURE (par jour)
     -------------------------------------------------------------------
     Pour CHAQUE jour :
       ouvert : true  = le salon travaille ce jour-là
                false = fermé toute la journée (aucun créneau proposé)
       debut  : heure d'ouverture au format "HH:MM" (ex "09:00")
       fin    : heure de fermeture au format "HH:MM" (ex "18:00")
                → dernier créneau proposé = fin - durée du service.
       pause  : (optionnel) fermeture le midi. Mettez null si pas de pause.
                Exemple de pause : { debut: "12:30", fin: "13:30" }
  ------------------------------------------------------------------- */
  horaires: {
    lundi:    { ouvert: true,  debut: "09:00", fin: "18:00", pause: { debut: "12:30", fin: "13:30" } },
    mardi:    { ouvert: true,  debut: "09:00", fin: "18:00", pause: { debut: "12:30", fin: "13:30" } },
    mercredi: { ouvert: true,  debut: "09:00", fin: "18:00", pause: { debut: "12:30", fin: "13:30" } },
    jeudi:    { ouvert: true,  debut: "09:00", fin: "19:00", pause: { debut: "12:30", fin: "13:30" } },
    vendredi: { ouvert: true,  debut: "09:00", fin: "19:00", pause: { debut: "12:30", fin: "13:30" } },
    samedi:   { ouvert: true,  debut: "08:30", fin: "17:00", pause: null },
    dimanche: { ouvert: false, debut: "00:00", fin: "00:00", pause: null }   // fermé
  },

  /* -------------------------------------------------------------------
     3. JOURS FERMÉS / VACANCES (dates entières bloquées)
     -------------------------------------------------------------------
     Ajoutez les dates où le salon est fermé exceptionnellement
     (congés, jours fériés…). Format "AAAA-MM-JJ".
     Exemple : "2026-12-25" pour Noël.
  ------------------------------------------------------------------- */
  joursFermes: [
    "2026-12-25",   // Noël
    "2026-01-01"    // Jour de l'An
    // "2026-07-21",  // ← exemple : ajoutez vos propres dates ici
  ],

  /* -------------------------------------------------------------------
     4. CRÉNEAUX INDISPONIBLES (heures précises déjà réservées/bloquées)
     -------------------------------------------------------------------
     Bloquez une heure précise d'une journée précise pour qu'elle
     n'apparaisse plus dans le calendrier.
     Format : { date: "AAAA-MM-JJ", heure: "HH:MM" }
     💡 Comme il n'y a pas de serveur (site 100% statique), c'est ici
        que vous « rayez » manuellement les créneaux déjà pris.
  ------------------------------------------------------------------- */
  creneauxBloques: [
    // { date: "2026-07-14", heure: "10:00" },
    // { date: "2026-07-14", heure: "10:15" },
  ],

  /* -------------------------------------------------------------------
     5. SERVICES (prix et durées)
     -------------------------------------------------------------------
     id       : identifiant technique (ne pas changer)
     nom      : nom affiché
     prix     : nombre en euros
     duree    : durée EN MINUTES (sert à calculer le dernier créneau)
     dureeTxt : durée affichée au client
     image    : photo dans /images/
  ------------------------------------------------------------------- */
  services: [
    {
      id: "coupe",
      nom: "Coupe",
      prix: 30,
      duree: 45,
      dureeTxt: "45 minutes",
      image: "images/service-coupe.jpg",
      alt: "Coiffeur réalisant une coupe homme précise à la tondeuse",
      desc: "Coupe sur-mesure au ciseau et à la tondeuse, finitions au rasoir et coiffage soigné."
    },
    {
      id: "barbe",
      nom: "Barbe",
      prix: 25,
      duree: 30,
      dureeTxt: "30 minutes",
      image: "images/service-barbe.jpg",
      alt: "Taille et entretien de barbe au salon de barbier",
      desc: "Taille, dessin des contours et rasage à l'ancienne, serviette chaude et soin apaisant."
    },
    {
      id: "coupe-barbe",
      nom: "Coupe + barbe",
      prix: 45,
      duree: 60,
      dureeTxt: "1 heure",
      image: "images/service-coupe-barbe.jpg",
      alt: "Homme après une prestation complète coupe et barbe",
      desc: "L'expérience complète : coupe sur-mesure et barbe travaillée pour un résultat impeccable."
    }
  ],

  /* -------------------------------------------------------------------
     6. RÉGLAGES DE RÉSERVATION
     -------------------------------------------------------------------
     pasMinutes      : intervalle entre deux créneaux (15 = 09:00, 09:15…)
     delaiMiniHeures : délai minimum avant un rendez-vous (en heures).
                       Ex : 2 = on ne peut pas réserver pour dans moins de 2h.
     dateMax         : dernière date réservable (incluse).
     ouverture       : règle d'ouverture hebdomadaire glissante (voir ci-dessous).
  ------------------------------------------------------------------- */
  reservation: {
    pasMinutes: 15,
    delaiMiniHeures: 2,

    // Date maximale réservable (incluse). Aucun créneau proposé au-delà.
    dateMax: "2026-12-31",

    // OUVERTURE HEBDOMADAIRE GLISSANTE
    // Une semaine (lundi → dimanche) s'ouvre à la réservation dès qu'on a
    // dépassé le "vendredi 21h" de la semaine qui la précède.
    //   → concrètement : ce vendredi 21h ouvre la semaine suivante.
    // Les semaines pas encore ouvertes restent visibles mais verrouillées.
    // Mettez  ouverture: null  pour tout ouvrir immédiatement (sans règle).
    ouverture: { jour: 5, heure: 21 }   // jour : 0=dim … 5=vendredi ; heure : 21 = 21h
  },

  /* -------------------------------------------------------------------
     7. EMAILJS — envoi des demandes de rendez-vous par email
     -------------------------------------------------------------------
     EmailJS permet d'envoyer un email depuis un site statique, SANS serveur.
     👉 Tant que ces 3 valeurs restent vides ("") ou "XXX", le site bascule
        automatiquement sur le mode « mailto » (ouverture de la messagerie
        du client pré-remplie vers l'email du salon). Le site fonctionne donc
        même sans EmailJS configuré.

     Pour activer l'envoi automatique (voir README, section EmailJS) :
       1. Créez un compte gratuit sur https://www.emailjs.com
       2. Récupérez votre Public Key, Service ID et Template ID
       3. Collez-les ci-dessous.

     Variables disponibles dans vos templates EmailJS :
       {{service}} {{date}} {{heure}} {{prenom}} {{nom}}
       {{telephone}} {{email}} {{message}} {{prix}} {{duree}}
  ------------------------------------------------------------------- */
  emailjs: {
    publicKey:         "k2JkXtD2RO8TkoO77",   // Public Key EmailJS
    serviceId:         "service_nm7lzla",     // Service ID EmailJS
    templateBarbier:   "template_xhi4eqj",    // template de la DEMANDE DE RDV (envoyé au barbier)
    templateClient:    "",                    // accusé de réception AU CLIENT : désactivé (géré manuellement par le barbier)
    // Template dédié au FORMULAIRE DE CONTACT (message libre).
    // Tant qu'il est vide, le formulaire de contact réutilise templateBarbier.
    templateContact:   ""                     // ex : "template_zzzzzzz"
  },

  /* -------------------------------------------------------------------
     8. BACKEND GOOGLE SHEET — blocage automatique des créneaux
     -------------------------------------------------------------------
     Permet de bloquer un créneau AUTOMATIQUEMENT pour tous les visiteurs
     dès qu'une personne le demande (via un Google Sheet + Apps Script).

     👉 Tant que « url » est vide (""), le site fonctionne comme avant :
        blocage manuel via creneauxBloques ci-dessus. Aucune régression.

     Pour activer (voir BACKEND-GOOGLE-SHEET.md) :
       1. Crée le Google Sheet + colle le script (google-apps-script/Code.gs)
       2. Déploie-le en « Application Web » (accès : Tout le monde)
       3. Colle ici l'URL qui finit par /exec
  ------------------------------------------------------------------- */
  backend: {
    url: ""   // ex : "https://script.google.com/macros/s/AKfy.../exec"
  },

  /* -------------------------------------------------------------------
     9. ASSISTANT VIRTUEL (bouton de chat flottant)
     -------------------------------------------------------------------
     L'assistant répond aux questions des clients en utilisant les
     informations RÉELLES de ce fichier (services, tarifs, horaires,
     créneaux libres…) et la FAQ de la page. Il fonctionne hors ligne,
     gratuitement, sans aucune clé.

     actif        : false pour désactiver complètement l'assistant.
     nom          : nom affiché en haut de la fenêtre de chat.
     messageAccueil : première phrase affichée au visiteur.

     aiProxyUrl   : (optionnel, pour plus tard) URL d'un relais qui appelle
        une vraie IA (Claude…). ⚠️ NE JAMAIS mettre de clé API ici : ce
        fichier est public. La clé doit rester sur le relais (Apps Script).
        Vide = moteur local uniquement.
  ------------------------------------------------------------------- */
  assistant: {
    actif: true,
    nom: "Assistant Rufix",
    messageAccueil: "Bonjour 👋 Je suis l'assistant de Rufix Barber. Je peux vous renseigner sur les prestations, les tarifs, les horaires, et vous guider pour réserver.",
    aiProxyUrl: ""
  }
};

/* Rendre CONFIG accessible aux autres scripts (booking.js, main.js). */
window.CONFIG = CONFIG;
