/* =====================================================================
   RUFIX BARBER — reviews.js
   Système d'avis maison : formulaire (nom, note 1-5, commentaire) +
   carrousel des avis, alimenté par un Google Sheet DÉDIÉ (config.reviewsBackend).

   - Les avis sont récupérés du plus RÉCENT au plus ancien.
   - Affichage sécurisé : tout texte client est ÉCHAPPÉ (anti-XSS).
   - Carrousel responsive : flèches + glissement tactile natif.
   ===================================================================== */

(function () {
  "use strict";

  const C = window.CONFIG;
  const RB = (C && C.reviewsBackend) || {};
  const T = (k, fb) => (window.RufixI18N ? window.RufixI18N.t(k) : fb);
  // Échappement HTML : empêche l'injection de code par un commentaire client.
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let reviews = [];
  let selectedNote = 0;

  const backendUrl = () => (RB.url || "").trim();

  /* --------- Récupération des avis (les plus récents d'abord) --------- */
  function fetchReviews() {
    const u = backendUrl();
    if (!u) return Promise.resolve([]);
    const sep = u.indexOf("?") === -1 ? "?" : "&";
    // _=timestamp : contourne le cache de Google Apps Script (avis toujours à jour)
    return fetch(`${u}${sep}_=${Date.now()}`, { method: "GET", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d && d.ok && Array.isArray(d.reviews)) ? d.reviews : [])
      .catch(() => []);
  }

  /* ------------------------- Rendu du carrousel ------------------------ */
  function starsHtml(n) {
    let h = "";
    for (let i = 1; i <= 5; i++) {
      h += `<svg class="icon review-star${i <= n ? " is-on" : ""}" aria-hidden="true"><use href="#i-star"></use></svg>`;
    }
    return h;
  }

  function render() {
    const track = document.getElementById("reviewsTrack");
    const carousel = document.getElementById("reviewsCarousel");
    const empty = document.getElementById("reviewsEmpty");
    if (!track) return;

    if (reviews.length === 0) {
      carousel.hidden = true;
      // Message « soyez le premier » seulement si le backend est configuré.
      empty.textContent = backendUrl() ? T("rev.first", "Soyez le premier à laisser un avis !") : "";
      empty.style.display = backendUrl() ? "" : "none";
      return;
    }
    empty.style.display = "none";
    carousel.hidden = false;
    track.innerHTML = reviews.map((r) => `
      <article class="review-slide">
        <div class="review-slide__stars" aria-label="${r.note} / 5">${starsHtml(r.note)}</div>
        <p class="review-slide__text">${esc(r.commentaire)}</p>
        <div class="review-slide__meta">
          <span class="review-slide__name">— ${esc(r.nom)}</span>
          <span class="review-slide__date">${esc(r.date)}${r.heure ? " · " + esc(r.heure) : ""}</span>
        </div>
      </article>`).join("");
    updateArrows();
  }

  function scrollByCard(dir) {
    const vp = document.getElementById("reviewsViewport");
    const card = vp.querySelector(".review-slide");
    const step = card ? card.getBoundingClientRect().width + 18 : vp.clientWidth;
    vp.scrollBy({ left: dir * step, behavior: "smooth" });
  }
  function updateArrows() {
    const vp = document.getElementById("reviewsViewport");
    const prev = document.getElementById("revPrev"), next = document.getElementById("revNext");
    if (!vp || !prev || !next) return;
    const max = vp.scrollWidth - vp.clientWidth - 2;
    prev.disabled = vp.scrollLeft <= 2;
    next.disabled = vp.scrollLeft >= max || max <= 0;
  }

  /* ---------------------- Sélecteur d'étoiles (form) ------------------- */
  function renderStarInput() {
    const box = document.getElementById("starInput");
    if (!box) return;
    box.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "star-btn"; b.dataset.val = String(i);
      b.setAttribute("aria-label", `${i} / 5`);
      b.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-star"></use></svg>`;
      b.addEventListener("click", () => { selectedNote = i; paintStars(); });
      b.addEventListener("mouseenter", () => paintStars(i));
      box.appendChild(b);
    }
    box.addEventListener("mouseleave", () => paintStars());
    paintStars();
  }
  function paintStars(hover) {
    const n = hover || selectedNote;
    document.querySelectorAll("#starInput .star-btn").forEach((b) => {
      b.classList.toggle("is-on", Number(b.dataset.val) <= n);
    });
  }

  function updateCount() {
    const ta = document.getElementById("rv-com"), c = document.getElementById("rvCount");
    if (ta && c) c.textContent = `${ta.value.length} / 500`;
  }

  /* -------------------------- Envoi d'un avis ------------------------- */
  function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const fb = document.getElementById("reviewFeedback");
    const show = (type, msg) => { fb.className = `booking-feedback is-visible is-${type}`; fb.textContent = msg; };

    const nom = (form.nom.value || "").trim();
    const commentaire = (form.commentaire.value || "").trim();
    // Validation CÔTÉ CLIENT (le serveur revalide aussi).
    if (!nom) return show("error", T("rev.errName", "Merci d'indiquer votre nom."));
    if (!selectedNote) return show("error", T("rev.errNote", "Merci de choisir une note."));
    if (!commentaire) return show("error", T("rev.errCom", "Merci d'écrire un commentaire."));
    if (!backendUrl()) return show("error", "Système d'avis non configuré (voir config.js).");

    const btn = form.querySelector('button[type="submit"]');
    const label = btn.textContent; btn.disabled = true; btn.textContent = "…";
    // Content-Type text/plain : évite le pré-vol CORS (Apps Script).
    fetch(backendUrl(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ nom: nom.slice(0, 60), note: selectedNote, commentaire: commentaire.slice(0, 500) })
    })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.ok) {
          show("success", T("rev.thanks", "Merci ! Votre avis a bien été publié."));
          form.reset(); selectedNote = 0; paintStars(); updateCount();
          form.hidden = true;
          return fetchReviews().then((list) => { reviews = list; render(); });
        }
        show("error", T("rev.errGen", "Une erreur est survenue. Merci de réessayer."));
      })
      .catch(() => show("error", T("rev.errGen", "Une erreur est survenue. Merci de réessayer.")))
      .finally(() => { btn.disabled = false; btn.textContent = label; });
  }

  /* =============================== INIT ============================== */
  function init() {
    if (!document.getElementById("reviewsCarousel")) return;
    renderStarInput();

    document.getElementById("revPrev").addEventListener("click", () => scrollByCard(-1));
    document.getElementById("revNext").addEventListener("click", () => scrollByCard(1));
    document.getElementById("reviewsViewport").addEventListener("scroll", updateArrows, { passive: true });

    const toggle = document.getElementById("reviewToggle");
    const form = document.getElementById("reviewForm");
    toggle.addEventListener("click", () => {
      form.hidden = !form.hidden;
      toggle.setAttribute("aria-expanded", String(!form.hidden));
      if (!form.hidden) form.nom.focus();
    });
    form.addEventListener("submit", submit);
    const ta = document.getElementById("rv-com");
    if (ta) ta.addEventListener("input", updateCount);

    fetchReviews().then((list) => { reviews = list; render(); });

    // Re-rendu au changement de langue (état vide + libellés du sélecteur d'étoiles)
    if (window.RufixI18N) window.RufixI18N.onChange(() => { render(); });
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
