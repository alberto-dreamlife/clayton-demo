/* Clayton, living renders: a short clip plays once when its frame scrolls into
   view, then fades away and leaves the still render underneath. The still is
   always in the page, so a browser that refuses autoplay, a phone on a data
   saver plan, or a reader who asked for reduced motion simply sees the render
   and nothing is missing.

   Markup: any element with data-clip="path.mp4" that already contains the still
   <img>. The <video> is created here rather than in the HTML so the pages stay
   readable and the file is only requested when the frame is about to appear. */
(function(){
  "use strict";
  var frames = [].slice.call(document.querySelectorAll("[data-clip]"));
  if (!frames.length) return;

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var conn = navigator.connection || {};
  if (reduced || conn.saveData) return;

  function arm(frame){
    var v = document.createElement("video");
    v.className = "clipv";
    v.muted = true; v.playsInline = true; v.setAttribute("muted",""); v.setAttribute("playsinline","");
    v.preload = "none";
    v.setAttribute("aria-hidden","true"); v.tabIndex = -1;
    v.src = frame.getAttribute("data-clip");
    /* The clip has to crop exactly like the still under it, or the handoff
       jumps. Some pages anchor their header image to the bottom edge, so the
       framing is read from the image rather than assumed. */
    var still = frame.querySelector("img");
    if (still) v.style.objectPosition = getComputedStyle(still).objectPosition;
    frame.appendChild(v);

    var played = false;

    /* The still shows until the first frame is actually painting, so a slow
       network never flashes a black rectangle where the render was. */
    v.addEventListener("playing", function(){ v.classList.add("live"); }, {once:true});

    v.addEventListener("ended", function(){
      v.classList.remove("live"); v.classList.add("done");
      /* Once faded, release the decoder; the still has the frame from here on. */
      setTimeout(function(){ v.removeAttribute("src"); v.load(); }, 1200);
    });
    v.addEventListener("error", function(){ v.remove(); });

    /* Two rings: fetch when the frame is a screen away, play when a third of it
       is on screen. Fetching early is what makes the play feel instant. */
    var near = new IntersectionObserver(function(es){
      es.forEach(function(e){
        if (!e.isIntersecting) return;
        v.preload = "auto"; v.load();
        near.disconnect();
      });
    }, {rootMargin:"100% 0px"});
    near.observe(frame);

    var here = new IntersectionObserver(function(es){
      es.forEach(function(e){
        if (!e.isIntersecting || played) return;
        played = true; here.disconnect();
        var p = v.play();
        if (p && p.catch) p.catch(function(){ v.remove(); });
      });
    }, {threshold:0.35});
    here.observe(frame);
  }

  frames.forEach(arm);
})();
