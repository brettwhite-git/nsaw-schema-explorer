// Lab: the entry piece's sequence (scene 0, scene 1) at full size, with the real controls.
//   click the stage / Space / Right / PageDown: next finished frame     Left / PageUp: previous finished frame
//   scroll over the stage: moves inside the current beat                  0-6: a scene     End or S: skip to the scene's last frame    F: full screen
//   ?scene=1&beat=3 opens at that finished frame (beat is 0-based)       ?theme=light  ?reduced=1  ?phone=1  ?hint=0  ?chrome=0  ?labels=0 (all text hidden)  ?u=0.5 (a frame part-way through the beat)
import '../../styles/tokens.generated.css';
import '../../styles/drawn.css';
import { loadOntology, type Ontology } from '../../ontology/load';
import { currentTheme, setTheme } from '../../site/theme';
import { SCENES, Sequence } from '../../figures/scenes';

const q = new URLSearchParams(location.search);
let reduced = q.get('reduced') === '1' || (!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && q.get('reduced') !== '0');
let phone = q.get('phone') === '1';
const lab = document.getElementById('lab')!;
const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
const btn = (label: string, on: () => void): HTMLButtonElement => { const b = mk('button', 'btn', label); b.type = 'button'; b.addEventListener('click', (e) => { e.stopPropagation(); on(); }); return b; };

let seq: Sequence | null = null;
let ontology: Ontology | undefined;
let frame: HTMLElement; let hint: HTMLElement; let beatsBar: HTMLElement;
const scrub = mk('input'); scrub.type = 'range'; scrub.min = '0'; scrub.max = '1000'; scrub.value = '0'; scrub.setAttribute('aria-label', 'progress in this scene');
const readout = mk('span', 'readout');
const sceneBtns: HTMLButtonElement[] = [];
let beatBtns: HTMLButtonElement[] = [];
let shownScene = -1;

function toggleFull(): void {
  const on = document.documentElement.classList.toggle('lab-full');
  if (on) document.documentElement.requestFullscreen?.().catch(() => {});
  else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.documentElement.classList.remove('lab-full'); });

function buildBeatButtons(scene: number): void {
  beatsBar.textContent = ''; beatBtns = [];
  SCENES[scene].beats.forEach((b, i) => { const bt = btn(`${i + 1} ${b.name}`, () => seq?.goto(scene, i, 1)); bt.title = 'jump to this beat’s finished frame'; beatBtns.push(bt); beatsBar.append(bt); });
}

function mount(pos: { scene: number; beat: number; u: number } | null): void {
  seq?.destroy();
  frame.textContent = ''; frame.className = `lab-frame${phone ? ' phone' : ''}`;
  seq = new Sequence(frame, SCENES, {
    ontology, reducedMotion: reduced,
    onFullscreen: toggleFull,
    onUse: () => hint.classList.add('gone'),
    onChange: (s, info) => {
      if (s.scene !== shownScene) { shownScene = s.scene; buildBeatButtons(s.scene); }
      scrub.value = String(Math.round(info.p * 1000));
      readout.textContent = `scene ${s.scene} · beat ${s.beat + 1}/${SCENES[s.scene].beats.length} · ${s.u >= 1 ? 'finished' : s.playing ? 'playing' : 'u ' + s.u.toFixed(2)}`;
      sceneBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === s.scene)));
      beatBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === s.beat)));
    },
  });
  if (pos) seq.goto(pos.scene, pos.beat, pos.u); else seq.render();
  (window as unknown as { seq: Sequence }).seq = seq;
}

function build(): void {
  const top = mk('div', 'lab-top lab-chrome');
  top.append(mk('h1', '', 'The entry piece: scene 0 and scene 1'));
  top.append(btn('full screen (F)', toggleFull), btn('theme', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark')));
  lab.append(top);
  const ctl = mk('div', 'lab-ctl lab-chrome');
  ctl.append(btn('back', () => seq?.back()), btn('next', () => seq?.next()), btn('skip scene', () => seq?.skip()), scrub, readout);
  scrub.addEventListener('input', () => seq?.setSceneProgress(Number(scrub.value) / 1000));
  const rm = btn('reduced motion', () => { reduced = !reduced; rm.setAttribute('aria-pressed', String(reduced)); const s = seq!.core.state; mount({ scene: s.scene, beat: s.beat, u: reduced ? 1 : s.u }); });
  rm.setAttribute('aria-pressed', String(reduced));
  const ph = btn('phone width', () => { phone = !phone; ph.setAttribute('aria-pressed', String(phone)); const s = seq!.core.state; mount({ scene: s.scene, beat: s.beat, u: s.u }); });
  ph.setAttribute('aria-pressed', String(phone));
  ctl.append(rm, ph);
  lab.append(ctl);
  const scenes = mk('div', 'lab-steps lab-chrome');
  SCENES.forEach((s, i) => { const b = btn(`${i} ${s.name}`, () => seq?.jump(i)); sceneBtns.push(b); scenes.append(b); });
  lab.append(scenes);
  beatsBar = mk('div', 'lab-steps lab-chrome'); lab.append(beatsBar);
  const wrap = mk('div', 'lab-wrap');
  frame = mk('div', 'lab-frame'); wrap.append(frame);
  hint = mk('div', 'lab-hint', 'click or Space: next · ← back · scroll: within a beat · 0–6: a scene · End: skip scene · F: full screen');
  if (q.get('hint') === '0') hint.classList.add('gone');
  wrap.append(hint);
  lab.append(wrap);
  lab.append(mk('p', 'lab-note lab-chrome', 'Real-time feel cannot be judged from screenshots: tune beat lengths in figures/scenes/scene0 and figures/scenes/netsuite (BEATS0, BEATS1) and each pose delay in the world tables. ?scene=1&beat=3 opens at an exact finished frame.'));
}

async function main(): Promise<void> {
  if (q.get('chrome') === '0') document.documentElement.classList.add('lab-full');
  if (q.get('labels') === '0') { const st = document.createElement('style'); st.textContent = '.scn text, .scn-note, .scn-q, .scn-badge { visibility: hidden !important; }'; document.head.append(st); }   // captures: stage only
  build();
  try { ontology = await loadOntology({ baseUrl: '/ontology/' }); } catch (e) { console.warn('ontology did not load; the ledger says "Many"', e); }
  const sc = q.get('scene'), bt = q.get('beat');
  const pos = sc !== null ? { scene: Number(sc), beat: bt !== null ? Number(bt) : 0, u: q.get('u') !== null ? Number(q.get('u')) : (bt !== null ? 1 : 0) } : null;
  mount(pos);
}
void main();
