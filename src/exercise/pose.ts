// Camera form check: turns pose landmarks (one frame at a time) into a rep count or a
// held-seconds count, plus a short form cue. Pure and unit-tested; the camera and the
// pose model live in CameraModal.tsx / poseModel.ts. Nothing here sees the video itself.
import type { Exercise, TrackerKind } from './catalog';

/** One MediaPipe pose landmark: x/y normalized to the frame (0–1), visibility 0–1. */
export interface Landmark { x: number; y: number; visibility?: number }

/** MediaPipe Pose landmark indices (33-point model) used by the counters. */
export const LM = {
  lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28,
} as const;

type Side = 'l' | 'r';
type Joint = 'Shoulder' | 'Elbow' | 'Wrist' | 'Hip' | 'Knee' | 'Ankle';
interface Pt { x: number; y: number }

const MIN_VISIBILITY = 0.5;
/** Frames further apart than this don't count toward a hold (tab in the background, a stalled camera). Slow phones run ~3 fps. */
const MAX_FRAME_GAP = 1;
/** Light smoothing of the measured angle so jitter doesn't cross a threshold twice. */
const SMOOTHING = 0.5;
/** Seconds of being in view needed per rep when an exercise has no counter yet. */
export const WATCH_SECONDS_PER_REP = 1.5;

