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
    ville:      "Etterbeek",                         // commune affichée
    adresse:    "",                                  // (masqué) adresse postale non affichée
    codePostal: "1040",                              // code postal d'Etterbeek
    telephone:  "",                                  // (masqué) numéro non affiché
    email:      "infos@rufixbarber.com",             // email public du salon
    // --- Réseaux sociaux (URL nettoyées des paramètres de suivi) ---
    instagram:      "https://www.instagram.com/rufixbarber",   // compte du salon
    instagramPerso: "https://www.instagram.com/rufiiix___",    // compte personnel
    tiktok:         "https://www.tiktok.com/@rufixbarber",     // TikTok du salon
    facebook:       "",                                        // pas de page Facebook (laisser vide = icône masquée)
    // Adresse du site en ligne (sert au SEO / partages). À adapter après mise en ligne.
    siteUrl:    "https://rufixbarber.com/"
  },

  /* -------------------------------------------------------------------
     1 bis. JOURS INDISPONIBLES — RENVOI VERS UN SALON PARTENAIRE
     -------------------------------------------------------------------
     Message affiché pour les jours marqués « indispo: true » dans les
     horaires (voir section 2). Le nom devient un lien cliquable.
       message    : phrase affichée dans la bannière (suivie du nom + « . »)
       labelColonne : texte vertical affiché dans les colonnes concernées
       nom / url  : nom et lien de réservation du salon partenaire
  ------------------------------------------------------------------- */
  partenaireIndispo: {
    message:      "Ces jours-là, Rufix vous coiffe au salon partenaire — réservez directement chez",
    labelColonne: "Réserver chez le partenaire",
    nom:          "Mathieu Nayis Schaerbeek",
    url:          "https://salonkee.be/salon/mathieu-nayis-schaerbeek?lang=fr"
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
       indispo: (optionnel) true = jour NON travaillé mais avec renvoi vers
                le salon partenaire (voir section 1 bis « partenaireIndispo »).
                Différent de « fermé » : affiche un message + lien de résa.
  ------------------------------------------------------------------- */
  horaires: {
    lundi:    { ouvert: true,  debut: "11:00", fin: "21:00", pause: null },
    mardi:    { ouvert: true,  debut: "11:00", fin: "21:00", pause: null },
    mercredi: { ouvert: false, debut: "00:00", fin: "00:00", pause: null, indispo: true },
    jeudi:    { ouvert: false, debut: "00:00", fin: "00:00", pause: null, indispo: true },
    vendredi: { ouvert: true,  debut: "11:00", fin: "21:00", pause: null },
    samedi:   { ouvert: true,  debut: "11:00", fin: "21:00", pause: null },
    dimanche: { ouvert: false, debut: "00:00", fin: "00:00", pause: null, surDemande: true }   // fermé, mais sur demande
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
    "2026-01-01",   // Jour de l'An
    "2026-08-23",   // Indisponible (personnel)
    "2026-08-24"    // Indisponible (personnel)
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
     ouvertureMensuelle : true = réservation MOIS par MOIS. Le mois suivant
                       s'ouvre ENTIÈREMENT le « jourOuvertureMoisSuivant » du
                       mois en cours. Ex. le 25 juillet → tout le mois d'août
                       s'ouvre ; le 25 août → tout septembre ; etc.
     jourOuvertureMoisSuivant : jour du mois (1-28) où le mois suivant s'ouvre.
     dateMax         : garde-fou : dernière date réservable absolue (incluse).
     ouverture       : règle d'ouverture hebdomadaire glissante (voir ci-dessous).
  ------------------------------------------------------------------- */
  reservation: {
    pasMinutes: 15,
    delaiMiniHeures: 2,

    // Réservation MOIS par MOIS : le mois suivant s'ouvre en entier le 25 du
    // mois en cours (25 juillet → tout août ; 25 août → tout septembre ; …).
    ouvertureMensuelle: true,
    jourOuvertureMoisSuivant: 24,

    // Garde-fou de date absolue (la limite effective est le plus proche
    // entre la fin du mois ouvert et cette date).
    dateMax: "2027-12-31",

    // OUVERTURE HEBDOMADAIRE GLISSANTE
    // Désactivée (null) : toutes les semaines du bloc ouvert sont réservables.
    // Pour réactiver la règle « vendredi 21h ouvre la semaine suivante »,
    // remettez : ouverture: { jour: 5, heure: 21 }
    ouverture: null
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
    url: "https://script.google.com/macros/s/AKfycbx50vS7p0XadRG8DXsH5mIvy2F8NCuguwCOtzM9V2wsoDpJ2IVbxPatpjPwH5MH3OIz/exec"
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
  },

  /* -------------------------------------------------------------------
     10. FEED INSTAGRAM (section « Nos dernières réalisations »)
     -------------------------------------------------------------------
     LE PLUS SIMPLE : SnapWidget.com (gratuit).
       1. Va sur snapwidget.com → « Create a Free Widget »
       2. Connecte @rufixbarber, choisis « Grid », puis « Get Widget »
       3. Copie le code fourni (commence par <iframe …>)
       4. Colle-le ci-dessous ENTRE LES BACKTICKS ` ` (voir README).

     ⚠️ Garde bien les backticks ` ` autour du code : ils permettent de
        coller le code tel quel, même s'il contient des guillemets.
     Tant que c'est vide, une jolie grille de repli s'affiche (aucune page vide).
  ------------------------------------------------------------------- */
  instagramFeed: ``
};

/* Rendre CONFIG accessible aux autres scripts (booking.js, main.js). */
window.CONFIG = CONFIG;
