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

/* ---------- ANIMATED HERO TERRAIN + FALCON MORPH/DOCK (talon parity) ----------
   Wave identical at rest. On scroll the dust morphs into the falcon, rides
   the viewport, and docks beside the [data-dock] sec-head — claws on its
   bottom text line. Docked bird is painted by a document-positioned canvas
   (native compositor scroll, no redraw lag). */
var canvas = document.getElementById("terrain");
var ctx = canvas ? canvas.getContext("2d") : null;
var W = 0, H = 0, dotColor = "#EDECE8", sigColor = "#B0453B", last = 0, heroVisible = true;
var gmx = -1e4, gmy = -1e4, ggx = -1e4, ggy = -1e4, gAmp = 0;
var DPRc = Math.min(window.devicePixelRatio || 1, 2);
var follow = !reduceMotion && !!canvas;
var falconPts = null, falconAspect = 1.336;
var mT = 0, mE = 0, sc = 0, txr = 0, wsr = 0;
var waveTopDoc = 0, waveH = 0, dockBotDoc = 0, dockSecTop = 0, dockShown = false;
var dockSec = document.querySelector("[data-dock]");
var dockSection = dockSec ? dockSec.closest("section") : null;
var dcv = null;
if (follow && dockSection) {
  dcv = document.createElement("canvas");
  dcv.setAttribute("aria-hidden", "true");
  dcv.style.cssText = "position:absolute;z-index:-1;pointer-events:none;opacity:0";
  dockSection.appendChild(dcv);
}
window.addEventListener("pointermove", function(e){
  if (!canvas) return;
  var r = canvas.getBoundingClientRect();
  gmx = e.clientX - r.left; gmy = e.clientY - r.top;
}, { passive: true });
document.addEventListener("pointerleave", function(){ gmx = -1e4; gmy = -1e4; });
(function loadBird(){
  if (!follow) return;
  var img = new Image();
  img.onload = function(){
    var SW = 220, SH = Math.max(1, Math.round(SW * (img.height / img.width)));
    falconAspect = img.width / img.height;
    var oc = document.createElement("canvas");
    oc.width = SW; oc.height = SH;
    var o2 = oc.getContext("2d"); if (!o2) return;
    o2.drawImage(img, 0, 0, SW, SH);
    var px = o2.getImageData(0, 0, SW, SH).data;
    var pts = [];
    for (var y = 0; y < SH; y++) for (var x = 0; x < SW; x++) {
      if (px[(y * SW + x) * 4 + 3] > 60) pts.push(x / SW, y / SH);
    }
    if (pts.length) falconPts = new Float32Array(pts);
  };
  img.src = "./falcon-bird-white.png";
})();
function docTopOf(el){
  var y = 0, n = el;
  while (n) { y += n.offsetTop; n = n.offsetParent; }
  return y;
}
function measureDock(){
  if (!dockSec) return;
  // +34: match company-site's dock position. Its dock heading is 2 lines
  // ("Three instruments. / One engine."); ours is 1, so without this the falcon
  // docks ~34px higher and its top wing crosses the hero/demo divider.
  var next = docTopOf(dockSec) + dockSec.offsetHeight + 66;
  if (dockSection) dockSecTop = docTopOf(dockSection);
  if (Math.abs(next - dockBotDoc) > 1) {
    dockBotDoc = next;
    if (dockShown) drawDockFalcon();
  }
}
function heroScroll(){
  sc = window.scrollY;
  mT = Math.min(1, Math.max(0, sc / (Math.max(1, waveH) * 0.25)));
  measureDock();
}
function falconGeom(){
  var minL = Math.max(txr, wsr) > 0 ? Math.max(txr, wsr) + 24 : 0;
  var avail = W - minL - 12;
  var fH = Math.max(140, Math.min(H * 0.42, avail / falconAspect));
  var fW = fH * falconAspect;
  var fX = Math.min(Math.max(W * 0.74 - fW / 2, minL), W - fW - 8);
  return { minL: minL, avail: avail, fH: fH, fW: fW, fX: fX };
}
function drawDockFalcon(){
  if (!falconPts || !dcv) return;
  var g = falconGeom();
  var fYdoc = dockBotDoc - g.fH, pad = 8;
  var bw = Math.ceil(g.fW + pad * 2), bh = Math.ceil(g.fH + pad * 2);
  dcv.width = bw * DPRc; dcv.height = bh * DPRc;
  dcv.style.width = bw + "px"; dcv.style.height = bh + "px";
  dcv.style.left = Math.round(g.fX - pad) + "px";
  dcv.style.top = Math.round(fYdoc - pad - dockSecTop) + "px";
  var d2 = dcv.getContext("2d"); if (!d2) return;
  d2.setTransform(DPRc, 0, 0, DPRc, 0, 0);
  d2.clearRect(0, 0, bw, bh);
  var nPts = falconPts.length / 2;
  var ROWS = 92, COLS = Math.min(340, Math.max(150, Math.floor(W / 4)));
  var ox = g.fX - pad, oyDoc = fYdoc - pad;
  d2.fillStyle = dotColor;
  for (var r = 0; r < ROWS; r++) for (var c = 0; c <= COLS; c++) {
    var ti = (Math.floor(hash2(c + 13, r + 7) * nPts)) % nPts;
    var tx = g.fX + falconPts[ti * 2] * g.fW + (hash2(c + 3, r + 5) - 0.5) * 5;
    var ty = fYdoc + falconPts[ti * 2 + 1] * g.fH + (hash2(c + 9, r + 1) - 0.5) * 5;
    d2.globalAlpha = 0.55 + hash2(c, r + 41) * 0.4;
    d2.fillRect(tx - ox, ty - oyDoc, 1.4, 1.4);
  }
  d2.globalAlpha = 1;
}
function drawFrame(t){
  if (follow) {
    sc = window.scrollY;
    mT = Math.min(1, Math.max(0, sc / (Math.max(1, waveH) * 0.25)));
  }
  var Hw = follow ? waveH : H;
  var yOff = follow ? waveTopDoc - sc : 0;
  ctx.clearRect(0, 0, W, H);
  var ROWS = 92, COLS = Math.min(340, Math.max(150, Math.floor(W / 4)));
  var horizon = Hw * 0.24, spread = Hw * 0.68, maxH = Hw * 0.78;
  var stepX = W / COLS;
  ggx += (gmx - ggx) * 0.07; ggy += (gmy - ggy) * 0.07;
  gAmp += (((gmx > -1e3 && gmy > -1e3) ? 1 : 0) - gAmp) * 0.045;
  var gR2 = Math.pow(Math.min(W, Hw) * 0.16, 2);
  var pin = window.__morphPin;
  if (typeof pin === "number") { mT = pin; mE = pin; }
  mE += (mT - mE) * 0.09;
  var g = falconGeom();
  var morph = falconPts && mE > 0.004 && W >= 640 && g.avail >= 220;
  var k = morph ? (mE < 0.5 ? 2 * mE * mE : 1 - Math.pow(-2 * mE + 2, 2) / 2) : 0;
  var followCY = H * 0.45;
  var dockCY = follow && dockBotDoc > 0 ? dockBotDoc - sc - g.fH / 2 : 1e9;
  var fCY = Math.min(followCY, dockCY);
  var fY = fCY - g.fH / 2;
  var docked = !!(morph && mE > 0.97 && dockCY < followCY && dcv);
  if (docked !== dockShown) {
    dockShown = docked;
    if (docked) drawDockFalcon();
    if (dcv) dcv.style.opacity = docked ? "1" : "0";
  }
  if (docked) { ctx.clearRect(0, 0, W, H); return; }
  if (follow && waveTopDoc + Hw - sc < -60 && fY + g.fH < -60) return;
  var nPts = falconPts ? falconPts.length / 2 : 0;
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
      var hidden = h < 0.02;
      if (hidden && !morph) continue;
      var y = base - (hidden ? 0 : h * maxH * (0.35 + 0.65 * d)) + jy + yOff;
      var alpha = hidden ? 0 : Math.min(0.95, 0.05 + Math.pow(h, 1.25) * 1.5) * (0.3 + 0.7 * d);
      if (gAmp > 0.01 && !hidden) {
        var gpx = u * W - ggx, gpy = y - ggy;
        var gd2 = gpx * gpx + gpy * gpy;
        if (gd2 < gR2) {
          var gg = Math.exp((-gd2 / gR2) * 3.2) * gAmp;
          y -= gg * 26;
          alpha = Math.min(0.95, alpha + gg * 0.35);
        }
      }
      var x = u * W;
      if (k > 0) {
        var ti = (Math.floor(hash2(c + 13, r + 7) * nPts)) % nPts;
        var tx = g.fX + falconPts[ti * 2] * g.fW + (hash2(c + 3, r + 5) - 0.5) * 5;
        var ty = fY + falconPts[ti * 2 + 1] * g.fH + (hash2(c + 9, r + 1) - 0.5) * 5;
        x += (tx - x) * k; y += (ty - y) * k;
        alpha += ((0.55 + hash2(c, r + 41) * 0.4) - alpha) * k;
      }
      if (y < -8 || y > H + 8) continue;
      if (!hidden && h > 0.62 && ((c * 7 + r * 13) % 97) === 0) {
        ctx.fillStyle = sigColor; ctx.globalAlpha = 0.9; ctx.fillRect(x, y, 2, 2);
      } else {
        ctx.fillStyle = dotColor; ctx.globalAlpha = alpha; ctx.fillRect(x, y, 1.4, 1.4);
      }
    }
  }
  ctx.globalAlpha = 1;
}
function resizeTerrain(){
  if (!canvas) return;
  if (follow) canvas.classList.add("hero-canvas--follow");
  DPRc = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = W * DPRc; canvas.height = H * DPRc;
  ctx.setTransform(DPRc, 0, 0, DPRc, 0, 0);
  var scY = window.scrollY;
  var hero = document.querySelector(".hero");
  if (hero) {
    var hr = hero.getBoundingClientRect();
    waveTopDoc = hr.top + scY + hr.height * 0.18;
    waveH = hr.height * 0.82;
  } else { waveTopDoc = 0; waveH = H; }
  var crL = follow ? 0 : canvas.getBoundingClientRect().left;
  txr = 0; wsr = 0;
  function glyphRight(el){
    var rg = document.createRange();
    rg.selectNodeContents(el);
    var m = 0, rects = rg.getClientRects();
    for (var i = 0; i < rects.length; i++) m = Math.max(m, rects[i].right - crL);
    return m;
  }
  var pb = document.querySelector(".hero .promptbox");
  if (pb) txr = Math.max(txr, pb.getBoundingClientRect().right - crL);
  document.querySelectorAll(".hero .hero-sub, .hero .trust").forEach(function(el){
    txr = Math.max(txr, glyphRight(el));
  });
  if (dockSec) wsr = glyphRight(dockSec);
  measureDock();
  heroScroll();
  if (dockShown) drawDockFalcon(); // resize invalidates the docked bird's geometry
  drawFrame(last / 1000);
}
function loop(ts){
  requestAnimationFrame(loop);
  if (document.hidden) return;
  if (!heroVisible && !dockShown && mE < 0.01) { /* resting + offscreen */ }
  if (mE < 0.01 && ts - last < 33) return;
  last = ts;
  drawFrame(ts / 1000);
}
if (follow) window.addEventListener("scroll", heroScroll, { passive: true });

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

