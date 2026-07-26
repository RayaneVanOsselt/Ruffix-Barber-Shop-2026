/* =====================================================================
   RUFIX BARBER — booking.js
   Réservation avec CALENDRIER HEBDOMADAIRE et créneaux COLORÉS.

   Principes (cf. cahier des charges) :
   - Vue par SEMAINE (lun → dim), navigation semaine par semaine. Réservation
     ouverte MOIS par MOIS : le mois suivant s'ouvre le 25 du mois en cours
     (config.reservation.ouvertureMensuelle).
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

  // JOURS/MOIS restent en FRANÇAIS pour lire config.horaires (clés françaises).
  // Pour l'AFFICHAGE, on passe par i18n (jourL/jourC/moisL) qui suivent la langue.
  const I18 = () => window.RufixI18N;
  const tr = (k, fb) => (I18() ? I18().t(k) : fb);
  const jourL = () => tr("days.long", JOURS);
  const jourC = () => tr("days.short", JOURS_COURT);
  const moisL = () => tr("months", MOIS);
  const SVC_KEY = { "coupe": "svc.coupe.name", "barbe": "svc.barbe.name", "coupe-barbe": "svc.cb.name" };
  const svcName = (s) => (I18() && SVC_KEY[s.id]) ? I18().t(SVC_KEY[s.id]) : s.nom;

  /* --- État de la réservation --- */
  const state = {
    weekStart: null,       // lundi de la semaine affichée (Date)
    selectedDate: null,    // "AAAA-MM-JJ"
    selectedTime: null,    // "HH:MM"
    serviceId: null,       // id du service choisi
    occupiedByDate: {},    // 🔴 RDV CONFIRMÉS → créneaux bloqués
    pendingByDate: {},     // 🟠 demandes EN ATTENTE → visibles mais non bloquantes
    loading: false,
    // Vrai tant que les créneaux déjà pris n'ont pas été chargés depuis le backend.
    // Évite d'afficher des créneaux VERTS (donc cliquables) alors qu'ils sont
    // peut-être déjà réservés — Google Apps Script met ~2 s à répondre.
    loadingOccupied: false
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
    // Garde-fou de date absolue.
    const fixe = startOfDay(parseISO(C.reservation.dateMax || "2026-12-31"));
    const r = C.reservation;

    // RÉSERVATION MOIS PAR MOIS : le mois suivant s'ouvre en entier le
    // « jourOuvertureMoisSuivant » (par défaut le 25) du mois en cours.
    //   → le 25 juillet, tout août est réservable ; le 25 août, tout septembre ; etc.
    if (r.ouvertureMensuelle) {
      const jour = Number(r.jourOuvertureMoisSuivant) || 25;
      const now = new Date();
      let y = now.getFullYear();
      let mois = now.getMonth();               // mois courant (0-11)
      if (now.getDate() >= jour) mois += 1;     // à partir du 25 → on ouvre le mois suivant
      // Dernier jour du mois cible = « jour 0 » du mois d'après (Date normalise l'année).
      const horizon = startOfDay(new Date(y, mois + 1, 0));
      return horizon < fixe ? horizon : fixe;   // on garde la plus proche
    }
    return fixe;
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
    // ⚠️ Google met les réponses Apps Script en cache : sans paramètre unique,
    // le site afficherait des disponibilités périmées (créneau confirmé encore vert).
    return fetch(`${url}${sep}all=1&_=${Date.now()}`, { method: "GET", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        // Transforme ["AAAA-MM-JJ HH:MM", …] en { "AAAA-MM-JJ": Set(["HH:MM"]) }
        const versMap = (liste) => {
          const map = {};
          (Array.isArray(liste) ? liste : []).forEach((s) => {
            const sp = String(s).split(" ");
            if (sp.length < 2) return;
            if (!map[sp[0]]) map[sp[0]] = new Set();
            map[sp[0]].add(sp[1]);
          });
          return map;
        };
        if (d && d.ok) {
          // "confirmed" = nouveau format (v3) ; "occupied" = repli ancien format
          state.occupiedByDate = versMap(d.confirmed || d.occupied);
          state.pendingByDate = versMap(d.pending);
        }
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
  // 🔴 Créneau BLOQUÉ : RDV confirmé par le barbier, ou blocage manuel (config.js)
  function isReserved(dateISO, hhmm) {
    if (C.creneauxBloques.some((b) => b.date === dateISO && b.heure === hhmm)) return true;
    const set = state.occupiedByDate[dateISO];
    return set ? set.has(hhmm) : false;
  }
  // 🟠 Créneau EN ATTENTE : une demande existe, mais elle ne bloque pas encore.
  function isPending(dateISO, hhmm) {
    const set = state.pendingByDate[dateISO];
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
    const hhmm = toHHMM(t);
    if (isReserved(dateISO, hhmm)) return "reserved";                   // 🔴 confirmé
    if (isPending(dateISO, hhmm)) return "pending";                     // 🟠 en attente
    return "free";                                                      // 🟢 libre
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
  // La prestation choisie tient-elle entièrement ?
  // 🟠 Un créneau "en attente" reste réservable : seuls les RDV confirmés bloquent.
  function spanIsFree(dateISO, startHHMM, dureeMin) {
    return spanTimes(startHHMM, dureeMin).every((hhmm) => {
      const st = slotStatus(dateISO, toMin(hhmm));
      return st === "free" || st === "pending";
    });
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
    const W = tr("cal.week", "Semaine du"), TO = tr("cal.to", "au"), M = moisL();
    if (a.getMonth() === b.getMonth()) {
      return `${W} ${jour(a)} ${TO} ${jour(b)} ${M[b.getMonth()]} ${b.getFullYear()}`;
    }
    return `${W} ${jour(a)} ${M[a.getMonth()]} ${TO} ${jour(b)} ${M[b.getMonth()]} ${b.getFullYear()}`;
  }

  // Bannière « salon partenaire » : lisible, pleine largeur, sous la légende.
  // Créée à la volée et réutilisée. Masquée si pas de jour indisponible.
  function renderPartnerBanner(show, p) {
    const wrap = document.querySelector(".week__grid-wrap");
    if (!wrap) return;
    let banner = document.getElementById("weekPartner");
    if (show && p && p.url) {
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "weekPartner";
        banner.className = "week__partner";
        wrap.parentElement.insertBefore(banner, wrap);   // juste au-dessus de la grille
      }
      banner.innerHTML =
        `<svg class="icon" aria-hidden="true"><use href="#i-info"></use></svg>` +
        `<span>${p.message} <a href="${p.url}" target="_blank" rel="noopener">${p.nom}</a>.</span>`;
      banner.style.display = "";
    } else if (banner) {
      banner.style.display = "none";
    }
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

    // Un jour "indisponible" (mercredi/jeudi) : travaillé ailleurs → colonne
    // remplacée par un message + lien vers le salon partenaire.
    const isIndispo = (iso) => {
      const h = C.horaires[JOURS[parseISO(iso).getDay()]];
      return !!(h && h.indispo);
    };

    // Placement EXPLICITE (grid-column / grid-row) : indispensable pour qu'un
    // seul bloc-message puisse couvrir toute la hauteur des colonnes indispo.
    // En-tête : coin vide (col 1) + 7 jours (col 2 → 8), sur la ligne 1.
    let html = `<div class="wcell wcorner" style="grid-column:1;grid-row:1" aria-hidden="true"></div>`;
    days.forEach((iso, i) => {
      const d = parseISO(iso);
      const isToday = toISO(new Date()) === iso;
      html += `<div class="wcell whead${isToday ? " is-today" : ""}" style="grid-column:${i + 2};grid-row:1">
                 <span class="whead__dow">${jourC()[d.getDay()]}</span>
                 <span class="whead__num">${d.getDate()}</span>
               </div>`;
    });

    // Lignes horaires (ligne 2 et suivantes)
    let rowIndex = 1;
    for (let t = min; t <= max - pas; t += pas) {
      const hhmm = toHHMM(t);
      // On n'affiche la ligne que si au moins un jour a un créneau réel à cette heure.
      const anyReal = days.some((iso) => slotStatus(iso, t) !== "none");
      if (!anyReal) continue;
      rowIndex++;

      html += `<div class="wcell wtime" style="grid-column:1;grid-row:${rowIndex}">${hhmm}</div>`;
      days.forEach((iso, i) => {
        if (isIndispo(iso)) return;   // colonne couverte par le bloc-message (plus bas)
        const col = i + 2;
        const st0 = slotStatus(iso, t);
        // Tant que les créneaux pris ne sont pas chargés, on n'affiche NI vert NI rouge :
        // un état neutre non cliquable, pour ne jamais proposer un créneau déjà réservé.
        const st = (state.loadingOccupied && (st0 === "free" || st0 === "reserved" || st0 === "pending"))
                 ? "loading" : st0;
        const key = iso + " " + hhmm;
        if (st === "none") { html += `<div class="wcell wslot wslot--none" style="grid-column:${col};grid-row:${rowIndex}" aria-hidden="true"></div>`; return; }
        const isSel = selSet.has(key);
        const cls = isSel ? "wslot--sel" : ("wslot--" + st);
        // 🟠 "pending" reste cliquable : la demande n'est pas encore confirmée.
        const clickable = (st === "free" || st === "pending");
        const dLabel = `${jourC()[parseISO(iso).getDay()]} ${parseISO(iso).getDate()} · ${hhmm}`;
        const stTxt = st === "free" ? "disponible" : st === "reserved" ? "réservé (confirmé)"
                    : st === "pending" ? "demande en attente de confirmation"
                    : st === "past" ? "passé"
                    : st === "locked" ? "pas encore ouvert" : st === "loading" ? "chargement en cours" : "indisponible";
        html += `<button type="button" class="wcell wslot ${cls}" style="grid-column:${col};grid-row:${rowIndex}"
                   ${clickable ? "" : "disabled"}
                   ${clickable ? `data-date="${iso}" data-time="${hhmm}"` : ""}
                   aria-label="${dLabel} — ${stTxt}"></button>`;
      });
    }

    // Colonnes INDISPONIBLES (jours où le barbier travaille ailleurs) : simple
    // cellule hachurée pleine hauteur avec un libellé VERTICAL discret. Le
    // message + lien vers le salon partenaire est affiché dans une bannière
    // pleine largeur sous la légende (voir renderPartnerBanner) : ainsi le texte
    // ne déborde JAMAIS des colonnes étroites.
    const p = C.partenaireIndispo;
    const labelCol = (p && p.labelColonne) || "Réserver chez le partenaire";
    if (rowIndex >= 2) {
      days.forEach((iso, i) => {
        if (!isIndispo(iso)) return;
        const style = `grid-column:${i + 2};grid-row:2 / ${rowIndex + 1}`;
        if (p && p.url) {
          // Colonne CLIQUABLE : mène directement à la réservation chez le partenaire.
          html += `<a class="wcell wslot--indispo is-link" style="${style}"
                     href="${p.url}" target="_blank" rel="noopener"
                     aria-label="${labelCol} — ${p.nom}">
                     <span class="wslot-indispo__label">${labelCol} ↗</span>
                   </a>`;
        } else {
          html += `<div class="wcell wslot--indispo" style="${style}" aria-label="${labelCol}">
                     <span class="wslot-indispo__label">${labelCol}</span>
                   </div>`;
        }
      });
    }

    grid.innerHTML = html;

    // Bannière « salon partenaire » — lisible, pleine largeur (remplace l'ancien
    // message tassé dans les colonnes). Affichée seulement si la semaine contient
    // des jours indisponibles ET qu'un partenaire est configuré.
    renderPartnerBanner(days.some(isIndispo), p);

    // Navigation (bornes)
    prevBtn.disabled = state.weekStart <= mondayOf(new Date());
    nextBtn.disabled = mondayOf(dateMax()) <= state.weekStart;

    // Note : chargement des disponibilités en cours ?
    if (state.loadingOccupied) {
      note.textContent = tr("cal.loading", "⏳ Chargement des disponibilités en cours…");
      note.classList.add("is-visible");
    } else if (!isWeekOpen(state.weekStart)) {
      const o = weekOpensAt(state.weekStart);
      note.textContent = `${tr("cal.closedFrom","🔒 Les réservations pour cette semaine ouvrent le")} ${jourL()[o.getDay()]} ${o.getDate()} ${moisL()[o.getMonth()]} · ${pad(o.getHours())}h.`;
      note.classList.add("is-visible");
    } else if (!state.serviceId) {
      note.textContent = tr("cal.chooseDate", "Choisissez d'abord une prestation (étape 1), puis cliquez un créneau vert.");
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
      note.textContent = tr("cal.chooseDate", "Choisissez d'abord une prestation (étape 1).");
      note.classList.add("is-visible");
      return;
    }
    if (!spanIsFree(dateISO, hhmm, service.duree)) {
      note.textContent = tr("resa.err.short", "Ce créneau est trop court.").replace("{s}", svcName(service));
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
        <span class="service-radio__name">${svcName(s)}</span>
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
    return `${jourL()[d.getDay()]} ${d.getDate()} ${moisL()[d.getMonth()]} ${d.getFullYear()}`;
  }
  function updateSummary() {
    const el = document.getElementById("bookingSummary");
    if (!el) return;
    const service = C.services.find((s) => s.id === state.serviceId);
    if (state.selectedDate && state.selectedTime && service) {
      const dateTxt = formatDateLong(parseISO(state.selectedDate));
      el.innerHTML = `${tr("resa.summary","Confirmez votre demande :")} <strong>${svcName(service)}</strong>
        · <strong>${dateTxt}</strong> · <strong>${state.selectedTime}</strong>
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

    if (!service)            return showFeedback(feedback, "error", tr("resa.err.service","Merci de choisir une prestation."));
    if (!state.selectedDate || !state.selectedTime)
                             return showFeedback(feedback, "error", tr("resa.err.slot","Merci de choisir un créneau (case verte) dans le calendrier."));
    if (!form.checkValidity()) { form.reportValidity(); return; }

    // Dernière vérification côté client (la plage est-elle toujours libre ?)
    if (!spanIsFree(state.selectedDate, state.selectedTime, service.duree)) {
      return showFeedback(feedback, "error", tr("resa.err.gone","Ce créneau n'est plus disponible. Merci d'en choisir un autre."));
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
          tr("resa.err.taken","Ce créneau vient d'être réservé par quelqu'un d'autre. Merci d'en choisir un autre."));
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
              tr("resa.ok","Votre demande de rendez-vous a bien été envoyée."));
            // La demande passe en ATTENTE (orange) : elle ne bloque pas encore le
            // créneau, c'est le barbier qui la confirmera (statut "Confirmé" dans le Sheet).
            const set = state.pendingByDate[payload.dateISO] || (state.pendingByDate[payload.dateISO] = new Set());
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
    // Si un backend est configuré, on démarre en "chargement" : aucun créneau
    // n'est proposé tant qu'on ne sait pas lesquels sont déjà pris.
    state.loadingOccupied = !!backendUrl();

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
      // Seules les cases réservables portent data-date (vert ou orange)
      const cell = e.target.closest(".wslot[data-date]");
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

    // Charge l'état des créneaux pris (backend), puis débloque l'affichage.
    // On lève le "chargement" même en cas d'échec réseau, pour ne pas laisser
    // le calendrier inutilisable (repli : blocage manuel via config.creneauxBloques).
    if (backendUrl()) {
      fetchAllOccupied().then(() => {
        state.loadingOccupied = false;
        renderWeek();
      });
    }

    // Re-rendu à chaque changement de langue
    if (window.RufixI18N) window.RufixI18N.onChange(() => { renderServiceChoices(); renderWeek(); updateSummary(); });
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
