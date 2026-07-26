/* =====================================================================
   RUFIX BARBER — i18n.js
   Système multilingue (FR par défaut, NL, EN).

   ➤ MAINTENANCE : toutes les traductions sont dans l'objet TR ci-dessous,
     regroupées par langue puis par clé. Pour modifier un texte, changez
     simplement la valeur — rien d'autre à toucher.

   ➤ Dans le HTML :
       data-i18n="cle"       → remplace le texte de l'élément
       data-i18n-html="cle"  → remplace le HTML interne (textes avec liens)
       data-i18n-ph="cle"    → remplace l'attribut placeholder
       data-i18n-aria="cle"  → remplace l'attribut aria-label

   ➤ Dans le JS (booking.js, assistant.js…) :
       window.RufixI18N.t("cle")     → renvoie la traduction courante
       window.RufixI18N.lang         → langue active ("fr"|"nl"|"en")
       window.RufixI18N.onChange(cb) → rappelé à chaque changement de langue
   ===================================================================== */

(function () {
  "use strict";

  const TR = {
    /* ============================ FRANÇAIS ============================ */
    fr: {
      "lang.name": "Français",
      // Navigation
      "nav.accueil": "Accueil", "nav.services": "Services", "nav.reservation": "Réservation",
      "nav.galerie": "Galerie", "nav.avis": "Avis", "nav.contact": "Contact", "nav.reserver": "Réserver",
      // Hero
      "hero.eyebrow": "Barbier · Coiffure homme · Etterbeek",
      "hero.title": "L'art de la coupe masculine",
      "hero.sub": "Coupe, barbe et rasage dans un cadre premium — sur rendez-vous.",
      "hero.cta1": "Réserver maintenant", "hero.cta2": "Découvrir nos services", "hero.scroll": "Défiler",
      // À propos
      "about.eyebrow": "Le salon", "about.title": "Un savoir-faire, une exigence",
      "about.lead": "Chez Rufix Barber, chaque prestation est pensée comme un moment à part. Dans un cadre feutré et raffiné, nos barbiers allient techniques traditionnelles et style contemporain pour révéler votre allure. Coupe sur-mesure, barbe travaillée, rasage à l'ancienne : le soin du détail, toujours, et rien d'autre.",
      "about.stat1": "années d'expérience", "about.stat2": "sur rendez-vous", "about.stat3": "satisfaction client",
      "about.link": "Voir nos prestations",
      // Services
      "services.eyebrow": "Nos prestations", "services.title": "Des services taillés sur-mesure",
      "services.lead": "Trois formules pour un résultat impeccable, réalisées avec des produits premium.",
      "svc.coupe.name": "Coupe", "svc.coupe.desc": "Coupe sur-mesure au ciseau et à la tondeuse, finitions au rasoir et coiffage soigné.",
      "svc.barbe.name": "Barbe", "svc.barbe.desc": "Taille, dessin des contours et rasage à l'ancienne, serviette chaude et soin apaisant.",
      "svc.cb.name": "Coupe + barbe", "svc.cb.desc": "L'expérience complète : coupe sur-mesure et barbe travaillée pour un résultat impeccable.",
      "btn.reserver": "Réserver",
      // Réservation
      "resa.eyebrow": "Réservation", "resa.title": "Demandez votre rendez-vous",
      "resa.lead1": "Choisissez une date, un créneau et votre prestation. Votre demande sera",
      "resa.lead2": "confirmée manuellement", "resa.lead3": "par le barbier.",
      "resa.step1": "Choisissez votre prestation", "resa.step2": "Choisissez votre créneau",
      "resa.step3": "Vos informations",
      "legend.free": "Disponible", "legend.pending": "Demande en attente",
      "legend.taken": "Réservé / indisponible", "legend.sel": "Votre sélection",
      "form.prenom": "Prénom", "form.nom": "Nom", "form.tel": "Téléphone", "form.email": "Email",
      "resa.submit": "Envoyer ma demande de rendez-vous",
      "resa.note": "Il s'agit d'une <strong>demande</strong> : vous recevrez un email de confirmation dès que le barbier aura validé votre créneau. Le salon étant privé, aucune réservation n'est confirmée automatiquement.",
      // Galerie
      "gal.eyebrow": "Galerie", "gal.title": "L'atelier en images",
      "gal.lead": "Un aperçu de l'ambiance, des détails et du savoir-faire du salon.", "gal.zoom": "Agrandir",
      // Instagram
      "insta.eyebrow": "Instagram", "insta.title": "Nos dernières réalisations",
      "insta.lead": "suivez nos coupes au quotidien.", "insta.follow": "Suivez-nous sur Instagram",
      // Avis
      "rev.eyebrow": "Avis clients", "rev.title": "Ils nous font confiance",
      "rev.lead": "Quelques retours de nos clients.",
      "rev.1.text": "Meilleur barbier de la ville. Accueil au top, coupe nette et ambiance vraiment premium. Je ne vais plus ailleurs.",
      "rev.1.role": "Client depuis 2 ans",
      "rev.2.text": "Le rasage à l'ancienne est un vrai moment de détente. Travail précis et soigné, je recommande les yeux fermés.",
      "rev.2.role": "Coupe + barbe",
      "rev.3.text": "Prise de rendez-vous simple et barbier à l'écoute. Le résultat correspond exactement à ce que je voulais. Parfait.",
      "rev.3.role": "Coupe homme",
      // FAQ
      "faq.eyebrow": "Questions fréquentes", "faq.title": "Tout ce qu'il faut savoir",
      "faq.q1": "Faut-il réserver ?",
      "faq.a1": "Oui, le salon fonctionne uniquement sur rendez-vous afin de vous garantir un accueil personnalisé et sans attente. Envoyez votre demande via le formulaire de réservation : le barbier vous confirme le créneau par email.",
      "faq.q2": "Combien de temps dure une coupe ?",
      "faq.a2": "Comptez environ 45 minutes pour une coupe, 30 minutes pour la barbe, et 1 heure pour la formule coupe + barbe. Nous prenons le temps qu'il faut pour un résultat impeccable.",
      "faq.q3": "Peut-on payer en espèces ?",
      "faq.a3": "Oui, le paiement est possible en espèces comme par carte bancaire directement au salon, à la fin de votre prestation.",
      "faq.q4": "Comment fonctionne la réservation en ligne ?",
      "faq.a4": "Vous choisissez une date, un créneau et votre prestation, puis vous envoyez votre demande. Ce n'est pas une réservation ferme : le barbier valide manuellement votre créneau et vous confirme par email.",
      "faq.q5": "Que se passe-t-il en cas de retard ?",
      "faq.a5": "Merci de nous prévenir par email en cas de retard. Au-delà de 10 minutes, la prestation pourra être écourtée ou reportée afin de respecter les rendez-vous suivants.",
      "faq.q6": "Comment annuler ou modifier un rendez-vous ?",
      "faq.a6": "Il suffit de nous contacter par email au moins 24 heures à l'avance. Nous décalerons votre rendez-vous avec plaisir selon les disponibilités.",
      // Contact
      "contact.eyebrow": "Contact", "contact.title": "Nous trouver & nous écrire",
      "contact.address": "Adresse", "contact.email": "Email", "contact.hours": "Horaires",
      "contact.formTitle": "Envoyez-nous un message",
      "contact.msg": "Message", "contact.msgPh": "Votre message…", "contact.send": "Envoyer le message",
      // Footer
      "footer.tagline": "Barbier & salon de coiffure homme premium à Etterbeek. Coupe, barbe et rasage sur rendez-vous.",
      "footer.coord": "Coordonnées", "footer.hours": "Horaires",
      "footer.legal1": "Mentions légales", "footer.legal2": "Politique de confidentialité",
      "footer.rights": "Tous droits réservés.",
      // Assistant
      "chat.status": "Réponse immédiate", "chat.placeholder": "Posez votre question…",
      "chat.welcome": "Bonjour 👋 Je suis l'assistant de Rufix Barber. Je peux vous renseigner sur les prestations, les tarifs, les horaires, et vous guider pour réserver.",
      "chip.tarifs": "Vos tarifs", "chip.rdv": "Prendre RDV", "chip.dispo": "Prochaines dispos",
      "chip.horaires": "Horaires", "chip.adresse": "Où êtes-vous ?",
      // Jours / mois (calendrier)
      "days.long": ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"],
      "days.short": ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"],
      "months": ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"],
      "cal.week": "Semaine du", "cal.to": "au", "cal.chooseDate": "Choisissez d'abord une prestation (étape 1), puis cliquez un créneau vert.",
      "cal.loading": "⏳ Chargement des disponibilités en cours…",
      "cal.closedFrom": "🔒 Les réservations pour cette semaine ouvrent le",
      "resa.err.service": "Merci de choisir une prestation.",
      "resa.err.slot": "Merci de choisir un créneau (case verte) dans le calendrier.",
      "resa.err.taken": "Ce créneau vient d'être réservé par quelqu'un d'autre. Merci d'en choisir un autre.",
      "resa.err.gone": "Ce créneau n'est plus disponible. Merci d'en choisir un autre.",
      "resa.ok": "Votre demande de rendez-vous a bien été envoyée. Vous recevrez un email de confirmation dès que le coiffeur aura validé votre créneau.",
      "resa.summary": "Confirmez votre demande :",
      "contact.ok": "Merci ! Votre message a bien été envoyé. Nous vous répondrons rapidement."
    },

    /* ========================== NEDERLANDS ========================== */
    nl: {
      "lang.name": "Nederlands",
      "nav.accueil": "Home", "nav.services": "Diensten", "nav.reservation": "Reserveren",
      "nav.galerie": "Galerij", "nav.avis": "Reviews", "nav.contact": "Contact", "nav.reserver": "Reserveren",
      "hero.eyebrow": "Kapper · Herenkapsel · Etterbeek",
      "hero.title": "De kunst van het herenkapsel",
      "hero.sub": "Knippen, baard en scheren in een premium kader — op afspraak.",
      "hero.cta1": "Nu reserveren", "hero.cta2": "Ontdek onze diensten", "hero.scroll": "Scrollen",
      "about.eyebrow": "De zaak", "about.title": "Vakmanschap en precisie",
      "about.lead": "Bij Rufix Barber is elke behandeling een moment op zich. In een verzorgde, sfeervolle ruimte combineren onze kappers traditionele technieken met een hedendaagse stijl om uw look tot zijn recht te laten komen. Kapsel op maat, verzorgde baard, klassiek scheren: altijd oog voor detail, en niets minder.",
      "about.stat1": "jaar ervaring", "about.stat2": "op afspraak", "about.stat3": "klanttevredenheid",
      "about.link": "Bekijk onze diensten",
      "services.eyebrow": "Onze diensten", "services.title": "Diensten op maat",
      "services.lead": "Drie formules voor een onberispelijk resultaat, met premium producten.",
      "svc.coupe.name": "Knippen", "svc.coupe.desc": "Kapsel op maat met schaar en tondeuse, afwerking met het scheermes en verzorgde styling.",
      "svc.barbe.name": "Baard", "svc.barbe.desc": "Bijknippen, contouren tekenen en klassiek scheren, warme handdoek en kalmerende verzorging.",
      "svc.cb.name": "Knippen + baard", "svc.cb.desc": "De complete ervaring: kapsel op maat en een verzorgde baard voor een onberispelijk resultaat.",
      "btn.reserver": "Reserveren",
      "resa.eyebrow": "Reserveren", "resa.title": "Vraag uw afspraak aan",
      "resa.lead1": "Kies een datum, een tijdslot en uw dienst. Uw aanvraag wordt",
      "resa.lead2": "handmatig bevestigd", "resa.lead3": "door de kapper.",
      "resa.step1": "Kies uw dienst", "resa.step2": "Kies uw tijdslot", "resa.step3": "Uw gegevens",
      "legend.free": "Beschikbaar", "legend.pending": "Aanvraag in behandeling",
      "legend.taken": "Gereserveerd / niet beschikbaar", "legend.sel": "Uw keuze",
      "form.prenom": "Voornaam", "form.nom": "Naam", "form.tel": "Telefoon", "form.email": "E-mail",
      "resa.submit": "Mijn afspraakaanvraag versturen",
      "resa.note": "Dit is een <strong>aanvraag</strong>: u ontvangt een bevestigingsmail zodra de kapper uw tijdslot heeft gevalideerd. De zaak is privé, er wordt geen enkele reservatie automatisch bevestigd.",
      "gal.eyebrow": "Galerij", "gal.title": "De zaak in beeld",
      "gal.lead": "Een blik op de sfeer, de details en het vakmanschap.", "gal.zoom": "Vergroten",
      "insta.eyebrow": "Instagram", "insta.title": "Onze recentste realisaties",
      "insta.lead": "volg onze kapsels dag na dag.", "insta.follow": "Volg ons op Instagram",
      "rev.eyebrow": "Klantenreviews", "rev.title": "Zij vertrouwen ons",
      "rev.lead": "Enkele reacties van onze klanten.",
      "rev.1.text": "Beste kapper van de stad. Top onthaal, strak kapsel en een echt premium sfeer. Ik ga nergens anders meer.",
      "rev.1.role": "Klant sinds 2 jaar",
      "rev.2.text": "Klassiek scheren is een echt moment van ontspanning. Precies en verzorgd werk, ik raad het met gesloten ogen aan.",
      "rev.2.role": "Knippen + baard",
      "rev.3.text": "Eenvoudig afspraken maken en een kapper die luistert. Het resultaat is precies wat ik wilde. Perfect.",
      "rev.3.role": "Herenkapsel",
      "faq.eyebrow": "Veelgestelde vragen", "faq.title": "Alles wat u moet weten",
      "faq.q1": "Moet ik reserveren?",
      "faq.a1": "Ja, de zaak werkt uitsluitend op afspraak voor een persoonlijk onthaal zonder wachttijd. Stuur uw aanvraag via het reservatieformulier: de kapper bevestigt het tijdslot per e-mail.",
      "faq.q2": "Hoe lang duurt een kapsel?",
      "faq.a2": "Reken op ongeveer 45 minuten voor een kapsel, 30 minuten voor de baard en 1 uur voor de formule knippen + baard. We nemen de tijd voor een onberispelijk resultaat.",
      "faq.q3": "Kan ik cash betalen?",
      "faq.a3": "Ja, betalen kan zowel cash als met de bankkaart, ter plaatse na uw behandeling.",
      "faq.q4": "Hoe werkt de online reservatie?",
      "faq.a4": "U kiest een datum, een tijdslot en uw dienst en verstuurt uw aanvraag. Het is geen vaste reservatie: de kapper valideert uw tijdslot handmatig en bevestigt per e-mail.",
      "faq.q5": "Wat als ik te laat ben?",
      "faq.a5": "Verwittig ons per e-mail bij vertraging. Na 10 minuten kan de behandeling worden ingekort of verplaatst om de volgende afspraken te respecteren.",
      "faq.q6": "Hoe annuleer of wijzig ik een afspraak?",
      "faq.a6": "Contacteer ons per e-mail minstens 24 uur op voorhand. We verplaatsen uw afspraak graag volgens de beschikbaarheid.",
      "contact.eyebrow": "Contact", "contact.title": "Ons vinden & schrijven",
      "contact.address": "Adres", "contact.email": "E-mail", "contact.hours": "Openingsuren",
      "contact.formTitle": "Stuur ons een bericht",
      "contact.msg": "Bericht", "contact.msgPh": "Uw bericht…", "contact.send": "Bericht versturen",
      "footer.tagline": "Premium kapper & herenkapsel in Etterbeek. Knippen, baard en scheren op afspraak.",
      "footer.coord": "Contactgegevens", "footer.hours": "Openingsuren",
      "footer.legal1": "Wettelijke vermeldingen", "footer.legal2": "Privacybeleid",
      "footer.rights": "Alle rechten voorbehouden.",
      "chat.status": "Direct antwoord", "chat.placeholder": "Stel uw vraag…",
      "chat.welcome": "Hallo 👋 Ik ben de assistent van Rufix Barber. Ik informeer u graag over de diensten, prijzen en openingsuren en help u met reserveren.",
      "chip.tarifs": "Prijzen", "chip.rdv": "Afspraak maken", "chip.dispo": "Beschikbaarheid",
      "chip.horaires": "Openingsuren", "chip.adresse": "Waar zijn jullie?",
      "days.long": ["zondag","maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag"],
      "days.short": ["Zo","Ma","Di","Wo","Do","Vr","Za"],
      "months": ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"],
      "cal.week": "Week van", "cal.to": "tot", "cal.chooseDate": "Kies eerst een dienst (stap 1) en klik dan op een groen tijdslot.",
      "cal.loading": "⏳ Beschikbaarheid wordt geladen…",
      "cal.closedFrom": "🔒 De reservaties voor deze week openen op",
      "resa.err.service": "Kies a.u.b. een dienst.",
      "resa.err.slot": "Kies a.u.b. een tijdslot (groen vakje) in de kalender.",
      "resa.err.taken": "Dit tijdslot is net door iemand anders gereserveerd. Kies a.u.b. een ander.",
      "resa.err.gone": "Dit tijdslot is niet meer beschikbaar. Kies a.u.b. een ander.",
      "resa.ok": "Uw afspraakaanvraag is verstuurd. U ontvangt een bevestigingsmail zodra de kapper uw tijdslot heeft gevalideerd.",
      "resa.summary": "Bevestig uw aanvraag:",
      "contact.ok": "Bedankt! Uw bericht is verstuurd. We antwoorden u snel."
    },

    /* ============================ ENGLISH ============================ */
    en: {
      "lang.name": "English",
      "nav.accueil": "Home", "nav.services": "Services", "nav.reservation": "Booking",
      "nav.galerie": "Gallery", "nav.avis": "Reviews", "nav.contact": "Contact", "nav.reserver": "Book",
      "hero.eyebrow": "Barber · Men's hair · Etterbeek",
      "hero.title": "The art of the men's cut",
      "hero.sub": "Haircut, beard and shave in a premium setting — by appointment.",
      "hero.cta1": "Book now", "hero.cta2": "Discover our services", "hero.scroll": "Scroll",
      "about.eyebrow": "The shop", "about.title": "Craftsmanship and precision",
      "about.lead": "At Rufix Barber, every service is a moment in itself. In a refined, cosy setting, our barbers blend traditional techniques with a contemporary style to bring out your look. Bespoke cut, groomed beard, old-school shave: attention to detail, always, and nothing less.",
      "about.stat1": "years of experience", "about.stat2": "by appointment", "about.stat3": "client satisfaction",
      "about.link": "See our services",
      "services.eyebrow": "Our services", "services.title": "Tailor-made services",
      "services.lead": "Three formulas for a flawless result, using premium products.",
      "svc.coupe.name": "Haircut", "svc.coupe.desc": "Bespoke cut with scissors and clippers, razor finish and careful styling.",
      "svc.barbe.name": "Beard", "svc.barbe.desc": "Trimming, line-up and old-school shave, hot towel and soothing care.",
      "svc.cb.name": "Haircut + beard", "svc.cb.desc": "The full experience: a bespoke cut and a groomed beard for a flawless result.",
      "btn.reserver": "Book",
      "resa.eyebrow": "Booking", "resa.title": "Request your appointment",
      "resa.lead1": "Choose a date, a slot and your service. Your request will be",
      "resa.lead2": "confirmed manually", "resa.lead3": "by the barber.",
      "resa.step1": "Choose your service", "resa.step2": "Choose your slot", "resa.step3": "Your details",
      "legend.free": "Available", "legend.pending": "Request pending",
      "legend.taken": "Booked / unavailable", "legend.sel": "Your selection",
      "form.prenom": "First name", "form.nom": "Last name", "form.tel": "Phone", "form.email": "Email",
      "resa.submit": "Send my appointment request",
      "resa.note": "This is a <strong>request</strong>: you'll receive a confirmation email once the barber has approved your slot. The shop is private, so no booking is confirmed automatically.",
      "gal.eyebrow": "Gallery", "gal.title": "The workshop in pictures",
      "gal.lead": "A glimpse of the atmosphere, the details and the craft.", "gal.zoom": "Enlarge",
      "insta.eyebrow": "Instagram", "insta.title": "Our latest work",
      "insta.lead": "follow our cuts every day.", "insta.follow": "Follow us on Instagram",
      "rev.eyebrow": "Client reviews", "rev.title": "They trust us",
      "rev.lead": "A few words from our clients.",
      "rev.1.text": "Best barber in town. Great welcome, sharp cut and a truly premium vibe. I don't go anywhere else.",
      "rev.1.role": "Client for 2 years",
      "rev.2.text": "The old-school shave is a real moment of relaxation. Precise, careful work — I recommend it with my eyes closed.",
      "rev.2.role": "Haircut + beard",
      "rev.3.text": "Easy booking and a barber who listens. The result is exactly what I wanted. Perfect.",
      "rev.3.role": "Men's haircut",
      "faq.eyebrow": "Frequently asked questions", "faq.title": "Everything you need to know",
      "faq.q1": "Do I need to book?",
      "faq.a1": "Yes, the shop works by appointment only, for a personal welcome with no waiting. Send your request via the booking form: the barber confirms your slot by email.",
      "faq.q2": "How long does a haircut take?",
      "faq.a2": "Allow about 45 minutes for a haircut, 30 minutes for the beard, and 1 hour for the haircut + beard formula. We take the time needed for a flawless result.",
      "faq.q3": "Can I pay in cash?",
      "faq.a3": "Yes, you can pay in cash or by card, right at the shop, after your service.",
      "faq.q4": "How does online booking work?",
      "faq.a4": "You choose a date, a slot and your service, then send your request. It isn't a firm booking: the barber approves your slot manually and confirms by email.",
      "faq.q5": "What happens if I'm late?",
      "faq.a5": "Please let us know by email if you're running late. After 10 minutes, the service may be shortened or rescheduled to respect the following appointments.",
      "faq.q6": "How do I cancel or change an appointment?",
      "faq.a6": "Just contact us by email at least 24 hours in advance. We'll gladly reschedule your appointment based on availability.",
      "contact.eyebrow": "Contact", "contact.title": "Find us & write to us",
      "contact.address": "Address", "contact.email": "Email", "contact.hours": "Opening hours",
      "contact.formTitle": "Send us a message",
      "contact.msg": "Message", "contact.msgPh": "Your message…", "contact.send": "Send message",
      "footer.tagline": "Premium barber & men's hair salon in Etterbeek. Haircut, beard and shave by appointment.",
      "footer.coord": "Contact", "footer.hours": "Opening hours",
      "footer.legal1": "Legal notice", "footer.legal2": "Privacy policy",
      "footer.rights": "All rights reserved.",
      "chat.status": "Instant reply", "chat.placeholder": "Ask your question…",
      "chat.welcome": "Hi 👋 I'm the Rufix Barber assistant. I can tell you about the services, prices and opening hours, and guide you to book.",
      "chip.tarifs": "Prices", "chip.rdv": "Book", "chip.dispo": "Availability",
      "chip.horaires": "Opening hours", "chip.adresse": "Where are you?",
      "days.long": ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
      "days.short": ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
      "months": ["January","February","March","April","May","June","July","August","September","October","November","December"],
      "cal.week": "Week of", "cal.to": "to", "cal.chooseDate": "First choose a service (step 1), then click a green slot.",
      "cal.loading": "⏳ Loading availability…",
      "cal.closedFrom": "🔒 Bookings for this week open on",
      "resa.err.service": "Please choose a service.",
      "resa.err.slot": "Please choose a slot (green cell) in the calendar.",
      "resa.err.taken": "This slot was just booked by someone else. Please choose another.",
      "resa.err.gone": "This slot is no longer available. Please choose another.",
      "resa.ok": "Your appointment request has been sent. You'll receive a confirmation email once the barber has approved your slot.",
      "resa.summary": "Confirm your request:",
      "contact.ok": "Thank you! Your message has been sent. We'll reply shortly."
    }
  };

  const LANGS = ["fr", "nl", "en"];
  const DEFAULT = "fr";
  const KEY = "rufix_lang";
  const listeners = [];

  function detect() {
    const saved = localStorage.getItem(KEY);
    if (saved && LANGS.indexOf(saved) !== -1) return saved;
    const nav = (navigator.language || "fr").slice(0, 2).toLowerCase();
    return LANGS.indexOf(nav) !== -1 ? nav : DEFAULT;
  }

  let lang = detect();

  function t(key) {
    const d = TR[lang] || TR[DEFAULT];
    return (d[key] != null) ? d[key] : (TR[DEFAULT][key] != null ? TR[DEFAULT][key] : key);
  }

  function apply() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.setAttribute("placeholder", t(el.dataset.i18nPh)); });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    // Sélecteur : bouton actif
    document.querySelectorAll("[data-lang]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.lang === lang);
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });
    listeners.forEach((cb) => { try { cb(lang); } catch (e) {} });
  }

  function setLang(l) {
    if (LANGS.indexOf(l) === -1 || l === lang) { if (l === lang) apply(); return; }
    lang = l;
    localStorage.setItem(KEY, l);
    apply();
  }

  window.RufixI18N = {
    get lang() { return lang; },
    langs: LANGS,
    t: t,
    setLang: setLang,
    onChange: (cb) => { if (typeof cb === "function") listeners.push(cb); }
  };

  // Applique dès que le DOM est prêt (avant que booking/assistant ne s'initialisent
  // n'est pas garanti ; ceux-ci s'abonnent via onChange et se re-render).
  function boot() {
    // Câble le sélecteur de langue
    document.querySelectorAll("[data-lang]").forEach((b) => {
      b.addEventListener("click", () => setLang(b.dataset.lang));
    });
    apply();
  }
  if (document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
