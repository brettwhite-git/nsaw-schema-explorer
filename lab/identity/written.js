/* written.js — the site's handwriting, written by a pen instead of wiped in.
 *
 *   window.WrittenInk
 *     .writeText(el, lines, opts)        → handle    notes in Caveat, one letter after another
 *     .drawBracket(svg, height, opts)    → handle    a hand-written "[" or "]" (handle.setHeight(h) refits it)
 *     .drawArrow(svg, opts)              → handle    a small pen arrow: one stroke, then the two barbs
 *     .noteWindow(lineCount)             → ms a note of that many lines takes to write (the length of its sound)
 *     .ready                             → Promise, settled once the glyph data is in (or failed)
 *
 *     .handles                           → every live handle (for devtools: WrittenInk.handles[0].seek(300))
 *
 *   handle: { duration, play(delayMs), finish(), clear(), seek(ms), destroy() }
 *     play     writes it in, starting delayMs from now (reduced motion: finished at once)
 *     finish   the final state, instantly          clear   nothing on the page, instantly
 *
 * Text: the letters are Caveat SemiBold OUTLINES (the look of the old .note-line), each
 * revealed through its own <mask> by a fat stroke that follows the letter's traced
 * centre-line, so ink appears where the pen has been. Outlines, centre-lines, advances and
 * kerning come precomputed from caveat-glyphs.json (scripts/make-written-glyphs.mjs); the
 * page never loads the font file or a font parser for this. A note is one pen: its lines
 * are written one after another and together fill noteWindow(lines), which is also how long
 * the handwriting sound for that many lines runs (sound.js write2/3/4), so the two stay in step.
 *
 * Bracket and arrow: each pen stroke is a filled ribbon (two inked edges around a spine),
 * thinner where the pen lands, fuller mid-stroke, tapering fast where it lifts. The pen
 * follows the spine at pen speed (slow into the turns, quick down the straight, eased at
 * both ends), never a uniform wipe. Every shape comes from a fixed seed: nothing boils
 * between replays or resizes.
 *
 * Sizes follow CSS: a line's <svg> is sized in em, so .note-line's font-size sets it.
 * Colour is currentColor. Reduced motion (html.is-reduced, ?reduced=1 or the OS setting,
 * or opts.reduced): play() goes straight to the final state.
 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var HERE = (document.currentScript && document.currentScript.src) || location.href;

  var CFG = {
    glyphsUrl: new URL('caveat-glyphs.json', HERE).href,
    lineHeight: 1.2,      // em: the .note-line line box
    penSpeed: 15,         // em per second along a letter's centre-line, before the note is fitted to its window
    maskWidth: 0.2,       // em: the revealing stroke, about twice Caveat's stem (the centre-line is approximate)
    lineDur: 1800,        // ms: what one line took in the old wipe; with lineGap, the window a note fills
    lineGap: 900,
    inkWidth: 2.1,        // px: bracket + arrow, Caveat's stem at note size
    bracketDur: 450,      // ms
    arrowDur: 400
  };

  /* ---------- helpers ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function tiltRand(s) { var x = Math.sin(s * 9999) * 10000; return x - Math.floor(x); }   // the site's line tilt
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function smoothstep(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  function isReduced(opts) {
    if (opts && opts.reduced != null) return !!opts.reduced;
    return document.documentElement.classList.contains('is-reduced') || /[?&]reduced=1\b/.test(location.search) ||
      !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ---------- one clock for everything being written ---------- */
  var active = [], all = [], rafId = 0;                // all: every live handle (WrittenInk.handles, for devtools)
  function tick(now) {
    rafId = 0;
    for (var i = active.length - 1; i >= 0; i--) if (!active[i]._step(now)) active.splice(i, 1);
    if (active.length) rafId = requestAnimationFrame(tick);
  }
  function makeHandle(duration, reduced) {
    var h = { duration: duration, state: 'clear', render: function () { return false; } }, t0 = 0, timer = 0, held = -1;
    all.push(h);
    function stop() {
      clearTimeout(timer); timer = 0;
      var i = active.indexOf(h);
      if (i >= 0) active.splice(i, 1);
    }
    h._forget = function () { stop(); var i = all.indexOf(h); if (i >= 0) all.splice(i, 1); };
    h._step = function (now) {
      if (h.render(now - t0)) return true;
      h.state = 'done';
      return false;
    };
    h.play = function (delayMs) {
      stop();
      if (reduced) { h.finish(); return h; }
      var delay = Math.max(0, delayMs || 0);
      h.render(-1);
      h.state = 'playing';
      t0 = performance.now() + delay;
      timer = setTimeout(function () {                // waiting costs a timer, not a frame loop
        timer = 0;
        active.push(h);
        if (!rafId) rafId = requestAnimationFrame(tick);
      }, delay);
      return h;
    };
    h.finish = function () { stop(); h.state = 'done'; h.render(Infinity); return h; };
    h.clear = function () { stop(); h.state = 'clear'; h.render(-1); return h; };
    h.seek = function (ms) { stop(); h.state = 'held'; held = ms; h.render(ms); return h; };
    /* the drawing was rebuilt (new height, glyphs arrived): show it as the handle stands */
    h._rebuilt = function (restart) {
      if (h.state === 'done') h.render(Infinity);
      else if (h.state === 'playing') { if (restart && performance.now() > t0) t0 = performance.now(); h.render(-1); }
      else if (h.state === 'clear') h.render(-1);
      else h.render(held);
    };
    return h;
  }

  /* =====================================================================================
     Pen strokes as ribbons (bracket, arrow)
     ===================================================================================== */

  /* coarse points → a dense smooth line (~0.6px steps), centripetal Catmull-Rom */
  function spline(src, step) {
    step = step || 0.6;
    var n = src.length, out = [src[0]];
    function d(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
    for (var i = 0; i < n - 1; i++) {
      var p1 = src[i], p2 = src[i + 1], p0 = src[i - 1] || p1, p3 = src[i + 2] || p2;
      var d1 = d(p0, p1), d2 = d(p1, p2), d3 = d(p2, p3);
      var a1 = Math.sqrt(d1), a2 = Math.sqrt(d2), a3 = Math.sqrt(d3), b1 = [0, 0], b2 = [0, 0];
      for (var c = 0; c < 2; c++) {
        b1[c] = d1 < 1e-6 ? p1[c] + (p2[c] - p1[c]) / 3
          : (d1 * p2[c] - d2 * p0[c] + (2 * d1 + 3 * a1 * a2 + d2) * p1[c]) / (3 * a1 * (a1 + a2));
        b2[c] = d3 < 1e-6 ? p2[c] + (p1[c] - p2[c]) / 3
          : (d3 * p1[c] - d2 * p3[c] + (2 * d3 + 3 * a3 * a2 + d2) * p2[c]) / (3 * a3 * (a3 + a2));
      }
      var m = Math.max(1, Math.ceil(d2 / step));
      for (var s = 1; s <= m; s++) {
        var t = s / m, u = 1 - t;
        out.push([
          u * u * u * p1[0] + 3 * u * u * t * b1[0] + 3 * u * t * t * b2[0] + t * t * t * p2[0],
          u * u * u * p1[1] + 3 * u * u * t * b1[1] + 3 * u * t * t * b2[1] + t * t * t * p2[1]
        ]);
      }
    }
    return out;
  }

  /* One stroke, ready to draw: the spine, how far the pen is at any moment, the two inked edges.
     spec: { pts, dur, width, inLen, inMin, outLen, outMin, startSlow, endSlow, seed }
       inLen/inMin    the pen lands: width grows from inMin (× width) over inLen px
       outLen/outMin  the pen lifts: width falls to outMin over the last outLen px
       startSlow/endSlow  how much of full speed the pen has at the two ends (0–1) */
  function makeStroke(spec) {
    var pts = spline(spec.pts), n = pts.length, cum = [0], i;
    for (i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    var L = cum[n - 1] || 1;

    /* pen speed: the two-thirds power law (slower through tight turns), eased at both ends */
    var v = [];
    for (i = 0; i < n; i++) {
      var r = 1e3;
      if (i > 0 && i < n - 1) {
        var a = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
        var b = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
        var da = Math.abs(b - a); if (da > Math.PI) da = 2 * Math.PI - da;
        r = da < 1e-4 ? 1e3 : ((cum[i + 1] - cum[i - 1]) / 2) / da;
      }
      v.push(Math.max(0.3, Math.min(1, Math.pow(r / 9, 1 / 3))));
    }
    var s0 = spec.startSlow == null ? 0.3 : spec.startSlow, s1 = spec.endSlow == null ? 0.45 : spec.endSlow;
    var inRun = Math.min(L * 0.3, 14), outRun = Math.min(L * 0.3, 16);
    var sp = v.map(function (_, k) {
      var s = 0, c = 0;
      for (var q = Math.max(0, k - 4); q <= Math.min(n - 1, k + 4); q++) { s += v[q]; c++; }
      return (s / c) * (s0 + (1 - s0) * smoothstep(cum[k] / inRun)) * (s1 + (1 - s1) * smoothstep((L - cum[k]) / outRun));
    });
    var time = [0];
    for (i = 1; i < n; i++) time.push(time[i - 1] + (cum[i] - cum[i - 1]) / ((sp[i] + sp[i - 1]) / 2));
    var k = spec.dur / time[n - 1];
    for (i = 0; i < n; i++) time[i] *= k;

    /* the ribbon: pressure along the stroke, a slow breathing of the width, nothing jagged */
    var rnd = mulberry32(spec.seed || 1), TAU = 6.283185;
    var wf = 1.3 + rnd() * 1.2, wp = rnd() * TAU, wf2 = 3.1 + rnd() * 2, wp2 = rnd() * TAU;
    var W = spec.width / 2, inLen = Math.min(spec.inLen, L * 0.4), outLen = Math.min(spec.outLen, L * 0.5);
    var S = { n: n, cum: cum, time: time, len: L, dur: spec.dur,
      cx: new Float32Array(n), cy: new Float32Array(n), hw: new Float32Array(n),
      nx: new Float32Array(n), ny: new Float32Array(n), tx: new Float32Array(n), ty: new Float32Array(n) };
    for (i = 0; i < n; i++) {
      var p = pts[Math.max(0, i - 1)], q2 = pts[Math.min(n - 1, i + 1)];
      var dx = q2[0] - p[0], dy = q2[1] - p[1], dl = Math.hypot(dx, dy) || 1;
      var u = cum[i] / 60 * TAU;
      var press = 0.94 + 0.1 * Math.max(0, dy / dl);                    // a touch heavier pulling down the page
      var taper = (spec.inMin + (1 - spec.inMin) * smoothstep(cum[i] / inLen)) *
        (spec.outMin + (1 - spec.outMin) * Math.pow(smoothstep((L - cum[i]) / outLen), 0.8));
      S.cx[i] = pts[i][0]; S.cy[i] = pts[i][1];
      S.tx[i] = dx / dl; S.ty[i] = dy / dl; S.nx[i] = -dy / dl; S.ny[i] = dx / dl;
      S.hw[i] = W * press * taper * (1 + 0.06 * Math.sin(wf * u + wp) + 0.035 * Math.sin(wf2 * u + wp2));
    }
    return S;
  }

  /* how much of the stroke is on the page `ms` after the pen landed */
  function lengthAt(S, ms) {
    var t = S.time, lo = 0, hi = t.length - 1;
    if (ms <= 0) return 0;
    if (ms >= t[hi]) return S.len;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (t[mid] <= ms) lo = mid; else hi = mid; }
    return S.cum[lo] + (S.cum[hi] - S.cum[lo]) * (ms - t[lo]) / ((t[hi] - t[lo]) || 1);
  }

  function f2(v) { return v.toFixed(2); }
  /* The stroke up to arc-length `len` as one closed outline: left edge out, round the pen's
     tip, right edge back, round the landing. */
  function ribbonPath(S, len) {
    if (len <= 0) return '';
    var n = S.n, cum = S.cum, k = n - 1, fr = 0, i, a;
    if (len < S.len) {
      var lo = 0, hi = n - 1;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (cum[mid] <= len) lo = mid; else hi = mid; }
      k = lo; fr = (len - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
    }
    function mix(arr) { return fr > 0 ? arr[k] + (arr[k + 1] - arr[k]) * fr : arr[k]; }
    var d = 'M' + f2(S.cx[0] + S.nx[0] * S.hw[0]) + ' ' + f2(S.cy[0] + S.ny[0] * S.hw[0]);
    for (i = 1; i <= k; i++) d += 'L' + f2(S.cx[i] + S.nx[i] * S.hw[i]) + ' ' + f2(S.cy[i] + S.ny[i] * S.hw[i]);
    var ex = mix(S.cx), ey = mix(S.cy), eh = mix(S.hw), enx = mix(S.nx), eny = mix(S.ny), etx = mix(S.tx), ety = mix(S.ty);
    for (a = 0; a <= 4; a++) {                                          // the tip: half a turn, left → ahead → right
      var c = Math.cos(a * 0.785398), s = Math.sin(a * 0.785398);
      d += 'L' + f2(ex + eh * (enx * c + etx * s)) + ' ' + f2(ey + eh * (eny * c + ety * s));
    }
    for (i = k; i >= 1; i--) d += 'L' + f2(S.cx[i] - S.nx[i] * S.hw[i]) + ' ' + f2(S.cy[i] - S.ny[i] * S.hw[i]);
    for (a = 0; a < 4; a++) {                                           // the landing: right → behind → left
      var c2 = Math.cos(a * 0.785398), s2 = Math.sin(a * 0.785398);
      d += 'L' + f2(S.cx[0] - S.hw[0] * (S.nx[0] * c2 + S.tx[0] * s2)) + ' ' + f2(S.cy[0] - S.hw[0] * (S.ny[0] * c2 + S.ty[0] * s2));
    }
    return d + 'Z';
  }

  /* A drawing made of pen strokes, one after another in a single <path>.
     build() → [{ S: stroke, at: ms the pen lands }] */
  function inkHandle(svg, duration, build, reduced) {
    var path = el('path', { fill: 'currentColor' }, svg), strokes = [], full = '', shown = null;
    var h = makeHandle(duration, reduced);
    h.render = function (ms) {
      if (ms < 0) { if (shown !== '') path.setAttribute('d', shown = ''); return true; }
      if (ms >= duration) { if (shown !== full) path.setAttribute('d', shown = full); return false; }
      var d = '';
      for (var i = 0; i < strokes.length; i++) {
        var s = strokes[i], t = ms - s.at;
        if (t > 0) d += t >= s.S.dur ? s.full : ribbonPath(s.S, lengthAt(s.S, t));
      }
      path.setAttribute('d', shown = d);
      return true;
    };
    h._build = function () {
      strokes = build();
      full = '';
      strokes.forEach(function (s) { s.full = ribbonPath(s.S, s.S.len); full += s.full; });
      shown = null;
      h._rebuilt(false);
    };
    h.destroy = function () { h._forget(); path.remove(); };
    return h;
  }

  /* ---------- the bracket ----------
     One stroke, top to bottom, as a hand writes a tall "[": the pen lands at the far end of the
     top arm and runs in (a small entry hook, like the top of a C), turns down, comes down the
     page not quite straight (a gentle bow, a slow waver), turns and leaves with a quick flick
     that lifts as it goes. side 'left' = "[" (arms point right); 'right' = "]" (arms point left). */
  function bracketPoints(h, width, side, seed) {
    var rnd = mulberry32(seed), j = function (a) { return (rnd() - 0.5) * a; };
    var q = Math.min(1, h / 30);                                        // very short brackets: everything smaller
    var hook = (6.2 + j(1.0)) * q, flick = (8.4 + j(1.2)) * q;           // the way out runs longer than the way in
    var bow = Math.min(1.5, 0.35 + h * 0.005) * (0.7 + rnd() * 0.6);    // px the upright bellies away from its arms
    var sway = Math.min(1.1, h * 0.004) * (rnd() < 0.5 ? -1 : 1), swayAt = rnd() * 0.5;   // …and a slow S on the long ones
    var lean = j(1.4) * Math.min(1, h / 120);                           // the foot drifts a little off the head
    var c = [                                                           // [along the arm, down the page]
      [hook, (1.9 + j(0.5)) * q], [hook * 0.5, (1.3 + j(0.25)) * q], [1.05 * q, 1.2 * q], [0.1, 2.3 * q], [-0.03, 5.6 * q]
    ];
    var top = 10, bot = h - 10, span = bot - top;
    if (span > 14) {
      var steps = Math.max(1, Math.round(span / 34));
      for (var s = 0; s <= steps; s++) {
        var u = s / steps, y = top + span * u;
        var yy = top + span * (steps > 1 && s > 0 && s < steps ? u + j(0.25) / steps : u);
        c.push([-bow * Math.sin(Math.PI * (y - 2) / (h - 4)) + sway * Math.sin(Math.PI * u) * Math.sin(Math.PI * 2 * (u + swayAt)) + lean * u + j(0.6), yy]);
      }
    }
    c.push([lean - 0.02, h - 5.6 * q], [lean + 0.12, h - 2.3 * q], [lean + 1.05 * q, h - 1.25 * q], [lean + flick * 0.45, h - (1.1 + j(0.2)) * q],
      [lean + flick * 0.78, h - (1.4 + j(0.2)) * q], [lean + flick, h - (2.0 + j(0.4)) * q]);
    var xv = side === 'right' ? width - 4.6 : 2.1, dir = side === 'right' ? -1 : 1;
    return c.map(function (p) { return [xv + dir * p[0], p[1]]; });
  }

  function drawBracket(svg, height, opts) {
    opts = opts || {};
    var side = opts.side === 'right' ? 'right' : 'left';
    var width = opts.width || (side === 'right' ? 14 : 12);
    var dur = opts.duration || CFG.bracketDur, seed = (opts.seed || 0) * 7919 + (side === 'right' ? 20211 : 4177);
    var h = 0;
    var handle = inkHandle(svg, dur, function () {
      if (!(h > 6)) return [];
      return [{ at: 0, S: makeStroke({
        pts: bracketPoints(h, width, side, seed), dur: dur, width: opts.inkWidth || CFG.inkWidth,
        inLen: 4.5, inMin: 0.5, outLen: 7, outMin: 0.14, startSlow: 0.26, endSlow: 0.5, seed: seed + 5
      }) }];
    }, isReduced(opts));
    handle.setHeight = function (nh) {
      nh = Math.max(0, Math.round(nh || 0));
      svg.setAttribute('viewBox', '0 0 ' + width + ' ' + nh);
      svg.setAttribute('width', width);
      svg.setAttribute('height', nh);
      if (nh === h) return handle;
      h = nh;
      handle._build();
      return handle;
    };
    handle.kind = 'bracket'; handle.el = svg;
    handle.setHeight(height);
    return handle;
  }

  /* ---------- the arrow ----------
     The shaft in one quick stroke, the pen lifts, then the two barbs, each flicked back from the
     point with a beat between them. Default: the showcase's note arrow (20 × 31, from under a
     bracket's foot down and round to the first note line).
     opts: { shaft: [[x, y], …], barbs: [[dx, dy], [dx, dy]] from the point, width, height, duration, seed } */
  function drawArrow(svg, opts) {
    opts = opts || {};
    var w = opts.width || 20, hgt = opts.height || 31, dur = opts.duration || CFG.arrowDur, seed = (opts.seed || 0) * 131 + 31;
    var rnd = mulberry32(seed), j = function (a) { return (rnd() - 0.5) * a; };
    var shaft = opts.shaft || [[2.3 + j(0.5), 4.4], [2.0 + j(0.4), 11], [3.0 + j(0.5), 18.6], [6.3, 23.8 + j(0.5)], [11.2, 25.9 + j(0.4)], [17.0, 26.1 + j(0.5)]];
    var barbs = opts.barbs || [[-5.3 + j(0.6), -3.3 + j(0.5)], [-4.8 + j(0.6), 3.7 + j(0.5)]];
    var tip = shaft[shaft.length - 1], ink = opts.inkWidth || CFG.inkWidth;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + hgt);
    svg.setAttribute('width', w);
    svg.setAttribute('height', hgt);
    var t1 = dur * 0.58, t2 = dur * 0.12, lift = dur * 0.11, beat = dur * 0.07;       // shaft, a barb, the lift, the beat between barbs
    var handle = inkHandle(svg, dur, function () {
      var out = [{ at: 0, S: makeStroke({ pts: shaft, dur: t1, width: ink * 0.9, inLen: 5, inMin: 0.45, outLen: 7, outMin: 0.55, startSlow: 0.3, endSlow: 0.6, seed: seed + 1 }) }];
      barbs.forEach(function (b, k) {
        var bend = k ? -0.5 : 0.5;                                      // each barb bows a hair, away from the shaft
        out.push({ at: t1 + lift + k * (t2 + beat), S: makeStroke({
          pts: [[tip[0] + 0.2, tip[1]], [tip[0] + b[0] * 0.55, tip[1] + b[1] * 0.55 + bend], [tip[0] + b[0], tip[1] + b[1]]],
          dur: t2, width: ink * 0.74, inLen: 1.2, inMin: 0.7, outLen: 4.4, outMin: 0.16, startSlow: 0.7, endSlow: 0.8, seed: seed + 2 + k
        }) });
      });
      return out;
    }, isReduced(opts));
    handle.kind = 'arrow'; handle.el = svg;
    handle._build();
    return handle;
  }

  /* =====================================================================================
     Text
     ===================================================================================== */
  var glyphData = null, warned = {};
  var ready = fetch(CFG.glyphsUrl).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (d) { glyphData = d; return d; });
  ready.catch(function (e) { if (window.console) console.warn('[written] glyph data did not load, notes fall back to plain text:', e); });

  function noteWindow(lineCount) {
    var n = Math.max(1, lineCount || 1);
    return (n - 1) * CFG.lineGap + ((n - 1) % 2 ? 110 : 0) + CFG.lineDur;
  }

  var uid = 0;
  /* lay the lines out and plan the pen: every letter's strokes get a start and an end, in order */
  function buildText(rows, lines, D, total, seed) {
    var upm = D.upm, rnd = mulberry32(seed * 7919 + 20211);
    var box = CFG.lineHeight * upm, baseIn = (box - (D.asc + D.desc)) / 2 + D.asc;
    var mw = CFG.maskWidth * upm, speed = CFG.penSpeed * upm / 1000;    // units per ms
    var items = [], t = 0;
    lines.forEach(function (text, li) {
      var svg = rows[li], x = 0, prev = '';
      var defs = el('defs', {}, svg);
      if (li) t += 200;                                                 // back to the start of a line
      text.split('').forEach(function (ch) {
        var g = D.glyphs[ch];
        if (!g) {
          if (!warned[ch] && window.console) console.warn('[written] no glyph for "' + ch + '": run scripts/make-written-glyphs.mjs');
          warned[ch] = true;
          x += upm * 0.3; t += 100; prev = '';
          return;
        }
        x += D.kern[prev + ch] || 0;
        prev = ch;
        if (!g[1]) { x += g[0]; t += 100; return; }                     // a space: lift and move on
        var id = 'wi-m' + (++uid);
        var mask = el('mask', { id: id, maskUnits: 'userSpaceOnUse', x: -0.6 * upm, y: -(D.asc + 0.25 * upm), width: g[0] + 1.2 * upm, height: D.asc + D.desc + 0.5 * upm }, defs);
        var pen = el('g', { fill: 'none', stroke: '#fff', 'stroke-width': mw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, mask);
        var path = el('path', { d: g[1], transform: 'translate(' + x + ' 0)' }, svg);
        var pace = 0.82 + rnd() * 0.43, g0 = t, strokes = [];           // each letter at its own pace
        for (var k = 2; k < g.length; k += 2) {
          var len = g[k];
          var s = { el: el('path', { d: g[k + 1], 'stroke-dasharray': len + ' ' + (len + mw * 2) }, pen), len: len, t0: t };
          t += Math.max(32, len / speed * pace);
          s.t1 = t;
          t += 16;                                                      // lift inside the letter
          strokes.push(s);
        }
        items.push({ el: path, maskRef: 'url(#' + id + ')', strokes: strokes, pad: mw, t0: g0, t1: t - 16, state: -1 });
        t += 4 + rnd() * 22;                                            // on to the next letter
        x += g[0];
      });
      svg.setAttribute('viewBox', '0 ' + (-baseIn).toFixed(1) + ' ' + Math.max(1, Math.ceil(x)) + ' ' + box);
      svg.style.width = (x / upm).toFixed(3) + 'em';
    });
    /* fit the take to its window: the hand speeds up or slows down, the rhythm stays */
    var k = t > 0 ? total / t : 1;
    items.forEach(function (it) {
      it.t0 *= k; it.t1 *= k;
      it.strokes.forEach(function (s) { s.t0 *= k; s.t1 *= k; });
    });
    return items;
  }

  /* writeText(el, lines, opts)
     el      the lines' container (the site's .margin-note__lines); it gets one div.note-line per line
     opts    { seed, window (ms, default noteWindow(lines.length)), tilt (max degrees, default 1.6),
               lineClass, label (false: no aria-label), reduced } */
  function writeText(root, lines, opts) {
    opts = opts || {};
    lines = (lines || []).map(String);
    var seed = opts.seed || 0, tilt = opts.tilt == null ? 1.6 : opts.tilt;
    var total = opts.window || noteWindow(lines.length);
    var h = makeHandle(total, isReduced(opts)), items = null;
    h.kind = 'text'; h.el = root;

    if (opts.label !== false && lines.length) {                         // the words stay readable; the drawing is decoration
      root.setAttribute('role', 'img');
      root.setAttribute('aria-label', lines.join(' '));
    }
    var divs = lines.map(function (_, i) {
      var row = document.createElement('div');
      row.className = opts.lineClass || 'note-line';
      row.style.setProperty('--line-tilt', ((tiltRand(seed + i + 1) - 0.5) * tilt).toFixed(2) + 'deg');
      root.appendChild(row);
      return row;
    });
    var rows = divs.map(function (row) {
      /* sized here, not only in CSS: an unstyled <svg> is 300 × 150 and would push the line out of place */
      return el('svg', { class: 'written-line', 'aria-hidden': 'true', focusable: 'false', fill: 'currentColor',
        style: 'display:block;height:' + CFG.lineHeight + 'em;width:0;overflow:visible' }, row);
    });

    function ease(p) { return 0.55 * p + 0.45 * (0.5 - 0.5 * Math.cos(Math.PI * p)); }
    /* everything as it stands `ms` into the take; the DOM is only touched where a state changes */
    h.render = function (ms) {
      if (!items) return ms < total;
      var busy = false;
      for (var i = 0; i < items.length; i++) {
        var it = items[i], state = ms < it.t0 ? 0 : ms >= it.t1 ? 1 : 2;
        if (state !== 1) busy = true;
        if (state !== 2 && state === it.state) continue;
        if (state === 0) {
          it.el.style.visibility = 'hidden';
        } else if (state === 1) {
          it.el.style.visibility = '';
          it.el.removeAttribute('mask');                                // finished: the plain outline
        } else {
          if (it.state !== 2) { it.el.setAttribute('mask', it.maskRef); it.el.style.visibility = ''; }
          for (var k = 0; k < it.strokes.length; k++) {
            var s = it.strokes[k];
            var p = ms <= s.t0 ? -1 : ms >= s.t1 ? 1 : ease((ms - s.t0) / (s.t1 - s.t0));
            s.el.style.strokeDashoffset = p < 0 ? (s.len + it.pad).toFixed(1) : (s.len * (1 - p)).toFixed(1);
          }
        }
        it.state = state;
      }
      return busy;
    };
    var alive = true;
    ready.then(function (D) {
      if (!alive) return;
      items = buildText(rows, lines, D, total, seed);
      h._rebuilt(true);                                                 // asked to play before the glyphs were in: start now
    }, function () {
      if (!alive) return;                                               // no glyph data: the words as plain text, in the page's Caveat
      rows.forEach(function (svg) { svg.remove(); });
      divs.forEach(function (row, i) { row.textContent = lines[i]; });
      root.removeAttribute('role');
      root.removeAttribute('aria-label');
      h.render = function (ms) { root.style.visibility = ms < 0 ? 'hidden' : ''; return false; };
      h._rebuilt(false);
    });
    h.destroy = function () {
      alive = false;
      h._forget();
      divs.forEach(function (row) { row.remove(); });
      root.style.visibility = '';
      root.removeAttribute('role');
      root.removeAttribute('aria-label');
    };
    return h;
  }

  window.WrittenInk = {
    writeText: writeText,
    drawBracket: drawBracket,
    drawArrow: drawArrow,
    noteWindow: noteWindow,
    ready: ready.then(function () { return true; }, function () { return false; }),
    handles: all,
    config: CFG
  };
})();
