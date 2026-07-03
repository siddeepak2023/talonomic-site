/* ============================================================
   DUSK INSTRUMENT — shared art + behavior
   Theme toggle · animated hero terrain · still massif ·
   Bayer-dithered art (sphere / dome / image) · scroll reveals ·
   demo typing/count-up helpers.
   Markup contract:
     <canvas id="terrain">            animated hero (optional)
     <canvas data-art="sphere|dome|massif">   stills
     <canvas data-art="image" data-src="x.png">  dithered image
     <button id="themeToggle">        theme switch (optional)
     .rv                              scroll-reveal elements
   ============================================================ */
(function(){
"use strict";
var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var root = document.documentElement;

/* ---------- THEME ---------- */
var stored = null;
try { stored = localStorage.getItem("bf-theme"); } catch(e){}
if (stored === "light" || (!stored && window.matchMedia("(prefers-color-scheme: light)").matches)) {
  root.setAttribute("data-theme","light");
}
var toggle = document.getElementById("themeToggle");
if (toggle) toggle.addEventListener("click", function(){
  var light = root.getAttribute("data-theme") === "light";
  if (light) root.removeAttribute("data-theme");
  else root.setAttribute("data-theme","light");
  try { localStorage.setItem("bf-theme", light ? "dark" : "light"); } catch(e){}
  syncColors();
});

/* ---------- SHARED MATH ---------- */
function hash2(a, b){
  var s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function n2(x, y){
  return Math.sin(x * 1.7 + Math.sin(y * 0.8) * 1.3) * Math.cos(y * 1.1 + Math.sin(x * 0.6));
}
function fbm(x, y, t){
  var v = 0, a = 0.55, f = 1;
  for (var i = 0; i < 4; i++) {
    v += a * n2(x * f + t * 0.25, y * f - t * 0.18);
    f *= 2.05; a *= 0.5;
  }
  return v * 0.5 + 0.5;
}
function cssVar(name){ return getComputedStyle(root).getPropertyValue(name).trim(); }

/* ---------- ANIMATED HERO TERRAIN ---------- */
var canvas = document.getElementById("terrain");
var ctx = canvas ? canvas.getContext("2d") : null;
var W = 0, H = 0, dotColor = "#EDECE8", sigColor = "#B0453B", last = 0, heroVisible = true;

function drawFrame(t){
  ctx.clearRect(0, 0, W, H);
  var ROWS = 70, COLS = Math.min(260, Math.max(120, Math.floor(W / 5)));
  var horizon = H * 0.24, spread = H * 0.68, maxH = H * 0.78;
  var stepX = W / COLS;
  for (var r = 0; r < ROWS; r++) {
    var d = r / (ROWS - 1);
    var base = horizon + d * spread;
    for (var c = 0; c <= COLS; c++) {
      var jx = (hash2(c, r) - 0.5) * stepX * 1.8;
      var jy = (hash2(c + 57, r + 91) - 0.5) * 7;
      var u = (c + jx / stepX) / COLS;
      var e1 = Math.exp(-Math.pow((u - 0.62) / 0.16, 2));
      var e2 = 0.55 * Math.exp(-Math.pow((u - 0.86) / 0.10, 2));
      var env = Math.min(1, e1 + e2);
      var h = fbm(u * 4.2, d * 3.1, t) * env;
      if (h < 0.02) continue;
      var y = base - h * maxH * (0.35 + 0.65 * d) + jy;
      var alpha = Math.min(0.95, 0.05 + Math.pow(h, 1.25) * 1.5) * (0.3 + 0.7 * d);
      if (h > 0.62 && ((c * 7 + r * 13) % 97) === 0) {
        ctx.fillStyle = sigColor; ctx.globalAlpha = 0.9; ctx.fillRect(u * W, y, 2, 2);
      } else {
        ctx.fillStyle = dotColor; ctx.globalAlpha = alpha; ctx.fillRect(u * W, y, 1.4, 1.4);
      }
    }
  }
  ctx.globalAlpha = 1;
}
function resizeTerrain(){
  if (!canvas) return;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawFrame(last / 1000); /* always paint — rAF is paused in background tabs */
}
function loop(ts){
  requestAnimationFrame(loop);
  if (!heroVisible || document.hidden) return;
  if (ts - last < 33) return;
  last = ts;
  drawFrame(ts / 1000);
}

/* ---------- STILL MASSIF ---------- */
function drawMassifStill(cv){
  var w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = w * dpr; cv.height = h * dpr;
  var c2 = cv.getContext("2d");
  c2.setTransform(dpr, 0, 0, dpr, 0, 0);
  var fg = cssVar("--fg"), sg = cssVar("--signal");
  var ROWS = 88, COLS = Math.max(140, Math.floor(w / 4));
  var horizon = h * 0.18, spread = h * 0.74, maxH = h * 0.95, stepX = w / COLS;
  var SEED = parseFloat(cv.getAttribute("data-seed")) || 7.31;
  var twin = cv.getAttribute("data-variant") === "twin";
  for (var r = 0; r < ROWS; r++) {
    var d = r / (ROWS - 1);
    var base = horizon + d * spread;
    for (var q = 0; q <= COLS; q++) {
      var jx = (hash2(q, r) - 0.5) * stepX * 1.8;
      var jy = (hash2(q + 57, r + 91) - 0.5) * 6;
      var u = (q + jx / stepX) / COLS;
      var env = twin
        ? Math.min(1, 0.92 * Math.exp(-Math.pow((u - 0.38) / 0.15, 2))
                    + 0.85 * Math.exp(-Math.pow((u - 0.66) / 0.12, 2)))
        : Math.min(1, Math.exp(-Math.pow((u - 0.5) / 0.13, 2))
                    + 0.4 * Math.exp(-Math.pow((u - 0.31) / 0.09, 2))
                    + 0.34 * Math.exp(-Math.pow((u - 0.69) / 0.08, 2)));
      var hh = Math.pow(fbm(u * 6.5, d * 4.2, SEED), 1.15) * env;
      if (hh < 0.02) continue;
      var y = base - hh * maxH * (0.3 + 0.7 * d) + jy;
      if (y < 0) continue;
      var alpha = Math.min(0.95, 0.04 + Math.pow(hh, 1.3) * 1.7) * (0.28 + 0.72 * d);
      if (hh > 0.6 && ((q * 7 + r * 13) % 131) === 0) {
        c2.fillStyle = sg; c2.globalAlpha = 0.85; c2.fillRect(u * w, y, 2, 2);
      } else {
        c2.fillStyle = fg; c2.globalAlpha = alpha; c2.fillRect(u * w, y, 1.3, 1.3);
      }
    }
  }
  c2.globalAlpha = 1;
}

/* ---------- BAYER DITHER ---------- */
var BAYER = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
function bayer(x, y){ return (BAYER[y % 4][x % 4] + 0.5) / 16; }
function ditherField(cv, field, cell){
  var w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  cv.width = w; cv.height = h;
  var c2 = cv.getContext("2d");
  c2.clearRect(0, 0, w, h);
  c2.fillStyle = cssVar("--fg");
  for (var y = 0; y < h; y += cell) {
    for (var x = 0; x < w; x += cell) {
      var b = field(x / w, y / h);
      if (b > bayer((x / cell) | 0, (y / cell) | 0)) c2.fillRect(x, y, cell - 1, cell - 1);
    }
  }
}
function sphereField(u, v){
  var dx = u - 0.5, dy = v - 0.5;
  var r = Math.sqrt(dx * dx + dy * dy);
  if (r > 0.47) return 0;
  var z = Math.sqrt(Math.max(0, 0.47 * 0.47 - r * r)) / 0.47;
  var lum = Math.max(0, (-dx / 0.47) * -0.45 + (-dy / 0.47) * 0.55 + z * 0.72);
  return Math.pow(lum, 1.6) * 0.95;
}
function diamondField(u, v){
  /* brilliant-cut rhombus, same dithered register as the old dome */
  var dx = (u - 0.5) * 2.15, dy = (v - 0.5) * 1.95;
  var m = Math.abs(dx) + Math.abs(dy);
  if (m > 0.95) return 0;
  var b = 0.10 + 0.45 * Math.pow(m / 0.95, 3.0);          /* rim glow */
  b += 0.38 * Math.exp(-Math.pow((Math.abs(dx) - Math.abs(dy)) / 0.05, 2)); /* facet ridges */
  b += 0.30 * Math.exp(-Math.pow(dx / 0.035, 2));          /* vertical axis */
  b += 0.26 * Math.exp(-Math.pow((dy + 0.12) / 0.035, 2)); /* girdle line */
  b += 0.45 * Math.exp(-Math.pow((dx + 0.18) / 0.10, 2)) * Math.exp(-Math.pow((dy + 0.30) / 0.10, 2)); /* crown highlight */
  b *= dy < -0.12 ? 1.18 : 0.82;                           /* crown brighter than pavilion */
  return Math.min(1, b);
}
/* dithered image (e.g. falcon logo) */
var imgCache = {};
function imageField(src){
  var rec = imgCache[src];
  if (!rec) return function(){ return 0; };
  return function(u, v){
    var x = Math.min(rec.w - 1, (u * rec.w) | 0);
    var y = Math.min(rec.h - 1, (v * rec.h) | 0);
    var a = rec.d.data[(y * rec.w + x) * 4 + 3] / 255;
    return a * (0.85 - v * 0.25);
  };
}
function loadArtImage(src){
  if (imgCache[src]) return;
  imgCache[src] = null;
  var img = new Image();
  img.onload = function(){
    var off = document.createElement("canvas");
    off.width = 128; off.height = Math.round(128 * img.height / img.width);
    off.getContext("2d").drawImage(img, 0, 0, off.width, off.height);
    imgCache[src] = { d: off.getContext("2d").getImageData(0, 0, off.width, off.height), w: off.width, h: off.height };
    renderArts();
  };
  img.src = src;
}
function renderArts(){
  document.querySelectorAll("[data-art]").forEach(function(cv){
    var kind = cv.getAttribute("data-art");
    if (kind === "sphere") ditherField(cv, sphereField, 3);
    else if (kind === "dome" || kind === "diamond") ditherField(cv, diamondField, 2);
    else if (kind === "massif") drawMassifStill(cv);
    else if (kind === "image") {
      var src = cv.getAttribute("data-src");
      if (imgCache[src]) ditherField(cv, imageField(src), 3);
      else loadArtImage(src);
    }
  });
}

/* ---------- COLOR SYNC ---------- */
function syncColors(){
  dotColor = cssVar("--fg") || dotColor;
  sigColor = cssVar("--signal") || sigColor;
  if (canvas) drawFrame(last / 1000);
  renderArts();
}

/* ---------- INIT ---------- */
window.addEventListener("resize", function(){ resizeTerrain(); renderArts(); });
resizeTerrain();
syncColors();
if (canvas && !reduceMotion) {
  new IntersectionObserver(function(en){ heroVisible = en[0].isIntersecting; })
    .observe(canvas.closest("section") || canvas);
  requestAnimationFrame(loop);
}

/* ---------- SCROLL REVEALS ---------- */
var io = new IntersectionObserver(function(entries){
  entries.forEach(function(en){
    if (en.isIntersecting) { en.target.classList.add("on"); io.unobserve(en.target); }
  });
}, { threshold: 0.15 });
document.querySelectorAll(".rv").forEach(function(el){ io.observe(el); });

/* ---------- DEMO HELPERS (typing + count-up), exported ---------- */
window.DUSK = {
  reduceMotion: reduceMotion,
  renderArts: renderArts,
  typeInto: function(el, text, speed, done, runRef){
    var i = 0, run = runRef.v;
    el.innerHTML = '<span class="caret"></span>';
    (function tick(){
      if (run !== runRef.v) return;
      if (i <= text.length) {
        el.innerHTML = text.slice(0, i).replace(/\n/g, "<br>") + '<span class="caret"></span>';
        i++;
        runRef.t = setTimeout(tick, speed);
      } else {
        el.innerHTML = text.replace(/\n/g, "<br>");
        done && done();
      }
    })();
  },
  countUp: function(container, runRef){
    container.classList.add("show");
    container.querySelectorAll("b[data-count]").forEach(function(b){
      var target = parseInt(b.getAttribute("data-count"), 10);
      var prefix = b.getAttribute("data-prefix") || "";
      var suffix = b.getAttribute("data-suffix") || "";
      if (reduceMotion) { b.textContent = prefix + target.toLocaleString() + suffix; return; }
      var t0 = performance.now(), run = runRef.v;
      (function step(now){
        if (run !== runRef.v) return;
        var p = Math.min(1, (now - t0) / 900);
        var eased = 1 - Math.pow(1 - p, 3);
        b.textContent = prefix + Math.round(target * eased).toLocaleString() + suffix;
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  },

  /* Auto-advancing scripted product demo ("demo video").
     cfg: { root, tabsEl, qEl, codeEl, tilesEl, capEl, progEl, scenarios }
     scenario: { label, cap, q, code, tiles:[{v,prefix,suffix,label,neg,static}] } */
  demoRunner: function(cfg){
    var D = window.DUSK;
    var runRef = { v: 0, t: null };
    var active = 0, HOLD = 4600;
    cfg.scenarios.forEach(function(sc, i){
      var b = document.createElement("button");
      b.type = "button";
      b.className = "demo-tab";
      b.textContent = "0" + (i + 1) + " " + sc.label;
      b.addEventListener("click", function(){ play(i); });
      cfg.tabsEl.appendChild(b);
    });
    var tabs = cfg.tabsEl.querySelectorAll(".demo-tab");
    function renderTiles(sc){
      cfg.tilesEl.classList.remove("show");
      cfg.tilesEl.innerHTML = sc.tiles.map(function(t){
        var b = t.static !== undefined
          ? "<b>" + t.static + "</b>"
          : '<b data-count="' + t.v + '"' +
            (t.prefix ? ' data-prefix="' + t.prefix + '"' : "") +
            (t.suffix ? ' data-suffix="' + t.suffix + '"' : "") + ">0</b>";
        return '<div class="tile' + (t.neg ? " neg" : "") + '">' + b + "<s>" + t.label + "</s></div>";
      }).join("");
    }
    function setProg(ms){
      if (!cfg.progEl) return;
      var bar = cfg.progEl.firstElementChild;
      bar.classList.remove("run");
      bar.style.transitionDuration = "0ms";
      bar.offsetWidth; /* reflow — restart the bar */
      if (ms) { bar.style.transitionDuration = ms + "ms"; bar.classList.add("run"); }
    }
    function play(i){
      runRef.v++;
      clearTimeout(runRef.t);
      active = i;
      var sc = cfg.scenarios[i];
      tabs.forEach(function(tb, j){ tb.classList.toggle("on", j === i); });
      if (cfg.capEl) cfg.capEl.innerHTML = "FEATURE 0" + (i + 1) + " — <b>" + sc.cap + "</b>";
      renderTiles(sc);
      cfg.qEl.textContent = ""; cfg.codeEl.textContent = "";
      if (D.reduceMotion) {
        cfg.qEl.textContent = sc.q;
        cfg.codeEl.innerHTML = sc.code.replace(/\n/g, "<br>");
        D.countUp(cfg.tilesEl, runRef);
        setProg(0);
        return;
      }
      var total = sc.q.length * 30 + 420 + sc.code.length * 8 + 300 + 900 + HOLD;
      setProg(total);
      D.typeInto(cfg.qEl, sc.q, 30, function(){
        runRef.t = setTimeout(function(){
          D.typeInto(cfg.codeEl, sc.code, 8, function(){
            runRef.t = setTimeout(function(){
              D.countUp(cfg.tilesEl, runRef);
              runRef.t = setTimeout(function(){
                play((active + 1) % cfg.scenarios.length);
              }, HOLD);
            }, 300);
          }, runRef);
        }, 420);
      }, runRef);
    }
    /* static first frame — demo never renders blank (hidden tabs, no-IO, reduced motion) */
    (function primeScene(){
      var sc = cfg.scenarios[0];
      tabs[0].classList.add("on");
      if (cfg.capEl) cfg.capEl.innerHTML = "FEATURE 01 — <b>" + sc.cap + "</b>";
      renderTiles(sc);
      cfg.qEl.textContent = sc.q;
      cfg.codeEl.innerHTML = sc.code.replace(/\n/g, "<br>");
      cfg.tilesEl.classList.add("show");
      cfg.tilesEl.querySelectorAll("b[data-count]").forEach(function(b){
        b.textContent = (b.getAttribute("data-prefix") || "")
          + parseInt(b.getAttribute("data-count"), 10).toLocaleString()
          + (b.getAttribute("data-suffix") || "");
      });
    })();
    new IntersectionObserver(function(en){
      if (en[0].isIntersecting) play(active);
      else { runRef.v++; clearTimeout(runRef.t); setProg(0); }
    }, { threshold: 0.3 }).observe(cfg.root);
    return { play: play };
  }
};
})();
