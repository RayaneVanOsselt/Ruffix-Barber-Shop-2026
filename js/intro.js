/* =====================================================================
   RUFIX BARBER — intro.js
   Animation d'entrée du site, puis entrée en scène du hero.
   - La décision (intro ou non) est prise dans le <head> d'index.html :
       html.motion → animations autorisées
       html.has-intro → l'intro s'affiche (1re visite de la session)
   - Les styles et le déroulé visuel sont dans css/animations.css.
   - Chargé juste après i18n.js : le titre du hero est déjà traduit.
   ===================================================================== */

(function () {
  "use strict";
  const root = document.documentElement;
  clearTimeout(window.__rufixIntroFailsafe);
  if (!root.classList.contains("motion")) return;

  const LOAD_MS = 1750;        // durée du compteur 000 → 100
  const MAX_WAIT_MS = 4200;    // on n'attend jamais l'image du hero au-delà
  const FONT_WAIT_MS = 700;    // attente max de la police du logo

  /* ============ 1. TITRE DU HERO : découpe en mots ============= */
  // Chaque mot est placé dans un masque pour monter en cascade.
  // Si la langue change ensuite, i18n.js remet du texte simple (sans animation).
  function splitTitle() {
    const h1 = document.querySelector(".hero h1");
    if (!h1) return;
    const words = h1.textContent.trim().split(/\s+/);
    h1.textContent = "";
    words.forEach((word, i) => {
      const mask = document.createElement("span");
      const inner = document.createElement("span");
      mask.className = "w";
      inner.style.setProperty("--i", i);
      inner.textContent = word;
      mask.appendChild(inner);
      if (i) h1.appendChild(document.createTextNode(" "));
      h1.appendChild(mask);
    });
    h1.classList.add("is-split");
  }

  const heroIn = () => root.classList.add("hero-in");

  /* ============ 2. INTRO ====================================== */
  function runIntro() {
    const intro = document.getElementById("intro");
    if (!intro) { root.classList.remove("has-intro"); heroIn(); return; }

    try { sessionStorage.setItem("rufix_intro_seen", "1"); } catch (e) {}

    // La moitié basse reçoit une copie de la scène : la coupe tranche le logo.
    const top = intro.querySelector(".intro__half--top .intro__stage");
    intro.querySelector(".intro__half--bottom").appendChild(top.cloneNode(true));

    const counter = intro.querySelector(".intro__count");
    const bar = intro.querySelector(".intro__bar");
    const heroImg = document.querySelector(".hero__media img");
    let imgReady = !heroImg || heroImg.complete;
    if (!imgReady) {
      const done = () => { imgReady = true; };
      heroImg.addEventListener("load", done, { once: true });
      heroImg.addEventListener("error", done, { once: true });
    }

    let phase = "load";
    let start = 0;

    // Compteur : progresse sur LOAD_MS, plafonne à 92 tant que l'image
    // du hero n'est pas chargée (on ne révèle jamais un fond vide).
    function tick(now) {
      if (phase !== "load") return;
      if (!start) start = now;
      const t = Math.min((now - start) / LOAD_MS, 1);
      const eased = 1 - (1 - t) * (1 - t);
      const ready = imgReady || now - start > MAX_WAIT_MS;
      const value = Math.round(eased * (ready ? 100 : 92));
      counter.textContent = String(value).padStart(3, "0");
      bar.style.transform = `scaleX(${value / 100})`;
      if (t === 1 && ready) cut(false);
      else requestAnimationFrame(tick);
    }

    function cut(fast) {
      if (phase !== "load") return;
      phase = "cut";
      counter.textContent = "100";
      bar.style.transform = "scaleX(1)";
      intro.classList.toggle("is-fast", fast);
      intro.classList.add("is-play", "is-cut");
      setTimeout(open, fast ? 240 : 400);
    }

    function open() {
      phase = "open";
      intro.classList.add("is-open");
      heroIn();   // le hero s'anime pendant que les moitiés s'écartent
      setTimeout(finish, intro.classList.contains("is-fast") ? 850 : 1200);
    }

    function finish() {
      stopListening();
      intro.remove();
      root.classList.remove("has-intro");
    }

    // Le visiteur est pressé : clic, touche, molette ou glissé → on coupe tout de suite.
    const skip = () => cut(true);
    const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"];
    EVENTS.forEach((ev) => window.addEventListener(ev, skip, { passive: true }));
    function stopListening() {
      EVENTS.forEach((ev) => window.removeEventListener(ev, skip, { passive: true }));
    }

    // On démarre quand la police du logo est prête (ou après FONT_WAIT_MS).
    let launched = false;
    const launch = () => {
      if (launched || phase !== "load") return;
      launched = true;
      intro.classList.add("is-play");
      requestAnimationFrame(tick);
    };
    if (document.fonts && document.fonts.load) {
      document.fonts.load('700 1em "Playfair Display"').then(launch, launch);
    }
    setTimeout(launch, FONT_WAIT_MS);
  }

  /* =========================== INIT ========================== */
  splitTitle();
  if (root.classList.contains("has-intro")) runIntro();
  else {
    const intro = document.getElementById("intro");   // intro déjà vue : inutile dans le DOM
    if (intro) intro.remove();
    requestAnimationFrame(heroIn);
  }
})();
