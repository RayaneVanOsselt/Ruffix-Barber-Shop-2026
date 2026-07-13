/* =====================================================================
   RUFIX BARBER — booking.js
   Logique de réservation : calendrier, génération des créneaux de 15 min,
   récapitulatif, et envoi de la DEMANDE de rendez-vous.

   ⚠️ IMPORTANT (rappel métier) : le salon est privé. Le client NE réserve
   PAS un créneau confirmé : il envoie une DEMANDE que le barbier valide
   manuellement. Tout le vocabulaire de l'interface le reflète.

   ⚠️ LIMITE TECHNIQUE (GitHub Pages = site statique, sans serveur) :
   il est impossible de verrouiller un créneau en temps réel entre plusieurs
   visiteurs. La disponibilité est donc pilotée par le fichier config.js que
   le propriétaire édite à la main (jours fermés, créneaux bloqués).
   👉 Pour un retrait automatique des créneaux, l'évolution recommandée est
      de brancher Google Calendar ou un petit backend (voir README).
   ===================================================================== */

(function () {
  "use strict";

  const C = window.CONFIG;
  const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
                "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  /* --- État de la réservation en cours --- */
  const state = {
    view: null,          // mois affiché dans le calendrier (Date sur le 1er)
    selectedDate: null,  // Date choisie
    selectedTime: null,  // "HH:MM"
    serviceId: null      // id du service choisi
  };

  /* ================= UTILITAIRES DE DATE / HEURE ================= */
  const pad = (n) => String(n).padStart(2, "0");

  // Convertit une Date en clé locale "AAAA-MM-JJ" (sans décalage de fuseau).
  function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

  // "HH:MM" -> minutes depuis minuit
  function toMin(hhmm) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
  // minutes -> "HH:MM"
  function toHHMM(min) { return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; }

  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

  // Un jour est-il réservable ? (pas dans le passé, ouvert, non bloqué, dans la fenêtre)
  function isDayAvailable(date) {
    const today = startOfDay(new Date());
    const day = startOfDay(date);
    if (day < today) return false;                                    // passé
    const limite = new Date(today);
    limite.setDate(limite.getDate() + C.reservation.joursAVenir);
    if (day > limite) return false;                                   // trop loin
    if (C.joursFermes.includes(toISO(day))) return false;             // vacances / férié
    const h = C.horaires[JOURS[day.getDay()]];
    if (!h || !h.ouvert) return false;                                // jour de fermeture
    return true;
  }

  /* ================= GÉNÉRATION DES CRÉNEAUX ====================
     Lit config.js pour construire les créneaux de 15 min de la journée,
     en excluant : la pause déjeuner, les créneaux bloqués, et — pour
     aujourd'hui — les créneaux déjà passés (avec le délai minimum). */
  function generateSlots(date) {
    const h = C.horaires[JOURS[date.getDay()]];
    if (!h || !h.ouvert) return [];

    const pas = C.reservation.pasMinutes;
    const iso = toISO(date);
    const debut = toMin(h.debut);
    const fin = toMin(h.fin);                 // dernier créneau proposé = fin - pas
    const bloques = new Set(
      C.creneauxBloques.filter((b) => b.date === iso).map((b) => b.heure)
    );

    // Seuil « maintenant + délai mini » si la date est aujourd'hui
    const now = new Date();
    const estAujourdhui = toISO(now) === iso;
    const seuilMin = now.getHours() * 60 + now.getMinutes() + C.reservation.delaiMiniHeures * 60;

    const slots = [];
    for (let t = debut; t <= fin - pas; t += pas) {
      const hhmm = toHHMM(t);
      // Exclure la pause déjeuner
      if (h.pause && t >= toMin(h.pause.debut) && t < toMin(h.pause.fin)) continue;
      // Exclure les créneaux bloqués manuellement (config.js)
      if (bloques.has(hhmm)) continue;
      // Exclure les créneaux déjà passés aujourd'hui
      if (estAujourdhui && t < seuilMin) continue;
      slots.push(hhmm);
    }
    return slots;
  }

  /* ===================== RENDU DU CALENDRIER ==================== */
  function renderCalendar() {
    const monthLabel = document.getElementById("calMonth");
    const grid = document.getElementById("calGrid");
    const prevBtn = document.getElementById("calPrev");
    const nextBtn = document.getElementById("calNext");
    if (!grid) return;

    const view = state.view;
    monthLabel.textContent = `${MOIS[view.getMonth()]} ${view.getFullYear()}`;

    // En-têtes des jours (lundi en premier)
    const dows = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    let html = dows.map((d) => `<div class="calendar__dow">${d}</div>`).join("");

    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    // getDay() : 0=dim … on décale pour commencer le lundi
    const offset = (first.getDay() + 6) % 7;
    const nbJours = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();

    // Cellules vides avant le 1er
    for (let i = 0; i < offset; i++) html += `<div class="calendar__day is-empty" aria-hidden="true"></div>`;

    for (let d = 1; d <= nbJours; d++) {
      const date = new Date(view.getFullYear(), view.getMonth(), d);
      const iso = toISO(date);
      const dispo = isDayAvailable(date);
      const selected = state.selectedDate && toISO(state.selectedDate) === iso;
      html += `<button type="button"
                 class="calendar__day${selected ? " is-selected" : ""}"
                 data-date="${iso}"
                 ${dispo ? "" : "disabled"}
                 aria-label="${d} ${MOIS[view.getMonth()]}${dispo ? "" : " — indisponible"}"
                 ${selected ? 'aria-pressed="true"' : ""}>${d}</button>`;
    }
    grid.innerHTML = html;

    // Activer / désactiver les flèches de navigation
    const today = startOfDay(new Date());
    const curMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    prevBtn.disabled = view <= curMonthStart;
    const limite = new Date(today);
    limite.setDate(limite.getDate() + C.reservation.joursAVenir);
    const limiteMonthStart = new Date(limite.getFullYear(), limite.getMonth(), 1);
    nextBtn.disabled = view >= limiteMonthStart;

    // Clic sur un jour disponible
    grid.querySelectorAll(".calendar__day[data-date]:not([disabled])").forEach((btn) => {
      btn.addEventListener("click", () => selectDate(btn.dataset.date));
    });
  }

  function selectDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    state.selectedDate = new Date(y, m - 1, d);
    state.selectedTime = null;
    renderCalendar();
    renderSlots();
    updateSummary();
  }

  /* ===================== RENDU DES CRÉNEAUX ==================== */
  function renderSlots() {
    const box = document.getElementById("slots");
    if (!box) return;

    if (!state.selectedDate) {
      box.innerHTML = `<p class="slots__hint">Choisissez d'abord une date pour voir les créneaux disponibles.</p>`;
      return;
    }
    const slots = generateSlots(state.selectedDate);
    if (slots.length === 0) {
      box.innerHTML = `<p class="slots__empty">Aucun créneau disponible ce jour-là. Merci de choisir une autre date.</p>`;
      return;
    }
    box.innerHTML = slots.map((s) =>
      `<button type="button" class="slot${state.selectedTime === s ? " is-selected" : ""}"
        data-time="${s}" ${state.selectedTime === s ? 'aria-pressed="true"' : ""}>${s}</button>`
    ).join("");

    box.querySelectorAll(".slot").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedTime = btn.dataset.time;
        renderSlots();
        updateSummary();
      });
    });
  }

  /* ============ RADIOS DE SERVICE (générées depuis config) ===== */
  function renderServiceChoices() {
    const box = document.getElementById("serviceChoice");
    if (!box) return;
    box.innerHTML = C.services.map((s) => `
      <label class="service-radio">
        <input type="radio" name="service" value="${s.id}" ${state.serviceId === s.id ? "checked" : ""}>
        <span class="service-radio__name">${s.nom}</span>
        <span class="service-radio__meta">${s.prix} € · ${s.dureeTxt}</span>
      </label>`).join("");

    box.querySelectorAll('input[name="service"]').forEach((input) => {
      input.addEventListener("change", () => { state.serviceId = input.value; updateSummary(); });
    });
  }

  /* ================= RÉCAPITULATIF DE CONFIRMATION ============= */
  function updateSummary() {
    const el = document.getElementById("bookingSummary");
    if (!el) return;
    const service = C.services.find((s) => s.id === state.serviceId);
    if (state.selectedDate && state.selectedTime && service) {
      const dateTxt = formatDateLong(state.selectedDate);
      el.innerHTML = `Confirmez votre demande : <strong>${service.nom}</strong>
        le <strong>${dateTxt}</strong> à <strong>${state.selectedTime}</strong>
        <br><span style="color:var(--color-muted)">${service.prix} € · ${service.dureeTxt}</span>`;
      el.classList.remove("is-hidden");
    } else {
      el.classList.add("is-hidden");
    }
  }

  function formatDateLong(d) {
    return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
  }

  /* =====================================================================
     ENVOI DE LA DEMANDE — STRATÉGIE MODULAIRE
     ---------------------------------------------------------------------
     On isole l'envoi dans une seule fonction « sendReservation(payload) ».
     Pour changer de fournisseur (Formspree, Google Form, mailto…),
     il suffit de remplacer le contenu de cette fonction — le reste du
     code ne change pas.
     ===================================================================== */
  function emailjsConfigured() {
    const e = C.emailjs;
    return e && e.publicKey && e.serviceId && e.templateBarbier &&
           !/^X+$/i.test(e.publicKey) && window.emailjs;
  }

  // Repli universel : ouvre la messagerie du client, pré-remplie vers le salon.
  function mailtoFallback(payload) {
    const sujet = `Demande de RDV — ${payload.service} le ${payload.date} à ${payload.heure}`;
    const corps =
`Bonjour,

Je souhaite demander un rendez-vous :

• Service : ${payload.service} (${payload.prix} € · ${payload.duree})
• Date    : ${payload.date}
• Heure   : ${payload.heure}

Mes coordonnées :
• Prénom    : ${payload.prenom}
• Nom       : ${payload.nom}
• Téléphone : ${payload.telephone}
• Email     : ${payload.email}

Merci de me confirmer ce créneau.
`;
    const url = `mailto:${encodeURIComponent(C.salon.email)}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
    window.location.href = url;
  }

  // Renvoie une promesse. Utilise EmailJS si configuré, sinon mailto.
  function sendReservation(payload) {
    if (emailjsConfigured()) {
      const e = C.emailjs;
      // 1) Email au barbier (la demande à valider)
      const p = window.emailjs.send(e.serviceId, e.templateBarbier, payload);
      // 2) Email de courtoisie au client (optionnel, si template fourni)
      if (e.templateClient && !/^X+$/i.test(e.templateClient)) {
        window.emailjs.send(e.serviceId, e.templateClient, payload).catch(() => {});
      }
      return p;
    }
    // Repli mailto : considéré comme « envoyé » une fois la messagerie ouverte.
    return new Promise((resolve) => { mailtoFallback(payload); resolve({ fallback: true }); });
  }

  /* ==================== SOUMISSION DU FORMULAIRE =============== */
  function handleSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const feedback = document.getElementById("bookingFeedback");
    const service = C.services.find((s) => s.id === state.serviceId);

    // Validations métier explicites
    if (!state.selectedDate) return showFeedback(feedback, "error", "Merci de choisir une date.");
    if (!state.selectedTime) return showFeedback(feedback, "error", "Merci de choisir un créneau horaire.");
    if (!service)            return showFeedback(feedback, "error", "Merci de choisir une prestation.");
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const data = new FormData(form);
    const payload = {
      service:   service.nom,
      prix:      service.prix,
      duree:     service.dureeTxt,
      date:      formatDateLong(state.selectedDate),
      dateISO:   toISO(state.selectedDate),
      heure:     state.selectedTime,
      prenom:    (data.get("prenom") || "").trim(),
      nom:       (data.get("nom") || "").trim(),
      telephone: (data.get("telephone") || "").trim(),
      email:     (data.get("email") || "").trim(),
      salon:     C.salon.nom
    };

    const btn = form.querySelector('button[type="submit"]');
    const btnTxt = btn.textContent;
    btn.disabled = true; btn.textContent = "Envoi en cours…";

    sendReservation(payload)
      .then((res) => {
        if (res && res.fallback) {
          showFeedback(feedback, "info",
            "Votre messagerie s'est ouverte avec la demande pré-remplie. Envoyez l'email pour finaliser votre demande de rendez-vous.");
        } else {
          showFeedback(feedback, "success",
            "Votre demande de rendez-vous a bien été envoyée. Vous recevrez un email de confirmation dès que le coiffeur aura validé votre créneau.");
          form.reset();
          state.selectedTime = null;
          renderSlots(); updateSummary();
        }
      })
      .catch(() => {
        // En cas d'échec EmailJS, on bascule sur le repli mailto pour ne pas perdre la demande.
        mailtoFallback(payload);
        showFeedback(feedback, "info",
          "L'envoi automatique a échoué : votre messagerie s'est ouverte avec la demande pré-remplie. Envoyez l'email pour finaliser.");
      })
      .finally(() => { btn.disabled = false; btn.textContent = btnTxt; });
  }

  function showFeedback(el, type, msg) {
    if (!el) return;
    el.className = `booking-feedback is-visible is-${type}`;
    el.textContent = msg;
    el.setAttribute("role", "status");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* =================== PRÉ-REMPLISSAGE DEPUIS UNE CARTE ======== */
  // Appelé quand on clique « Réserver » sur une carte service.
  function preselectService(serviceId) {
    state.serviceId = serviceId;
    renderServiceChoices();
    updateSummary();
  }
  window.RufixBooking = { preselectService };

  /* =========================== INIT =========================== */
  function init() {
    if (!C || !document.getElementById("bookingForm")) return;

    // Mois affiché = mois courant
    const now = new Date();
    state.view = new Date(now.getFullYear(), now.getMonth(), 1);

    renderCalendar();
    renderSlots();
    renderServiceChoices();

    document.getElementById("calPrev").addEventListener("click", () => {
      state.view = new Date(state.view.getFullYear(), state.view.getMonth() - 1, 1);
      renderCalendar();
    });
    document.getElementById("calNext").addEventListener("click", () => {
      state.view = new Date(state.view.getFullYear(), state.view.getMonth() + 1, 1);
      renderCalendar();
    });

    document.getElementById("bookingForm").addEventListener("submit", handleSubmit);

    // Boutons « Réserver » des cartes services : pré-sélection + défilement
    document.querySelectorAll("[data-book-service]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        preselectService(btn.dataset.bookService);
        document.getElementById("reservation").scrollIntoView({ behavior: "smooth" });
      });
    });
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