/* ---------- DATA OBSERVATORY KIT (ported from Talon landing) ---------- */
function prepArt(cv){
  var w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return null;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = w * dpr; cv.height = h * dpr;
  var c2 = cv.getContext("2d"); if (!c2) return null;
  c2.setTransform(dpr, 0, 0, dpr, 0, 0);
  c2.clearRect(0, 0, w, h);
  return { c2: c2, w: w, h: h, fg: cssVar("--fg"), sg: cssVar("--signal") };
}
function dottedVGrid(c2, w, h, step, fg){
  c2.fillStyle = fg;
  for (var x = step / 2; x < w; x += step) {
    c2.globalAlpha = 0.10;
    for (var y = 6; y < h - 6; y += 7) c2.fillRect(x, y, 1, 1);
    c2.globalAlpha = 0.5; c2.fillRect(x - 1, 2, 2, 2); c2.fillRect(x - 1, h - 4, 2, 2);
  }
  c2.globalAlpha = 1;
}
/* Route massif — dust ridge + dotted climbing route + waypoints. Shared by
   the preview slot (seed varies the terrain). */
function routeMassif(cv, SEED){
  var p = prepArt(cv); if (!p) return;
  var c2 = p.c2, w = p.w, h = p.h, fg = p.fg, sg = p.sg;
  var ROWS = 88, COLSN = Math.max(150, Math.floor(w / 2.6));
  var horizon = h * 0.16, spread = h * 0.76, maxHh = h * 0.95, stepX = w / COLSN;
  function env(u){ return Math.min(1, Math.exp(-Math.pow((u - 0.68) / 0.22, 2)) + 0.38 * Math.exp(-Math.pow((u - 0.3) / 0.13, 2))); }
  for (var r = 0; r < ROWS; r++) {
    var d = r / (ROWS - 1), base = horizon + d * spread;
    for (var q = 0; q <= COLSN; q++) {
      var jx = (hash2(q, r) - 0.5) * stepX * 1.8;
      var jy = (hash2(q + 57, r + 91) - 0.5) * 6;
      var u = (q + jx / stepX) / COLSN;
      var hh = Math.pow(fbm(u * 6.5, d * 4.2, SEED), 1.15) * env(u);
      if (hh < 0.02) continue;
      var y = base - hh * maxHh * (0.3 + 0.7 * d) + jy;
      if (y < 0) continue;
      var alpha = Math.min(0.95, 0.04 + Math.pow(hh, 1.3) * 1.7) * (0.28 + 0.72 * d);
      if (hh > 0.6 && ((q * 7 + r * 13) % 131) === 0) { c2.fillStyle = sg; c2.globalAlpha = 0.85; c2.fillRect(u * w, y, 2, 2); }
      else { c2.fillStyle = fg; c2.globalAlpha = alpha; c2.fillRect(u * w, y, 1.3, 1.3); }
    }
  }
  function route(u){ return h * (0.84 - 0.58 * Math.exp(-Math.pow((u - 0.68) / 0.30, 2)) + 0.015 * Math.sin(u * 21)); }
  for (var uu = 0.08; uu < 0.72; uu += 0.008) { c2.fillStyle = fg; c2.globalAlpha = 0.6; c2.fillRect(uu * w, route(uu), 1.6, 1.6); }
  [0.12, 0.42, 0.68].forEach(function(u, i, arr){
    var y = route(u), last = i === arr.length - 1;
    c2.fillStyle = last ? sg : fg; c2.globalAlpha = last ? 0.95 : 0.85;
    c2.fillRect(u * w - 2.5, y - 2.5, 5, 5);
    c2.globalAlpha = 0.35; c2.fillStyle = fg; c2.fillRect(u * w - 0.5, y + 6, 1, 9);
  });
  c2.globalAlpha = 1;
}
function drawGhostChart(cv){ routeMassif(cv, 5.62); }
/* Audit checkmark — hard-edged halftone stroke, oxblood point at the tip. */
function segDist(u, v, x1, y1, x2, y2){
  var dx = x2 - x1, dy = y2 - y1;
  var t = Math.max(0, Math.min(1, ((u - x1) * dx + (v - y1) * dy) / (dx * dx + dy * dy)));
  var px = u - (x1 + t * dx), py = v - (y1 + t * dy);
  return Math.sqrt(px * px + py * py);
}
function checkField(u, v){
  var d = Math.min(segDist(u, v, 0.06, 0.50, 0.36, 0.84), segDist(u, v, 0.36, 0.84, 0.90, 0.10));
  if (d < 0.070) return 1;
  return Math.exp(-Math.pow((d - 0.070) / 0.022, 2)) * 0.55;
}
function drawGlitchSphere(cv){
  var w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
  ditherField(cv, checkField, 2);
  var c2 = cv.getContext("2d"); if (!c2) return;
  var sg = cssVar("--signal");
  for (var i = 0; i < 3; i++) {
    var sy = Math.round(h * (0.35 + 0.35 * hash2(i, 3)));
    var dx = Math.round((hash2(i, 9) > 0.5 ? 1 : -1) * (6 + hash2(i, 9) * 8));
    var band = c2.getImageData(0, sy, cv.width, 2);
    c2.clearRect(0, sy, cv.width, 2);
    c2.putImageData(band, dx, sy);
  }
  c2.fillStyle = sg; c2.globalAlpha = 0.95;
  c2.fillRect(w * 0.88 - 2.5, h * 0.20 - 2.5, 5, 5);
  c2.globalAlpha = 1;
}
/* Dust chronometer — particle dial, ticks, dotted second hand three ticks
   shy of 12 with an oxblood tip, dust sweep trailing behind. */
