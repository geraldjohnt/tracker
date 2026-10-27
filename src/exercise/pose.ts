// Camera form check: turns pose landmarks (one frame at a time) into a rep count or a
// held-seconds count, plus a short form cue. Pure and unit-tested; the camera and the
// pose model live in CameraModal.tsx / poseModel.ts. Nothing here sees the video itself.
import type { Exercise, TrackerKind } from './catalog';

/** One MediaPipe pose landmark: x/y normalized to the frame (0–1), visibility 0–1. */
export interface Landmark { x: number; y: number; visibility?: number }

/** MediaPipe Pose landmark indices (33-point model) used by the counters. */
export const LM = {
  nose: 0,
  lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28,
  lHeel: 29, rHeel: 30, lFoot: 31, rFoot: 32,
} as const;

type Side = 'l' | 'r';
type Joint = 'Shoulder' | 'Elbow' | 'Wrist' | 'Hip' | 'Knee' | 'Ankle' | 'Heel' | 'Foot';
interface Pt { x: number; y: number }

const MIN_VISIBILITY = 0.5;
/** Frames further apart than this don't count toward a hold (tab in the background, a stalled camera). Slow phones run ~3 fps. */
const MAX_FRAME_GAP = 1;
/** Light smoothing of the measured angle so jitter doesn't cross a threshold twice. */
const SMOOTHING = 0.5;
/** Seconds of being in view needed per rep when an exercise has no counter yet. */
export const WATCH_SECONDS_PER_REP = 1.5;
/** Jumps: the ankles must rise this share of the leg length above the floor line. */
const JUMP_LIFT = 0.1;
/** Jumps: a rep that reached the bottom may still take off this many seconds after standing up. */
const JUMP_WINDOW = 0.8;

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

