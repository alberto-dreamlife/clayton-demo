/* Clayton, shared behaviour: the nav that turns solid past the hero, reveal on
   scroll, and the fullscreen viewer any page can feed with [data-lightbox]. */

/* ---------- nav ---------- */
(() => {
  const nav = document.querySelector(".nav");
  if (!nav || nav.classList.contains("static")) return;
  const onScroll = () => nav.classList.toggle("solid", window.scrollY > 40);
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });
})();

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

/* ---------- lightbox ---------- */
const Lightbox = (() => {
  let items = [], i = 0, el = null, img = null, capEl = null, countEl = null;

  function build() {
    el = document.createElement("div");
    el.className = "lb";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML = `
      <button class="lb-close" aria-label="Close">&#10005;</button>
      <button class="lb-prev" aria-label="Previous">&#8249;</button>
      <button class="lb-next" aria-label="Next">&#8250;</button>
      <div class="lb-stage"><img alt=""></div>
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
    document.addEventListener("keydown", e => {
      if (!el.classList.contains("open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    });
    let tx = 0;
    el.addEventListener("touchstart", e => { tx = e.touches[0].clientX; }, { passive: true });
    el.addEventListener("touchend", e => {
      const dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 55) go(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function render() {
    const it = items[i];
    img.src = it.src;
    img.alt = it.title || "";
    capEl.innerHTML = (it.title ? `<b>${it.title}</b>` : "") + (it.caption || "");
    countEl.textContent = items.length > 1 ? `${i + 1} / ${items.length}` : "";
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
    setTimeout(() => el.classList.remove("open"), 300);
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
  var TARGETS = ".hero-copy h1, .pagehead h1";
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
