// A scene is a list of BEATS. Each beat ends on a FINISHED FRAME (the frame a click jumps to). Beats are contiguous
// windows of the scene's progress 0..1; the scene's own clock is in ms, so a beat's length is its `ms`.
export interface BeatDef { id: string; name: string; ms: number }
export interface Beat { id: string; name: string; ms: number; from: number; to: number; startMs: number }

export function makeBeats(defs: BeatDef[]): { beats: Beat[]; total: number; start: number[] } {
  const total = defs.reduce((a, d) => a + d.ms, 0);
  let t = 0;
  const beats = defs.map((d) => { const b: Beat = { ...d, startMs: t, from: t / total, to: (t + d.ms) / total }; t += d.ms; return b; });
  return { beats, total, start: beats.map((b) => b.startMs) };
}
export const beatOf = (beats: Beat[], p: number): number => { for (let i = beats.length - 1; i >= 0; i--) if (p >= beats[i].from) return i; return 0; };