/** How far b is above a, in degrees from horizontal (negative = below). */
export function elevation(a: Pt, b: Pt): number {
  return (Math.atan2(a.y - b.y, Math.abs(b.x - a.x)) * 180) / Math.PI;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const other = (s: Side): Side => (s === 'l' ? 'r' : 'l');

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
  nose(): Pt | null {
    const n = this.lms[LM.nose];
    return n && (n.visibility ?? 1) >= MIN_VISIBILITY ? { x: n.x * this.aspect, y: n.y } : null;
  }
  /**
   * The person faces the camera (rather than standing side-on): both shoulders and hips are
   * visible and the shoulders look wide next to the torso's height.
   */
  front(): boolean {
    if (!this.sees('l', ['Shoulder', 'Hip']) || !this.sees('r', ['Shoulder', 'Hip'])) return false;
    const w = Math.abs(this.p('l', 'Shoulder').x - this.p('r', 'Shoulder').x);
    const h = Math.abs((this.p('l', 'Hip').y + this.p('r', 'Hip').y) / 2 - (this.p('l', 'Shoulder').y + this.p('r', 'Shoulder').y) / 2);
    return w > 0.55 * h;
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
  /**
   * In view and in the right position right now (form checks pass, starting position seen).
   * Drives the green/red skeleton. Watch counters have no form checks, so it only means "in view".
   */
  formOk: boolean;
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

/* ---------------- measurements ---------------- */

const knee = (f: Frame, s: Side) => angle(f.p(s, 'Hip'), f.p(s, 'Knee'), f.p(s, 'Ankle'));
const elbow = (f: Frame, s: Side) => angle(f.p(s, 'Shoulder'), f.p(s, 'Elbow'), f.p(s, 'Wrist'));
const hip = (f: Frame, s: Side) => angle(f.p(s, 'Shoulder'), f.p(s, 'Hip'), f.p(s, 'Knee'));
/** Arm raised from the side of the body: 0 = by the hip, 180 = straight overhead. */
const arm = (f: Frame, s: Side) => angle(f.p(s, 'Hip'), f.p(s, 'Shoulder'), f.p(s, 'Wrist'));
/** Torso from horizontal: 0 = lying or in a plank, 90 = upright. */
const torso = (f: Frame, s: Side) => tilt(f.p(s, 'Hip'), f.p(s, 'Shoulder'));
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

/**
 * Knee angle for squats, from either view. Side-on it's the real hip–knee–ankle angle. Facing
 * the camera the thigh points at the lens, so the angle barely changes on screen; instead the
 * thigh's height next to the shin's says how deep you are (equal = standing, flat = parallel),
 * mapped onto the same 180°…90° scale.
 */
function squatKnee(f: Frame, s: Side): number {
  if (!f.front()) return knee(f, s);
  const h = f.p(s, 'Hip'), k = f.p(s, 'Knee'), a = f.p(s, 'Ankle');
  const r = Math.max(0, Math.min(1, (k.y - h.y) / Math.max(1e-6, a.y - k.y)));
  return 90 + 90 * r;
}
/** Front view only: knees closer together than the feet once you're on the way down. */
function kneesCave(f: Frame, s: Side): string {
  if (!f.front() || !f.sees('l', ['Knee', 'Ankle']) || !f.sees('r', ['Knee', 'Ankle']) || squatKnee(f, s) > 145) return '';
  const knees = Math.abs(f.p('l', 'Knee').x - f.p('r', 'Knee').x);
  const feet = Math.abs(f.p('l', 'Ankle').x - f.p('r', 'Ankle').x);
  return knees < 0.7 * feet ? 'Knees caving in: push them out over your toes' : '';
}
/** Lying checks: the torso is roughly flat (on the back or face down). */
const lying = (cue: string) => (f: Frame, s: Side) => (torso(f, s) > 40 ? cue : '');
const straightLegs = (f: Frame, s: Side) => (knee(f, s) < 140 ? 'Keep your legs straight' : '');

/* ---------------- rep counters ---------------- */

/**
 * A rep is: leave the resting position, reach the working threshold, come back to rest.
 * `metric` is usually a joint angle; `dir` says whether the working position is below or above
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
  /** Must be true in at least one frame past the working threshold (at depth, not on the way back), or the rep doesn't count. */
  need?: { test: (f: Frame, s: Side) => boolean; cue: string };
  /** The rep needs a jump: both ankles off the floor at some point. */
  jump?: boolean;
  /**
   * Which side is measured: 'best' = the side the camera sees best (default); 'either' = whichever
   * side is working hardest (alternating legs, one rep at a time); 'each' = both sides count
   * their own reps (fast alternating moves like mountain climbers, where one side starts before
   * the other has finished).
   */
  sides?: 'best' | 'either' | 'each';
}

const PUSH = { metric: elbow, dir: 'below', work: 100, rest: 150, partial: 130 } as const;

const REP_SPECS: Partial<Record<TrackerKind, RepSpec>> = {
  squat: {
    joints: ['Hip', 'Knee', 'Ankle'], metric: squatKnee, dir: 'below', work: 105, rest: 155, partial: 140,
    shallow: 'Go lower: thighs to about parallel', form: kneesCave,
  },
  jumpsquat: {
    joints: ['Hip', 'Knee', 'Ankle'], metric: squatKnee, dir: 'below', work: 115, rest: 155, partial: 140, jump: true,
    shallow: 'Go lower before you jump', form: kneesCave,
  },
  lunge: {
    // Both legs are checked: whichever knee bends most (stepping back with either leg).
    joints: ['Hip', 'Knee', 'Ankle'], metric: knee, dir: 'below', work: 110, rest: 155, partial: 140, sides: 'either',
    shallow: 'Go lower: back knee toward the floor',
    form: (f, s) => (tilt(f.p(s, 'Hip'), f.p(s, 'Shoulder')) < 55 ? 'Keep your chest up' : ''),
  },
  sidelunge: {
    // Facing the camera, the bent leg shows its knee angle; the other leg stays straight.
    joints: ['Hip', 'Knee', 'Ankle'], metric: knee, dir: 'below', work: 125, rest: 160, partial: 145, sides: 'either',
    shallow: 'Sit lower into the bent leg',
    need: { test: (f, s) => f.sees(other(s), ['Hip', 'Knee', 'Ankle']) && knee(f, other(s)) > 150, cue: 'Keep the other leg straight' },
  },
  calfraise: {
    // Heel height over the toes, as a share of the shin (×100): 0 flat, ~15+ on the toes.
    joints: ['Hip', 'Knee', 'Ankle', 'Heel', 'Foot'], dir: 'above', work: 9, rest: 4, partial: 6,
    metric: (f, s) => ((f.p(s, 'Foot').y - f.p(s, 'Heel').y) / Math.max(1e-6, dist(f.p(s, 'Knee'), f.p(s, 'Ankle')))) * 100,
    shallow: 'Rise higher onto your toes',
    form: (f, s) => (knee(f, s) < 150 ? 'Keep your knees straight' : ''),
  },
  pushup: {
    joints: ['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Knee'], ...PUSH,
    shallow: 'Go lower: chest toward the floor',
    form: (f, s) => {
      if (tilt(f.p(s, 'Shoulder'), f.p(s, 'Hip')) > 50) return 'Get into the push-up position, side-on to the camera';
      return line(f, s, 'Knee') < 150 ? hipCue(f, s, 'Knee') : '';
    },
  },
  // Wall push-ups: the body stays upright, so only the straight line is checked.
  wallpush: {
    joints: ['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Knee'], ...PUSH, work: 105,
    shallow: 'Go closer: nose toward the wall',
    form: (f, s) => (line(f, s, 'Knee') < 155 ? hipCue(f, s, 'Knee') : ''),
  },
  pike: {
    joints: ['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Ankle'], ...PUSH,
    shallow: 'Go lower: head toward the floor',
    form: (f, s) => (f.p(s, 'Hip').y > f.p(s, 'Shoulder').y || line(f, s, 'Ankle') > 135 ? 'Hips up: make an upside-down V' : ''),
  },
  archer: {
    // Facing the camera: one arm bends, the other stays straight out to the side.
    joints: ['Shoulder', 'Elbow', 'Wrist'], ...PUSH, sides: 'either',
    shallow: 'Go lower toward the bent arm',
    need: { test: (f, s) => f.sees(other(s), ['Shoulder', 'Elbow', 'Wrist']) && elbow(f, other(s)) > 140, cue: 'Keep the other arm straight' },
  },
  hspu: {
    joints: ['Shoulder', 'Elbow', 'Wrist', 'Hip'], ...PUSH,
    shallow: 'Go lower: head toward the floor',
    form: (f, s) => (f.p(s, 'Hip').y > f.p(s, 'Shoulder').y || f.p(s, 'Wrist').y < f.p(s, 'Shoulder').y ? 'Kick up into a handstand against the wall' : ''),
  },
  dip: {
    joints: ['Shoulder', 'Elbow', 'Wrist', 'Hip'], ...PUSH,
    shallow: 'Go lower: elbows to 90°',
    form: (f, s) => (torso(f, s) < 45 ? 'Keep your chest up' : ''),
  },
  pullup: {
    joints: ['Shoulder', 'Elbow', 'Wrist'], metric: elbow, dir: 'below', work: 90, rest: 145, partial: 120,
    shallow: 'Pull higher: chin over the bar',
    form: (f, s) => (f.p(s, 'Wrist').y > f.p(s, 'Elbow').y ? 'Hang from the bar with your hands above you' : ''),
    need: { test: (f, s) => { const n = f.nose(); return !!n && n.y < f.p(s, 'Wrist').y; }, cue: 'Pull until your chin is over the bar' },
  },
  row: {
    joints: ['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Ankle'], metric: elbow, dir: 'below', work: 95, rest: 145, partial: 120,
    shallow: 'Pull higher: chest to the bar',
    form: (f, s) => {
      if (tilt(f.p(s, 'Shoulder'), f.p(s, 'Ankle')) > 60) return 'Set up under the bar, side-on to the camera';
      return line(f, s, 'Ankle') < 150 ? hipCue(f, s, 'Ankle') : '';
    },
  },
  bridge: {
    joints: ['Shoulder', 'Hip', 'Knee'], metric: hip, dir: 'above', work: 160, rest: 145, partial: 152,
    shallow: 'Lift higher: shoulders, hips and knees in a line',
    form: (f, s) => (tilt(f.p(s, 'Shoulder'), f.p(s, 'Hip')) > 45 ? 'Lie on your back, side-on to the camera' : ''),
  },
  superman: {
    // Hands and feet lift together: the wrist–hip–ankle line bends from flat into a shallow banana.
    joints: ['Shoulder', 'Wrist', 'Hip', 'Ankle'], dir: 'below', work: 160, rest: 170, partial: 165,
    metric: (f, s) => angle(f.p(s, 'Wrist'), f.p(s, 'Hip'), f.p(s, 'Ankle')),
    shallow: 'Lift a little higher and hold',
    form: lying('Lie face down, side-on to the camera'),
    need: {
      test: (f, s) => elevation(f.p(s, 'Hip'), f.p(s, 'Wrist')) > 2 && elevation(f.p(s, 'Hip'), f.p(s, 'Ankle')) > 2,
      cue: 'Lift your arms and legs together',
    },
  },
  snowangel: {
    joints: ['Shoulder', 'Wrist', 'Hip'], metric: arm, dir: 'above', work: 140, rest: 60, partial: 110,
    shallow: 'Sweep your arms all the way overhead',
    form: lying('Lie face down, side-on to the camera'),
  },
  crunch: {
    joints: ['Shoulder', 'Hip', 'Knee'], metric: torso, dir: 'above', work: 22, rest: 10, partial: 16,
    shallow: 'Lift your shoulder blades off the floor',
    form: (f, s) => (torso(f, s) > 70 ? 'Lie on your back, side-on to the camera' : ''),
  },
  bicycle: {
    joints: ['Shoulder', 'Hip', 'Knee'], metric: hip, dir: 'below', work: 95, rest: 135, partial: 115, sides: 'each',
    shallow: 'Bring the knee further in',
    form: lying('Lie on your back, side-on to the camera'),
    need: { test: (f, s) => torso(f, s) > 10, cue: 'Lift your shoulders and twist elbow to knee' },
  },
  deadbug: {
    // From the tabletop (knees at 90°), each leg straightens out in turn.
    joints: ['Shoulder', 'Hip', 'Knee', 'Ankle'], metric: knee, dir: 'above', work: 155, rest: 125, partial: 140, sides: 'each',
    shallow: 'Straighten the leg all the way',
    form: lying('Lie on your back, side-on to the camera'),
  },
  birddog: {
    joints: ['Shoulder', 'Hip', 'Knee'], metric: hip, dir: 'above', work: 155, rest: 125, partial: 140, sides: 'each',
    shallow: 'Reach the leg straight back',
    form: (f, s) => (torso(f, s) > 35 ? 'Get on your hands and knees, side-on to the camera' : ''),
    need: {
      test: f => (['l', 'r'] as Side[]).some(s => f.sees(s, ['Shoulder', 'Wrist', 'Hip']) && arm(f, s) > 130),
      cue: 'Reach the opposite arm forward too',
    },
  },
  legraise: {
    joints: ['Shoulder', 'Hip', 'Knee', 'Ankle'], dir: 'below', work: 110, rest: 150, partial: 130,
    metric: (f, s) => line(f, s, 'Ankle'),
    shallow: 'Lift your legs higher', form: straightLegs,
  },
  kneeraise: {
    joints: ['Shoulder', 'Wrist', 'Hip', 'Knee'], metric: hip, dir: 'below', work: 100, rest: 150, partial: 125,
    shallow: 'Bring your knees higher, toward your chest',
    form: (f, s) => (f.p(s, 'Wrist').y > f.p(s, 'Shoulder').y ? 'Hang from the bar with straight arms' : ''),
  },
  vup: {
    joints: ['Shoulder', 'Wrist', 'Hip', 'Knee', 'Ankle'], dir: 'below', work: 95, rest: 145, partial: 120,
    metric: (f, s) => angle(f.p(s, 'Wrist'), f.p(s, 'Hip'), f.p(s, 'Ankle')),
    shallow: 'Reach higher: hands toward your feet', form: straightLegs,
  },
  climber: {
    joints: ['Shoulder', 'Hip', 'Knee'], metric: hip, dir: 'below', work: 105, rest: 140, partial: 125, sides: 'each',
    shallow: 'Drive the knee further toward your chest',
    form: (f, s) => (torso(f, s) > 45 ? 'Get into a high plank, side-on to the camera' : ''),
  },
  jack: {
    // Arms from the sides to overhead; facing the camera, the feet must go wide as well.
    joints: ['Shoulder', 'Wrist', 'Hip'], metric: arm, dir: 'above', work: 140, rest: 50, partial: 100,
    shallow: 'Arms all the way overhead',
    need: {
      test: f => {
        if (!f.front() || !f.sees('l', ['Ankle']) || !f.sees('r', ['Ankle'])) return true;
        return Math.abs(f.p('l', 'Ankle').x - f.p('r', 'Ankle').x) > 1.6 * Math.abs(f.p('l', 'Hip').x - f.p('r', 'Hip').x);
      },
      cue: 'Jump your feet wide as your arms go up',
    },
  },
  burpee: {
    // Standing (torso upright) → plank (torso flat, body straight) → stand and jump.
    joints: ['Shoulder', 'Hip', 'Knee', 'Ankle'], metric: torso, dir: 'below', work: 30, rest: 65, partial: 45, jump: true,
    shallow: 'Kick your feet back into a plank',
    need: { test: (f, s) => line(f, s, 'Ankle') > 145, cue: 'Kick your feet all the way back into a straight plank' },
  },
  tuckjump: {
    joints: ['Shoulder', 'Hip', 'Knee', 'Ankle'], metric: hip, dir: 'below', work: 100, rest: 150, partial: 125, jump: true,
    shallow: 'Pull your knees higher, toward your chest',
  },
  nordic: {
    // Kneeling upright (knees at 90°) → lowered forward; only the controlled part checks the hips.
    joints: ['Shoulder', 'Hip', 'Knee', 'Ankle'], metric: knee, dir: 'above', work: 145, rest: 115, partial: 130,
    shallow: 'Lower further before you catch yourself',
    form: (f, s) => (knee(f, s) < 140 && hip(f, s) < 145 ? 'Keep your hips straight: lower as one piece' : ''),
  },
  dragonflag: {
    // Body from near vertical (shoulders on the bench) down toward level and back up.
    joints: ['Shoulder', 'Hip', 'Knee', 'Ankle'], dir: 'below', work: 25, rest: 55, partial: 40,
    metric: (f, s) => tilt(f.p(s, 'Shoulder'), f.p(s, 'Ankle')),
    shallow: 'Lower your body further toward level',
    form: (f, s) => (line(f, s, 'Ankle') < 150 ? 'Keep your body straight: don’t bend at the hips' : ''),
  },
};

/** One side's (or the whole body's) rep state machine. */
class RepTrack {
  /** 'idle' until the resting position is seen once, so getting into place never counts. */
  phase: 'idle' | 'rest' | 'moving' | 'work' = 'idle';
  private smooth: number | null = null;
  private badForm = '';
  private reachedPartial = false;
  private needMet = false;
  private jumped = false;
  /** A rep that's waiting for its jump, until this time (jump exercises). */
  private pendingUntil: number | null = null;
  depth = 0;

  constructor(private spec: RepSpec) {}

  /** Feeds one measurement. Returns reps counted (0/1) and a new cue (null = keep the old one). */
  step(raw: number, formCue: string, needOk: boolean, airborne: boolean, t: number): { counted: number; cue: string | null } {
    const { dir, work, rest, partial, shallow, need, jump } = this.spec;
    this.smooth = this.smooth === null ? raw : this.smooth + SMOOTHING * (raw - this.smooth);
    const m = this.smooth;
    const beyond = (thr: number) => (dir === 'below' ? m <= thr : m >= thr);
    const atRest = !beyond(rest) || m === rest;
    let counted = 0;
    let cue: string | null = null;

    if (this.pendingUntil !== null) {
      if (airborne) { counted = 1; cue = ''; this.pendingUntil = null; }
      else if (t > this.pendingUntil || !atRest) { cue = 'Jump: get both feet off the floor (rep not counted)'; this.pendingUntil = null; }
    }

    if (this.phase === 'idle') {
      if (atRest) { this.phase = 'rest'; cue = ''; } else cue = 'Start in the starting position';
    } else if (this.phase === 'rest') {
      if (!atRest) { this.phase = 'moving'; this.badForm = ''; this.reachedPartial = false; this.needMet = false; this.jumped = false; }
    }
    if (this.phase === 'moving' || this.phase === 'work') {
      if (beyond(work)) this.phase = 'work';
      if (beyond(partial)) this.reachedPartial = true;
      if (formCue) this.badForm = formCue;
      if (beyond(work) && needOk) this.needMet = true;
      if (airborne) this.jumped = true;
      if (atRest) {
        if (this.phase !== 'work') { if (this.reachedPartial) cue = shallow; }
        else if (this.badForm) cue = this.badForm + ' (rep not counted)';
        else if (need && !this.needMet) cue = need.cue + ' (rep not counted)';
        else if (jump && !this.jumped) this.pendingUntil = t + JUMP_WINDOW;
        else { counted++; cue = ''; }
        this.phase = 'rest';
      } else if (formCue) cue = formCue;
    }

    this.depth = this.phase === 'idle' ? 0 : Math.max(0, Math.min(1, (m - rest) / (work - rest)));
    return { counted, cue };
  }
}

class RepCounter implements Counter {
  readonly mode = 'reps' as const;
  private s: CounterState = { reps: 0, seconds: 0, inView: false, formOk: false, cue: '', depth: 0 };
  private tracks: Record<Side, RepTrack>;
  /** Jumps: where the ankles rest on the floor (image y), learned while standing. */
  private ground: number | null = null;
  /** When the ankles last went "up" while standing; a long "jump" means the camera moved, so the floor is re-learned. */
  private upSince: number | null = null;

  constructor(private spec: RepSpec) {
    const one = new RepTrack(spec);
    // 'each' keeps a state machine per side; otherwise both names share one.
    this.tracks = spec.sides === 'each' ? { l: one, r: new RepTrack(spec) } : { l: one, r: one };
  }

  state() { return this.s; }

  /** The side(s) to measure this frame, with the track each one feeds. */
  private pick(f: Frame): Side[] {
    const { joints, metric, dir, sides = 'best' } = this.spec;
    if (sides === 'best') { const s = f.side(joints); return s ? [s] : []; }
    const seen = (['l', 'r'] as Side[]).filter(s => f.sees(s, joints));
    if (sides === 'each' || seen.length < 2) return seen;
    const [a, b] = seen.map(s => metric(f, s));
    return [(dir === 'below' ? b < a : b > a) ? seen[1] : seen[0]];
  }

  /** Jumps: are the ankles clearly above the floor line? Also learns the floor while standing. */
  private airborne(f: Frame, s: Side, t: number): boolean {
    if (!this.spec.jump) return false;
    const y = f.p(s, 'Ankle').y;
    const leg = dist(f.p(s, 'Hip'), f.p(s, 'Ankle'));
    let up = this.ground !== null && this.ground - y > JUMP_LIFT * leg;
    const standing = this.tracks[s].phase === 'idle' || this.tracks[s].phase === 'rest';
    this.upSince = up && standing ? (this.upSince ?? t) : null;
    if (this.upSince !== null && t - this.upSince > 1.5) { this.ground = y; this.upSince = null; up = false; }
    // Follows the floor down at once and up slowly, so a jump while standing barely moves it.
    if (this.ground === null || y > this.ground) this.ground = y;
    else if (standing && !up) this.ground += 0.05 * (y - this.ground);
    return up;
  }

  update(lms: Landmark[] | undefined, t: number, aspect: number): CounterState {
    const f = lms?.length ? new Frame(lms, aspect) : null;
    const sides = f ? this.pick(f) : [];
    if (!f || !sides.length) return (this.s = { ...this.s, inView: false, formOk: false, cue: 'Step back so your whole body is in view' });

    const { metric, form, need } = this.spec;
    let { reps, cue } = this.s;
    let formOk = true, depth = 0;
    for (const s of sides) {
      const track = this.tracks[s];
      const formCue = form?.(f, s) ?? '';
      const r = track.step(metric(f, s), formCue, need?.test(f, s) ?? true, this.airborne(f, s, t), t);
      reps += r.counted;
      if (r.cue !== null) cue = r.cue;
      if (track.phase === 'idle' || formCue) formOk = false;
      depth = Math.max(depth, track.depth);
    }
    return (this.s = { reps, seconds: 0, inView: true, formOk, cue, depth });
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
  hollow: {
    joints: ['Shoulder', 'Hip', 'Knee', 'Ankle'],
    check: (f, s) => {
      const legs = tilt(f.p(s, 'Hip'), f.p(s, 'Ankle'));
      if (torso(f, s) > 50 || legs > 60) return 'Lie on your back, side-on to the camera';
      if (knee(f, s) < 145) return 'Keep your legs straight';
      if (torso(f, s) < 6) return 'Lift your shoulders off the floor';
      if (legs < 6) return 'Lift your feet a little off the floor';
      return legs > 40 ? 'Lower your legs toward the floor' : '';
    },
  },
  lsit: {
    joints: ['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Knee', 'Ankle'],
    check: (f, s) => {
      const h = f.p(s, 'Hip'), a = f.p(s, 'Ankle'), w = f.p(s, 'Wrist');
      if (torso(f, s) < 50) return 'Sit up tall, hands beside your hips, side-on to the camera';
      if (elbow(f, s) < 150) return 'Straighten your arms and press down';
      if (knee(f, s) < 150) return 'Keep your legs straight';
      if (tilt(h, a) > 25) return a.y < h.y ? 'Lower your legs to hip height' : 'Lift your legs to hip height';
      return w.y - a.y < 0.12 * dist(f.p(s, 'Shoulder'), h) ? 'Press through your hands to lift your legs off the floor' : '';
    },
  },
};

class HoldCounter implements Counter {
  readonly mode = 'hold' as const;
  private s: CounterState = { reps: 0, seconds: 0, inView: false, formOk: false, cue: '', depth: 0 };
  private last: number | null = null;
  constructor(private spec: HoldSpec) {}
  state() { return this.s; }
  update(lms: Landmark[] | undefined, t: number, aspect: number): CounterState {
    const dt = this.last === null ? 0 : t - this.last;
    this.last = t;
    const f = lms?.length ? new Frame(lms, aspect) : null;
    const side = f?.side(this.spec.joints) ?? null;
    if (!f || !side) return (this.s = { ...this.s, inView: false, formOk: false, cue: 'Step back so your whole body is in view', depth: 0 });
    const cue = this.spec.check(f, side);
    const seconds = this.s.seconds + (!cue && dt > 0 && dt <= MAX_FRAME_GAP ? dt : 0);
    return (this.s = { reps: 0, seconds, inView: true, formOk: !cue, cue, depth: cue ? 0 : 1 });
  }
}

/* ---------------- watch (no counter yet) ---------------- */

/**
 * For exercises without a counter: counts the seconds a person is in view. Every bundled
 * exercise has a counter now; this covers a newer catalog (an unknown `tracker`) on an old page.
 */
class WatchCounter implements Counter {
  readonly mode = 'watch' as const;
  private s: CounterState = { reps: 0, seconds: 0, inView: false, formOk: false, cue: '', depth: 0 };
  private last: number | null = null;
  state() { return this.s; }
  update(lms: Landmark[] | undefined, t: number): CounterState {
    const dt = this.last === null ? 0 : t - this.last;
    this.last = t;
    const seen = !!lms?.length && [LM.lShoulder, LM.rShoulder, LM.lHip, LM.rHip].filter(i => (lms[i]?.visibility ?? 1) >= MIN_VISIBILITY).length >= 2;
    if (!seen) return (this.s = { ...this.s, inView: false, formOk: false, cue: 'Step into view of the camera' });
    const seconds = this.s.seconds + (dt > 0 && dt <= MAX_FRAME_GAP ? dt : 0);
    return (this.s = { ...this.s, seconds, inView: true, formOk: true, cue: '' });
  }
}

/** The counter for an exercise: its catalog `tracker`, or a watch timer if it has none. */
export function createCounter(ex: Pick<Exercise, 'tracker'>): Counter {
  const kind = ex.tracker;
  const rep = kind && REP_SPECS[kind];
  if (rep) return new RepCounter(rep);
  const hold = kind && HOLD_SPECS[kind];
  if (hold) return new HoldCounter(hold);
  return new WatchCounter();
}

/** Whether this page has a counter for the tracker (a newer catalog may name one it doesn't know). */
export const hasCounter = (kind: string | undefined) => !!kind && (kind in REP_SPECS || kind in HOLD_SPECS);

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
