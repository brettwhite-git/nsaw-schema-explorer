// DOM glue of the sequence: one shared stage, the scenes drawn into it one at a time, the control scheme.
import type { Ontology } from '../../ontology/load';
import type { AnyScene } from './contract';
import { resolveNames, type Names } from './order/data';
import { PlayerCore, sceneProgress, type PlayerState } from './player';
import { StageView } from './shared/stageview';
import { stageFor, type Stage } from './shared/stage';
import { QUESTIONS } from './shared/furniture';
import { beatOf } from './shared/beats';

export interface SequenceOpts {
  ontology?: Ontology;
  reducedMotion: boolean;
  onChange?: (s: PlayerState, info: { p: number; beatName: string; sceneName: string }) => void;
  /** F pressed */
  onFullscreen?: () => void;
  /** any control used (the hint fades) */
  onUse?: () => void;
}

export class Sequence {
  readonly core: PlayerCore;
  private names: Names;
  private view: StageView | null = null;
  private sceneView: { apply(s: unknown): void; destroy(): void } | null = null;
  private L: unknown = null;
  private builtScene = -1;
  private stage: Stage = { w: 0, h: 0 };
  private raf = 0; private last = 0; private destroyed = false;
  private ro?: ResizeObserver; private rt = 0;
  private offs: (() => void)[] = [];

  constructor(readonly host: HTMLElement, readonly scenes: AnyScene[], private o: SequenceOpts) {
    this.names = resolveNames(o.ontology);
    this.core = new PlayerCore(scenes.map((s) => ({ beats: s.beats })), o.reducedMotion);
    this.rebuild();
    if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => { clearTimeout(this.rt); this.rt = window.setTimeout(() => { if (!this.destroyed) this.rebuild(); }, 80); }); this.ro.observe(host); }
    const on = <K extends keyof WindowEventMap>(t: K, f: (e: WindowEventMap[K]) => void, opt?: AddEventListenerOptions): void => { window.addEventListener(t, f, opt); this.offs.push(() => window.removeEventListener(t, f, opt)); };
    on('keydown', (e) => this.onKey(e));
    const click = (e: MouseEvent): void => { if ((e.target as HTMLElement).closest?.('.scn-q, .scn-badge')) return; this.use(); this.core.next(); this.afterChange(); };
    host.addEventListener('click', click);
    this.offs.push(() => host.removeEventListener('click', click));
    const wheel = (e: WheelEvent): void => {
      const s = this.core.state, before = s.u;
      const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * 600 : e.deltaY;
      const probe = Math.min(1, Math.max(0, before + dy / 900));
      if (probe === before) return;   // nothing to scroll in this beat: let the page scroll
      e.preventDefault(); this.use();
      this.core.scroll(dy / 900); this.afterChange();
    };
    host.addEventListener('wheel', wheel, { passive: false });
    this.offs.push(() => host.removeEventListener('wheel', wheel));
  }

  private use(): void { this.o.onUse?.(); }
  private onKey(e: KeyboardEvent): void {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (t && t.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
    const k = e.key;
    let handled = true;
    if (k === ' ' || k === 'ArrowRight' || k === 'PageDown' || k === 'ArrowDown') this.core.next();
    else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'ArrowUp') this.core.back();
    else if (k === 'End' || k === 's' || k === 'S') this.core.skip();
    else if (k === 'f' || k === 'F') { this.o.onFullscreen?.(); }
    else if (/^[0-6]$/.test(k)) { if (!this.core.jump(Number(k))) handled = false; }
    else handled = false;
    if (handled) { e.preventDefault(); this.use(); this.afterChange(); }
  }

  /** a pinned question was used: go to the scene that answers it, when it is built */
  questionJump(i: number): void { this.use(); if (this.core.jump(QUESTIONS[i].answeredIn)) this.afterChange(); }
  next(): void { this.use(); this.core.next(); this.afterChange(); }
  back(): void { this.use(); this.core.back(); this.afterChange(); }
  jump(n: number): void { this.core.jump(n); this.afterChange(); }
  skip(): void { this.core.skip(); this.afterChange(); }
  goto(scene: number, beat: number, u = 1): void { this.core.goto(scene, beat, u); this.afterChange(); }
  /** the lab scrubber: a progress of the CURRENT scene */
  setSceneProgress(p: number): void {
    const sc = this.scenes[this.core.state.scene];
    const b = beatOf(sc.beats, p), bt = sc.beats[b];
    this.core.goto(this.core.state.scene, b, bt.to > bt.from ? Math.min(1, Math.max(0, (p - bt.from) / (bt.to - bt.from))) : 1);
    this.afterChange();
  }

  private afterChange(): void {
    this.render();
    if (this.core.state.playing && !this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame((n) => this.loop(n)); }
  }
  private loop(now: number): void {
    this.raf = 0;
    if (this.destroyed) return;
    const dt = Math.min(100, now - this.last); this.last = now;
    this.core.tick(dt);
    this.render();
    if (this.core.state.playing) this.raf = requestAnimationFrame((n) => this.loop(n));
  }

  private rebuild(): void {
    const w = this.host.clientWidth || this.host.getBoundingClientRect().width || 1200;
    const next = stageFor(w);
    if (this.view && next.w === this.stage.w && next.h === this.stage.h) return;
    this.stage = next;
    this.sceneView?.destroy(); this.sceneView = null; this.builtScene = -1;
    this.view?.destroy();
    this.view = new StageView(this.host, next, { names: this.names, reduced: this.o.reducedMotion, onQuestion: (i) => this.questionJump(i) });
    this.render();
  }

  render(): void {
    const view = this.view; if (!view) return;
    const st = this.core.state;
    const sc = this.scenes[st.scene];
    if (this.builtScene !== st.scene) {
      this.sceneView?.destroy(); view.resetScene();
      this.L = sc.layout(this.stage, this.names);
      this.sceneView = sc.create(view, this.L, this.names);
      this.builtScene = st.scene;
    }
    const p = sceneProgress(sc.beats, st);
    const s = sc.at(this.L, p, this.names);
    view.applyFurniture(sc.furniture(this.L, s));
    this.sceneView!.apply(s);
    view.setAlt(sc.alt(s));
    view.host.dataset.scene = String(st.scene); view.host.dataset.beat = String(st.beat); view.host.dataset.u = st.u.toFixed(3);
    this.o.onChange?.(st, { p, beatName: sc.beats[st.beat].name, sceneName: sc.name });
  }

  /** the model at the current frame (tests and tools) */
  current(): { scene: AnyScene; L: unknown; p: number } { const st = this.core.state; const sc = this.scenes[st.scene]; return { scene: sc, L: this.L, p: sceneProgress(sc.beats, st) }; }

  destroy(): void {
    this.destroyed = true; if (this.raf) cancelAnimationFrame(this.raf);
    clearTimeout(this.rt); this.ro?.disconnect(); this.offs.forEach((f) => f());
    this.sceneView?.destroy(); this.view?.destroy();
  }
}
