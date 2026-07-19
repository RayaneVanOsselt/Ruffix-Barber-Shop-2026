/* =====================================================================
   RUFIX BARBER — assistant.js
   Assistant virtuel : bouton de chat flottant + moteur de réponses.

   ➤ Le moteur LOCAL lit les VRAIES données du site :
       - config.js  : services, tarifs, durées, horaires, jours fermés,
                      adresse, téléphone, email, réseaux, règles de résa
       - la FAQ de la page (lue dans le DOM, donc toujours à jour)
       - les créneaux réellement disponibles (via window.RufixBooking)
     → Aucune clé, aucun coût, fonctionne hors ligne et sur toutes les pages.

   ➤ ÉVOLUTION : pour brancher une vraie IA plus tard, renseignez
     config.assistant.aiProxyUrl (un relais qui garde la clé côté serveur).
     ⚠️ Ne jamais mettre de clé API dans ce fichier : il est public.
   ===================================================================== */

(function () {
  "use strict";

  const C = window.CONFIG;
  if (!C || !C.assistant || C.assistant.actif === false) return;

  const A = C.assistant;
  const onHome = !!document.getElementById("reservation");     // page d'accueil ?
  const lienResa = onHome ? "#reservation" : "index.html#reservation";

  /* ===================== OUTILS ===================== */
  // Normalise pour la comparaison : minuscules, sans accents.
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const JOURS_ORDRE = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /* ============ CONNAISSANCES ISSUES DU SITE ============ */
  function listeServices() {
    return C.services.map((s) => `• <strong>${esc(s.nom)}</strong> — ${s.prix} € · ${esc(s.dureeTxt)}`).join("<br>");
  }
  function listeHoraires() {
    return JOURS_ORDRE.map((j) => {
      const h = C.horaires[j];
      if (!h || !h.ouvert) return `• ${cap(j)} : <em>fermé</em>`;
      const pause = h.pause ? ` (pause ${h.pause.debut}–${h.pause.fin})` : "";
      return `• ${cap(j)} : ${h.debut} – ${h.fin}${pause}`;
    }).join("<br>");
  }
  function adresseTxt() {
    const s = C.salon;
    return `${esc(s.adresse)}, ${esc(s.codePostal)} ${esc(s.ville)}`;
  }
  // Lit la FAQ directement dans la page (reste synchronisée automatiquement)
  function faqDuSite() {
    return [...document.querySelectorAll(".faq-item")].map((it) => ({
      q: (it.querySelector(".faq-item__q")?.textContent || "").trim(),
      r: (it.querySelector(".faq-item__a-inner")?.textContent || "").trim()
    })).filter((x) => x.q && x.r);
  }

  // Contexte complet — sert aussi de "prompt" si une vraie IA est branchée.
  function contexteSite() {
    const s = C.salon;
    const faq = faqDuSite().map((f) => `Q: ${f.q}\nR: ${f.r}`).join("\n");
    return [
      `Salon : ${s.nom} — barbier / coiffeur homme à ${s.ville}.`,
      `Adresse : ${s.adresse}, ${s.codePostal} ${s.ville}. Tél : ${s.telephone}. Email : ${s.email}.`,
      `Prestations : ${C.services.map((x) => `${x.nom} ${x.prix}€ (${x.dureeTxt})`).join(" ; ")}.`,
      `Horaires : ${JOURS_ORDRE.map((j) => { const h = C.horaires[j]; return `${j} ${h && h.ouvert ? h.debut + "-" + h.fin : "fermé"}`; }).join(" ; ")}.`,
      `Réservation : uniquement sur demande. Le client envoie une demande, le barbier confirme MANUELLEMENT par email. Rien n'est confirmé automatiquement.`,
      `Créneaux de 15 minutes. Réservable jusqu'au ${C.reservation.dateMax}.`,
      faq ? `FAQ du site :\n${faq}` : ""
    ].filter(Boolean).join("\n");
  }

  /* ============ RÉPONSES ============ */
  function repProchainesDispos() {
    if (!window.RufixBooking || !window.RufixBooking.nextAvailableSlots) {
      return `Je ne peux pas consulter le calendrier depuis cette page. <a href="${lienResa}">Ouvrir le calendrier de réservation</a> pour voir les créneaux libres (en vert).`;
    }
    const slots = window.RufixBooking.nextAvailableSlots(4);
    if (!slots.length) {
      return `Je ne vois pas de créneau libre pour le moment. Les réservations s'ouvrent chaque <strong>vendredi à 21h</strong> pour la semaine suivante. <a href="${lienResa}">Voir le calendrier</a>`;
    }
    const l = slots.map((s) => `• <strong>${esc(s.date)}</strong> à <strong>${esc(s.heure)}</strong>`).join("<br>");
    return `Voici les prochains créneaux disponibles :<br>${l}<br><br>Les cases <strong>vertes</strong> du calendrier sont libres, les <strong>rouges</strong> déjà prises. <a href="${lienResa}">Réserver maintenant</a>`;
  }

  function repGuideResa() {
    return `Voici comment réserver, étape par étape :<br>
      <strong>1.</strong> Choisissez votre prestation (Coupe, Barbe ou Coupe + barbe).<br>
      <strong>2.</strong> Dans le calendrier de la semaine, cliquez une case <strong>verte</strong> (libre). Les <strong>rouges</strong> sont déjà réservées.<br>
      <strong>3.</strong> Remplissez vos coordonnées (prénom, nom, téléphone, email).<br>
      <strong>4.</strong> Vérifiez le récapitulatif puis envoyez votre demande.<br><br>
      ⚠️ C'est une <strong>demande</strong> : le barbier vous confirme ensuite par email.
      <a href="${lienResa}">Aller à la réservation</a>`;
  }

  function repReseaux() {
    const s = C.salon, l = [];
    if (s.instagram) l.push(`• <a href="${esc(s.instagram)}" target="_blank" rel="noopener">Instagram du salon</a>`);
    if (s.instagramPerso) l.push(`• <a href="${esc(s.instagramPerso)}" target="_blank" rel="noopener">Instagram perso</a>`);
    if (s.tiktok) l.push(`• <a href="${esc(s.tiktok)}" target="_blank" rel="noopener">TikTok</a>`);
    return l.length ? `Retrouvez-nous ici :<br>${l.join("<br>")}` : `Nos réseaux arrivent bientôt !`;
  }

  /* ============ INTENTIONS (moteur local) ============ */
  const INTENTS = [
    { id: "salut", mots: ["bonjour", "salut", "bonsoir", "hello", "coucou", "hey"],
      rep: () => `Bonjour ! 👋 Comment puis-je vous aider ? Je peux vous parler des <strong>prestations</strong>, des <strong>tarifs</strong>, des <strong>horaires</strong>, ou vous guider pour <strong>réserver</strong>.` },

    { id: "tarifs", mots: ["tarif", "prix", "coute", "cout", "combien", "euro", "cher", "budget"],
      rep: () => `Voici nos tarifs :<br>${listeServices()}<br><br>Paiement en espèces ou par carte au salon. <a href="${lienResa}">Réserver</a>` },

    { id: "services", mots: ["service", "prestation", "propose", "faites", "coupe", "barbe", "rasage", "offre"],
      rep: () => `Nos prestations :<br>${listeServices()}<br><br>La <strong>Coupe</strong> comprend la coupe sur-mesure et le coiffage ; la <strong>Barbe</strong> inclut la taille, les contours et le rasage à l'ancienne. <a href="${lienResa}">Réserver</a>` },

    { id: "horaires", mots: ["horaire", "ouvert", "ouverture", "fermeture", "ferme", "quand", "jour", "heure"],
      rep: () => `Nos horaires :<br>${listeHoraires()}<br><br>Le salon fonctionne <strong>uniquement sur rendez-vous</strong>.` },

    { id: "dispo", mots: ["dispo", "disponibilite", "disponible", "creneau", "libre", "place", "prochain"],
      rep: repProchainesDispos },

    { id: "reserver", mots: ["reserver", "reservation", "rendez", "rdv", "prendre", "booker", "comment"],
      rep: repGuideResa },

    { id: "confirmation", mots: ["confirme", "confirmation", "valide", "validation", "sur", "certain", "automatique"],
      rep: () => `Votre réservation n'est <strong>pas automatique</strong> : le salon étant privé, vous envoyez une <strong>demande</strong> de rendez-vous. Le barbier la valide ensuite manuellement et vous recevez un <strong>email de confirmation</strong>. Tant que vous n'avez pas cet email, le créneau n'est pas confirmé.` },

    { id: "annuler", mots: ["annuler", "annulation", "modifier", "changer", "reporter", "decaler"],
      rep: () => `Pour annuler ou modifier un rendez-vous, contactez-nous au moins <strong>24 heures à l'avance</strong> :<br>• Tél : <a href="tel:${esc(String(C.salon.telephone).replace(/[^+\d]/g, ""))}">${esc(C.salon.telephone)}</a><br>• Email : <a href="mailto:${esc(C.salon.email)}">${esc(C.salon.email)}</a><br>Nous décalerons votre créneau avec plaisir.` },

    { id: "retard", mots: ["retard", "tard", "attendre", "attente"],
      rep: () => `En cas de retard, prévenez-nous par téléphone au <a href="tel:${esc(String(C.salon.telephone).replace(/[^+\d]/g, ""))}">${esc(C.salon.telephone)}</a>. Au-delà de <strong>10 minutes</strong>, la prestation pourra être écourtée ou reportée afin de respecter les rendez-vous suivants.` },

    { id: "paiement", mots: ["payer", "paiement", "especes", "cash", "carte", "bancontact", "cb"],
      rep: () => `Vous pouvez payer en <strong>espèces</strong> ou par <strong>carte bancaire</strong>, directement au salon à la fin de votre prestation.` },

    { id: "adresse", mots: ["adresse", "ou", "situe", "trouver", "acces", "venir", "localisation", "plan", "parking"],
      rep: () => `Nous sommes au <strong>${adresseTxt()}</strong>.<br>Vous trouverez la carte et l'itinéraire dans la section <a href="${onHome ? "#contact" : "index.html#contact"}">Contact</a>.` },

    { id: "contact", mots: ["contact", "telephone", "appeler", "numero", "mail", "email", "joindre", "ecrire"],
      rep: () => `Vous pouvez nous joindre :<br>• Tél : <a href="tel:${esc(String(C.salon.telephone).replace(/[^+\d]/g, ""))}">${esc(C.salon.telephone)}</a><br>• Email : <a href="mailto:${esc(C.salon.email)}">${esc(C.salon.email)}</a><br>Ou via le formulaire de la section <a href="${onHome ? "#contact" : "index.html#contact"}">Contact</a>.` },

    { id: "duree", mots: ["duree", "dure", "temps", "long", "minutes"],
      rep: () => `Durées de nos prestations :<br>${C.services.map((s) => `• ${esc(s.nom)} : <strong>${esc(s.dureeTxt)}</strong>`).join("<br>")}<br><br>Le calendrier bloque automatiquement le temps nécessaire.` },

    { id: "reseaux", mots: ["instagram", "insta", "tiktok", "reseau", "social", "photo", "compte", "suivre"],
      rep: repReseaux },

    { id: "probleme", mots: ["probleme", "marche", "bug", "erreur", "arrive", "impossible", "bloque", "aide"],
      rep: () => `Pas de souci, je vous aide. Les cas les plus fréquents :<br>
        • <strong>Aucune case verte ?</strong> La semaine n'est peut-être pas encore ouverte — les réservations s'ouvrent le <strong>vendredi à 21h</strong> pour la semaine suivante.<br>
        • <strong>Créneau refusé ?</strong> Votre prestation a besoin de plusieurs créneaux consécutifs ; essayez un autre horaire.<br>
        • <strong>Formulaire bloqué ?</strong> Vérifiez que prénom, nom, téléphone et email sont remplis.<br><br>
        Sinon, appelez-nous au <a href="tel:${esc(String(C.salon.telephone).replace(/[^+\d]/g, ""))}">${esc(C.salon.telephone)}</a>.` }
  ];

  function chercherFAQ(q) {
    const n = norm(q);
    const mots = n.split(/\s+/).filter((w) => w.length > 3);
    let best = null, bestScore = 0;
    faqDuSite().forEach((f) => {
      const nq = norm(f.q);
      let score = 0;
      mots.forEach((m) => { if (nq.includes(m)) score++; });
      if (score > bestScore) { bestScore = score; best = f; }
    });
    return bestScore >= 2 ? best : null;
  }

  function repondreLocal(question) {
    const n = norm(question);
    let best = null, bestScore = 0;
    INTENTS.forEach((it) => {
      let score = 0;
      it.mots.forEach((m) => { if (n.includes(m)) score++; });
      if (score > bestScore) { bestScore = score; best = it; }
    });
    if (best && bestScore > 0) return best.rep();

    const faq = chercherFAQ(question);
    if (faq) return `<strong>${esc(faq.q)}</strong><br>${esc(faq.r)}`;

    return `Je n'ai pas bien saisi 🤔 Je peux vous renseigner sur :<br>
      • les <strong>prestations</strong> et <strong>tarifs</strong><br>
      • les <strong>horaires</strong> et <strong>disponibilités</strong><br>
      • la <strong>réservation</strong> (guide pas à pas)<br>
      • l'<strong>adresse</strong> et le <strong>contact</strong><br><br>
      Pour une question précise, appelez-nous au <a href="tel:${esc(String(C.salon.telephone).replace(/[^+\d]/g, ""))}">${esc(C.salon.telephone)}</a>.`;
  }

  /* ====== RELAIS IA OPTIONNEL (branchable plus tard) ====== */
  function repondre(question) {
    const url = (A.aiProxyUrl || "").trim();
    if (!url) return Promise.resolve(repondreLocal(question));
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ question: question, contexte: contexteSite() })
    })
      .then((r) => r.json())
      .then((d) => (d && d.reponse) ? esc(d.reponse).replace(/\n/g, "<br>") : repondreLocal(question))
      .catch(() => repondreLocal(question));   // repli : moteur local
  }

  /* ===================== INTERFACE ===================== */
  const SVG_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/></svg>';
  const SVG_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const SVG_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';

  const CHIPS = [
    { txt: "Vos tarifs", q: "tarifs" },
    { txt: "Prendre RDV", q: "comment reserver" },
    { txt: "Prochaines dispos", q: "disponibilites" },
    { txt: "Horaires", q: "horaires" },
    { txt: "Où êtes-vous ?", q: "adresse" }
  ];

  let ui = {}, ouvert = false;

  function construireUI() {
    const wrap = document.createElement("div");
    wrap.className = "chat";
    wrap.innerHTML = `
      <button class="chat-fab" id="chatFab" aria-label="Ouvrir l'assistant Rufix Barber" aria-expanded="false">
        <span class="chat-fab__icon">${SVG_CHAT}</span>
      </button>
      <div class="chat-panel" id="chatPanel" role="dialog" aria-label="${esc(A.nom)}" aria-hidden="true">
        <header class="chat-head">
          <img src="images/logo.png" alt="" width="240" height="240" />
          <span class="chat-head__id">
            <strong>${esc(A.nom)}</strong>
            <span class="chat-head__status">Réponse immédiate</span>
          </span>
          <button class="chat-close" id="chatClose" aria-label="Fermer l'assistant">${SVG_CLOSE}</button>
        </header>
        <div class="chat-body" id="chatBody" role="log" aria-live="polite"></div>
        <div class="chat-chips" id="chatChips"></div>
        <form class="chat-form" id="chatForm">
          <input class="chat-input" id="chatInput" type="text" autocomplete="off"
                 placeholder="Posez votre question…" aria-label="Votre question" />
          <button class="chat-send" type="submit" aria-label="Envoyer">${SVG_SEND}</button>
        </form>
      </div>`;
    document.body.appendChild(wrap);

    ui = {
      fab: wrap.querySelector("#chatFab"),
      panel: wrap.querySelector("#chatPanel"),
      close: wrap.querySelector("#chatClose"),
      body: wrap.querySelector("#chatBody"),
      chips: wrap.querySelector("#chatChips"),
      form: wrap.querySelector("#chatForm"),
      input: wrap.querySelector("#chatInput")
    };
  }

  function ajouterMessage(html, qui) {
    const el = document.createElement("div");
    el.className = `chat-msg chat-msg--${qui}`;
    el.innerHTML = html;
    ui.body.appendChild(el);
    ui.body.scrollTop = ui.body.scrollHeight;
    return el;
  }

  function afficherChips() {
    ui.chips.innerHTML = "";
    CHIPS.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chat-chip";
      b.textContent = c.txt;
      b.addEventListener("click", () => envoyer(c.q, c.txt));
      ui.chips.appendChild(b);
    });
  }

  function envoyer(question, affiche) {
    const q = (question || "").trim();
    if (!q) return;
    ajouterMessage(esc(affiche || q), "user");     // message client : texte échappé
    ui.input.value = "";
    ui.chips.style.display = "none";               // libère de la place une fois la discussion lancée

    const attente = ajouterMessage('<span class="chat-typing"><i></i><i></i><i></i></span>', "bot");
    repondre(q).then((rep) => {
      attente.innerHTML = rep;                     // réponse : HTML maîtrisé (nos données)
      ui.body.scrollTop = ui.body.scrollHeight;
    });
  }

  function basculer(forcer) {
    ouvert = (typeof forcer === "boolean") ? forcer : !ouvert;
    ui.panel.classList.toggle("is-open", ouvert);
    ui.panel.setAttribute("aria-hidden", String(!ouvert));
    ui.fab.setAttribute("aria-expanded", String(ouvert));
    ui.fab.classList.toggle("is-open", ouvert);
    if (ouvert) {
      if (!ui.body.dataset.init) {
        ajouterMessage(esc(A.messageAccueil), "bot");
        afficherChips();
        ui.body.dataset.init = "1";
      }
      setTimeout(() => ui.input.focus(), 150);
    }
  }

  function init() {
    construireUI();
    ui.fab.addEventListener("click", () => basculer());
    ui.close.addEventListener("click", () => basculer(false));
    ui.form.addEventListener("submit", (e) => { e.preventDefault(); envoyer(ui.input.value); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ouvert) basculer(false); });
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
