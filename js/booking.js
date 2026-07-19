/* =====================================================================
   RUFIX BARBER — booking.js
   Réservation avec CALENDRIER HEBDOMADAIRE et créneaux COLORÉS.

   Principes (cf. cahier des charges) :
   - Vue par SEMAINE (lun → dim), navigation semaine par semaine, jusqu'au
     31/12/2026 inclus (config.reservation.dateMax).
   - Créneaux de 15 min. La DURÉE du service détermine automatiquement le
     nombre de créneaux consécutifs bloqués (30 min = 2, 45 = 3, 1 h = 4…).
   - Les créneaux ne DISPARAISSENT pas : ils changent d'état / de couleur.
       🟢 vert  = disponible et réservable
       🔴 rouge = déjà réservé / indisponible
       (gris/verrouillé = semaine pas encore ouverte, ou hors horaires)
   - Ouverture hebdo glissante : une semaine s'ouvre au "vendredi 21h" de la
     semaine précédente (config.reservation.ouverture).

   ⚠️ Le salon reste en CONFIRMATION MANUELLE : une demande bloque le créneau
   mais n'est pas confirmée automatiquement côté client.

   ⚠️ Site statique : la disponibilité partagée entre visiteurs vient du
   backend Google Sheet (config.backend.url) ; sinon, blocage manuel via
   config.creneauxBloques. L'anti double-réservation final est côté backend.
   ===================================================================== */