function drawAscent(cv){
  var p = prepArt(cv); if (!p) return;
  var c2 = p.c2, w = p.w, h = p.h, fg = p.fg, sg = p.sg;
  var SEED = 9.41, cxp = w / 2, cyp = h * 0.52, R = Math.min(w, h) * 0.40;
  var HAND = -Math.PI / 2 - 0.32;
  var N = Math.max(2600, Math.floor(R * 34)), i, a, g, band2, r, den, al, big;
  for (i = 0; i < N; i++) {
    a = hash2(i, 3) * Math.PI * 2;
    g = (hash2(i, 7) + hash2(i, 11) - 1);
    band2 = 0.055 + 0.10 * fbm(Math.cos(a) * 1.7 + 2, Math.sin(a) * 1.7 + 2, SEED);
    r = R * (1 + g * band2);
    den = 0.35 + 0.65 * fbm(a * 1.2, 0.5, SEED + 3);
    al = Math.max(0, 0.72 - Math.abs(g) * 0.95) * den;
    if (al < 0.04) continue;
    c2.fillStyle = fg; c2.globalAlpha = Math.min(0.85, al);
    big = hash2(i, 13) > 0.94;
    c2.fillRect(cxp + Math.cos(a) * r, cyp + Math.sin(a) * r, big ? 1.8 : 1.2, big ? 1.8 : 1.2);
  }
  var M = Math.max(1400, Math.floor(R * 18));
  for (i = 0; i < M; i++) {
    var back = Math.pow(hash2(i, 17), 1.6) * 2.4;
    a = HAND - back;
    r = R * (0.16 + 0.78 * Math.sqrt(hash2(i, 19)));
    al = 0.4 * Math.exp(-back * 1.6) * (0.3 + 0.7 * fbm(a * 2, r / R, SEED + 6)) * (0.4 + 0.6 * hash2(i, 23));
    if (al < 0.04) continue;
    c2.fillStyle = fg; c2.globalAlpha = Math.min(0.6, al);
    c2.fillRect(cxp + Math.cos(a) * r, cyp + Math.sin(a) * r, 1.2, 1.2);
  }
  for (i = 0; i < 12; i++) {
    a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
    var cardinal = i % 3 === 0;
    c2.fillStyle = fg; c2.globalAlpha = cardinal ? 0.8 : 0.45;
    var sz = cardinal ? 3 : 2;
    c2.fillRect(cxp + Math.cos(a) * R * 1.14 - sz / 2, cyp + Math.sin(a) * R * 1.14 - sz / 2, sz, sz);
  }
  for (r = R * 0.10; r < R * 0.96; r += 5) {
    c2.fillStyle = fg; c2.globalAlpha = 0.65;
    c2.fillRect(cxp + Math.cos(HAND) * r - 0.8, cyp + Math.sin(HAND) * r - 0.8, 1.6, 1.6);
  }
  var tx = cxp + Math.cos(HAND) * R, ty = cyp + Math.sin(HAND) * R;
  var grad = c2.createRadialGradient(tx, ty, 0, tx, ty, 14);
  grad.addColorStop(0, sg); grad.addColorStop(1, "rgba(0,0,0,0)");
  c2.globalAlpha = 0.5; c2.fillStyle = grad;
  c2.beginPath(); c2.arc(tx, ty, 14, 0, 7); c2.fill();
  c2.globalAlpha = 0.95; c2.fillStyle = sg; c2.fillRect(tx - 2.5, ty - 2.5, 5, 5);
  c2.fillStyle = fg; c2.globalAlpha = 0.9; c2.fillRect(cxp - 2, cyp - 2, 4, 4);
  c2.globalAlpha = 1;
}
/* Pricing — compounding halftone bar staircase with a dotted trend line. */
var BARS = 14, BAR_GROW = 1.24, BASE_Y = 0.88;
function barTop(i){ return BASE_Y - 0.66 * (Math.pow(BAR_GROW, i) / Math.pow(BAR_GROW, BARS - 1)); }
function barsField(u, v){
  var t = u * BARS, i = Math.min(BARS - 1, Math.floor(t));
  if (t % 1 > 0.78) return 0;
  var top = barTop(i);
  if (v < top || v > BASE_Y) return 0;
  return 0.20 + 0.55 * Math.exp(-(v - top) * 7);
}
function drawCurveFam(cv){
  var w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
  ditherField(cv, barsField, 3);
  var c2 = cv.getContext("2d"); if (!c2) return;
  var fg = cssVar("--fg"), sg = cssVar("--signal");
  c2.fillStyle = fg; c2.globalAlpha = 0.4;
  for (var u = 0.01; u <= 0.99; u += 0.011) c2.fillRect(u * w, BASE_Y * h + 3, 1.4, 1.4);
  function cx(i){ return ((i + 0.39) / BARS) * w; }
  c2.globalAlpha = 0.65;
  for (u = 0.028; u <= 0.965; u += 0.007) {
    var t = Math.min(BARS - 1.001, Math.max(0, u * BARS - 0.39));
    var i = Math.floor(t), fr = t - i;
    var y = (barTop(i) * (1 - fr) + barTop(Math.min(BARS - 1, i + 1)) * fr - 0.035) * h;
    c2.fillRect(u * w, y, 1.5, 1.5);
  }
  [4, 9].forEach(function(i){
    c2.fillStyle = fg; c2.globalAlpha = 0.9;
    c2.fillRect(cx(i) - 2.5, (barTop(i) - 0.035) * h - 2.5, 5, 5);
  });
  var ex = cx(BARS - 1), ey = (barTop(BARS - 1) - 0.035) * h;
  var grad = c2.createRadialGradient(ex, ey, 0, ex, ey, 16);
  grad.addColorStop(0, sg); grad.addColorStop(1, "rgba(0,0,0,0)");
  c2.globalAlpha = 0.55; c2.fillStyle = grad;
  c2.beginPath(); c2.arc(ex, ey, 16, 0, 7); c2.fill();
  c2.globalAlpha = 0.95; c2.fillStyle = sg; c2.fillRect(ex - 2.5, ey - 2.5, 5, 5);
  c2.globalAlpha = 1;
}
/* CTA — data sunset: sun-scale ring sinking behind a ragged dust sea. */
function drawEclipse(cv){
  var p = prepArt(cv); if (!p) return;
  var c2 = p.c2, w = p.w, h = p.h, fg = p.fg, sg = p.sg;
  var HORIZON = h * 0.62, SEED = 2.44;
  var cxp = w / 2, cyp = HORIZON + h * 0.06, R = h * 0.42;
  function dot(x, y, a, i){
    if (a < 0.03 || y < 0 || y > h || x < 0 || x > w) return;
    c2.fillStyle = hash2(i, 73) > 0.994 ? sg : fg;
    c2.globalAlpha = Math.min(0.85, a);
    var big = hash2(i, 77) > 0.92;
    c2.fillRect(x, y, big ? 1.8 : 1.15, big ? 1.8 : 1.15);
  }
  function env(u){ return Math.min(1, 0.45 + Math.exp(-Math.pow(Math.abs(u - 0.5) / 0.3, 2))); }
  function rise(u){ return h * (0.20 + 0.10 * Math.exp(-Math.pow(Math.abs(u - 0.5) / 0.22, 2))); }
  function surf(u){ return HORIZON - Math.pow(fbm(u * 6.2, 0.32, SEED + 5), 1.15) * env(u) * rise(u) * 0.9; }
  c2.save();
  c2.beginPath();
  c2.moveTo(0, 0); c2.lineTo(0, surf(0));
  var STEPS = 160, si;
  for (si = 1; si <= STEPS; si++) { var uu = si / STEPS; c2.lineTo(uu * w, surf(uu)); }
  c2.lineTo(w, 0); c2.closePath(); c2.clip();
  c2.strokeStyle = fg; c2.lineWidth = 2.5;
  c2.shadowColor = fg; c2.shadowBlur = 20;
  c2.beginPath(); c2.arc(cxp, cyp, R, 0, 7); c2.stroke();
  c2.shadowBlur = 38; c2.globalAlpha = 0.5;
  c2.beginPath(); c2.arc(cxp, cyp, R, 0, 7); c2.stroke();
  c2.shadowBlur = 0; c2.globalAlpha = 1;
  c2.restore();
  var ROWS = 56, COLSN = Math.max(240, Math.floor(w / 2.2)), stepX = w / COLSN;
  for (var r = 0; r < ROWS; r++) {
    var d = r / (ROWS - 1);
    for (var q = 0; q <= COLSN; q++) {
      var jx = (hash2(q + 401, r) - 0.5) * stepX * 1.8;
      var u = (q + jx / stepX) / COLSN;
      var hh = Math.pow(fbm(u * 6.2, 0.32 + d * 3.6, SEED + 5), 1.15) * env(u);
      if (hh < 0.02) continue;
      var base = HORIZON + d * (h - HORIZON) * 0.9;
      var y = base - hh * rise(u) * (0.55 + 0.45 * d) + (hash2(q + 91, r + 17) - 0.5) * 5;
      dot(u * w, y, (0.06 + Math.pow(hh, 1.2) * 1.6) * (0.35 + 0.65 * d), q * 17 + r * 3);
    }
  }
  for (var i2 = 0; i2 < 300; i2++) {
    var gy = Math.pow(hash2(i2, 15), 1.3);
    var yy = HORIZON + gy * (h - HORIZON) * 0.85;
    var spread = 0.02 + gy * 0.06;
    var gx = (hash2(i2, 5) + hash2(i2, 9) - 1) * spread;
    dot((0.5 + gx) * w, yy, 0.55 * Math.exp(-gy * 2.4) * (0.35 + 0.65 * hash2(i2, 21)), i2 * 3 + 1);
  }
  for (var i3 = 0; i3 < 420; i3++) {
    var x3 = hash2(i3, 61) * w, y3 = hash2(i3, 67) * HORIZON;
    if (Math.sqrt((x3 - cxp) * (x3 - cxp) + (y3 - cyp) * (y3 - cyp)) < R * 1.12) continue;
    dot(x3, y3, (0.04 + 0.24 * Math.pow(hash2(i3, 71), 3)) * (0.35 + 0.65 * (y3 / HORIZON)), i3);
  }
  c2.globalAlpha = 1;
}

