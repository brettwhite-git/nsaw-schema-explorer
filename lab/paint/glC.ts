// Technique C: flat colour + ID masks drawn with canvas 2D, then a three-pass fragment-shader finish:
// (1) warp + pigment density + brush streaks, (2) Kuwahara, (3) edge darkening from IDs, wet bleed, granulation, paper-fibre lighting, ink.
import { Scene, Mat } from './kit';
import { Paper, PAPER_RGB, makePaper } from './paper';
import { hex } from './rng';

const MATID: Record<Mat, number> = { sky: 1, mist: 2, far: 3, rock: 4, snow: 5, pine: 6, wall: 7, roof: 8, glass: 9, trim: 10, glaze: 0, gold: 11, plum: 12, glow: 13, wood: 14, skin: 15, cloth: 16, metal: 17, box: 18, ribbon: 19, stone: 20, plant: 21 };
const lumOf = (c: string): number => { const h = hex(c); return (0.3 * h[0] + 0.59 * h[1] + 0.11 * h[2]) / 255; };
const PL = (0.3 * 240 + 0.59 * 227 + 0.11 * 200) / 255;

function cv(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!]; }

export function rasterise(scene: Scene, S: number): { flat: HTMLCanvasElement; aux: HTMLCanvasElement; ink: HTMLCanvasElement } {
  const W = Math.round(scene.w * S), H = Math.round(scene.h * S);
  const [flat, f] = cv(W, H), [aux, a] = cv(W, H), [ink, k] = cv(W, H);
  for (const c of [f, a, k]) c.scale(S, S);
  f.fillStyle = '#F0E3C8'; f.fillRect(0, 0, scene.w, scene.h);
  a.fillStyle = '#000'; a.fillRect(0, 0, scene.w, scene.h);
  let oid = 0;
  const path = (c: CanvasRenderingContext2D, p: number[]): void => { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); };
  for (const it of scene.items) {
    if (it.k === 'poly') {
      oid++;
      if (it.grad) {
        const g = f.createLinearGradient(0, 0, 0, 470); scene.skyStops.forEach(([o, c]) => g.addColorStop(o, c)); f.fillStyle = g;
      } else f.fillStyle = it.fill;
      if (it.mat === 'glaze' || it.mat === 'mist') { f.globalCompositeOperation = 'multiply'; f.globalAlpha = (it.alpha ?? 1) * (it.mat === 'mist' ? 0.5 : 1); }
      path(f, it.pts); f.fill(); f.globalAlpha = 1; f.globalCompositeOperation = 'source-over';
      if (it.mat !== 'glaze' && it.mat !== 'mist') {
        a.fillStyle = `rgb(${MATID[it.mat] * 11},${(oid * 53) % 251},${(it.lay * 17) % 255})`; path(a, it.pts); a.fill();
      }
      if (it.ink) { k.strokeStyle = 'rgba(58,42,60,0.8)'; k.lineWidth = 0.5 + it.ink * 0.35; k.lineJoin = 'round'; path(k, it.pts); k.stroke(); }
    } else {
      const light = lumOf(it.col) > PL * 0.93;
      const c = light ? f : k; c.strokeStyle = light ? it.col : `rgba(${hex(it.col).join(',')},${it.a})`; c.globalAlpha = light ? it.a : 1; c.lineWidth = it.w; c.lineCap = 'round';
      c.beginPath(); c.moveTo(it.pts[0], it.pts[1]); for (let i = 2; i < it.pts.length; i += 2) c.lineTo(it.pts[i], it.pts[i + 1]); c.stroke(); c.globalAlpha = 1;
    }
  }
  return { flat, aux, ink };
}