(function () {
  "use strict";

  const C = window.CONFIG;
  const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const JOURS_COURT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
                "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  /* --- État de la réservation --- */
  const state = {
    weekStart: null,       // lundi de la semaine affichée (Date)
    selectedDate: null,    // "AAAA-MM-JJ"
    selectedTime: null,    // "HH:MM"
    serviceId: null,       // id du service choisi
    occupiedByDate: {},    // { "AAAA-MM-JJ": Set(["11:00", …]) } (backend)
    loading: false
  };

  /* ================= UTILITAIRES DATE / HEURE ================= */
  const pad = (n) => String(n).padStart(2, "0");
  function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function toMin(hhmm) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
  function toHHMM(min) { return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; }
  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function parseISO(iso) { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); }
  // Lundi de la semaine contenant d
  function mondayOf(d) { const x = startOfDay(d); const off = (x.getDay() + 6) % 7; return addDays(x, -off); }

  function dateMax() {
    return startOfDay(parseISO(C.reservation.dateMax || "2026-12-31"));
  }

  /* ============ OUVERTURE HEBDOMADAIRE GLISSANTE ============
     Une semaine (lundi = monday) s'ouvre dès qu'on a dépassé le "jour/heure"
     d'ouverture situé dans la semaine PRÉCÉDENTE (par défaut vendredi 21h). */
  function weekOpensAt(monday) {
    const o = C.reservation.ouverture;
    const jour = (o && typeof o.jour === "number") ? o.jour : 5;   // 5 = vendredi
    const heure = (o && typeof o.heure === "number") ? o.heure : 21;
    // Nombre de jours à reculer depuis le lundi pour tomber sur ce jour la semaine d'avant.
    const back = ((1 - jour + 7) % 7) || 7;   // vendredi → 3 ; lundi → 7
    const b = addDays(monday, -back);
    b.setHours(heure, 0, 0, 0);
    return b;
  }
  function isWeekOpen(monday) {
    if (!C.reservation.ouverture) return true;   // règle désactivée
    return new Date() >= weekOpensAt(monday);
  }

  /* ============ BACKEND GOOGLE SHEET (blocage auto) ============ */
  function backendUrl() { return ((C.backend && C.backend.url) || "").trim(); }

  // Récupère TOUS les créneaux déjà pris → state.occupiedByDate. Échoue en douceur.
  function fetchAllOccupied() {
    const url = backendUrl();
    if (!url) return Promise.resolve();
    const sep = url.indexOf("?") === -1 ? "?" : "&";
    return fetch(`${url}${sep}all=1`, { method: "GET" })
      .then((r) => r.json())
      .then((d) => {
        const map = {};
        if (d && d.ok && Array.isArray(d.occupied)) {
          d.occupied.forEach((s) => {
            const sp = String(s).split(" ");
            if (sp.length < 2) return;
            if (!map[sp[0]]) map[sp[0]] = new Set();
            map[sp[0]].add(sp[1]);
          });
        }
        state.occupiedByDate = map;
      })
      .catch(() => {});
  }

  // Enregistre la demande (POST) → { ok:true } | { taken:true } | { unreachable:true }.
  // Content-Type "text/plain" volontaire (évite le pré-vol CORS non géré par Apps Script).
  function recordBooking(payload) {
    const url = backendUrl();
    if (!url) return Promise.resolve({ ok: true, skipped: true });
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    })
      .then((r) => r.json())
      .then((d) => (d && d.ok) ? { ok: true } : (d && d.taken) ? { taken: true } : { unreachable: true })
      .catch(() => ({ unreachable: true }));
  }

  /* ================= STATUT D'UN CRÉNEAU =================
     Renvoie : 'none' (hors horaires / pause), 'closed' (jour fermé),
     'past' (déjà passé), 'locked' (semaine pas encore ouverte),
     'reserved' (déjà pris), 'free' (disponible). */
  function isReserved(dateISO, hhmm) {
    if (C.creneauxBloques.some((b) => b.date === dateISO && b.heure === hhmm)) return true;
    const set = state.occupiedByDate[dateISO];
    return set ? set.has(hhmm) : false;
  }

  function slotStatus(dateISO, t) {
    const d = parseISO(dateISO);
    const h = C.horaires[JOURS[d.getDay()]];
    if (!h || !h.ouvert || C.joursFermes.includes(dateISO)) return "closed";

    const debut = toMin(h.debut), fin = toMin(h.fin), pas = C.reservation.pasMinutes;
    if (t < debut || t > fin - pas) return "none";                       // hors horaires
    if (h.pause && t >= toMin(h.pause.debut) && t < toMin(h.pause.fin)) return "none"; // pause

    const today = startOfDay(new Date());
    const day = startOfDay(d);
    if (day > dateMax()) return "none";
    if (day < today) return "past";
    if (day.getTime() === today.getTime()) {
      const now = new Date();
      const seuil = now.getHours() * 60 + now.getMinutes() + (C.reservation.delaiMiniHeures || 0) * 60;
      if (t < seuil) return "past";
    }
    if (!isWeekOpen(mondayOf(d))) return "locked";
    if (isReserved(dateISO, toHHMM(t))) return "reserved";
    return "free";
  }

  // Tous les créneaux (15 min) qu'occupe une prestation à partir d'une heure.
  function spanTimes(startHHMM, dureeMin) {
    const pas = C.reservation.pasMinutes;
    const n = Math.max(1, Math.ceil(Number(dureeMin) / pas));
    const start = toMin(startHHMM);
    const out = [];
    for (let k = 0; k < n; k++) out.push(toHHMM(start + k * pas));
    return out;
  }
  // La prestation choisie tient-elle entièrement (tous les créneaux libres) ?
  function spanIsFree(dateISO, startHHMM, dureeMin) {
    return spanTimes(startHHMM, dureeMin).every((hhmm) => slotStatus(dateISO, toMin(hhmm)) === "free");
  }

  /* ===================== RENDU DE LA SEMAINE ==================== */
  function weekDaysISO() {
    const days = [];
    for (let i = 0; i < 7; i++) days.push(toISO(addDays(state.weekStart, i)));
    return days;
  }

  // Plage horaire à afficher : de la plus tôt à la plus tard parmi les jours ouverts.
  function weekTimeRange(daysISO) {
    let min = Infinity, max = -Infinity;
    daysISO.forEach((iso) => {
      const d = parseISO(iso);
      const h = C.horaires[JOURS[d.getDay()]];
      if (h && h.ouvert) { min = Math.min(min, toMin(h.debut)); max = Math.max(max, toMin(h.fin)); }
    });
    if (min === Infinity) { min = toMin("09:00"); max = toMin("18:00"); }
    return { min, max };
  }

  function labelWeek() {
    const a = state.weekStart, b = addDays(a, 6);
    const jour = (x) => x.getDate();
    if (a.getMonth() === b.getMonth()) {
      return `Semaine du ${jour(a)} au ${jour(b)} ${MOIS[b.getMonth()]} ${b.getFullYear()}`;
    }
    return `Semaine du ${jour(a)} ${MOIS[a.getMonth()]} au ${jour(b)} ${MOIS[b.getMonth()]} ${b.getFullYear()}`;
  }

  function renderWeek() {
    const grid = document.getElementById("weekGrid");
    const label = document.getElementById("weekLabel");
    const prevBtn = document.getElementById("weekPrev");
    const nextBtn = document.getElementById("weekNext");
    const note = document.getElementById("weekNote");
    if (!grid) return;

    label.textContent = labelWeek();

    const days = weekDaysISO();
    const { min, max } = weekTimeRange(days);
    const pas = C.reservation.pasMinutes;

    // Créneaux de la sélection en cours (pour surligner la plage réservée).
    const service = C.services.find((s) => s.id === state.serviceId);
    const selSet = new Set();
    if (state.selectedDate && state.selectedTime && service) {
      spanTimes(state.selectedTime, service.duree).forEach((hh) => selSet.add(state.selectedDate + " " + hh));
    }

    // En-tête : coin vide + 7 jours
    let html = `<div class="wcell wcorner" aria-hidden="true"></div>`;
    days.forEach((iso) => {
      const d = parseISO(iso);
      const isToday = toISO(new Date()) === iso;
      html += `<div class="wcell whead${isToday ? " is-today" : ""}">
                 <span class="whead__dow">${JOURS_COURT[d.getDay()]}</span>
                 <span class="whead__num">${d.getDate()}</span>
               </div>`;
    });

    // Lignes horaires
    for (let t = min; t <= max - pas; t += pas) {
      const hhmm = toHHMM(t);
      // On n'affiche la ligne que si au moins un jour a un créneau réel à cette heure.
      const anyReal = days.some((iso) => {
        const st = slotStatus(iso, t);
        return st !== "none";
      });
      if (!anyReal) continue;

      html += `<div class="wcell wtime">${hhmm}</div>`;
      days.forEach((iso) => {
        const st = slotStatus(iso, t);
        const key = iso + " " + hhmm;
        if (st === "none") { html += `<div class="wcell wslot wslot--none" aria-hidden="true"></div>`; return; }
        const isSel = selSet.has(key);
        const cls = isSel ? "wslot--sel" : ("wslot--" + st);
        const clickable = (st === "free");
        const dLabel = `${JOURS_COURT[parseISO(iso).getDay()]} ${parseISO(iso).getDate()} à ${hhmm}`;
        const stTxt = st === "free" ? "disponible" : st === "reserved" ? "réservé" : st === "past" ? "passé" : st === "locked" ? "pas encore ouvert" : "indisponible";
        html += `<button type="button" class="wcell wslot ${cls}"
                   ${clickable ? "" : "disabled"}
                   ${clickable ? `data-date="${iso}" data-time="${hhmm}"` : ""}
                   aria-label="${dLabel} — ${stTxt}"></button>`;
      });
    }

    grid.innerHTML = html;

    // Navigation (bornes)
    prevBtn.disabled = state.weekStart <= mondayOf(new Date());
    nextBtn.disabled = mondayOf(dateMax()) <= state.weekStart;

    // Note : semaine pas encore ouverte ?
    if (!isWeekOpen(state.weekStart)) {
      const o = weekOpensAt(state.weekStart);
      note.textContent = `🔒 Les réservations pour cette semaine ouvrent le ${JOURS[o.getDay()]} ${o.getDate()} ${MOIS[o.getMonth()]} à ${pad(o.getHours())}h.`;
      note.classList.add("is-visible");
    } else if (!state.serviceId) {
      note.textContent = "Choisissez d'abord une prestation (étape 1), puis cliquez un créneau vert.";
      note.classList.add("is-visible");
    } else {
      note.classList.remove("is-visible");
      note.textContent = "";
    }
  }

  /* ===================== SÉLECTION D'UN CRÉNEAU ==================== */
  function selectSlot(dateISO, hhmm) {
    const note = document.getElementById("weekNote");
    const service = C.services.find((s) => s.id === state.serviceId);
    if (!service) {
      note.textContent = "Choisissez d'abord une prestation (étape 1).";
      note.classList.add("is-visible");
      return;
    }
    if (!spanIsFree(dateISO, hhmm, service.duree)) {
      note.textContent = `Ce créneau est trop court pour « ${service.nom} » (${service.dureeTxt}) : un créneau suivant est déjà pris. Choisissez un autre horaire.`;
      note.classList.add("is-visible");
      return;
    }
    state.selectedDate = dateISO;
    state.selectedTime = hhmm;
    renderWeek();
    updateSummary();
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
      input.addEventListener("change", () => {
        state.serviceId = input.value;
        // La durée change : on revérifie la sélection en cours.
        if (state.selectedDate && state.selectedTime) {
          const service = C.services.find((s) => s.id === state.serviceId);
          if (!spanIsFree(state.selectedDate, state.selectedTime, service.duree)) {
            state.selectedDate = null; state.selectedTime = null;
          }
        }
        renderWeek();
        updateSummary();
      });
    });
  }

  /* ================= RÉCAPITULATIF DE CONFIRMATION ============= */
  function formatDateLong(d) {
    return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
  }
  function updateSummary() {
    const el = document.getElementById("bookingSummary");
    if (!el) return;
    const service = C.services.find((s) => s.id === state.serviceId);
    if (state.selectedDate && state.selectedTime && service) {
      const dateTxt = formatDateLong(parseISO(state.selectedDate));
      el.innerHTML = `Confirmez votre demande : <strong>${service.nom}</strong>
        le <strong>${dateTxt}</strong> à <strong>${state.selectedTime}</strong>
        <br><span style="color:var(--color-muted)">${service.prix} € · ${service.dureeTxt}</span>`;
      el.classList.remove("is-hidden");
    } else {
      el.classList.add("is-hidden");
    }
  }

  /* =====================================================================
     ENVOI DE LA DEMANDE — stratégie modulaire (EmailJS, sinon mailto).
     ===================================================================== */
  function emailjsConfigured() {
    const e = C.emailjs;
    return e && e.publicKey && e.serviceId && e.templateBarbier &&
           !/^X+$/i.test(e.publicKey) && window.emailjs;
  }

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

  function sendReservation(payload) {
    if (emailjsConfigured()) {
      const e = C.emailjs;
      const p = window.emailjs.send(e.serviceId, e.templateBarbier, payload);
      if (e.templateClient && !/^X+$/i.test(e.templateClient)) {
        window.emailjs.send(e.serviceId, e.templateClient, payload).catch(() => {});
      }
      return p;
    }
    return new Promise((resolve) => { mailtoFallback(payload); resolve({ fallback: true }); });
  }

  /* ==================== SOUMISSION DU FORMULAIRE =============== */
  function handleSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const feedback = document.getElementById("bookingFeedback");
    const service = C.services.find((s) => s.id === state.serviceId);

    if (!service)            return showFeedback(feedback, "error", "Merci de choisir une prestation.");
    if (!state.selectedDate || !state.selectedTime)
                             return showFeedback(feedback, "error", "Merci de choisir un créneau (case verte) dans le calendrier.");
    if (!form.checkValidity()) { form.reportValidity(); return; }

    // Dernière vérification côté client (la plage est-elle toujours libre ?)
    if (!spanIsFree(state.selectedDate, state.selectedTime, service.duree)) {
      return showFeedback(feedback, "error", "Ce créneau n'est plus disponible. Merci d'en choisir un autre.");
    }

    const data = new FormData(form);
    const payload = {
      service:   service.nom,
      prix:      service.prix,
      duree:     service.dureeTxt,
      dureeMin:  service.duree,     // minutes → blocage backend
      date:      formatDateLong(parseISO(state.selectedDate)),
      dateISO:   state.selectedDate,
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
    const restore = () => { btn.disabled = false; btn.textContent = btnTxt; };

    // 1) On réserve d'abord le créneau dans le backend (blocage automatique).
    recordBooking(payload).then((rec) => {
      if (rec.taken) {
        restore();
        showFeedback(feedback, "error",
          "Ce créneau vient d'être réservé par quelqu'un d'autre. Merci d'en choisir un autre.");
        fetchAllOccupied().then(() => { state.selectedTime = null; state.selectedDate = null; renderWeek(); updateSummary(); });
        return;
      }
      // 2) Puis on envoie la demande par email (EmailJS ou repli mailto).
      sendReservation(payload)
        .then((res) => {
          if (res && res.fallback) {
            showFeedback(feedback, "info",
              "Votre messagerie s'est ouverte avec la demande pré-remplie. Envoyez l'email pour finaliser votre demande de rendez-vous.");
          } else {
            showFeedback(feedback, "success",
              "Votre demande de rendez-vous a bien été envoyée. Vous recevrez un email de confirmation dès que le coiffeur aura validé votre créneau.");
            // Blocage immédiat côté affichage (les créneaux passent en rouge).
            const set = state.occupiedByDate[payload.dateISO] || (state.occupiedByDate[payload.dateISO] = new Set());
            spanTimes(payload.heure, payload.dureeMin).forEach((hh) => set.add(hh));
            form.reset();
            state.selectedDate = null; state.selectedTime = null;
            renderWeek(); updateSummary();
          }
        })
        .catch(() => {
          mailtoFallback(payload);
          showFeedback(feedback, "info",
            "L'envoi automatique a échoué : votre messagerie s'est ouverte avec la demande pré-remplie. Envoyez l'email pour finaliser.");
        })
        .finally(restore);
    });
  }

  function showFeedback(el, type, msg) {
    if (!el) return;
    el.className = `booking-feedback is-visible is-${type}`;
    el.textContent = msg;
    el.setAttribute("role", "status");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* =================== PRÉ-REMPLISSAGE DEPUIS UNE CARTE ======== */
  function preselectService(serviceId) {
    state.serviceId = serviceId;
    renderServiceChoices();
    renderWeek();
    updateSummary();
  }

  /* ============ API PUBLIQUE (utilisée par l'assistant) ========
     Permet à l'assistant de citer de VRAIS créneaux disponibles et
     d'emmener le visiteur directement sur la réservation. */
  function nextAvailableSlots(limit, serviceId) {
    const service = C.services.find((s) => s.id === serviceId) || C.services[0];
    const pas = C.reservation.pasMinutes;
    const max = dateMax();
    const out = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 120 && out.length < limit; i++) {
      const day = addDays(today, i);
      if (day > max) break;
      const iso = toISO(day);
      const h = C.horaires[JOURS[day.getDay()]];
      if (!h || !h.ouvert) continue;
      for (let t = toMin(h.debut); t <= toMin(h.fin) - pas && out.length < limit; t += pas) {
        const hhmm = toHHMM(t);
        if (slotStatus(iso, t) === "free" && spanIsFree(iso, hhmm, service.duree)) {
          out.push({ dateISO: iso, date: formatDateLong(parseISO(iso)), heure: hhmm, service: service.nom });
        }
      }
    }
    return out;
  }

  function goToReservation(serviceId) {
    if (serviceId) preselectService(serviceId);
    const el = document.getElementById("reservation");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  window.RufixBooking = {
    preselectService,
    goToReservation,
    nextAvailableSlots,
    refreshOccupied: () => (backendUrl() ? fetchAllOccupied().then(renderWeek) : Promise.resolve())
  };

  /* =========================== INIT =========================== */
  function init() {
    if (!C || !document.getElementById("bookingForm")) return;

    // Semaine affichée = semaine courante (mais jamais avant aujourd'hui).
    state.weekStart = mondayOf(new Date());

    renderServiceChoices();
    renderWeek();

    document.getElementById("weekPrev").addEventListener("click", () => {
      if (state.weekStart <= mondayOf(new Date())) return;
      state.weekStart = addDays(state.weekStart, -7);
      renderWeek();
      if (backendUrl()) fetchAllOccupied().then(renderWeek);
    });
    document.getElementById("weekNext").addEventListener("click", () => {
      if (mondayOf(dateMax()) <= state.weekStart) return;
      state.weekStart = addDays(state.weekStart, 7);
      renderWeek();
      if (backendUrl()) fetchAllOccupied().then(renderWeek);
    });

    document.getElementById("weekGrid").addEventListener("click", (e) => {
      const cell = e.target.closest(".wslot--free[data-date]");
      if (cell) selectSlot(cell.dataset.date, cell.dataset.time);
    });

    document.getElementById("bookingForm").addEventListener("submit", handleSubmit);

    document.querySelectorAll("[data-book-service]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        preselectService(btn.dataset.bookService);
        document.getElementById("reservation").scrollIntoView({ behavior: "smooth" });
      });
    });

    // Charge l'état des créneaux pris (backend), puis rafraîchit l'affichage.
    if (backendUrl()) fetchAllOccupied().then(renderWeek);
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
