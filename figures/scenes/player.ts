// The SEQUENCE PLAYER, pure state machine (no DOM, no clock of its own: the caller feeds tick(dt)).
// The piece is presented LIVE, so there is no fixed length. Position = (scene, beat, u): u is how far through the
// beat's animation we are, 0..1. A FINISHED frame is u = 1 (and, at the very start, the empty paper of scene 0 beat 0).
//   next()   click / Space / Right / PageDown / clicker: play the current beat to its end; at a finished frame, play the next beat
//            (while a beat is playing it jumps straight to its finished frame)
//   back()   Left / PageUp: the previous finished frame (instant), across scene boundaries
//   scroll() moves u smoothly inside the CURRENT beat and settles at its ends; it never crosses a beat boundary
//   jump(n)  number keys 0-6 and the pinned questions: the opening frame of scene n (ignored when scene n is not built)
//   skip()   End or S: the current scene's last finished frame
//   tick(ms) advances a playing beat by time
// Instant mode (reduced motion): every move lands on a finished frame at once; nothing animates.
export interface BeatInfo { ms: number }
export interface SceneInfo { beats: BeatInfo[] }
export interface Pos { scene: number; beat: number; u: number }
export interface PlayerState extends Pos { playing: boolean }

export class PlayerCore {
  state: PlayerState = { scene: 0, beat: 0, u: 0, playing: false };
  constructor(private scenes: SceneInfo[], private instant = false) {}

  get sceneCount(): number { return this.scenes.length; }
  get finished(): boolean { return this.state.u >= 1; }
  private beatsOf(scene: number): number { return this.scenes[scene].beats.length; }
  private lastBeat(scene: number): number { return this.beatsOf(scene) - 1; }
  private set(scene: number, beat: number, u: number, playing = false): void { this.state = { scene, beat, u, playing }; }
  isLast(): boolean { const s = this.state; return s.scene === this.scenes.length - 1 && s.beat === this.lastBeat(s.scene) && s.u >= 1; }

  next(): void {
    const s = this.state;
    if (s.u < 1) {
      if (this.instant || s.playing) this.set(s.scene, s.beat, 1);
      else this.state = { ...s, playing: true };
      return;
    }
    if (s.beat < this.lastBeat(s.scene)) this.step(s.scene, s.beat + 1);
    else if (s.scene < this.scenes.length - 1) this.step(s.scene + 1, 0);
  }
  private step(scene: number, beat: number): void { if (this.instant) this.set(scene, beat, 1); else this.set(scene, beat, 0, true); }

  back(): void {
    const s = this.state;
    if (s.beat > 0) this.set(s.scene, s.beat - 1, 1);
    else if (s.scene > 0) this.set(s.scene - 1, this.lastBeat(s.scene - 1), 1);
    else this.set(0, 0, 0);
  }

  /** du: change of u (positive = forward). Clamped to the current beat. */
  scroll(du: number): void {
    const s = this.state;
    this.set(s.scene, s.beat, Math.min(1, Math.max(0, s.u + du)));
  }

  jump(scene: number): boolean {
    if (scene < 0 || scene >= this.scenes.length) return false;
    this.set(scene, 0, 0);
    return true;
  }
  skip(): void { const s = this.state; this.set(s.scene, this.lastBeat(s.scene), 1); }
  /** open at an exact finished frame */
  goto(scene: number, beat: number, u = 1): void {
    scene = Math.min(Math.max(0, scene), this.scenes.length - 1);
    beat = Math.min(Math.max(0, beat), this.lastBeat(scene));
    this.set(scene, beat, u);
  }
  tick(dtMs: number): void {
    const s = this.state;
    if (!s.playing) return;
    const u = s.u + dtMs / this.scenes[s.scene].beats[s.beat].ms;
    if (u >= 1) this.set(s.scene, s.beat, 1); else this.state = { ...s, u };
  }
}

/** progress of a scene for a position, given the beat windows (each beat: from..to of the scene's progress) */
export function sceneProgress(beats: { from: number; to: number }[], pos: Pos): number {
  const b = beats[pos.beat];
  return b.from + pos.u * (b.to - b.from);
}
