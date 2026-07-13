/* =====================================================================
   RUFIX BARBER — main.js
   Navigation (navbar, burger, lien actif), révélations au défilement,
   lightbox de la galerie, accordéon FAQ, injection des données du salon
   depuis config.js, initialisation d'EmailJS et formulaire de contact.
   Chaque fonction est courte et à responsabilité unique.
   ===================================================================== */

(function () {
  "use strict";
  const C = window.CONFIG;

  /* ================= 1. NAVBAR : opacité au scroll ============== */
  function initNavbarScroll() {
    const navbar = document.getElementById("navbar");
    if (!navbar) return;
    const onScroll = () => navbar.classList.toggle("is-scrolled", window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ================= 2. MENU BURGER (mobile) =================== */
  function initBurger() {
    const burger = document.getElementById("burger");
    const links = document.getElementById("navLinks");
    if (!burger || !links) return;

    const toggle = (open) => {
      const willOpen = open ?? !links.classList.contains("is-open");
      links.classList.toggle("is-open", willOpen);
      burger.classList.toggle("is-open", willOpen);
      burger.setAttribute("aria-expanded", String(willOpen));
    };
    burger.addEventListener("click", () => toggle());
    // Fermer le menu après un clic sur un lien
    links.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => toggle(false)));
    // Fermer avec Échap
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggle(false); });
  }

  /* ============ 3. LIEN ACTIF selon la section visible ========= */
  function initActiveLink() {
    const links = Array.from(document.querySelectorAll(".navbar__link[href^='#']"));
    const sections = links
      .map((l) => document.querySelector(l.getAttribute("href")))
      .filter(Boolean);
    if (!sections.length) return;

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((l) => l.classList.toggle(
          "is-active", l.getAttribute("href") === `#${entry.target.id}`));
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    sections.forEach((s) => obs.observe(s));
  }

  /* ============ 4. RÉVÉLATIONS AU DÉFILEMENT (perf) ============ */
  function initReveal() {
    const els = document.querySelectorAll("[data-reveal]");
    if (!els.length) return;

    // Si l'utilisateur préfère réduire les animations, on affiche tout d'emblée.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const obs = new IntersectionObserver((entries, o) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          o.unobserve(entry.target);   // on ne révèle qu'une fois (perf)
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => obs.observe(el));
  }

  /* ==================== 5. ACCORDÉON FAQ ====================== */
  function initFaq() {
    const items = document.querySelectorAll(".faq-item");
    items.forEach((item) => {
      const btn = item.querySelector(".faq-item__q");
      const panel = item.querySelector(".faq-item__a");
      btn.addEventListener("click", () => {
        const isOpen = item.classList.contains("is-open");
        // Un seul item ouvert à la fois
        items.forEach((it) => {
          it.classList.remove("is-open");
          it.querySelector(".faq-item__q").setAttribute("aria-expanded", "false");
          it.querySelector(".faq-item__a").style.maxHeight = null;
        });
        if (!isOpen) {
          item.classList.add("is-open");
          btn.setAttribute("aria-expanded", "true");
          panel.style.maxHeight = panel.scrollHeight + "px";
        }
      });
    });
  }

  /* ==================== 6. LIGHTBOX GALERIE =================== */
  function initLightbox() {
    const items = Array.from(document.querySelectorAll(".gallery-item"));
    const box = document.getElementById("lightbox");
    if (!items.length || !box) return;

    const imgEl = box.querySelector(".lightbox__img");
    const counter = box.querySelector(".lightbox__counter");
    const sources = items.map((it) => {
      const img = it.querySelector("img");
      return { src: img.dataset.full || img.src, alt: img.alt };
    });
    let index = 0;
    let lastFocused = null;

    const show = (i) => {
      index = (i + sources.length) % sources.length;
      imgEl.src = sources[index].src;
      imgEl.alt = sources[index].alt;
      counter.textContent = `${index + 1} / ${sources.length}`;
    };
    const open = (i) => {
      lastFocused = document.activeElement;
      show(i);
      box.classList.add("is-open");
      box.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      box.querySelector(".lightbox__close").focus();
    };
    const close = () => {
      box.classList.remove("is-open");
      box.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if (lastFocused) lastFocused.focus();
    };

    items.forEach((it, i) => {
      it.addEventListener("click", () => open(i));
      it.setAttribute("tabindex", "0");
      it.setAttribute("role", "button");
      it.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); }
      });
    });

    box.querySelector(".lightbox__close").addEventListener("click", close);
    box.querySelector(".lightbox__prev").addEventListener("click", () => show(index - 1));
    box.querySelector(".lightbox__next").addEventListener("click", () => show(index + 1));
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    // Navigation clavier
    document.addEventListener("keydown", (e) => {
      if (!box.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });
  }

  /* ============ 7. INJECTION DES DONNÉES DU SALON ============= */
  // Remplit tous les éléments [data-config="chemin.vers.valeur"] avec config.js.
  function injectConfig() {
    if (!C) return;
    const get = (path) => path.split(".").reduce((o, k) => (o ? o[k] : undefined), C);

    document.querySelectorAll("[data-config]").forEach((el) => {
      const val = get(el.dataset.config);
      if (val == null) return;
      if (el.dataset.configAttr) el.setAttribute(el.dataset.configAttr, val);
      else el.textContent = val;
    });

    // Liens spéciaux (tel:, mailto:, réseaux, maps)
    const setHref = (sel, href) => document.querySelectorAll(sel).forEach((a) => a && (a.href = href));
    setHref("[data-config-tel]", `tel:${(C.salon.telephone || "").replace(/[^+\d]/g, "")}`);
    setHref("[data-config-mail]", `mailto:${C.salon.email}`);
    setHref("[data-config-instagram]", C.salon.instagram);
    setHref("[data-config-facebook]", C.salon.facebook);
    setHref("[data-config-maps]", C.salon.mapsLink);

    // Carte Google Maps
    const map = document.getElementById("mapFrame");
    if (map) map.src = C.salon.mapsEmbed;

    // Année du footer
    const year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();

    // Ville pour le SEO visible (partout où [data-config="salon.ville"])
    // déjà géré par la boucle ci-dessus.

    // Horaires d'ouverture (footer)
    renderHoraires();
  }

  // Construit la liste des horaires depuis config.js (footer).
  function renderHoraires() {
    const box = document.getElementById("footerHoraires");
    if (!box || !C) return;
    const labels = {
      lundi: "Lundi", mardi: "Mardi", mercredi: "Mercredi", jeudi: "Jeudi",
      vendredi: "Vendredi", samedi: "Samedi", dimanche: "Dimanche"
    };
    box.innerHTML = Object.keys(labels).map((k) => {
      const h = C.horaires[k];
      const val = h && h.ouvert ? `${h.debut} – ${h.fin}` : "Fermé";
      return `<li><span>${labels[k]}</span><span>${val}</span></li>`;
    }).join("");
  }

  /* ============ 8. EMAILJS : initialisation ================== */
  function initEmailJS() {
    const e = C && C.emailjs;
    if (e && e.publicKey && !/^X+$/i.test(e.publicKey) && window.emailjs) {
      try { window.emailjs.init({ publicKey: e.publicKey }); } catch (_) {}
    }
  }

  /* ============ 9. FORMULAIRE DE CONTACT ===================== */
  // Envoi 100 % automatique via EmailJS : n'ouvre JAMAIS la messagerie du
  // visiteur quand EmailJS est configuré. Le repli mailto ne sert que si
  // EmailJS n'est pas configuré du tout (cas de secours).
  function initContactForm() {
    const form = document.getElementById("contactForm");
    if (!form) return;
    const feedback = document.getElementById("contactFeedback");

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const data = new FormData(form);
      const payload = {
        nom:     (data.get("nom") || "").trim(),
        email:   (data.get("email") || "").trim(),
        message: (data.get("message") || "").trim(),
        salon:   C.salon.nom
      };

      const e = C.emailjs;
      const notEmpty = (v) => v && !/^X+$/i.test(v);
      // Template dédié au contact s'il existe, sinon on réutilise celui de la demande de RDV.
      const templateId = notEmpty(e && e.templateContact) ? e.templateContact
                       : (e && e.templateBarbier) || "";
      const emailjsOn = e && notEmpty(e.publicKey) && notEmpty(e.serviceId) &&
                        notEmpty(templateId) && window.emailjs;

      const done = (type, msg) => {
        feedback.className = `booking-feedback is-visible is-${type}`;
        feedback.textContent = msg;
        feedback.setAttribute("role", "status");
      };

      if (emailjsOn) {
        const btn = form.querySelector('button[type="submit"]');
        const t = btn.textContent; btn.disabled = true; btn.textContent = "Envoi…";
        window.emailjs.send(e.serviceId, templateId, payload)
          .then(() => { done("success", "Merci ! Votre message a bien été envoyé. Nous vous répondrons rapidement."); form.reset(); })
          .catch(() => {
            // On n'ouvre PAS la messagerie : on invite simplement à réessayer.
            done("error", `Désolé, l'envoi a échoué. Merci de réessayer, ou de nous appeler au ${C.salon.telephone}.`);
          })
          .finally(() => { btn.disabled = false; btn.textContent = t; });
      } else {
        // Cas de secours uniquement si EmailJS n'est pas configuré.
        mailtoContact(payload);
        done("info", "Votre messagerie s'est ouverte avec le message pré-rempli. Envoyez-le pour nous contacter.");
      }
    });
  }

  function mailtoContact(p) {
    const sujet = `Message depuis le site — ${p.nom}`;
    const corps = `Nom : ${p.nom}\nEmail : ${p.email}\n\n${p.message}`;
    window.location.href =
      `mailto:${encodeURIComponent(C.salon.email)}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
  }

  /* =========================== INIT ========================== */
  function init() {
    injectConfig();
    initEmailJS();
    initNavbarScroll();
    initBurger();
    initActiveLink();
    initReveal();
    initFaq();
    initLightbox();
    initContactForm();
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