const VS = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;
const COMMON = `precision highp float; varying vec2 vUv; uniform vec2 uRes; uniform float uS; uniform float uSeed; uniform float uWarp; uniform float uKuw; uniform float uDens; uniform float uFade;
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+7.1; a*=.5; } return s/.9375; }
vec2 lpx(){ return vec2(vUv.x*uRes.x, (1.-vUv.y)*uRes.y)/uS; }
const vec3 PAPER = vec3(${PAPER_RGB.map((v) => (v / 255).toFixed(4)).join(',')});`;

const P1 = `${COMMON}
uniform sampler2D uFlat, uAux;
void main(){
  vec2 px = lpx();
  vec2 w = vec2(fbm(px*.035+uSeed), fbm(px*.035+19.3+uSeed))-.5;
  vec2 w2 = vec2(vn(px*.4), vn(px*.4+7.1))-.5;
  vec2 q = px + (w*8. + w2*1.8)*uWarp;
  vec2 uv = vec2(q.x*uS/uRes.x, 1.-q.y*uS/uRes.y);
  vec3 col = texture2D(uFlat, uv).rgb; vec4 ax = texture2D(uAux, uv);
  float mat = floor(ax.r*255./11.+.5), oid = ax.g;
  vec3 t = col/PAPER;
  float dens = .72 + .56*fbm(q*.02 + oid*61.);
  float streak = 1.;
  if (mat==4.||mat==6.||mat==8.||mat==3.||mat==20.) { vec2 r = mat==4.? vec2(q.x*.5+q.y*.9, q.y*.5-q.x*.9) : mat==6. ? vec2(q.x*.8+q.y*.5, q.y*.8-q.x*.5) : q; streak = .78 + .44*vn(r*vec2(.9,.12)+oid*9.); }
  if (mat==1.) dens = .8 + .4*fbm(q*.006+uSeed);
  if (mat==5.) dens = .6 + .8*fbm(q*.03+oid*17.);
  t = 1. - (1.-t)*mix(1., dens*streak, uDens);
  gl_FragColor = vec4(t*PAPER, 1.);
}`;
const P2 = `${COMMON}
uniform sampler2D uIn;
void main(){
  vec2 st = vec2(1.)/uRes; vec2 uv = vUv; float R = 3.;
  vec3 m[4]; float s[4]; for(int k=0;k<4;k++){ m[k]=vec3(0.); s[k]=0.; }
  for(int j=-3;j<=3;j++) for(int i=-3;i<=3;i++){
    vec3 c = texture2D(uIn, uv+vec2(float(i),float(j))*st*uS*.8).rgb; float l=dot(c,vec3(.3,.59,.11));
    if(i<=0&&j<=0){ m[0]+=c; s[0]+=l*l; } if(i>=0&&j<=0){ m[1]+=c; s[1]+=l*l; }
    if(i<=0&&j>=0){ m[2]+=c; s[2]+=l*l; } if(i>=0&&j>=0){ m[3]+=c; s[3]+=l*l; }
  }
  if (uKuw < .5) { gl_FragColor = texture2D(uIn, uv); return; }
  float n = 16.; float best=1e9; vec3 outc=vec3(0.);
  for(int k=0;k<4;k++){ vec3 mm=m[k]/n; float v=abs(s[k]/n - dot(mm,vec3(.3,.59,.11))*dot(mm,vec3(.3,.59,.11))); if(v<best){best=v; outc=mm;} }
  gl_FragColor = vec4(outc,1.);
}`;
const P3 = `${COMMON}
uniform sampler2D uIn, uAux, uInk, uPaper;
vec2 flipy(vec2 u){ return u; }
void main(){
  vec2 px = lpx();
  vec2 w = vec2(fbm(px*.035+uSeed), fbm(px*.035+19.3+uSeed))-.5; vec2 w2 = vec2(vn(px*.4), vn(px*.4+7.1))-.5;
  vec2 q = px + (w*8. + w2*1.8)*uWarp; vec2 uvq = vec2(q.x*uS/uRes.x, 1.-q.y*uS/uRes.y);
  vec2 st = vec2(1.)/uRes*uS;
  vec4 a0 = texture2D(uAux, uvq);
  float mat = floor(a0.r*255./11.+.5);
  float wet = (mat==1.||mat==3.||mat==5.)? .8 : .12;
  // colour bleed across boundaries: wide gather weighted by wetness
  vec3 base = texture2D(uIn, vUv).rgb, acc = base; float ws = 1.;
  for(int i=0;i<12;i++){ float a=float(i)*.5236, r = 2.+mod(float(i),3.)*2.2; vec2 o=vec2(cos(a),sin(a))*r*st; acc += texture2D(uIn, vUv+o).rgb*wet; ws += wet; }
  vec3 col = mix(base, acc/ws, .65*wet);
  // edge darkening where object IDs change
  float e = 0.;
  for(int i=0;i<8;i++){ float a=float(i)*.7854; vec2 o=vec2(cos(a),sin(a))*1.6*st; vec4 an = texture2D(uAux, uvq+o); e += step(.012, abs(an.g-a0.g)+abs(an.r-a0.r)); }
  e /= 8.; col *= 1. - .30*e*(1.-wet*.6);
  // paper: base colour from the sheet, fibre bump lighting from fbm height
  vec4 pap = texture2D(uPaper, vUv);
  float hh = fbm(px*1.2)*.6 + vn(px*vec2(.7,.06)+3.)*.25 + vn(px*vec2(.06,.7)+9.)*.2;
  float hx = fbm((px+vec2(.7,0.))*1.2)*.6 + vn((px+vec2(.7,0.))*vec2(.7,.06)+3.)*.25 + vn((px+vec2(.7,0.))*vec2(.06,.7)+9.)*.2;
  float hy = fbm((px+vec2(0.,.7))*1.2)*.6 + vn((px+vec2(0.,.7))*vec2(.7,.06)+3.)*.25 + vn((px+vec2(0.,.7))*vec2(.06,.7)+9.)*.2;
  vec3 n = normalize(vec3(-(hx-hh)*3.2, -(hy-hh)*3.2, 1.));
  float lit = .9 + .22*dot(n, normalize(vec3(-.5,-.6,.65)));
  // granulation: pigment settles in valleys
  vec3 t = col/PAPER; float valley = 1.-hh;
  t = 1. - (1.-t)*(.78 + .55*valley);
  vec3 outc = pap.rgb * t * lit;
  // ink
  float ia = texture2D(uInk, uvq).a; outc = mix(outc, outc*vec3(.3,.22,.33), ia*.9);
  // painting fades into the paper toward the edges
  float d = min(min(px.x, px.y), min(uRes.x/uS-px.x, uRes.y/uS-px.y));
  float v = uFade < 1. ? 1. : smoothstep(0., uFade, d + (fbm(px*.025+uSeed)-.5)*uFade*.7 - uFade*.16);
  vec3 bare = pap.rgb*lit;
  outc = mix(bare, outc, v);
  gl_FragColor = vec4(outc*pap.a, pap.a);
}`;

