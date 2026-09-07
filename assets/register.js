/* ============================================================
   Register, shared.
   One form, three questions, mounted wherever a page asks for it:
     <div data-register-form></div>        inline, in the register band
     any [data-register] control            opens the same form in a modal
   The modal is built once, on first use. No network: it validates, keeps
   the answers, and reads them back. Wire submit() to an endpoint later.
   ============================================================ */
(() => {
  "use strict";

  const FORM = `
    <form class="rg-form" novalidate>
      <div class="rg-rail" aria-hidden="true"><i></i><i></i><i></i></div>
      <p class="rg-count" aria-live="polite">Step 1 of 3</p>

      <fieldset class="rg-step is-on" data-step="0">
        <legend>What should we <i>call you?</i></legend>
        <div class="rg-two">
          <label class="rg-f"><input name="first" placeholder=" " autocomplete="given-name"><span>First name</span></label>
          <label class="rg-f"><input name="last" placeholder=" " autocomplete="family-name"><span>Last name</span></label>
        </div>
      </fieldset>
      <fieldset class="rg-step" data-step="1">
        <legend>How many <i>bedrooms?</i></legend>
        <p class="rg-hint">Pick as many as you like. We will send the plans that fit.</p>
        <div class="chips" role="group" aria-label="Bedrooms">
          <button type="button" data-v="Studio"><span>Studio</span></button>
          <button type="button" data-v="One"><span>One</span></button>
          <button type="button" data-v="Two"><span>Two</span></button>
          <button type="button" data-v="Three"><span>Three</span></button>
          <button type="button" data-v="Still deciding"><span>Still deciding</span></button>
        </div>
      </fieldset>
      <fieldset class="rg-step" data-step="2">
        <legend>Where do the <i>plans go?</i></legend>
        <label class="rg-f"><input name="email" type="email" placeholder=" " autocomplete="email"><span>Email</span></label>
        <label class="rg-f"><input name="phone" type="tel" placeholder=" " autocomplete="tel"><span>Phone (optional)</span></label>
        <p class="rg-hint">Plans, pricing and the preview date. Nothing else.</p>
      </fieldset>

      <div class="rg-done" hidden tabindex="-1">
        <span class="tick" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg></span>
        <h3>You are on <i>the list.</i></h3>
        <p>The plans and pricing come to you before anything is said publicly.</p>
        <dl class="rg-sum"></dl>
      </div>

      <p class="rg-err" role="alert"></p>
      <div class="rg-acts">
        <button type="button" class="rg-back">&larr; Back</button>
        <button type="submit" class="btn btn-clay rg-go"><span class="tx">Continue</span><span class="arr">&#8594;</span></button>
      </div>
      <p class="rg-consent">Free and without obligation. Unsubscribe at any time.</p>
    </form>`;

  function mount(host) {
    host.innerHTML = FORM;
    const f = host.querySelector("form");
    const steps = [...f.querySelectorAll(".rg-step")], rail = [...f.querySelectorAll(".rg-rail i")];
    const count = f.querySelector(".rg-count"), err = f.querySelector(".rg-err");
    const back = f.querySelector(".rg-back"), go = f.querySelector(".rg-go");
    const done = f.querySelector(".rg-done"), sum = f.querySelector(".rg-sum");
    const chips = f.querySelector(".chips");
    let i = 0, picks = [];
    const pick = () => picks.join(", ");

    const all = [...chips.querySelectorAll("button")];
    all.forEach(b => b.addEventListener("click", () => {
      const v = b.dataset.v, on = b.getAttribute("aria-pressed") === "true";
      if (on) picks = picks.filter(x => x !== v);
      else if (v === "Still deciding") picks = [v];
      else picks = picks.filter(x => x !== "Still deciding").concat(v);
      all.forEach(x => x.setAttribute("aria-pressed", picks.includes(x.dataset.v) ? "true" : "false"));
      err.textContent = "";
    }));
    const v = n => f.elements[n].value.trim();
    const paint = (dir = 1, focus = true) => {
      steps.forEach((s, k) => {
        s.classList.toggle("is-on", k === i);
        s.classList.toggle("from-right", dir > 0);
      });
      rail.forEach((r, k) => r.classList.toggle("on", k <= i));
      count.textContent = `Step ${i + 1} of ${steps.length}`;
      back.classList.toggle("show", i > 0);
      go.querySelector(".tx").textContent = i === steps.length - 1 ? "Send me the plans" : "Continue";
      err.textContent = "";
      const first = steps[i].querySelector("input");
      /* Never on the first paint: focusing the inline form on load scrolled
         every page down to the register band. */
      if (focus && first && matchMedia("(min-width:900px)").matches) setTimeout(() => first.focus({ preventScroll: true }), 60);
    };
    const ok = () => {
      if (i === 0 && (!v("first") || !v("last"))) return "Both names, please.";
      if (i === 1 && !picks.length) return "Pick one or more, or Still deciding.";
      if (i === 2 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("email"))) return "That email does not look right.";
      return "";
    };
    f.addEventListener("submit", e => {
      e.preventDefault();
      const m = ok(); if (m) { err.textContent = m; f.classList.add("shake"); setTimeout(() => f.classList.remove("shake"), 500); return; }
      if (i < steps.length - 1) { i++; paint(1); return; }
      steps.forEach(s => s.classList.remove("is-on"));
      rail.forEach(r => r.classList.add("on"));
      f.classList.add("done"); done.hidden = false;
      sum.innerHTML = `<dt>Name</dt><dd>${v("first")} ${v("last")}</dd><dt>Looking for</dt><dd>${pick()}</dd><dt>Email</dt><dd>${v("email")}</dd>` + (v("phone") ? `<dt>Phone</dt><dd>${v("phone")}</dd>` : "");
      done.focus();
      submit({ first: v("first"), last: v("last"), beds: pick(), email: v("email"), phone: v("phone") });
    });
    back.addEventListener("click", () => { if (i > 0) { i--; paint(-1); } });
    paint(1, false);
  }

  /* where the answers go. Nowhere yet. */
  function submit(data) { if (window.CLAYTON_REGISTER) window.CLAYTON_REGISTER(data); }

  /* ---------- the modal ---------- */
  let modal = null, lastFocus = null;
  function buildModal() {
    modal = document.createElement("div");
    modal.className = "regm";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Register");
    modal.innerHTML = `
      <div class="regm-veil"></div>
      <div class="regm-card">
        <button class="regm-x" type="button" aria-label="Close"><span></span><span></span></button>
        <aside class="regm-side">
          <img src="assets/img/Clayton_Courtyard_fr.webp" alt="">
          <div class="regm-say">
            <span class="regm-brand"><svg class="regm-mark" viewBox="0 0 86 86" fill="currentColor" aria-hidden="true"><g transform="rotate(180 43 43)"><rect x="14" y="14" width="40" height="12" rx="1.5"/><rect x="60" y="14" width="12" height="40" rx="1.5"/><rect x="32" y="60" width="40" height="12" rx="1.5"/><rect x="14" y="32" width="12" height="40" rx="1.5" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".55"/></g></svg>CLAYTON</span>
            <div class="kicker">Register</div>
            <h2>Be first<br>through <i>the door.</i></h2>
            <ul>
              <li>Plans and pricing before they are public</li>
              <li>A private preview at the presentation centre</li>
              <li>Your place in the line, in the order you arrived</li>
            </ul>
          </div>
        </aside>
        <div class="regm-body" data-register-form></div>
      </div>`;
    document.body.appendChild(modal);
    mount(modal.querySelector("[data-register-form]"));
    modal.querySelector(".regm-x").addEventListener("click", close);
    modal.querySelector(".regm-veil").addEventListener("click", close);
    document.addEventListener("keydown", e => { if (e.key === "Escape" && modal.classList.contains("open")) close(); });
  }
  function open() {
    if (!modal) buildModal();
    lastFocus = document.activeElement;
    modal.classList.add("open");
    requestAnimationFrame(() => modal.classList.add("show"));
    document.documentElement.classList.add("lock");
    document.body.classList.remove("menu-open");
    const nav = document.querySelector(".nav"); if (nav) { nav.classList.remove("menu-open"); }
    const btn = document.getElementById("navBtn"); if (btn) btn.setAttribute("aria-expanded", "false");
    setTimeout(() => { const f = modal.querySelector("input"); if (f && matchMedia("(min-width:900px)").matches) f.focus(); }, 400);
  }
  function close() {
    modal.classList.remove("show");
    document.documentElement.classList.remove("lock");
    setTimeout(() => modal.classList.remove("open"), 380);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.querySelectorAll("[data-register-form]").forEach(mount);
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-register]");
    if (!t) return;
    e.preventDefault();
    open();
  });
  window.Register = { open, close };
})();
