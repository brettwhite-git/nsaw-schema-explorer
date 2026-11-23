/* The Warehouse, Drawn: identity lab.
   One specimen, three identities. Plain script, needs global `rough` (lab/vendor/rough.js)
   and optionally WrittenInk (written.js + caveat-glyphs.json).
   Rules it follows: see /DESIGN.md (fixed seeds, no solid fills, one accent focus per figure,
   drawn in not faded, nothing loops, reduced motion = finished drawing). */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var gen = rough.generator();
  var EASE = 'cubic-bezier(.42,.05,.4,1)';
  var Q = new URLSearchParams(location.search);
  var REDUCED = Q.has('reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  var uid = 0;

  /* ---------- helpers ---------- */
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function R(seed, extra) {
    var o = { roughness: 0.35, bowing: 0.4, seed: seed, disableMultiStroke: true, stroke: '#000', strokeWidth: 1 };
    for (var k in extra) o[k] = extra[k];
    return o;
  }
  function roughD(drawable) {                       // rough.js drawable -> one path string
    return gen.toPaths(drawable).map(function (p) { return p.d; }).join(' ');
  }
  function ink(parent, d, weight, cls) {
    return el('path', { d: d, pathLength: 1, 'class': 'ink ' + (cls || ''), 'stroke-width': weight }, parent);
  }
  function drawIn(node, delay, dur) {
    if (REDUCED || !node.animate) return;
    node.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { delay: delay, duration: dur, easing: EASE, fill: 'backwards' });
  }
  function writeIn(node, delay, dur) {                // text labels: a clip that opens left to right
    if (REDUCED || !node.animate) return;
    node.animate([{ clipPath: 'inset(-6px 100% -6px -6px)' }, { clipPath: 'inset(-6px -6px -6px -6px)' }],
      { delay: delay, duration: dur, easing: EASE, fill: 'backwards' });
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function cancelAll(root) {
    if (root.getAnimations) root.getAnimations({ subtree: true }).forEach(function (a) { a.cancel(); });
  }

  /* ---------- hatching: parallel hairlines clipped to a rect (never a fill) ---------- */
  // angle: degrees counter-clockwise from horizontal (45 = "/", 135 = "\")
  function hatchSegments(r, angle, gap) {
    var th = angle * Math.PI / 180, dx = Math.cos(th), dy = -Math.sin(th), nx = -dy, ny = dx;
    var cs = [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1]];
    var lo = Infinity, hi = -Infinity;
    cs.forEach(function (c) { var p = c[0] * nx + c[1] * ny; lo = Math.min(lo, p); hi = Math.max(hi, p); });
    var out = [];
    for (var c = lo + gap / 2; c < hi; c += gap) {
      var px = nx * c, py = ny * c, t0 = -1e9, t1 = 1e9, ok = true;
      [[-dx, px - r.x0], [dx, r.x1 - px], [-dy, py - r.y0], [dy, r.y1 - py]].forEach(function (s) {
        // clip px + t*dx >= x0 etc. (Liang-Barsky on the line direction)
        var p = s[0], q = s[1];
        if (Math.abs(p) < 1e-9) { if (q < 0) ok = false; return; }
        var t = q / p;
        if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
      });
      if (ok && t1 - t0 > 0.5) out.push([px + dx * t0, py + dy * t0, px + dx * t1, py + dy * t1]);
    }
    return out;
  }
  function hatch(parent, rect, angle, gap, weight, seed) {
    var g = el('g', { 'class': 'hatch' }, parent);
    hatchSegments(rect, angle, gap).forEach(function (s, i) {
      ink(g, 'M' + s[0].toFixed(1) + ' ' + s[1].toFixed(1) + 'L' + s[2].toFixed(1) + ' ' + s[3].toFixed(1), weight, 'h');
    });
    return g;
  }
  function stipple(parent, rect, gap, seed) {
    var rnd = mulberry32(seed), g = el('g', { 'class': 'hatch' }, parent);
    for (var y = rect.y0 + gap / 2; y < rect.y1; y += gap)
      for (var x = rect.x0 + gap / 2 + ((Math.round((y - rect.y0) / gap) % 2) ? gap / 2 : 0); x < rect.x1; x += gap) {
        var jx = (rnd() - .5) * 1.4, jy = (rnd() - .5) * 1.4;
        el('circle', { cx: (x + jx).toFixed(1), cy: (y + jy).toFixed(1), r: 0.7, 'class': 'dot' }, g);
      }
    return g;
  }

  /* ---------- tag shapes: one per data layer ---------- */
  var LAYERS = {
    source:   { name: 'NetSuite source', shape: 'rect',  weight: 0.8, hatch: 0,   rank: 1, word: 'rectangle' },
    warehouse:{ name: 'Warehouse',       shape: 'punch', weight: 1.6, hatch: 45,  rank: 2, word: 'punched tag' },
    semantic: { name: 'Semantic model',  shape: 'pill',  weight: 1.1, hatch: 135, rank: 3, word: 'pill' },
    derived:  { name: 'Derived',         shape: 'hex',   weight: 0.6, hatch: -1,  rank: 4, word: 'double hexagon' }
  };
  // returns { g, shape (clean outline d), hole }
  function shapeGeometry(shape, x, y, w, h) {
    var d, c;
    if (shape === 'rect') d = 'M' + x + ' ' + y + 'H' + (x + w) + 'V' + (y + h) + 'H' + x + 'Z';
    else if (shape === 'punch') { c = 8; d = 'M' + (x + c) + ' ' + y + 'H' + (x + w) + 'V' + (y + h) + 'H' + (x + c) + 'L' + x + ' ' + (y + h - c) + 'V' + (y + c) + 'Z'; }
    else if (shape === 'pill') { var r = h / 2; d = 'M' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + w - r) + ' ' + (y + h) + 'H' + (x + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + y + 'Z'; }
    else { c = h * 0.42; d = 'M' + (x + c) + ' ' + y + 'H' + (x + w - c) + 'L' + (x + w) + ' ' + (y + h / 2) + 'L' + (x + w - c) + ' ' + (y + h) + 'H' + (x + c) + 'L' + x + ' ' + (y + h / 2) + 'Z'; }
    return d;
  }
  /* A tag: paper, outline (rough, fixed seed), hatch band along the bottom edge, label.
     opts: layer, label, labelFont ('mono'|'serif'|'serifi'), seed, weight */
  function tag(parent, x, y, w, h, o) {
    var L = LAYERS[o.layer], id = 'c' + (++uid), seed = o.seed || 1;
    var g = el('g', { 'class': 'tag layer-' + o.layer + (o.cls ? ' ' + o.cls : ''), 'data-id': o.id || '' }, parent);
    var d = shapeGeometry(L.shape, x, y, w, h);
    var clip = el('clipPath', { id: id }, g); el('path', { d: d }, clip);
    el('path', { d: d, 'class': 'paper' }, g);
    var band = { x0: x + 1, x1: x + w - 1, y0: y + h - 8, y1: y + h - 1 };
    var hg = el('g', { 'clip-path': 'url(#' + id + ')' }, g);
    if (L.hatch >= 0) hatch(hg, band, L.hatch, 3.6, 0.6, seed); else stipple(hg, band, 3.4, seed);
    var wt = o.weight || L.weight;
    var od;
    if (L.shape === 'rect') od = roughD(gen.rectangle(x, y, w, h, R(seed)));
    else od = roughD(gen.path(d, R(seed)));
    ink(g, od, wt, 'outline');
    if (L.shape === 'hex') {                             // second hairline, inset: the derived layer's double outline
      var ins = 3, d2 = shapeGeometry('hex', x + ins, y + ins, w - 2 * ins, h - 2 * ins);
      ink(g, roughD(gen.path(d2, R(seed + 7))), 0.6, 'outline2');
    }
    if (L.shape === 'punch') {
      el('circle', { cx: x + 12, cy: y + h / 2 - 1, r: 2.4, 'class': 'hole' }, g);
    }
    var tx = L.shape === 'punch' ? x + 24 : (L.shape === 'pill' || L.shape === 'hex') ? x + w / 2 : x + 10;
    var anchor = (L.shape === 'pill' || L.shape === 'hex') ? 'middle' : 'start';
    var t = el('text', { x: tx, y: y + h / 2 - (L.hatch === 0 || L.hatch === 45 || L.hatch === 135 || L.hatch < 0 ? 1.5 : 0) + 4, 'text-anchor': anchor, 'class': 'lbl ' + (o.labelFont || 'mono') }, g);
    t.textContent = o.label;
    g._parts = { outlines: g.querySelectorAll('.outline,.outline2'), hatch: g.querySelectorAll('.h'), label: t, dots: g.querySelectorAll('.dot'), hole: g.querySelector('.hole'), paper: g.querySelector('.paper') };
    return g;
  }
  // draw a tag in (outline first, then the hatch band, then the label); returns end time
  function playTag(g, t0) {
    var p = g._parts, i;
    for (i = 0; i < p.outlines.length; i++) drawIn(p.outlines[i], t0 + i * 120, 520);
    for (i = 0; i < p.hatch.length; i++) drawIn(p.hatch[i], t0 + 420 + i * 26, 200);
    for (i = 0; i < p.dots.length; i++) if (!REDUCED && p.dots[i].animate) p.dots[i].animate([{ opacity: 0 }, { opacity: 1 }], { delay: t0 + 420 + i * 14, duration: 90, fill: 'backwards' });
    if (!REDUCED && p.paper.animate) p.paper.animate([{ opacity: 0 }, { opacity: 1 }], { delay: t0, duration: 240, fill: 'backwards' });
    writeIn(p.label, t0 + 180, 460);
    if (p.hole && !REDUCED && p.hole.animate) p.hole.animate([{ opacity: 0 }, { opacity: 1 }], { delay: t0 + 380, duration: 120, fill: 'backwards' });
    return t0 + 720;
  }

  /* ---------- figure 1: the sewn star schema ---------- */
  var ADV = 7.9;                                         // 11px mono (0.6em) + 0.12em tracking
  function schemaFigure(host, vid) {
    var TAGS = [
      { id: 'fact', label: 'DW_NS_SALES_ORDER_LINES_F', fact: true },
      { id: 'cust', label: 'CUSTOMER_D', pos: 'tl' },
      { id: 'item', label: 'ITEM_D', pos: 'tr' },
      { id: 'day',  label: 'DAY_D', pos: 'bl' },
      { id: 'sub',  label: 'SUBSIDIARY_D', pos: 'br' }
    ];
    var svg, drawn = false, focusId = null, threads = {}, tagEls = {}, timer = 0, maskN = 0;
    var api = { play: play, reset: reset, replay: function () { reset(); requestAnimationFrame(play); }, destroy: destroy };

    function build() {
      host.textContent = '';
      var w = Math.max(280, host.clientWidth), h = Math.round(Math.min(360, Math.max(300, w * 0.7)));
      svg = el('svg', { 'class': 'fig schema', width: w, height: h, viewBox: '0 0 ' + w + ' ' + h, role: 'img',
        'aria-label': 'Star schema: the fact table DW_NS_SALES_ORDER_LINES_F joined to CUSTOMER_D, ITEM_D, DAY_D and SUBSIDIARY_D. Illustration.' }, host);
      var fy = h / 2, fx = w / 2, FH = 40, DH = 30, rowT = Math.round(h * 0.15), rowB = Math.round(h * 0.85);
      var geo = {};
      TAGS.forEach(function (t) {
        var tw = Math.round(t.label.length * ADV + 36);
        t.w = tw; t.h = t.fact ? FH : DH;
        if (t.fact) { t.cx = fx; t.cy = fy; }
        else {
          var inset = Math.max(tw / 2 + 10, w * 0.23);
          t.cx = (t.pos === 'tl' || t.pos === 'bl') ? inset : w - inset;
          t.cy = (t.pos === 'tl' || t.pos === 'tr') ? rowT : rowB;
        }
        t.x = Math.round(t.cx - tw / 2); t.y = Math.round(t.cy - t.h / 2);
      });
      var F = TAGS[0];
      // threads first (under the tags)
      var tg = el('g', { 'class': 'threads' }, svg);
      var mdefs = el('defs', {}, svg);
      TAGS.slice(1).forEach(function (t, i) {
        var up = t.pos === 'tl' || t.pos === 'tr', left = t.pos === 'tl' || t.pos === 'bl';
        var ax = F.cx + (left ? -1 : 1) * F.w * 0.2, ay = F.cy + (up ? -FH / 2 : FH / 2);
        var bx = t.cx + (left ? 1 : -1) * t.w * 0.16, by = t.cy + (up ? DH / 2 : -DH / 2);
        var mx = (ax + bx) / 2, my = (ay + by) / 2, dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
        var bow = (left ? -1 : 1) * (up ? 1 : -1) * 9;
        var cx = mx + (-dy / L) * bow, cy = my + (dx / L) * bow;
        var d = 'M' + ax.toFixed(1) + ' ' + ay.toFixed(1) + 'Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + bx.toFixed(1) + ' ' + by.toFixed(1);
        var mid = 'm' + vid + (++maskN);
        var mk = el('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: w, height: h }, mdefs);
        var rv = el('path', { d: d, pathLength: 1, 'class': 'reveal' }, mk);
        var th = el('g', { 'class': 'thread-g', 'data-id': t.id }, tg);
        var p = el('path', { d: d, 'class': 'thread', mask: 'url(#' + mid + ')' }, th);
        var k1 = el('circle', { cx: ax, cy: ay, r: 2.3, 'class': 'knot' }, th), k2 = el('circle', { cx: bx, cy: by, r: 2.3, 'class': 'knot' }, th);
        var len = p.getTotalLength(), n = Math.max(4, Math.round(len / 9.5));
        threads[t.id] = { g: th, p: p, rv: rv, k1: k1, k2: k2, n: n, len: len };
        t.thread = threads[t.id];
      });
      // callout (a): leader + italic letter, between the two upper threads
      var cg = el('g', { 'class': 'callout' }, svg);
      var cy0 = F.y - 5, cy1 = rowT + 6;
      ink(cg, 'M' + fx + ' ' + cy0 + 'L' + fx + ' ' + (cy1 + 18), 0.6, 'leader');
      var ct = el('text', { x: fx, y: cy1 + 10, 'text-anchor': 'middle', 'class': 'note-t' }, cg);
      var C1 = TAGS[1], c1r = Math.max(C1.w / 2 + 10, w * 0.23) + C1.w / 2;
      ct.textContent = (fx - 44 > c1r + 4) ? '(a) the grain' : '(a)';   // the phrase only when it clears the upper tags
      // tags
      var gg = el('g', { 'class': 'tags' }, svg);
      TAGS.forEach(function (t, i) {
        var g = tag(gg, t.x, t.y, t.w, t.h, { layer: 'warehouse', label: t.label, seed: 11 + i * 5, id: t.id, cls: t.fact ? 'fact' : '' });
        g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', t.label);
        el('rect', { x: t.x - 6, y: t.y - 6, width: t.w + 12, height: t.h + 12, fill: 'transparent', 'class': 'hit' }, g);
        g.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') setFocus(t.id); });
        g.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') setFocus(null); });
        g.addEventListener('focus', function () { setFocus(t.id); });
        g.addEventListener('blur', function () { setFocus(null); });
        g.addEventListener('click', function () { setFocus(focusId === t.id && !t.fact ? null : t.id); });
        tagEls[t.id] = g;
      });
      svg.classList.add('undrawn');
      setFocus(null);
      if (drawn) svg.classList.remove('undrawn');
    }
    function setFocus(id) {
      focusId = id;
      var eff = id || 'fact';                           // at rest the fact table is the one accent
      TAGS.forEach(function (t) {
        var g = tagEls[t.id]; if (!g) return;
        var on = t.id === eff, lit = id && (on || t.id === 'fact' && id !== 'fact');
        if (id === 'fact') lit = true;
        g.classList.toggle('is-on', on);
        g.classList.toggle('is-lit', !!lit && !on);
        g.classList.toggle('is-dim', !!id && !on && !lit);
        if (t.thread) {
          var tOn = id && id !== 'fact' && t.id === id;
          t.thread.g.classList.toggle('is-on', !!tOn);
          t.thread.g.classList.toggle('is-dim', !!id && id !== 'fact' && !tOn);
          if (id === 'fact') t.thread.g.classList.remove('is-dim');
        }
      });
      svg.classList.toggle('has-focus', !!id);
    }
    function play() {
      if (!svg) return;
      drawn = true;
      svg.classList.remove('undrawn');
      if (REDUCED) return;
      var t = playTag(tagEls.fact, 0);
      TAGS.slice(1).forEach(function (tg, i) {
        var T = tg.thread, start = t - 60 + i * 520, dur = 560;
        T.rv.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { delay: start, duration: dur, easing: 'steps(' + T.n + ', end)', fill: 'backwards' });
        [T.k1].forEach(function (k) { k.animate([{ opacity: 0 }, { opacity: 1 }], { delay: start, duration: 80, fill: 'backwards' }); });
        T.k2.animate([{ opacity: 0 }, { opacity: 1 }], { delay: start + dur, duration: 80, fill: 'backwards' });
        playTag(tagEls[tg.id], start + dur - 140);
      });
      var end = t - 60 + 3 * 520 + 560 + 600;
      var ca = svg.querySelector('.callout');
      drawIn(ca.querySelector('.leader'), end, 380);
      writeIn(ca.querySelector('.note-t'), end + 120, 420);
    }
    function reset() { cancelAll(svg); drawn = false; svg.classList.add('undrawn'); }
    function destroy() { host.textContent = ''; }
    var ro = new ResizeObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(function () { var was = drawn; build(); if (was) svg.classList.remove('undrawn'); }, 120);
    });
    build();
    var lastW = host.clientWidth;
    ro.observe(host);
    api.el = host;
    return api;
  }

  /* ---------- figure 2: hatching sample (the four layer patterns) ---------- */
  function hatchFigure(host, vid) {
    var svg, drawn = false;
    function build() {
      host.textContent = '';
      var w = Math.max(280, host.clientWidth), h = 112;
      svg = el('svg', { 'class': 'fig hatching', width: w, height: h, viewBox: '0 0 ' + w + ' ' + h, role: 'img', 'aria-label': 'Four hatch patterns, never solid fills: horizontal, 45 degrees, 135 degrees, stipple.' }, host);
      var items = [['SOURCE', 0], ['WAREHOUSE', 45], ['SEMANTIC', 135], ['DERIVED', -1]];
      var gap = 10, pw = Math.floor((w - gap * 3) / 4), ph = 64;
      svg._items = [];
      items.forEach(function (it, i) {
        var x = i * (pw + gap), y = 6, id = 'hc' + (++uid);
        var g = el('g', { 'class': 'patch' }, svg);
        var cp = el('clipPath', { id: id }, g); el('rect', { x: x, y: y, width: pw, height: ph }, cp);
        var hg = el('g', { 'clip-path': 'url(#' + id + ')' }, g);
        var rect = { x0: x, y0: y, x1: x + pw, y1: y + ph };
        if (it[1] >= 0) hatch(hg, rect, it[1], 5, 0.6, 3); else stipple(hg, rect, 5, 5);
        ink(g, roughD(gen.rectangle(x, y, pw, ph, R(21 + i * 3))), 1.1, 'outline');
        var t1 = el('text', { x: x, y: y + ph + 16, 'class': 'cap mono' }, g); t1.textContent = it[1] >= 0 ? it[1] + ' DEG' : 'STIPPLE';
        var t2 = el('text', { x: x, y: y + ph + 29, 'class': 'cap2 mono' }, g); t2.textContent = it[0];
        svg._items.push(g);
      });
      svg.classList.add('undrawn');
      if (drawn) svg.classList.remove('undrawn');
    }
    function play() {
      drawn = true; svg.classList.remove('undrawn');
      if (REDUCED) return;
      svg._items.forEach(function (g, i) {
        var t0 = i * 260;
        drawIn(g.querySelector('.outline'), t0, 420);
        g.querySelectorAll('.h').forEach(function (p, k) { drawIn(p, t0 + 300 + k * 22, 220); });
        g.querySelectorAll('.dot').forEach(function (p, k) { p.animate([{ opacity: 0 }, { opacity: 1 }], { delay: t0 + 300 + k * 6, duration: 80, fill: 'backwards' }); });
        g.querySelectorAll('text').forEach(function (tx) { writeIn(tx, t0 + 360, 380); });
      });
    }
    function reset() { cancelAll(svg); drawn = false; svg.classList.add('undrawn'); }
    build();
    var timer;
    new ResizeObserver(function () { clearTimeout(timer); timer = setTimeout(function () { var was = drawn; build(); if (was) svg.classList.remove('undrawn'); }, 120); }).observe(host);
    return { play: play, reset: reset, replay: function () { reset(); requestAnimationFrame(play); }, el: host };
  }

  /* ---------- figure 3: isometric wireframe slab (one warehouse layer) ---------- */
  function slabFigure(host) {
    var svg, drawn = false;
    function build() {
      host.textContent = '';
      var W = 200, H = 186;
      svg = el('svg', { 'class': 'fig slab', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Isometric wireframe slab: one warehouse layer, with a pencil ghost of the layer above. Illustration.' }, host);
      // 2:1 diamond: top (x,y) right (x+hw, y+hh) bottom (x, y+2hh) left (x-hw, y+hh); thickness T
      var cx = 100, top = 64, hw = 78, hh = 39, T = 15;
      var P = { t: [cx, top], r: [cx + hw, top + hh], b: [cx, top + 2 * hh], l: [cx - hw, top + hh] };
      var pt = function (a, dy) { return a[0].toFixed(1) + ' ' + (a[1] + (dy || 0)).toFixed(1); };
      // pencil ghost: the layer above (illustrative), 30px up
      var gh = el('g', { 'class': 'pencil-g' }, svg);
      var up = -34, gd = 'M' + pt(P.t, up) + 'L' + pt(P.r, up) + 'L' + pt(P.b, up) + 'L' + pt(P.l, up) + 'Z';
      ink(gh, roughD(gen.path(gd, R(61, { roughness: 0.9, bowing: 0.6 }))), 1.1, 'pencil');
      [P.l, P.r, P.b].forEach(function (a, i) { ink(gh, 'M' + pt(a, up + 4) + 'L' + pt(a, -4), 1.1, 'pencil guide'); });
      // top face grid (hairline)
      var grid = el('g', { 'class': 'grid' }, svg), N = 4;
      for (var i = 1; i < N; i++) {
        var f = i / N;
        var a1 = [P.t[0] + (P.r[0] - P.t[0]) * f, P.t[1] + (P.r[1] - P.t[1]) * f], a2 = [P.l[0] + (P.b[0] - P.l[0]) * f, P.l[1] + (P.b[1] - P.l[1]) * f];
        var b1 = [P.t[0] + (P.l[0] - P.t[0]) * f, P.t[1] + (P.l[1] - P.t[1]) * f], b2 = [P.r[0] + (P.b[0] - P.r[0]) * f, P.r[1] + (P.b[1] - P.r[1]) * f];
        ink(grid, 'M' + pt(a1) + 'L' + pt(a2), 0.6, 'g');
        ink(grid, 'M' + pt(b1) + 'L' + pt(b2), 0.6, 'g');
      }
      // left face: hatch (the shadow side), clipped to the parallelogram
      var cid = 'sl' + (++uid);
      var cp = el('clipPath', { id: cid }, svg);
      el('path', { d: 'M' + pt(P.l) + 'L' + pt(P.b) + 'L' + pt(P.b, T) + 'L' + pt(P.l, T) + 'Z' }, cp);
      var hg = el('g', { 'clip-path': 'url(#' + cid + ')', 'class': 'side' }, svg);
      hatch(hg, { x0: P.l[0], x1: P.b[0], y0: P.l[1], y1: P.b[1] + T }, 45, 3.6, 0.6, 1);
      // edges: silhouette 1.6 (the one emphasis), visible inner edges 1.1
      var edges = el('g', { 'class': 'edges' }, svg);
      var sil = 'M' + pt(P.t) + 'L' + pt(P.r) + 'L' + pt(P.r, T) + 'L' + pt(P.b, T) + 'L' + pt(P.l, T) + 'L' + pt(P.l) + 'Z';
      ink(edges, roughD(gen.path(sil, R(71))), 1.6, 'sil');
      ink(edges, roughD(gen.path('M' + pt(P.l) + 'L' + pt(P.b) + 'L' + pt(P.r), R(72))), 1.1, 'inner');
      ink(edges, roughD(gen.path('M' + pt(P.b) + 'L' + pt(P.b, T), R(73))), 1.1, 'inner');
      var lab = el('text', { x: cx, y: H - 4, 'text-anchor': 'middle', 'class': 'cap mono' }, svg);
      lab.textContent = 'LAYER 02 / WAREHOUSE';
      svg._lab = lab;
      svg.classList.add('undrawn');
      if (drawn) svg.classList.remove('undrawn');
    }
    function play() {
      drawn = true; svg.classList.remove('undrawn');
      if (REDUCED) return;
      var q = svg.querySelectorAll.bind(svg);
      q('.sil').forEach(function (p) { drawIn(p, 0, 900); });
      q('.inner').forEach(function (p, i) { drawIn(p, 500 + i * 120, 500); });
      q('.g').forEach(function (p, i) { drawIn(p, 800 + i * 90, 380); });
      q('.side .h').forEach(function (p, i) { drawIn(p, 1300 + i * 24, 220); });
      q('.pencil').forEach(function (p, i) { drawIn(p, 1900 + i * 160, 600); });
      writeIn(svg._lab, 2200, 500);
    }
    function reset() { cancelAll(svg); drawn = false; svg.classList.add('undrawn'); }
    build();
    return { play: play, reset: reset, replay: function () { reset(); requestAnimationFrame(play); }, el: host };
  }

  /* ---------- figure 4: provenance legend samples ---------- */
  function legendFigure(host) {
    var rows = [
      ['solid', 'EXPLICIT', 'in the data. A solid ink line.'],
      ['thread', 'INFERRED', 'by a rule. A stitched thread.'],
      ['pencil', 'ILLUSTRATIVE', 'a sketch, not data. Pencil.']
    ];
    var drawn = false, svgs = [];
    host.textContent = '';
    rows.forEach(function (r, i) {
      var li = document.createElement('div'); li.className = 'lg-row'; host.appendChild(li);
      var s = el('svg', { 'class': 'fig lg', width: 84, height: 22, viewBox: '0 0 84 22', 'aria-hidden': 'true' }, li);
      var d = 'M4 11H80';
      if (r[0] === 'solid') ink(s, roughD(gen.path(d, R(31))), 1.1, 'line');
      else if (r[0] === 'thread') {
        var mid = 'lgm' + (++uid), mk = el('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 84, height: 22 }, s);
        var rv = el('path', { d: d, pathLength: 1, 'class': 'reveal' }, mk);
        var p = el('path', { d: 'M4 11Q42 15 80 11', 'class': 'thread', mask: 'url(#' + mid + ')' }, s);
        mk.firstChild.setAttribute('d', 'M4 11Q42 15 80 11');
        el('circle', { cx: 4, cy: 11, r: 2.3, 'class': 'knot' }, s); el('circle', { cx: 80, cy: 11, r: 2.3, 'class': 'knot' }, s);
        s._rv = rv;
      } else {
        ink(s, roughD(gen.path(d, R(41, { roughness: 0.9, bowing: 0.6 }))), 1.5, 'pencil');
        ink(s, roughD(gen.path('M5 12H79', R(43, { roughness: 0.9 }))), 1.1, 'pencil');
      }
      var tx = document.createElement('div'); tx.className = 'lg-txt';
      tx.innerHTML = '<span class="mono lab">' + r[1] + '</span><span class="serif">' + r[2] + '</span>';
      li.appendChild(tx);
      svgs.push(s);
    });
    host.classList.add('undrawn');
    function play() {
      drawn = true; host.classList.remove('undrawn');
      if (REDUCED) return;
      svgs.forEach(function (s, i) {
        var t0 = i * 450;
        s.querySelectorAll('.ink').forEach(function (p, k) { drawIn(p, t0 + k * 80, 480); });
        if (s._rv) s._rv.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { delay: t0, duration: 520, easing: 'steps(8, end)', fill: 'backwards' });
        s.querySelectorAll('.knot').forEach(function (k, n) { k.animate([{ opacity: 0 }, { opacity: 1 }], { delay: t0 + n * 500, duration: 80, fill: 'backwards' }); });
        var txt = host.children[i].querySelector('.lg-txt');
        txt.animate([{ opacity: 0 }, { opacity: 1 }], { delay: t0 + 200, duration: 320, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'backwards' });
      });
    }
    function reset() { cancelAll(host); drawn = false; host.classList.add('undrawn'); }
    return { play: play, reset: reset, replay: function () { reset(); requestAnimationFrame(play); }, el: host };
  }

  /* ---------- figure 5: four layers without four colours ---------- */
  function layersFigure(host) {
    var rows = [
      { layer: 'source',    label: 'salesOrder',    font: 'mono',   w: 108 },
      { layer: 'warehouse', label: 'SALES_ORDER_F', font: 'mono',   w: 134 },
      { layer: 'semantic',  label: 'Order Date',    font: 'serif',  w: 104 },
      { layer: 'derived',   label: 'Days Open',     font: 'serifi', w: 104 }
    ];
    var drawn = false, items = [];
    host.textContent = '';
    rows.forEach(function (r, i) {
      var L = LAYERS[r.layer], row = document.createElement('div'); row.className = 'ly-row'; host.appendChild(row);
      var rank = document.createElement('span'); rank.className = 'rank mono'; rank.textContent = L.rank; row.appendChild(rank);
      var s = el('svg', { 'class': 'fig ly', width: 140, height: 42, viewBox: '0 0 140 42', 'aria-hidden': 'true' }, row);
      var g = tag(s, 3, 5, r.w, 32, { layer: r.layer, label: r.label, labelFont: r.font, seed: 90 + i * 4 });
      var txt = document.createElement('div'); txt.className = 'ly-txt';
      txt.innerHTML = '<span class="mono lab">' + L.name + '</span><span class="mono spec">' + L.word + ' / ' + L.weight + ' / ' + (L.hatch >= 0 ? L.hatch + ' deg' : 'stipple') + '</span>';
      row.appendChild(txt);
      items.push({ g: g, row: row, txt: txt, rank: rank });
    });
    host.classList.add('undrawn');
    function play() {
      drawn = true; host.classList.remove('undrawn');
      if (REDUCED) return;
      items.forEach(function (it, i) {
        var t0 = i * 420;
        playTag(it.g, t0);
        [it.rank, it.txt].forEach(function (n) { n.animate([{ opacity: 0 }, { opacity: 1 }], { delay: t0 + 160, duration: 320, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'backwards' }); });
      });
    }
    function reset() { cancelAll(host); drawn = false; host.classList.add('undrawn'); }
    return { play: play, reset: reset, replay: function () { reset(); requestAnimationFrame(play); }, el: host };
  }

  /* ---------- the margin note, written ---------- */
  function noteFigure(host, seed) {
    var handle = null, pending = false, wanted = false;
    var lines = ['the grain of the sale:', 'one line, one row'];
    function make() {
      if (!window.WrittenInk) { host.textContent = lines.join(' '); host.classList.add('plain'); return; }
      window.WrittenInk.ready.then(function () {
        host.textContent = '';
        handle = window.WrittenInk.writeText(host, lines, { seed: seed, tilt: 1.2, reduced: REDUCED });
        if (wanted) handle.play(300);
        else handle.clear();
      });
    }
    make();
    return {
      play: function () { wanted = true; if (handle) { handle.clear(); handle.play(300); } },
      reset: function () { wanted = false; if (handle) handle.clear(); },
      replay: function () { if (handle) { handle.clear(); wanted = true; handle.play(250); } else wanted = true; },
      finish: function () { if (handle) handle.finish(); },
      el: host
    };
  }

  /* ---------- the text blocks: one light fade ---------- */
  function fadeFigure(host) {
    return {
      play: function () { if (!REDUCED && host.animate) host.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'backwards' }); },
      reset: function () { cancelAll(host); }, replay: function () { this.reset(); this.play(); }, el: host
    };
  }

  /* ---------- the variants ---------- */
  var VARIANTS = [
    { id: 'a', name: 'Manual', tag: 'warm parchment / near-black ink / vermilion', serif: 'Source Serif 4' },
    { id: 'b', name: 'Ledger', tag: 'cool ivory / blue-black ink / ochre', serif: 'Newsreader' },
    { id: 'c', name: 'Proof',  tag: 'off-white / deep ocean ink / amber', serif: 'Georgia' }
  ];
  function cardHTML(v) {
    return '' +
      '<header class="vhead"><span class="mono lab">VARIANT ' + v.id.toUpperCase() + '</span>' +
      '<h2 class="vname">' + v.name + '</h2><span class="mono sub">' + v.tag + '</span></header>' +
      '<div class="chapter" data-f="text">' +
      '<div class="mono labelrow"><span>CH. 03</span><i></i><span>FACT TABLES</span><i></i><span>DW_NS_SALES_ORDER_LINES_F</span><i></i><span>GRAIN 1 LINE</span></div>' +
      '<h3 class="title">The Grain of the Sale</h3>' +
      '<p class="body">A warehouse keeps what happened as <em>facts</em> and the who, what and when as <em>dimensions</em>. Every row of the fact table <span class="callout">(a)</span> is one order line. That is its grain: everything joined to it has to agree on it.</p>' +
      '<p class="call"><span class="callout">(a)</span> the grain: one row per order line</p>' +
      '<div class="note" data-f="note"></div></div>' +
      '<section class="blk"><h4 class="mono h">FIG. 1 / A STAR SCHEMA, SEWN <span class="ill">illustration</span></h4><div class="figbox schema-box" data-f="schema"></div>' +
      '<div class="mono cap-row">hover a tag: its thread lights</div></section>' +
      '<section class="blk"><h4 class="mono h">FIG. 2 / HATCHING <span class="ill">never a solid fill</span></h4><div class="figbox" data-f="hatch"></div></section>' +
      '<div class="pair"><section class="blk"><h4 class="mono h">FIG. 3 / ONE LAYER</h4><div class="figbox slab-box" data-f="slab"></div></section>' +
      '<section class="blk"><h4 class="mono h">PROVENANCE: HOW A LINE WAS DRAWN</h4><div class="legend" data-f="legend"></div></section></div>' +
      '<section class="blk"><h4 class="mono h">FOUR LAYERS, ONE COLOUR</h4><div class="layers" data-f="layers"></div>' +
      '<p class="mono cap-row">rank 1 to 4 reads left to right, bottom to top. shape / weight / hatch</p></section>' +
      '<footer class="mats mono" data-mats></footer>';
  }
  var cards = [];
  function buildAll() {
    var root = document.getElementById('variants');
    var els = VARIANTS.map(function (v) {                  // all sheets first, so every figure measures its final width
      var card = document.createElement('article'); card.className = 'v'; card.dataset.v = v.id; card.id = 'v-' + v.id;
      card.innerHTML = cardHTML(v); root.appendChild(card);   // security-nudge:ignore (static template, no user input)
      return card;
    });
    VARIANTS.forEach(function (v, vi) {
      var card = els[vi];
      var f = function (n) { return card.querySelector('[data-f=' + n + ']'); };
      var figs = {
        text: fadeFigure(f('text').querySelector('.title')),
        note: noteFigure(f('note'), v.id.charCodeAt(0)),
        schema: schemaFigure(f('schema'), v.id),
        hatch: hatchFigure(f('hatch'), v.id),
        slab: slabFigure(f('slab')),
        legend: legendFigure(f('legend')),
        layers: layersFigure(f('layers'))
      };
      var order = ['text', 'note', 'schema', 'hatch', 'slab', 'legend', 'layers'];
      // each figure draws in when it comes on screen
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.intersectionRatio >= 0.35 && !e.target._played) { e.target._played = true; e.target._fig.play(); }
        });
      }, { threshold: [0.35] });
      order.forEach(function (k) {
        var target = k === 'text' ? f('text') : figs[k].el; target._fig = figs[k];
        if (k === 'note') target = f('note');
        target._fig = figs[k]; io.observe(target);
      });
      var mats = card.querySelector('[data-mats]');
      cards.push({ v: v, card: card, figs: figs, order: order, io: io, mats: mats });
    });
    document.getElementById('replay').addEventListener('click', replayAll);
  }
  function replayAll() {
    cards.forEach(function (c) { c.order.forEach(function (k) { c.figs[k].reset(); }); });
    requestAnimationFrame(function () {
      cards.forEach(function (c) { c.order.forEach(function (k) { c.figs[k].play(); }); });
    });
  }
  function setReduced(on) {
    REDUCED = !!on;
    document.documentElement.classList.toggle('is-reduced', REDUCED);
    if (REDUCED) cards.forEach(function (c) { c.order.forEach(function (k) { var f = c.figs[k]; f.reset(); f.play(); if (f.finish) f.finish(); }); });
  }
  function fillMats() {
    cards.forEach(function (c) {
      var cs = getComputedStyle(c.card), g = function (n) { return cs.getPropertyValue(n).trim(); };
      var sw = function (n, v) { return '<span class="sw"><i style="--c:' + v + '"></i>' + n + ' ' + v.toUpperCase() + '</span>'; };
      c.mats.innerHTML = sw('PAPER', g('--paper')) + sw('INK', g('--ink')) + sw('INK-2', g('--ink-2')) + sw('PENCIL', g('--pencil')) + sw('ACCENT', g('--accent')) +
        '<span class="sw">FACES ' + c.v.serif.toUpperCase() + ' / JETBRAINS MONO / CAVEAT</span>';
    });
  }
  window.IDENTITY = { setReduced: setReduced, replayAll: replayAll, fillMats: fillMats, cards: cards, isReduced: function () { return REDUCED; } };

  /* ---------- page controls ---------- */
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    document.querySelectorAll('[data-theme-btn]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.themeBtn === t)); });
    fillMats();
  }
  document.addEventListener('DOMContentLoaded', function () {
    document.documentElement.classList.toggle('is-reduced', REDUCED);
    var t = Q.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = t;
    buildAll();
    setTheme(t);
    if (REDUCED) setReduced(true);          // reduced motion: every figure is finished at once, on screen or not
    document.querySelectorAll('[data-theme-btn]').forEach(function (b) { b.addEventListener('click', function () { setTheme(b.dataset.themeBtn); }); });
    var rm = document.getElementById('reduce');
    rm.checked = REDUCED;
    rm.addEventListener('change', function () { setReduced(rm.checked); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fillMats);
  });
})();