function renderArts(){
  document.querySelectorAll("[data-art]").forEach(function(cv){
    var kind = cv.getAttribute("data-art");
    if (kind === "sphere") ditherField(cv, sphereField, 3);
    else if (kind === "glitchsphere") drawGlitchSphere(cv);
    else if (kind === "ghostchart") drawGhostChart(cv);
    else if (kind === "ascent") drawAscent(cv);
    else if (kind === "curve") drawCurveFam(cv);
    else if (kind === "eclipse") drawEclipse(cv);
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
    function setIns(sc, show){
      if (!cfg.insEl) return;
      cfg.insEl.innerHTML = sc.ins ? "<span>" + sc.ins + "</span>" : "";
      cfg.insEl.classList.toggle("show", !!show && !!sc.ins);
    }
    function play(i){
      runRef.v++;
      clearTimeout(runRef.t);
      active = i;
      var sc = cfg.scenarios[i];
      tabs.forEach(function(tb, j){ tb.classList.toggle("on", j === i); });
      if (cfg.capEl) cfg.capEl.innerHTML = "FEATURE 0" + (i + 1) + " — <b>" + sc.cap + "</b>";
      renderTiles(sc);
      setIns(sc, false);
      cfg.qEl.textContent = ""; cfg.codeEl.textContent = "";
      if (D.reduceMotion) {
        cfg.qEl.textContent = sc.q;
        cfg.codeEl.innerHTML = sc.code.replace(/\n/g, "<br>");
        D.countUp(cfg.tilesEl, runRef);
        setIns(sc, true);
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
              (function(){ var v = runRef.v; setTimeout(function(){ if (v === runRef.v) setIns(sc, true); }, 500); })();
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
      setIns(sc, true);
    })();
    new IntersectionObserver(function(en){
      if (en[0].isIntersecting) play(active);
      else { runRef.v++; clearTimeout(runRef.t); setProg(0); }
    }, { threshold: 0.3 }).observe(cfg.root);
    return { play: play };
  }
};
})();
