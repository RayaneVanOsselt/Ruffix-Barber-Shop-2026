/* =====================================================================
   RUFIX BARBER — reviews.js
   Avis clients : carrousel « coverflow » premium + formulaire + modale
   « tous les avis » (chargement progressif), alimentés par un Google
   Sheet dédié (config.reviewsBackend).

   Points clés :
   - Conçu pour des CENTAINES d'avis : le carrousel n'affiche que les plus
     récents (CAROUSEL_MAX) ; la modale charge le reste par lots (lazy).
   - Effet de profondeur : la carte au centre est plus grande/nette, les
     voisines réduites et estompées — calcul 100 % arithmétique (rapide).
   - Défilement automatique lent + boucle infinie + glissement tactile +
     flèches. Respecte « prefers-reduced-motion ».
   - Sécurité : tout texte client est ÉCHAPPÉ (anti-XSS).
   ===================================================================== */

(function () {
  "use strict";

  const C = window.CONFIG;
  const RB = (C && C.reviewsBackend) || {};
  const T = (k, fb) => (window.RufixI18N ? window.RufixI18N.t(k) : fb);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const CAROUSEL_MAX = 16;   // nb d'avis (récents) dans le carrousel
  const MODAL_BATCH = 12;    // avis chargés par lot dans la modale
  const AUTO_SPEED = 26;     // vitesse défilement auto (px / seconde) — lent

  let all = [];              // tous les avis (récents d'abord)
  let selectedNote = 0;

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const backendUrl = () => (RB.url || "").trim();

  /* ------------------------------ Récupération ------------------------------ */
  function fetchReviews() {
    const u = backendUrl();
    if (!u) return Promise.resolve([]);
    const sep = u.indexOf("?") === -1 ? "?" : "&";
    return fetch(`${u}${sep}_=${Date.now()}`, { method: "GET", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d && d.ok && Array.isArray(d.reviews)) ? d.reviews : [])
      .catch(() => []);
  }

  /* --------------------------- Fabrique de cartes --------------------------- */
  function starsHtml(n, cls) {
    let h = "";
    for (let i = 1; i <= 5; i++) {
      h += `<svg class="icon ${cls || "rv-star"}${i <= n ? " is-on" : ""}" aria-hidden="true"><use href="#i-star"></use></svg>`;
    }
    return h;
  }
  function hueFromString(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }
  function avatarHtml(r) {
    const url = r.photo && /^https?:\/\//i.test(r.photo) ? r.photo : "";
    if (url) return `<span class="rv-avatar"><img src="${esc(url)}" alt="" loading="lazy" decoding="async"></span>`;
    const initial = esc((r.nom || "?").trim().charAt(0).toUpperCase() || "?");
    return `<span class="rv-avatar rv-avatar--mono" style="--h:${hueFromString(r.nom || "")}">${initial}</span>`;
  }
  function cardHtml(r) {
    const badge = r.verified
      ? `<span class="rv-badge"><svg class="icon" aria-hidden="true"><use href="#i-verified"></use></svg>${T("rev.verified", "Client vérifié")}</span>`
      : "";
    return `<article class="rv-card">
      <span class="rv-card__quote" aria-hidden="true">&#8220;</span>
      <div class="rv-card__top">
        ${avatarHtml(r)}
        <div class="rv-card__id">
          <span class="rv-card__name">${esc(r.nom)}</span>
          ${badge}
        </div>
      </div>
      <div class="rv-card__stars" aria-label="${r.note} / 5">${starsHtml(r.note)}</div>
      <p class="rv-card__text">${esc(r.commentaire)}</p>
      <div class="rv-card__foot"><span class="rv-card__date">${esc(r.date)}</span></div>
    </article>`;
  }
  const slotHtml = (r) => `<div class="rv-slot">${cardHtml(r)}</div>`;

  /* ============================ CARROUSEL COVERFLOW ========================= */
  const carousel = (function () {
    let stage, marquee, row, slots = [];
    let offset = 0, slotW = 0, copyW = 0, cardsPerCopy = 0;
    let paused = false, dragging = false, decided = false, isVert = false;
    let startX = 0, startY = 0, startOffset = 0, lastX = 0, lastT = 0, vel = 0, momentum = 0;
    let idleTimer = null, lastTs = 0, rafId = 0, onScreen = true;

    function build(list) {
      const base = list.slice(0, CAROUSEL_MAX);
      // 1) une passe pour mesurer la largeur d'un segment
      row.innerHTML = base.map(slotHtml).join("");
      const segW = row.scrollWidth;
      const stageW = marquee.clientWidth || 1;
      const copyReps = Math.max(1, Math.ceil(stageW / Math.max(segW, 1)));
      // 2) rendu final : segment répété (copyReps) × 3 copies pour la boucle
      const full = [];
      for (let k = 0; k < copyReps * 3; k++) full.push(base.map(slotHtml).join(""));
      row.innerHTML = full.join("");
      slots = Array.prototype.slice.call(row.children);
      cardsPerCopy = base.length * copyReps;
      // mesures (offsetLeft n'est pas affecté par les transforms)
      slotW = slots.length > 1 ? (slots[1].offsetLeft - slots[0].offsetLeft) : slots[0].offsetWidth;
      copyW = slotW * cardsPerCopy;
      offset = -copyW;                // on démarre dans la copie du milieu
      applyDepth();
    }

    function wrap() {
      if (offset <= -2 * copyW) offset += copyW;
      else if (offset >= 0) offset -= copyW;
    }

    function applyDepth() {
      row.style.transform = `translate3d(${offset}px,0,0)`;
      const centerX = marquee.clientWidth / 2;
      const ref = slotW * 1.25 || 1;
      const cardW = slots.length ? slots[0].offsetWidth : slotW;
      for (let i = 0; i < slots.length; i++) {
        const c = offset + i * slotW + cardW / 2;   // centre de la carte, repère marquee
        const norm = Math.abs(c - centerX) / ref;
        const t = norm >= 1 ? 0 : 1 - norm;          // 1 au centre → 0 aux extrémités
        const s = slots[i];
        // hors-champ : on allège
        if (c < -cardW || c > marquee.clientWidth + cardW) {
          if (s.style.opacity !== "0") { s.style.opacity = "0"; s.style.transform = "scale(.8)"; }
          s.classList.remove("is-focus");
          continue;
        }
        s.style.transform = `scale(${(0.8 + 0.2 * t).toFixed(3)})`;
        s.style.opacity = (0.35 + 0.65 * t).toFixed(3);
        s.style.zIndex = String(Math.round(t * 100));
        s.classList.toggle("is-focus", t > 0.82);
      }
    }

    function frame(ts) {
      const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
      lastTs = ts;
      if (momentum) {
        offset += momentum; momentum *= 0.92;
        if (Math.abs(momentum) < 0.2) { momentum = 0; scheduleResume(); }
      } else if (!paused && !dragging && onScreen && !reduceMotion) {
        offset -= AUTO_SPEED * dt;
      }
      wrap();
      applyDepth();
      rafId = requestAnimationFrame(frame);
    }

    function pause() { paused = true; }
    function scheduleResume() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { paused = false; }, 2200);
    }

    /* --- flèches : glisse d'un cran --- */
    function nudge(dir) {
      pause();
      momentum = 0;
      const target = offset + dir * -slotW;   // dir=+1 (suivant) → va vers la gauche
      const from = offset, dur = 480, t0 = performance.now();
      (function step(now) {
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);       // easeOutCubic
        offset = from + (target - from) * e;
        wrap(); applyDepth();
        if (p < 1) requestAnimationFrame(step); else scheduleResume();
      })(t0);
    }

    /* --- glissement tactile / souris --- */
    function onDown(e) {
      dragging = true; decided = false; isVert = false; momentum = 0; pause();
      startX = e.clientX; startY = e.clientY; startOffset = offset;
      lastX = e.clientX; lastT = performance.now(); vel = 0;
      try { marquee.setPointerCapture(e.pointerId); } catch (_) {}
    }
    function onMove(e) {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (!decided) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        decided = true; isVert = Math.abs(dy) > Math.abs(dx);
        if (isVert) { dragging = false; try { marquee.releasePointerCapture(e.pointerId); } catch (_) {} return; }
      }
      if (isVert) return;
      offset = startOffset + dx;
      const now = performance.now(), d = now - lastT;
      if (d > 0) vel = (e.clientX - lastX) / d;   // px / ms
      lastX = e.clientX; lastT = now;
      wrap(); applyDepth();
      if (e.cancelable) e.preventDefault();
    }
    function onUp() {
      if (!dragging) { scheduleResume(); return; }
      dragging = false;
      momentum = Math.max(-40, Math.min(40, vel * 16));   // inertie
      if (!momentum) scheduleResume();
    }

    function init(list) {
      stage = document.getElementById("reviewsStage");
      marquee = document.getElementById("reviewsMarquee");
      row = document.getElementById("reviewsRow");
      if (!stage || !marquee || !row) return;
      stage.hidden = false;
      build(list);

      document.getElementById("revPrev").addEventListener("click", () => nudge(-1));
      document.getElementById("revNext").addEventListener("click", () => nudge(1));
      marquee.addEventListener("pointerdown", onDown);
      marquee.addEventListener("pointermove", onMove, { passive: false });
      marquee.addEventListener("pointerup", onUp);
      marquee.addEventListener("pointercancel", onUp);
      marquee.addEventListener("mouseenter", pause);
      marquee.addEventListener("mouseleave", () => { if (!dragging) scheduleResume(); });

      // Pause hors-écran (perf) + onglet caché
      if ("IntersectionObserver" in window) {
        new IntersectionObserver((ents) => { onScreen = ents[0].isIntersecting; })
          .observe(stage);
      }
      document.addEventListener("visibilitychange", () => { onScreen = !document.hidden; });

      // Rebuild au redimensionnement (les largeurs changent aux breakpoints)
      let rt = null;
      window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => build(list), 200); });

      cancelAnimationFrame(rafId);
      lastTs = 0; rafId = requestAnimationFrame(frame);
    }

    return { init };
  })();

  /* =============================== RÉSUMÉ (note) ============================= */
  function renderSummary() {
    const box = document.getElementById("reviewsSummary");
    if (!box) return;
    if (!all.length) { box.hidden = true; return; }
    const avg = all.reduce((s, r) => s + (r.note || 0), 0) / all.length;
    document.getElementById("revAvg").textContent = avg.toFixed(1).replace(".", ",");
    document.getElementById("revAvgStars").innerHTML = starsHtml(Math.round(avg), "rv-star rv-star--sm");
    document.getElementById("revCountLabel").textContent =
      `${all.length} ${all.length > 1 ? T("rev.countP", "avis") : T("rev.count", "avis")}`;
    box.hidden = false;
  }

  /* ============================ MODALE « tous les avis » ==================== */
  const modal = (function () {
    let root, body, grid, sentinel, sub, closeBtn, lastFocus = null, rendered = 0, io = null;

    function renderBatch() {
      const next = all.slice(rendered, rendered + MODAL_BATCH);
      if (!next.length) return;
      const frag = document.createElement("div");
      frag.innerHTML = next.map(cardHtml).join("");
      while (frag.firstChild) grid.appendChild(frag.firstChild);
      rendered += next.length;
      if (rendered >= all.length && io) { io.unobserve(sentinel); }
    }
    // Charge assez de lots pour que la zone visible soit remplie (sinon rien à faire défiler)
    function fill() {
      let guard = 0;
      while (rendered < all.length && body.scrollHeight <= body.clientHeight + 40 && guard++ < 60) renderBatch();
    }
    function onScroll() {
      if (rendered >= all.length) return;
      if (body.scrollTop + body.clientHeight >= body.scrollHeight - 400) renderBatch();
    }
    function open() {
      root = document.getElementById("reviewsModal");
      body = document.getElementById("reviewsModalBody");
      grid = document.getElementById("reviewsModalGrid");
      sentinel = document.getElementById("reviewsSentinel");
      sub = document.getElementById("reviewsModalSub");
      closeBtn = document.getElementById("reviewsModalClose");
      lastFocus = document.activeElement;

      const avg = all.reduce((s, r) => s + (r.note || 0), 0) / (all.length || 1);
      sub.textContent = `${all.length} ${all.length > 1 ? T("rev.countP", "avis") : T("rev.count", "avis")} · ${T("rev.avg", "note moyenne")} ${avg.toFixed(1).replace(".", ",")}/5`;

      grid.innerHTML = ""; rendered = 0; renderBatch();

      root.hidden = false; root.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => { root.classList.add("is-open"); fill(); });

      // Chargement progressif : IntersectionObserver + repli sur l'écoute du scroll
      body.addEventListener("scroll", onScroll, { passive: true });
      if ("IntersectionObserver" in window) {
        io = new IntersectionObserver((ents) => { if (ents[0].isIntersecting) { renderBatch(); fill(); } }, { root: body, rootMargin: "400px" });
        io.observe(sentinel);
      }
      closeBtn.focus();
      document.addEventListener("keydown", onKey);
    }
    function close() {
      if (!root) return;
      root.classList.remove("is-open");
      root.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      if (body) body.removeEventListener("scroll", onScroll);
      if (io) { io.disconnect(); io = null; }
      setTimeout(() => { root.hidden = true; }, 260);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function onKey(e) { if (e.key === "Escape") close(); }

    function init() {
      const btn = document.getElementById("revSeeAll");
      const m = document.getElementById("reviewsModal");
      if (!btn || !m) return;
      btn.addEventListener("click", open);
      m.addEventListener("click", (e) => { if (e.target.hasAttribute("data-modal-close")) close(); });
    }
    return { init };
  })();

  /* --------------------------- État vide / affichage ------------------------ */
  function renderAll() {
    const empty = document.getElementById("reviewsEmpty");
    const seeAll = document.getElementById("revSeeAll");
    if (all.length === 0) {
      if (empty) {
        empty.textContent = backendUrl() ? T("rev.first", "Soyez le premier à laisser un avis !") : "";
        empty.style.display = backendUrl() ? "" : "none";
      }
      if (seeAll) seeAll.hidden = true;
      return;
    }
    if (empty) empty.style.display = "none";
    renderSummary();
    carousel.init(all);
    if (seeAll) seeAll.hidden = false;
  }

  /* ---------------------- Sélecteur d'étoiles (formulaire) ------------------ */
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

  /* -------------------------------- Envoi ---------------------------------- */
  function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const fb = document.getElementById("reviewFeedback");
    const show = (type, msg) => { fb.className = `booking-feedback is-visible is-${type}`; fb.textContent = msg; };

    const nom = (form.nom.value || "").trim();
    const commentaire = (form.commentaire.value || "").trim();
    if (!nom) return show("error", T("rev.errName", "Merci d'indiquer votre nom."));
    if (!selectedNote) return show("error", T("rev.errNote", "Merci de choisir une note."));
    if (!commentaire) return show("error", T("rev.errCom", "Merci d'écrire un commentaire."));
    if (!backendUrl()) return show("error", "Système d'avis non configuré (voir config.js).");

    const btn = form.querySelector('button[type="submit"]');
    const label = btn.textContent; btn.disabled = true; btn.textContent = "…";
    fetch(backendUrl(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ nom: nom.slice(0, 60), note: selectedNote, commentaire: commentaire.slice(0, 500) })
    })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.ok) {
          // L'avis passe en modération (« En attente ») : il n'apparaît pas encore.
          show("success", T("rev.thanks", "Merci ! Votre avis a bien été reçu. Il sera vérifié puis publié."));
          form.reset(); selectedNote = 0; paintStars(); updateCount();
          return;
        }
        show("error", T("rev.errGen", "Une erreur est survenue. Merci de réessayer."));
      })
      .catch(() => show("error", T("rev.errGen", "Une erreur est survenue. Merci de réessayer.")))
      .finally(() => { btn.disabled = false; btn.textContent = label; });
  }

  /* =============================== INIT ==================================== */
  function init() {
    if (!document.getElementById("reviewsStage")) return;
    renderStarInput();
    modal.init();

    const toggle = document.getElementById("reviewToggle");
    const form = document.getElementById("reviewForm");
    if (toggle && form) {
      toggle.addEventListener("click", () => {
        form.hidden = !form.hidden;
        toggle.setAttribute("aria-expanded", String(!form.hidden));
        if (!form.hidden) form.nom.focus();
      });
      form.addEventListener("submit", submit);
    }
    const ta = document.getElementById("rv-com");
    if (ta) ta.addEventListener("input", updateCount);

    fetchReviews().then((list) => { all = list; renderAll(); });

    if (window.RufixI18N) window.RufixI18N.onChange(() => { renderSummary(); });
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
