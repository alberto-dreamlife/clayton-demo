/* Clayton, shared behaviour: the nav that turns solid past the hero, reveal on
   scroll, and the fullscreen viewer any page can feed with [data-lightbox]. */

/* ---------- nav ---------- */
(() => {
  const nav = document.querySelector(".nav");
  if (!nav) return;
  /* Inner pages mark the bar .static: they have no hero for it to float over, so
     it is painted solid from the start. That only settles how it looks, not
     whether it gets out of the way, so the hide behaviour runs on every page and
     only the background toggle is skipped. */
  const floats = !nav.classList.contains("static");

  const SOLID = 40;   /* past this the bar needs a background to stay readable */
  const HIDE  = 140;  /* above this it is still part of the hero, so it stays */
  const SLOP  = 6;    /* a trackpad never gives you a clean zero, so ignore jitter */

  let last = 0, queued = false;

  const frame = () => {
    queued = false;
    /* Overscroll bounce reports negative values at the top and runs past the
       document at the bottom. Either one looks like a direction change and
       would flick the bar in and out at the ends of the page. */
    /* Nothing scrolls while the menu or the register popup is up, and the
       bar must not slide away under an open panel. */
    if (document.documentElement.classList.contains("lock")) return;
    const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const y = Math.min(Math.max(0, scrollY), max);

    if (floats) nav.classList.toggle("solid", y > SOLID);

    const moved = y - last;
    if (Math.abs(moved) > SLOP) {
      nav.classList.toggle("away", moved > 0 && y > HIDE);
      last = y;
    }
    /* Near the top it is always visible, whatever the last direction was. */
    if (y <= HIDE) nav.classList.remove("away");
  };

  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
  frame();
  addEventListener("scroll", onScroll, { passive: true });
  /* A keyboard user tabbing into a hidden bar would be focusing something they
     cannot see, so bring it back. */
  nav.addEventListener("focusin", () => nav.classList.remove("away"));

  /* The mark goes to the top of the home page. From the home page itself a
     same-URL click is a reload, and Safari puts a reload back where you were,
     so it is handled here instead. */
  const home = /(^|\/)index\.html$/.test(location.pathname) || /\/$/.test(location.pathname);
  document.querySelectorAll("a.brand").forEach(a => a.addEventListener("click", e => {
    if (!home) return;
    e.preventDefault();
    setMenuSafe(false);
    scrollTo({ top: 0, behavior: "smooth" });
  }));
  let setMenuSafe = () => {};

  /* ---- the menu ----
     v2. The panel is a sibling of the bar, not a child: the bar's blur and
     its slide-away transform would otherwise pin a fixed panel inside the
     bar's own box, which is the bug where the menu only opened at the top
     of the page. The panel is the menu at every width. */
  const btn = nav.querySelector(".navbtn");
  const menu = document.getElementById("navMenu");
  if (!btn || !menu) return;

  const setMenu = open => {
    nav.classList.toggle("menu-open", open);
    menu.classList.toggle("open", open);
    document.body.classList.toggle("menu-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    menu.setAttribute("aria-hidden", open ? "false" : "true");
    document.documentElement.classList.toggle("lock", open);
    if (open) nav.classList.remove("away");
  };
  setMenuSafe = setMenu;
  btn.addEventListener("click", () => setMenu(!nav.classList.contains("menu-open")));
  menu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setMenu(false)));
  addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });

  /* rolling over a page name brings up its picture on the right, on a
     crossfade: two stacked images, the spare one loads the next picture and
     is faded in over the current one. */
  const pics = menu.querySelectorAll(".nm-pic img");
  if (pics.length === 2) {
    let front = 0, seq = 0;
    const swap = src => {
      if (!src || pics[front].getAttribute("src") === src) return;
      const id = ++seq, back = pics[1 - front];
      back.src = src;
      const go = () => {
        if (id !== seq) return;            /* a newer rollover won */
        back.classList.add("on"); pics[front].classList.remove("on");
        front = 1 - front;
      };
      (back.decode ? back.decode() : Promise.resolve()).then(go, go);
    };
    pics[0].classList.add("on");
    menu.querySelectorAll(".nm[data-img]").forEach(a => {
      a.addEventListener("mouseenter", () => swap(a.dataset.img));
      a.addEventListener("focus", () => swap(a.dataset.img));
    });
  }
})();

