/* ============================================================
   The motion layer.

   One file, no dependencies, ~7 KB. It reads the page rather than requiring
   the page to be written for it: headings get split into words, figures get a
   curtain, numbers count, and internal links hand over behind a wipe.

   Per-site tuning lives in AX_CONFIG at the top. Everything below is shared,
   so a fix made here is a fix in all three projects.
   ============================================================ */
(function(){
"use strict";

/* Selectors differ between projects because the markup does. Only this block
   changes from site to site. */
var CFG = window.AX_CONFIG || {};
var SEL = {
  /* headings that should assemble word by word */
  heads:  CFG.heads  || "h1, h2",
  /* headings to leave alone: heroes already animate in the site's own CSS */
  skip:   CFG.skip   || ".hero h1, .ax-skip",
  /* pictures that get the curtain */
  figs:   CFG.figs   || "figure",
  /* numbers that count up */
  stats:  CFG.stats  || "[data-count]",
  /* things that just rise into place */
  ups:    CFG.ups    || "[data-up]",
  /* cards that lift under the cursor */
  lifts:  CFG.lifts  || "[data-lift]"
};
/* A heading that already carries the host site's block-level fade would run two
   entrances at once. The words are the better one, so the block one is taken
   off the headings the splitter claims and left everywhere else. */
var STRIP = CFG.stripReveal || ["reveal"];
var CURTAIN = CFG.curtain !== false;
var PROGRESS = CFG.progress !== false;

var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
var $$ = function(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };

/* ---------- 1. split headings into words ----------
   Walks the heading rather than replacing its HTML, so an <i> inside a title
   keeps its italic and its color and only its text is broken up. */
function splitNode(node, state){
  var kids = Array.prototype.slice.call(node.childNodes);
  kids.forEach(function(kid){
    if (kid.nodeType === 3){
      var parts = kid.nodeValue.split(/(\s+)/);
      var frag = document.createDocumentFragment();
      parts.forEach(function(p){
        if (!p) return;
        if (/^\s+$/.test(p)){
          var sp = document.createElement("span");
          sp.className = "ax-sp"; sp.textContent = p;
          frag.appendChild(sp);
          return;
        }
        var mask = document.createElement("span");
        mask.className = "ax-w";
        var inner = document.createElement("span");
        inner.textContent = p;
        inner.style.setProperty("--ax-d", (state.i * 42) + "ms");
        state.i++;
        mask.appendChild(inner);
        frag.appendChild(mask);
      });
      node.replaceChild(frag, kid);
    } else if (kid.nodeType === 1 && kid.tagName !== "BR" && !kid.classList.contains("ax-w")){
      splitNode(kid, state);
    }
  });
}

function prepareHeads(){
  var skip = SEL.skip;
  $$(SEL.heads).forEach(function(h){
    if (h.closest(skip)) return;
    if (h.matches(skip)) return;
    if (h.dataset.axDone) return;
    if (!h.textContent.trim()) return;
    /* A heading built for the site's own line reveal is left alone. Two
       reasons: it already animates, and its CSS styles ".ln span" as a block,
       which would catch the word masks and drop every word onto its own line. */
    if (h.querySelector(".ln")) return;
    h.dataset.axDone = "1";
    STRIP.forEach(function(c){ h.classList.remove(c); });
    splitNode(h, {i: 0});
    watch(h);
  });
}

/* ---------- 2. figures get the curtain ---------- */
function prepareFigs(){
  $$(SEL.figs).forEach(function(f){
    if (f.dataset.axDone) return;
    if (!f.querySelector("img, video, picture")) return;
    f.dataset.axDone = "1";
    f.classList.add("ax-fig");
    watch(f);
  });
}

/* ---------- 3. counters ----------
   Keeps whatever wraps the number: "1,066 sq ft" counts the 1066 and leaves
   the unit alone, and a range counts its first figure. */
function countUp(el){
  var raw = el.textContent;
  var m = raw.match(/[\d][\d,.]*/);
  if (!m) return;
  var target = parseFloat(m[0].replace(/,/g, ""));
  if (!isFinite(target) || target === 0) return;
  var grouped = m[0].indexOf(",") > -1;
  var dur = 1400, t0 = null;
  el.classList.add("ax-num");
  function fmt(v){
    var n = Math.round(v);
    return grouped ? n.toLocaleString("en-US") : String(n);
  }
  function step(t){
    if (t0 === null) t0 = t;
    var p = Math.min(1, (t - t0) / dur);
    /* ease out: fast to nearly there, then settle, like a dial coming to rest */
    var e = 1 - Math.pow(1 - p, 3);
    el.textContent = raw.replace(m[0], fmt(target * e));
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = raw;
  }
  requestAnimationFrame(step);
}

/* ---------- 4. one observer for everything ---------- */
var io = null;
function reveal(el){
  el.classList.add("ax-in");
  if (el.dataset.axCount) countUp(el);
}
function watch(el){
  if (reduced){ reveal(el); return; }
  /* Anything inside something hidden (a closed drawer, a lightbox, a filtered
     tile) never intersects, and a figure that never fires would sit under its
     curtain forever. Those are revealed up front: they are out of sight
     anyway, so there is no entrance to lose. */
  if (!el.offsetParent && getComputedStyle(el).position !== "fixed"){
    reveal(el); return;
  }
  /* A box with no area never intersects anything, at any scroll position: a
     wrapper whose picture is absolutely positioned inside it measures zero and
     would keep its curtain forever. */
  var r0 = el.getBoundingClientRect();
  if (r0.width < 2 || r0.height < 2){ reveal(el); return; }
  if (!io){
    /* threshold 0, not 0.15: an element taller than the window can never show
       15 percent of itself, which is exactly how a full-bleed image ends up
       permanently covered. The negative bottom margin does the waiting instead. */
    io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (!e.isIntersecting) return;
        reveal(e.target);
        io.unobserve(e.target);
      });
    }, {threshold: 0, rootMargin: "0px 0px -10% 0px"});
  }
  io.observe(el);
}