export interface CResult { canvas: HTMLCanvasElement; ms: number; parts: Record<string, number>; paper: Paper; }

function prog(gl: WebGL2RenderingContext, fs: string): WebGLProgram {
  const mk = (t: number, s: string): WebGLShader => { const sh = gl.createShader(t)!; gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader'); return sh; };
  const p = gl.createProgram()!; gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  return p;
}

export interface CCfg { warp: number; kuw: number; dens: number; fade?: number; flat?: HTMLCanvasElement; noInk?: boolean; bench?: number }
export function renderC(scene: Scene, o: { seed: number; scale: number; paper?: Paper; cfg?: CCfg }): CResult {
  const cfg = o.cfg ?? { warp: 1, kuw: 1, dens: 1 };
  const t0 = performance.now(), S = o.scale, W = Math.round(scene.w * S), H = Math.round(scene.h * S), parts: Record<string, number> = {};
  let t = performance.now();
  const paper = o.paper ?? makePaper(scene.w, scene.h, S, o.seed); parts.paper = o.paper ? 0 : paper.ms; t = performance.now();
  const ras = rasterise(scene, S); const flat = cfg.flat ?? ras.flat, aux = ras.aux, ink = cfg.noInk ? document.createElement('canvas') : ras.ink; if (cfg.noInk) { ink.width = 2; ink.height = 2; } parts.raster = performance.now() - t; t = performance.now();
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true })!;
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const tex = (src: TexImageSource): WebGLTexture => { const x = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, x); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return x; };
  const target = (): [WebGLTexture, WebGLFramebuffer] => { const x = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, x); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); const fb = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, x, 0); return [x, fb]; };
  const tFlat = tex(flat), tAux = tex(aux), tInk = tex(ink), tPaper = tex(paper.base);
  const [tA, fA] = target(), [tB, fB] = target();
  const vb = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const pass = (p: WebGLProgram, fb: WebGLFramebuffer | null, texs: Record<string, WebGLTexture>): void => {
    gl.useProgram(p); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, W, H);
    const loc = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(gl.getUniformLocation(p, 'uRes'), W, H); gl.uniform1f(gl.getUniformLocation(p, 'uS'), S); gl.uniform1f(gl.getUniformLocation(p, 'uWarp'), cfg.warp); gl.uniform1f(gl.getUniformLocation(p, 'uKuw'), cfg.kuw); gl.uniform1f(gl.getUniformLocation(p, 'uDens'), cfg.dens); gl.uniform1f(gl.getUniformLocation(p, 'uFade'), cfg.fade ?? 50);
    gl.uniform1f(gl.getUniformLocation(p, 'uSeed'), (o.seed % 97) * 1.37);
    let u = 0; for (const [n, x] of Object.entries(texs)) { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, x); gl.uniform1i(gl.getUniformLocation(p, n), u++); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  const p1 = prog(gl, P1), p2 = prog(gl, P2), p3 = prog(gl, P3);
  pass(p1, fA, { uFlat: tFlat, uAux: tAux });
  pass(p2, fB, { uIn: tA });
  pass(p3, null, { uIn: tB, uAux: tAux, uInk: tInk, uPaper: tPaper });
  const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); parts.shader = performance.now() - t;
  if (cfg.bench) { const tb = performance.now(); for (let i = 0; i < cfg.bench; i++) { pass(p1, fA, { uFlat: tFlat, uAux: tAux }); pass(p2, fB, { uIn: tA }); pass(p3, null, { uIn: tB, uAux: tAux, uInk: tInk, uPaper: tPaper }); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } parts.passes = (performance.now() - tb) / cfg.bench; }
  return { canvas, ms: performance.now() - t0, parts, paper };
}

import { renderB } from './paintB';
/** Hybrid D: the canvas painter lays the washes, strokes and ink; the shader finishes with paper-fibre lighting, grain, bleed and edge pooling. */
export function renderD(scene: Scene, o: { seed: number; scale: number; paper?: Paper; fade?: number }): CResult & { bms: number } {
  const t0 = performance.now(), S = o.scale, paper = o.paper ?? makePaper(scene.w, scene.h, S, o.seed);
  const b = renderB(scene, { seed: o.seed, scale: S, paper });
  const app = document.createElement('canvas'); app.width = b.plate.width; app.height = b.plate.height;
  const c = app.getContext('2d')!; c.fillStyle = '#F0E3C8'; c.fillRect(0, 0, app.width, app.height); c.globalCompositeOperation = 'multiply'; c.drawImage(b.plate, 0, 0);
  const r = renderC(scene, { seed: o.seed, scale: S, paper, cfg: { warp: 0.25, kuw: 0, dens: 0.35, flat: app, noInk: true, fade: o.fade } });
  return { ...r, ms: performance.now() - t0, bms: b.ms, parts: { ...b.parts, ...r.parts } };
}