/* the frame corners: an empty layer in every .corners card, so the brackets
   never fight the card's own gradient for the ::after slot */
document.querySelectorAll(".corners").forEach(el => { const i = document.createElement("i"); i.className = "ck"; el.appendChild(i); });

/* ---------- reveal ---------- */
(() => {
  const els = [...document.querySelectorAll(".reveal")];
  if (!els.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: .12 });
  els.forEach(el => io.observe(el));
})();

/* ---------- lightbox ----------
   v2. One stage for a still. Click to zoom in around the cursor, scroll to
   zoom by degrees, drag to pan, click again to settle it back. Swipe between
   pictures on a phone when not zoomed. Ported from the Victoria Haus viewer
   and cut down to what this site shows, which is stills only. */
const Lightbox = (() => {
  let items = [], i = 0, el = null, img = null, capEl = null, countEl = null;
  let scale = 1, tx = 0, ty = 0, dragging = false, sx = 0, sy = 0, px = 0, py = 0;
  let baseW = 0, baseH = 0, moved = false;
  const MAXS = 4;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function build() {
    el = document.createElement("div");
    el.className = "lb";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML = `
      <span class="lb-zoomhint">Click to zoom</span>
      <button class="lb-close" aria-label="Close">&#10005;</button>
      <button class="lb-prev" aria-label="Previous">&#8249;</button>
      <button class="lb-next" aria-label="Next">&#8250;</button>
      <div class="lb-stage"><img alt="" draggable="false"></div>
      <div class="lb-bar"><div class="lb-cap"></div><div class="lb-count"></div></div>`;
    document.body.appendChild(el);
    img = el.querySelector("img");
    capEl = el.querySelector(".lb-cap");
    countEl = el.querySelector(".lb-count");
    el.querySelector(".lb-close").addEventListener("click", close);
    el.querySelector(".lb-prev").addEventListener("click", e => { e.stopPropagation(); go(-1); });
    el.querySelector(".lb-next").addEventListener("click", e => { e.stopPropagation(); go(1); });
    el.addEventListener("click", e => {
      if (e.target === el || e.target.classList.contains("lb-stage")) close();
    });

    /* click toggles zoom, unless the pointer was dragged, in which case the
       click is the tail of a pan and must not reset it */
    img.addEventListener("click", e => {
      e.stopPropagation();
      if (moved) { moved = false; return; }
      if (scale > 1) reset(); else zoomAt(2.2, e);
    });
    el.addEventListener("wheel", e => {
      e.preventDefault();
      const next = clamp(scale * (e.deltaY < 0 ? 1.16 : 0.86), 1, MAXS);
      if (next === 1) { reset(); return; }
      zoomAt(next, e);
    }, { passive: false });
    img.addEventListener("pointerdown", e => {
      if (scale <= 1) return;
      e.preventDefault();
      dragging = true; moved = false; img.classList.add("grabbing");
      sx = e.clientX; sy = e.clientY; px = tx; py = ty;
      img.setPointerCapture(e.pointerId);
    });
    img.addEventListener("pointermove", e => {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      tx = px + dx; ty = py + dy;
      clampT(); applyT();
    });
    const endDrag = () => { dragging = false; img.classList.remove("grabbing"); };
    img.addEventListener("pointerup", endDrag);
    img.addEventListener("pointercancel", endDrag);

    let tsx = 0, tsy = 0;
    el.addEventListener("touchstart", e => { tsx = e.touches[0].clientX; tsy = e.touches[0].clientY; }, { passive: true });
    el.addEventListener("touchend", e => {
      if (scale > 1 || items.length < 2) return;
      const dx = e.changedTouches[0].clientX - tsx, dy = e.changedTouches[0].clientY - tsy;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    }, { passive: true });

    document.addEventListener("keydown", e => {
      if (!el.classList.contains("open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    });
    addEventListener("resize", () => { if (el.classList.contains("open")) { measure(); clampT(); applyT(); } });
  }

  function measure() {
    const prev = img.style.transform;
    img.style.transform = "none";
    const r = img.getBoundingClientRect();
    baseW = r.width; baseH = r.height;
    img.style.transform = prev;
  }
  function clampT() {
    const st = el.querySelector(".lb-stage").getBoundingClientRect();
    const slack = 90;
    const mx = Math.max(0, (baseW * scale - st.width) / 2) + slack;
    const my = Math.max(0, (baseH * scale - st.height) / 2) + slack;
    tx = clamp(tx, -mx, mx); ty = clamp(ty, -my, my);
  }
  const applyT = () => {
    img.classList.toggle("zoomed", scale > 1);
    el.classList.toggle("is-zoomed", scale > 1);
    img.style.transform = scale > 1 ? `translate(${tx}px, ${ty}px) scale(${scale})` : "";
  };
  function zoomAt(next, e) {
    if (!baseW) measure();
    const r = img.getBoundingClientRect();
    const cx = e.clientX - (r.left + r.width / 2);
    const cy = e.clientY - (r.top + r.height / 2);
    const k = next / scale;
    tx = cx - (cx - tx) * k;
    ty = cy - (cy - ty) * k;
    scale = next;
    clampT(); applyT();
  }
  function reset() { scale = 1; tx = ty = 0; applyT(); }

  function render() {
    const it = items[i];
    reset();
    img.style.opacity = 0;
    const show = () => { measure(); img.style.opacity = ""; };
    img.onload = show;
    img.src = it.src;
    if (img.complete) show();
    img.alt = it.title || "";
    capEl.innerHTML = (it.title ? `<b>${it.title}</b>` : "") + (it.caption || "");
    countEl.textContent = items.length > 1 ? `${String(i + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}` : "";
    const multi = items.length > 1;
    el.querySelector(".lb-prev").style.display = multi ? "grid" : "none";
    el.querySelector(".lb-next").style.display = multi ? "grid" : "none";
  }
  function go(step) {
    if (items.length < 2) return;
    i = (i + step + items.length) % items.length;
    render();
  }
  function open(list, index = 0) {
    if (!el) build();
    items = list; i = index;
    render();
    el.classList.add("open");
    requestAnimationFrame(() => el.classList.add("show"));
    document.body.style.overflow = "hidden";
  }
  function close() {
    el.classList.remove("show");
    document.body.style.overflow = "";
    setTimeout(() => { el.classList.remove("open"); reset(); }, 320);
  }
  return { open, close };
})();
window.Lightbox = Lightbox;

/* auto wire any [data-lightbox] on the page */
(() => {
  const nodes = [...document.querySelectorAll("[data-lightbox]")];
  if (!nodes.length) return;
  const items = nodes.map(n => ({
    src: n.dataset.full || n.querySelector("img")?.src,
    title: n.dataset.title || "",
    caption: n.dataset.caption || ""
  }));
  nodes.forEach((n, idx) => {
    n.style.cursor = "zoom-in";
    n.addEventListener("click", e => { e.preventDefault(); Lightbox.open(items, idx); });
  });
})();

/* ---------- optical alignment ----------
   A display capital carries its own side bearing: the ink of an R starts a few
   pixels right of where the text box starts. Left-align a big headline by its
   box and it reads as indented against the small caps sitting above it. This
   measures the first glyph at its rendered size and pulls the heading back by
   exactly that much, so the copy stacks on one clean edge whatever the headline
   says and whatever the viewport does to the type size. */
(function(){
  var TARGETS = ".hero-copy h1, .pagehead h1, .hero2 h1, .nhead h1";
  function optical(el){
    var t = (el.textContent || "").trim();
    if (!t) return;
    var cs = getComputedStyle(el);
    var ctx = optical.ctx || (optical.ctx = document.createElement("canvas").getContext("2d"));
    ctx.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
    var m = ctx.measureText(t[0]);
    /* actualBoundingBoxLeft is positive leftwards, so a glyph whose ink starts
       inside the box reports a negative value: that is the gap to close. */
    var gap = -m.actualBoundingBoxLeft;
    el.style.marginLeft = (gap > 0.5 ? (-gap).toFixed(1) + "px" : "");
  }
  function run(){ document.querySelectorAll(TARGETS).forEach(optical); }
  /* after the webfont lands, or the measurement is of a fallback face */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
  else addEventListener("load", run);
  var t; addEventListener("resize", function(){ clearTimeout(t); t = setTimeout(run, 150); });
})();