function prepareUps(){
  $$(SEL.ups).forEach(function(el, i){
    if (el.dataset.axDone) return;
    el.dataset.axDone = "1";
    el.classList.add("ax-up");
    if (!el.style.getPropertyValue("--ax-d"))
      el.style.setProperty("--ax-d", ((i % 4) * 90) + "ms");
    watch(el);
  });
}

function prepareStats(){
  $$(SEL.stats).forEach(function(el){
    if (el.dataset.axDone) return;
    el.dataset.axDone = "1";
    el.dataset.axCount = "1";
    watch(el);
  });
}

function prepareLifts(){
  $$(SEL.lifts).forEach(function(el){ el.classList.add("ax-lift"); });
}

/* ---------- 5. parallax ----------
   Depth of field on scroll: elements marked data-par drift against the page.
   All of them are measured in one pass per frame, so a page full of layers
   still costs one layout read. */
var pars = [];
function preparePar(){
  if (reduced) return;
  pars = $$("[data-par]").map(function(el){
    el.classList.add("ax-par");
    return {el: el, k: parseFloat(el.dataset.par) || 0.12};
  });
  if (pars.length) onScroll();
}

var ticking = false;
function onScroll(){
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(function(){
    var vh = innerHeight;
    pars.forEach(function(p){
      var r = p.el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      /* -1 above the fold, +1 below it, 0 dead centre */
      var mid = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
      p.el.style.transform = "translate3d(0," + (mid * p.k * 100).toFixed(2) + "px,0)";
    });
    if (bar){
      var h = document.documentElement.scrollHeight - vh;
      bar.style.transform = "scaleX(" + (h > 0 ? scrollY / h : 0).toFixed(4) + ")";
    }
    ticking = false;
  });
}

/* ---------- 6. scroll progress ---------- */
var bar = null;
function prepareBar(){
  if (reduced || !PROGRESS) return;
  bar = document.createElement("div");
  bar.className = "ax-prog";
  document.body.appendChild(bar);
}

/* ---------- 7. the page curtain ----------
   Only same-tab, same-site, plain left clicks are taken over. Anything with a
   modifier, a target, a download or a hash stays exactly as the browser
   would have handled it. */
function prepareCurtain(){
  if (reduced || !CURTAIN) return;
  var c = document.createElement("div");
  c.className = "ax-curtain ax-enter";
  document.body.appendChild(c);
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){ c.classList.add("ax-lift-off"); });
  });

  document.addEventListener("click", function(e){
    var a = e.target.closest && e.target.closest("a");
    if (!a) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== "_self") return;
    if (a.hasAttribute("download")) return;
    var href = a.getAttribute("href") || "";
    if (!href || href[0] === "#" || /^(mailto:|tel:|javascript:)/i.test(href)) return;
    if (a.host && a.host !== location.host) return;
    if (a.pathname === location.pathname && a.hash) return;
    e.preventDefault();
    c.className = "ax-curtain ax-out";
    setTimeout(function(){ location.href = a.href; }, 480);
  });

  /* coming back with the back button must not land on a black sheet */
  addEventListener("pageshow", function(ev){
    if (ev.persisted) c.className = "ax-curtain ax-enter ax-lift-off";
  });
}

/* ---------- go ---------- */
function init(){
  prepareBar();
  prepareHeads();
  prepareFigs();
  prepareUps();
  prepareStats();
  prepareLifts();
  preparePar();
  prepareCurtain();
  addEventListener("scroll", onScroll, {passive: true});
  addEventListener("resize", onScroll, {passive: true});

  /* Failsafe. A curtain is opaque, so a figure that somehow never fires is an
     invisible photograph. Ten seconds after load anything still covered is
     opened, whatever the reason. A missed animation is a shrug; a missing
     render is a broken page. */
  setTimeout(function(){
    $$(".ax-fig:not(.ax-in)").forEach(function(el){
      if (el.getBoundingClientRect().top < innerHeight * 3) reveal(el);
    });
  }, 10000);
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", init);
else init();

/* pages that build content from script can ask for a rescan */
window.AX = {rescan: function(){
  prepareHeads(); prepareFigs(); prepareUps(); prepareStats(); prepareLifts(); preparePar();
}};
})();