/** Angle at b (degrees, 0–180) between b→a and b→c. */
export function angle(a: Pt, b: Pt, c: Pt): number {
  const v1 = Math.atan2(a.y - b.y, a.x - b.x);
  const v2 = Math.atan2(c.y - b.y, c.x - b.x);
  let d = Math.abs(((v1 - v2) * 180) / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
}

/** How far a→b is from horizontal, in degrees (0 = level, 90 = vertical). */
export function tilt(a: Pt, b: Pt): number {
  const d = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
  return d > 90 ? 180 - d : d;
}

/**
 * A frame's landmarks with the side of the body that faces the camera. Coordinates are
 * scaled by the frame's aspect ratio so angles match what you see.
 */
class Frame {
  constructor(private lms: Landmark[], private aspect: number) {}
  private raw(side: Side, j: Joint) { return this.lms[LM[(side + j) as keyof typeof LM]]; }
  vis(side: Side, j: Joint) { return this.raw(side, j)?.visibility ?? 1; }
  p(side: Side, j: Joint): Pt { const l = this.raw(side, j); return { x: l.x * this.aspect, y: l.y }; }
  /** Every joint is visible on that side. */
  sees(side: Side, joints: Joint[]) { return joints.every(j => this.raw(side, j) && this.vis(side, j) >= MIN_VISIBILITY); }
  /** The side whose joints the camera sees best, or null if neither is clear. */
  side(joints: Joint[]): Side | null {
    const score = (s: Side) => Math.min(...joints.map(j => (this.raw(s, j) ? this.vis(s, j) : 0)));
    const best: Side = score('l') >= score('r') ? 'l' : 'r';
    return this.sees(best, joints) ? best : null;
  }
}

/** What a counter shows after each frame. */
export interface CounterState {
  /** Reps counted so far (rep counters). */
  reps: number;
  /** Seconds held in good form (hold counters) or in view (watch). */
  seconds: number;
  /** The person (the joints this exercise needs) is in view. */
  inView: boolean;
  /** Short coaching cue, or '' when everything looks right. */
  cue: string;
  /** 0 = resting position, 1 = deepest point; drives the little depth meter. */
  depth: number;
}

export interface Counter {
  readonly mode: 'reps' | 'hold' | 'watch';
  /** Feed one frame. `t` is in seconds; `aspect` is the frame's width / height. */
  update(lms: Landmark[] | undefined, t: number, aspect: number): CounterState;
  state(): CounterState;
}

/* ---------------- rep counters ---------------- */

/**
 * A rep is: leave the resting position, reach the working threshold, come back to rest.
 * `metric` is a joint angle; `dir` says whether the working position is below or above
 * the resting one (a squat bends the knee: below; a bridge opens the hip: above). The gap
 * between the two thresholds is the hysteresis that stops jitter from double counting.
 */
interface RepSpec {
  joints: Joint[];
  metric: (f: Frame, s: Side) => number;
  dir: 'below' | 'above';
  /** Working threshold: crossing it makes the rep count when you come back. */
  work: number;
  /** Resting threshold: crossing back over it completes the rep. */
  rest: number;
  /** Past this (but short of `work`) is a partial rep: no count, and `shallow` is shown. */
  partial: number;
  shallow: string;
  /** Form check while moving; a rep with bad form doesn't count. Returns a cue or ''. */
  form?: (f: Frame, s: Side) => string;
}

const knee = (f: Frame, s: Side) => angle(f.p(s, 'Hip'), f.p(s, 'Knee'), f.p(s, 'Ankle'));
const elbow = (f: Frame, s: Side) => angle(f.p(s, 'Shoulder'), f.p(s, 'Elbow'), f.p(s, 'Wrist'));
const hip = (f: Frame, s: Side) => angle(f.p(s, 'Shoulder'), f.p(s, 'Hip'), f.p(s, 'Knee'));
/** Straight body line from shoulder through hip to the far point (knee or ankle). */
const line = (f: Frame, s: Side, end: Joint) => angle(f.p(s, 'Shoulder'), f.p(s, 'Hip'), f.p(s, end));
/** The hip sits below (sagging) or above (piking) the shoulder→end line, in image terms. */
function hipCue(f: Frame, s: Side, end: Joint): string {
  const a = f.p(s, 'Shoulder'), h = f.p(s, 'Hip'), e = f.p(s, end);
  const cross = (e.x - a.x) * (h.y - a.y) - (e.y - a.y) * (h.x - a.x);
  // y grows downward; which sign means "below" depends on which way the person faces.
  const below = e.x >= a.x ? cross > 0 : cross < 0;
  return below ? 'Hips sagging: squeeze your glutes and brace' : 'Hips too high: lower them into a straight line';
}

const REP_SPECS: Partial<Record<TrackerKind, RepSpec>> = {
  squat: {
    joints: ['Hip', 'Knee', 'Ankle'], metric: knee, dir: 'below', work: 105, rest: 155, partial: 140,
    shallow: 'Go lower: thighs to about parallel',
  },
  lunge: {
    // Both legs are checked: whichever knee bends most (stepping back with either leg).
    joints: ['Hip', 'Knee', 'Ankle'], metric: knee, dir: 'below', work: 110, rest: 155, partial: 140,
    shallow: 'Go lower: back knee toward the floor',
    form: (f, s) => (tilt(f.p(s, 'Hip'), f.p(s, 'Shoulder')) < 55 ? 'Keep your chest up' : ''),
  },
  pushup: {
    joints: ['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Knee'], metric: elbow, dir: 'below', work: 100, rest: 150, partial: 130,
    shallow: 'Go lower: chest toward the floor',
    form: (f, s) => {
      if (tilt(f.p(s, 'Shoulder'), f.p(s, 'Hip')) > 50) return 'Get into the push-up position, side-on to the camera';
      return line(f, s, 'Knee') < 150 ? hipCue(f, s, 'Knee') : '';
    },
  },
  // Wall push-ups: the body stays upright, so only the straight line is checked.
  wallpush: {
    joints: ['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Knee'], metric: elbow, dir: 'below', work: 105, rest: 150, partial: 130,
    shallow: 'Go closer: nose toward the wall',
    form: (f, s) => (line(f, s, 'Knee') < 155 ? hipCue(f, s, 'Knee') : ''),
  },
  bridge: {
    joints: ['Shoulder', 'Hip', 'Knee'], metric: hip, dir: 'above', work: 160, rest: 145, partial: 152,
    shallow: 'Lift higher: shoulders, hips and knees in a line',
    form: (f, s) => (tilt(f.p(s, 'Shoulder'), f.p(s, 'Hip')) > 45 ? 'Lie on your back, side-on to the camera' : ''),
  },
};

class RepCounter implements Counter {
  readonly mode = 'reps' as const;
  private s: CounterState = { reps: 0, seconds: 0, inView: false, cue: '', depth: 0 };
  /** 'idle' until the resting position is seen once, so getting into place never counts. */
  private phase: 'idle' | 'rest' | 'moving' | 'work' = 'idle';
  private smooth: number | null = null;
  private badForm = '';
  private reachedPartial = false;

  constructor(private spec: RepSpec, private bothSides = false) {}

  state() { return this.s; }

  private measure(f: Frame): { m: number; side: Side } | null {
    const { joints, metric, dir } = this.spec;
    if (this.bothSides) {
      const sides = (['l', 'r'] as Side[]).filter(s => f.sees(s, joints));
      if (!sides.length) return null;
      const vals = sides.map(s => ({ m: metric(f, s), side: s }));
      return vals.reduce((a, b) => ((dir === 'below' ? b.m < a.m : b.m > a.m) ? b : a));
    }
    const side = f.side(joints);
    return side ? { m: metric(f, side), side } : null;
  }

  update(lms: Landmark[] | undefined, _t: number, aspect: number): CounterState {
    const f = lms?.length ? new Frame(lms, aspect) : null;
    const got = f && this.measure(f);
    if (!f || !got) return (this.s = { ...this.s, inView: false, cue: 'Step back so your whole body is in view' });

    const { dir, work, rest, partial, shallow, form } = this.spec;
    this.smooth = this.smooth === null ? got.m : this.smooth + SMOOTHING * (got.m - this.smooth);
    const m = this.smooth;
    const beyond = (thr: number) => (dir === 'below' ? m <= thr : m >= thr);
    const atRest = !beyond(rest) || m === rest;
    const formCue = form?.(f, got.side) ?? '';
    let cue = this.s.cue;
    let reps = this.s.reps;

    if (this.phase === 'idle') {
      if (atRest) { this.phase = 'rest'; cue = ''; } else cue = 'Start in the starting position';
    } else if (this.phase === 'rest') {
      if (!atRest) { this.phase = 'moving'; this.badForm = ''; this.reachedPartial = false; }
    }
    if (this.phase === 'moving' || this.phase === 'work') {
      if (beyond(work)) this.phase = 'work';
      if (beyond(partial)) this.reachedPartial = true;
      if (formCue) this.badForm = formCue;
      if (atRest) {
        if (this.phase === 'work' && !this.badForm) { reps++; cue = ''; }
        else if (this.phase === 'work') cue = this.badForm + ' (rep not counted)';
        else cue = this.reachedPartial ? shallow : cue;
        this.phase = 'rest';
      } else if (formCue) cue = formCue;
    }

    const depth = this.phase === 'idle' ? 0 : Math.max(0, Math.min(1, (m - rest) / (work - rest)));
    return (this.s = { reps, seconds: 0, inView: true, cue, depth });
  }
}

/* ---------------- hold counters ---------------- */

interface HoldSpec {
  joints: Joint[];
  /** '' while the position is right; otherwise what to fix. Seconds count only while ''. */
  check: (f: Frame, s: Side) => string;
}

const HOLD_SPECS: Partial<Record<TrackerKind, HoldSpec>> = {
  plank: {
    joints: ['Shoulder', 'Hip', 'Ankle'],
    check: (f, s) => {
      if (tilt(f.p(s, 'Shoulder'), f.p(s, 'Ankle')) > 40) return 'Get into the plank: body facing the floor, side-on to the camera';
      return line(f, s, 'Ankle') < 160 ? hipCue(f, s, 'Ankle') : '';
    },
  },
  wallsit: {
    joints: ['Hip', 'Knee', 'Ankle'],
    check: (f, s) => {
      const k = knee(f, s);
      if (k > 125) return 'Slide lower: knees bent to about 90°';
      return k < 65 ? 'Too low: come up until your thighs are level' : '';
    },
  },
};

class HoldCounter implements Counter {
  readonly mode = 'hold' as const;
  private s: CounterState = { reps: 0, seconds: 0, inView: false, cue: '', depth: 0 };
  private last: number | null = null;
  constructor(private spec: HoldSpec) {}
  state() { return this.s; }
  update(lms: Landmark[] | undefined, t: number, aspect: number): CounterState {
    const dt = this.last === null ? 0 : t - this.last;
    this.last = t;
    const f = lms?.length ? new Frame(lms, aspect) : null;
    const side = f?.side(this.spec.joints) ?? null;
    if (!f || !side) return (this.s = { ...this.s, inView: false, cue: 'Step back so your whole body is in view', depth: 0 });
    const cue = this.spec.check(f, side);
    const seconds = this.s.seconds + (!cue && dt > 0 && dt <= MAX_FRAME_GAP ? dt : 0);
    return (this.s = { reps: 0, seconds, inView: true, cue, depth: cue ? 0 : 1 });
  }
}

/* ---------------- watch (no counter yet) ---------------- */

/** For exercises without a counter yet: counts the seconds a person is in view. */
class WatchCounter implements Counter {
  readonly mode = 'watch' as const;
  private s: CounterState = { reps: 0, seconds: 0, inView: false, cue: '', depth: 0 };
  private last: number | null = null;
  state() { return this.s; }
  update(lms: Landmark[] | undefined, t: number): CounterState {
    const dt = this.last === null ? 0 : t - this.last;
    this.last = t;
    const seen = !!lms?.length && [LM.lShoulder, LM.rShoulder, LM.lHip, LM.rHip].filter(i => (lms[i]?.visibility ?? 1) >= MIN_VISIBILITY).length >= 2;
    if (!seen) return (this.s = { ...this.s, inView: false, cue: 'Step into view of the camera' });
    const seconds = this.s.seconds + (dt > 0 && dt <= MAX_FRAME_GAP ? dt : 0);
    return (this.s = { ...this.s, seconds, inView: true, cue: '' });
  }
}

/** The counter for an exercise: its catalog `tracker`, or a watch timer if it has none yet. */
export function createCounter(ex: Pick<Exercise, 'tracker'>): Counter {
  const kind = ex.tracker;
  const rep = kind && REP_SPECS[kind];
  if (rep) return new RepCounter(rep, kind === 'lunge');
  const hold = kind && HOLD_SPECS[kind];
  if (hold) return new HoldCounter(hold);
  return new WatchCounter();
}

/**
 * What the camera has to see before the quest completes: reps (rep counters) or seconds
 * (holds and watch). Per-side amounts double: 8 reps each side is 16 lunges.
 */
export function cameraGoal(ex: Pick<Exercise, 'measure' | 'perSide'>, amount: number, mode: Counter['mode']): number {
  const total = amount * (ex.perSide ? 2 : 1);
  if (mode === 'watch' && ex.measure === 'reps') return Math.ceil(total * WATCH_SECONDS_PER_REP);
  return total;
}

/** Progress toward the goal in the counter's own unit. */
export const cameraProgress = (s: CounterState, mode: Counter['mode']) => (mode === 'reps' ? s.reps : Math.floor(s.seconds));
