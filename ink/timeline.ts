// Draw-in timeline. One clock, two drivers:
//   time:     play() runs a rAF loop once, then stops (nothing loops)
//   progress: setProgress(0..1) maps scroll (or anything) onto the same total duration
// Only stroke-dashoffset, clip-path and opacity are touched, as the rulebook demands.
import { clamp01, dashOffset, easeDraw, easeText, labelInset, localProgress, stitchSteps } from './easing';

export interface TimelineItem {
  t0: number;
  dur: number;
  /** p is local progress 0..1 (already eased by the item's own easing). */
  apply(p: number): void;
  /** tagged for figure:stroke events */
  stroke?: boolean;
  label?: string;
  /** the last applied progress, to skip untouched work */
  _p?: number;
}

export class Timeline {
  private items: TimelineItem[] = [];
  private t = -1;
  private raf = 0;
  private startedAt = 0;
  private frozen = false;
  private playing = false;
  private strokeCb?: (item: TimelineItem) => void;
  total = 0;

  /** Add an item; returns its end time so callers can chain. */
  add(item: TimelineItem): number {
    this.items.push(item);
    this.total = Math.max(this.total, item.t0 + item.dur);
    item.apply(0);
    item._p = 0;
    return item.t0 + item.dur;
  }

  onStroke(cb: (item: TimelineItem) => void): void { this.strokeCb = cb; }

  /** Draw a stroke (pathLength=1 path, .ink) between t0 and t0+dur. */
  stroke(el: SVGElement, t0: number, dur: number, label?: string): number {
    return this.add({ t0, dur, stroke: true, label, apply: (p) => { el.style.strokeDashoffset = String(dashOffset(easeDraw(p))); } });
  }

  /** Sew a thread: reveal path stepped to whole stitches. */
  stitch(reveal: SVGElement, n: number, t0: number, dur: number, label?: string): number {
    return this.add({ t0, dur, stroke: true, label, apply: (p) => { reveal.style.strokeDashoffset = String(dashOffset(stitchSteps(p, n))); } });
  }

  /** Write a label in: a clip that opens left to right. */
  label(el: SVGElement | HTMLElement, t0: number, dur: number): number {
    return this.add({ t0, dur, apply: (p) => { el.style.clipPath = p >= 1 ? 'none' : `inset(-6px ${labelInset(easeDraw(p))}% -6px -6px)`; } });
  }

  /** Paper, dots, knots, text blocks: one light opacity fade. */
  fade(el: SVGElement | HTMLElement, t0: number, dur: number): number {
    return this.add({ t0, dur, apply: (p) => { el.style.opacity = String(easeText(p)); } });
  }

  /** Anything else that can be seeked (WrittenInk handles). */
  custom(t0: number, dur: number, apply: (p: number) => void): number {
    return this.add({ t0, dur, apply });
  }

  /** Render the whole drawing as it stands `ms` in. -1 = nothing drawn. */
  setTime(ms: number): void {
    const prev = this.t;
    this.t = ms;
    for (const it of this.items) {
      const p = ms < 0 ? 0 : localProgress(ms, it.t0, it.dur);
      if (p === it._p) continue;
      it.apply(p);
      it._p = p;
      if (it.stroke && this.strokeCb && prev < it.t0 && ms >= it.t0 && ms >= 0) this.strokeCb(it);
    }
  }

  /** Scroll-driven drawing: 0 = nothing, 1 = finished. */
  setProgress(p: number): void {
    this.stop();
    this.setTime(clamp01(p) * this.total);
  }

  get time(): number { return this.t; }
  get isPlaying(): boolean { return this.playing; }

  play(delay = 0): void {
    this.stop();
    this.playing = true;
    this.t = -1 - Math.max(0, delay);   // waiting counts as time before the first stroke
    this.begin();
  }

  private begin(): void {
    if (this.frozen) return;
    this.startedAt = performance.now();
    const base = this.t;
    const tick = (now: number) => {
      this.raf = 0;
      const ms = base + (now - this.startedAt);
      if (ms >= this.total) { this.setTime(this.total); this.playing = false; return; }
      this.setTime(ms);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Stop the loop but keep the drawing as it stands. */
  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.playing = false;
  }

  /** Off-screen: halt the loop. On screen again: carry on from where it stopped. */
  freeze(on: boolean): void {
    if (on === this.frozen) return;
    this.frozen = on;
    if (on) {
      if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    } else if (this.playing) {
      this.begin();
    }
  }

  finish(): void { this.stop(); this.setTime(this.total); }
  reset(): void { this.stop(); this.setTime(-1); }
  replay(delay = 0): void { this.reset(); this.play(delay); }
  destroy(): void { this.stop(); this.items = []; this.strokeCb = undefined; }
}
