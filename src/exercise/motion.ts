// Movement demos: a looping stick-figure animation for every catalog exercise.
//
// A figure is a 2D skeleton (hip → neck → head, two arms, two legs) posed by keyframes. Bones
// keep their length: each limb is given either as two absolute angles (upper and lower bone) or
// as a target point for the hand/foot, solved with two-bone IK, so planted hands and feet stay
// put while the body moves. Angles are degrees in screen space: 0 points down, 90 right, 180 up,
// −90 left (direction = (sin a, cos a)). In side view the figure faces right; limb 0 is the near
// one (drawn solid), limb 1 the far one. In front view limb 0 is on the screen's left.
//
// The scene is 160 × 120 units with the floor at y = 112 (a motion can move its `box`). Keyframes
// loop: each one says how long the move into it takes and how long it holds.

export type Pt = [number, number];
/** [upper, lower] absolute angles, or a target for the end of the limb (`rel`: relative to the neck). */
export type Limb = [number, number] | { to: Pt; bend?: 1 | -1; rel?: 'neck' };

export interface Pose {
  /** Hip position, or `neck` instead (then the hip follows from the torso angle). */
  hip?: Pt;
  neck?: Pt;
  /** Angle of hip → neck. */
  torso: number;
  /** Head tilt relative to the torso. */
  head?: number;
  legs: [Limb, Limb];
  arms: [Limb, Limb];
  /** Absolute foot angles (ankle → toe). Default: pointing the way the figure faces. */
  feet?: [number, number];
  /** Foreshortening of the torso and legs (pointing away from the viewer), 0–1. */
  short?: number;
}

export type Prop =
  | { k: 'wall'; x: number }
  | { k: 'bench'; x: number; y: number; w: number }
  | { k: 'bar'; x: number; y: number; w: number; post?: 'left' | 'right' | 'both' }
  | { k: 'block'; x: number; y: number; w: number; h: number };

export interface Frame { p: Pose; ms?: number; hold?: number }

export interface Motion {
  view?: 'side' | 'front';
  frames: Frame[];
  props?: Prop[];
  floor?: boolean;
  /** viewBox [x, y, w, h]; default [0, 0, 160, 120]. */
  box?: [number, number, number, number];
  /** Shown under the figure, e.g. "Seen from above". */
  note?: string;
  /** Index of the frame that best shows the exercise (used for still images). Default 1. */
  key?: number;
}

export const FLOOR = 112;
export const BONES = { torso: 30, neck: 5, headR: 6.5, upperArm: 18, forearm: 17, thigh: 23, shin: 22, foot: 8 } as const;
const HIP_W = 5, SHOULDER_W = 9;
const ANKLE_Y = FLOOR - 2;
/** Ankle height when up on the toes (plank, push-up). */
const TOE_Y = FLOOR - 5;

const rad = (a: number) => (a * Math.PI) / 180;
const dir = (a: number): Pt => [Math.sin(rad(a)), Math.cos(rad(a))];
const add = (p: Pt, a: number, len: number): Pt => { const d = dir(a); return [p[0] + d[0] * len, p[1] + d[1] * len]; };
const angleTo = (p: Pt, q: Pt) => (Math.atan2(q[0] - p[0], q[1] - p[1]) * 180) / Math.PI;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/** Two-bone IK: the joint and end of a limb from `root` reaching for `target`. */
function solve(root: Pt, target: Pt, a: number, b: number, bend: number): [Pt, Pt] {
  const d = Math.min(Math.max(Math.hypot(target[0] - root[0], target[1] - root[1]), Math.abs(a - b) + 0.01), a + b - 0.001);
  const base = angleTo(root, target);
  const alpha = (Math.acos((a * a + d * d - b * b) / (2 * a * d)) * 180) / Math.PI;
  const joint = add(root, base + bend * alpha, a);
  return [joint, add(joint, angleTo(joint, target), b)];
}

export interface Skeleton {
  hip: Pt; neck: Pt; head: Pt;
  /** Root, joint, end (+ toe for legs) per limb. */
  legs: [Pt[], Pt[]];
  arms: [Pt[], Pt[]];
  front: boolean;
}

function limbPoints(root: Pt, limb: Limb, a: number, b: number, bendDefault: 1 | -1, neck: Pt): [Pt, Pt] {
  if (Array.isArray(limb)) { const j = add(root, limb[0], a); return [j, add(j, limb[1], b)]; }
  const to: Pt = limb.rel === 'neck' ? [neck[0] + limb.to[0], neck[1] + limb.to[1]] : limb.to;
  return solve(root, to, a, b, limb.bend ?? bendDefault);
}

/** Joint positions for a pose. */
export function skeleton(p: Pose, front = false): Skeleton {
  const k = p.short ?? 1;
  const hip: Pt = p.hip ?? add(p.neck!, p.torso + 180, BONES.torso * k);
  const neck: Pt = p.neck ?? add(hip, p.torso, BONES.torso * k);
  const head = add(neck, p.torso + (p.head ?? 0), (BONES.neck + BONES.headR) * Math.max(k, 0.8));
  const side = (c: Pt, w: number, i: number): Pt => (front ? add(c, p.torso + (i === 0 ? 90 : -90), w) : c);
  const legs = p.legs.map((l, i) => {
    const root = side(hip, HIP_W, i);
    const [knee, ankle] = limbPoints(root, l, BONES.thigh * k, BONES.shin * k, 1, neck);
    const footA = p.feet?.[i] ?? (front ? (i === 0 ? -90 : 90) : 90);
    return [root, knee, ankle, add(ankle, footA, (front ? BONES.foot * 0.6 : BONES.foot) * k)];
  }) as [Pt[], Pt[]];
  const arms = p.arms.map((l, i) => {
    const root = side(neck, SHOULDER_W, i);
    return [root, ...limbPoints(root, l, BONES.upperArm, BONES.forearm, -1, neck)];
  }) as [Pt[], Pt[]];
  return { hip, neck, head, legs, arms, front };
}

/** A limb halfway between two keyframes. Matching kinds blend in their own terms; mixed ones blend angles. */
function blendLimb(a: Limb, b: Limb, t: number, ra: Pt[], rb: Pt[]): Limb {
  if (Array.isArray(a) && Array.isArray(b)) return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  if (!Array.isArray(a) && !Array.isArray(b) && (a.rel ?? '') === (b.rel ?? '') && (a.bend ?? 0) === (b.bend ?? 0))
    return { to: lerpPt(a.to, b.to, t), bend: a.bend, rel: a.rel };
  const ang = (pts: Pt[]): [number, number] => [angleTo(pts[0], pts[1]), angleTo(pts[1], pts[2])];
  const [a0, a1] = ang(ra), [b0, b1] = ang(rb);
  // shortest way round
  const near = (x: number, y: number) => y + Math.round((x - y) / 360) * 360;
  return [lerp(a0, near(a0, b0), t), lerp(a1, near(a1, b1), t)];
}

/** The pose t (0–1) of the way from a to b. */
export function blend(a: Pose, b: Pose, t: number, front = false): Pose {
  const sa = skeleton(a, front), sb = skeleton(b, front);
  const byNeck = !!(a.neck && b.neck);
  const p: Pose = {
    torso: lerp(a.torso, b.torso, t),
    short: a.short === undefined && b.short === undefined ? undefined : lerp(a.short ?? 1, b.short ?? 1, t),
    head: lerp(a.head ?? 0, b.head ?? 0, t),
    legs: [blendLimb(a.legs[0], b.legs[0], t, sa.legs[0], sb.legs[0]), blendLimb(a.legs[1], b.legs[1], t, sa.legs[1], sb.legs[1])],
    arms: [blendLimb(a.arms[0], b.arms[0], t, sa.arms[0], sb.arms[0]), blendLimb(a.arms[1], b.arms[1], t, sa.arms[1], sb.arms[1])],
  };
  if (byNeck) p.neck = lerpPt(sa.neck, sb.neck, t); else p.hip = lerpPt(sa.hip, sb.hip, t);
  if (a.feet || b.feet) {
    const fa = a.feet ?? [sa.front ? -90 : 90, 90], fb = b.feet ?? [sb.front ? -90 : 90, 90];
    p.feet = [lerp(fa[0], fb[0], t), lerp(fa[1], fb[1], t)];
  }
  return p;
}

const ease = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2;
const DEFAULT_MS = 700;

/** Length of one loop, in ms. */
export function cycleMs(m: Motion): number {
  return m.frames.reduce((s, f) => s + (f.ms ?? DEFAULT_MS) + (f.hold ?? 0), 0);
}

/** The pose at time `ms` into the loop. Each frame's `ms` is the move into it (frame 0's closes the loop). */
export function poseAt(m: Motion, ms: number): Pose {
  const n = m.frames.length;
  if (n === 1) return m.frames[0].p;
  let t = ((ms % cycleMs(m)) + cycleMs(m)) % cycleMs(m);
  for (let i = 1; i <= n; i++) {
    const f = m.frames[i % n], move = f.ms ?? DEFAULT_MS;
    if (t < move) return blend(m.frames[i - 1].p, f.p, ease(t / move), m.view === 'front');
    t -= move;
    const hold = f.hold ?? 0;
    if (t < hold) return f.p;
    t -= hold;
  }
  return m.frames[0].p;
}

/* ---------------- Pose helpers ---------------- */

const STAND_HIP: Pt = [80, ANKLE_Y - BONES.thigh - BONES.shin + 0.5];
const armsDown: [Limb, Limb] = [[6, 2], [-6, -4]];

/** Standing tall, feet under the hips. */
function stand(x = 80, arms: [Limb, Limb] = armsDown): Pose {
  return { hip: [x, STAND_HIP[1]], torso: 180, legs: [{ to: [x + 1, ANKLE_Y] }, { to: [x - 1, ANKLE_Y] }], arms };
}

/** A straight body from the ankles (or knees) at `ang` (ankle → neck direction). */
function plankFrom(foot: Pt, ang: number, arms: [Limb, Limb], opts: { knees?: boolean; feet?: [number, number] } = {}): Pose {
  if (opts.knees) {
    const hip = add(foot, ang, BONES.thigh);
    return { hip, torso: ang, legs: [[ang - 180, -115], [ang - 180, -120]], arms, feet: [-150, -150] };
  }
  const hip = add(foot, ang, BONES.thigh + BONES.shin);
  return { hip, torso: ang, legs: [[ang - 180, ang - 180], [ang - 180, ang - 180]], arms, feet: opts.feet ?? [60, 60] };
}

/** Angle from `foot` such that the neck sits at height `neckY` on a straight body (`len` = foot → neck). */
function bodyAngle(neckY: number, foot: Pt, len = BONES.thigh + BONES.shin + BONES.torso): number {
  const dy = neckY - foot[1];
  return angleTo([0, 0], [Math.sqrt(Math.max(len * len - dy * dy, 0)), dy]);
}

/** Push-up family: straight body from the feet, hands planted; `neckY` sets the depth. */
function pushup(foot: Pt, neckY: number, hands: Pt, opts: { knees?: boolean; feet?: [number, number]; bend?: 1 | -1; far?: Pt } = {}): Pose {
  const len = (opts.knees ? BONES.thigh : BONES.thigh + BONES.shin) + BONES.torso;
  const ang = bodyAngle(neckY, foot, len);
  const bend = opts.bend ?? -1;
  return plankFrom(foot, ang, [{ to: hands, bend }, { to: opts.far ?? [hands[0] - 2, hands[1]], bend }], opts);
}

/** Lying on the back, head on the left, shoulders at x = `nx`. */
const LIE_Y = FLOOR - 6;
function onBack(legs: [Limb, Limb], arms: [Limb, Limb], torso = -90, nx = 44, extra: Partial<Pose> = {}): Pose {
  return { neck: [nx, LIE_Y], torso, legs, arms, ...extra };
}
const armsAlongside: [Limb, Limb] = [{ to: [80, ANKLE_Y] }, { to: [78, ANKLE_Y] }];
const kneesBent: [Limb, Limb] = [{ to: [96, ANKLE_Y] }, { to: [94, ANKLE_Y] }];

/** Kneeling upright or leaning forward on a straight body pivoting at the knee. */
function kneel(knee: Pt, ang: number, arms: [Limb, Limb]): Pose {
  return { hip: add(knee, ang, BONES.thigh), torso: ang, legs: [[ang - 180, -90], [ang - 180, -90]], arms, feet: [-90, -90] };
}

/** Squat: feet planted at x, hip at (hx, hy). */
function squat(hx: number, hy: number, torso: number, arms: [Limb, Limb], x = 80): Pose {
  return { hip: [hx, hy], torso, legs: [{ to: [x + 1, ANKLE_Y] }, { to: [x - 1, ANKLE_Y] }], arms };
}
const armsForward: [Limb, Limb] = [[95, 92], [90, 88]];
const armsUp: [Limb, Limb] = [[168, 175], [162, 170]];

/** In the air: everything moved up by `dy`. */
function lift(p: Pose, dy: number, feet?: [number, number]): Pose {
  const up = (l: Limb): Limb => (Array.isArray(l) || l.rel ? l : { ...l, to: [l.to[0], l.to[1] - dy] });
  return {
    ...p, hip: p.hip ? [p.hip[0], p.hip[1] - dy] : undefined, neck: p.neck ? [p.neck[0], p.neck[1] - dy] : undefined,
    legs: [up(p.legs[0]), up(p.legs[1])], arms: [up(p.arms[0]), up(p.arms[1])], feet: feet ?? p.feet,
  };
}

/* Hanging from a bar at y = BAR_Y. */
const BAR_Y = 6;
const HANG_BOX: Motion['box'] = [0, -6, 160, 120];
function hang(neckY: number, legs: [Limb, Limb], torso = 180, x = 80, elbows: 1 | -1 = -1): Pose {
  return { neck: [x, neckY], torso, legs, arms: [{ to: [x + 3, BAR_Y], bend: elbows }, { to: [x - 3, BAR_Y], bend: elbows }] };
}
const hangLegs: [Limb, Limb] = [[4, -18], [-2, -26]];

/* ---------------- Exercises ---------------- */

const s = stand();
const squatBottom = squat(64, 89, 140, armsForward);
const pushFoot: Pt = [26, TOE_Y];
const pushHands: Pt = [96, ANKLE_Y];
const pushUp = pushup(pushFoot, 75, pushHands);
const pushDown = pushup(pushFoot, 100, pushHands);
const plankHi = pushup([28, TOE_Y], 75, [98, ANKLE_Y]);

function lunge(backNear: boolean, frontX: number, backX: number, hip: Pt, torso = 178): Pose {
  const front: Limb = { to: [frontX, ANKLE_Y] }, back: Limb = { to: [backX, ANKLE_Y - 5] };
  return { hip, torso, legs: backNear ? [back, front] : [front, back], arms: [{ to: [hip[0] + 2, hip[1] + 2] }, { to: [hip[0] - 1, hip[1] + 2] }], feet: backNear ? [50, 90] : [90, 50] };
}
const handsOnHips: [Limb, Limb] = [{ to: [STAND_HIP[0] + 3, STAND_HIP[1]] }, { to: [STAND_HIP[0] - 2, STAND_HIP[1]] }];

// Front view (jacks, side lunge, archer and wide push-ups)
function frontStand(feetApart = 6, arms: [Limb, Limb] = [[-8, -4], [8, 4]], hipY = STAND_HIP[1]): Pose {
  return { hip: [80, hipY], torso: 180, legs: [{ to: [80 - feetApart, ANKLE_Y], bend: -1 }, { to: [80 + feetApart, ANKLE_Y], bend: 1 }], arms };
}
/** Push-up seen from the front: shoulders at height `y`, hips/legs going away (foreshortened). */
function frontPush(nx: number, y: number, hands: [Pt, Pt]): Pose {
  return { neck: [nx, y], torso: 0, short: 0.3, legs: [[176, 178], [184, 182]], arms: [{ to: hands[1], bend: 1 }, { to: hands[0], bend: -1 }], feet: [180, 180] };
}

export const MOTIONS: Record<string, Motion> = {
  'air-squat': { frames: [{ p: s, hold: 250 }, { p: squatBottom, ms: 1000, hold: 200 }] },
  'jump-squat': {
    frames: [
      { p: s, ms: 300, hold: 250 },
      { p: squatBottom, ms: 700, hold: 100 },
      { p: lift(stand(80, armsUp), 14, [25, 25]), ms: 280, hold: 60 },
      { p: squat(72, 78, 160, armsForward), ms: 260 },
    ],
  },
  'glute-bridge': {
    frames: [
      { p: onBack(kneesBent, armsAlongside), hold: 250 },
      { p: onBack(kneesBent, armsAlongside, -55, 44, { head: -35 }), ms: 800, hold: 600 },
    ],
  },
  'single-leg-bridge': {
    frames: [
      { p: onBack([{ to: [96, ANKLE_Y] }, [100, 100]], armsAlongside), hold: 250 },
      { p: onBack([{ to: [96, ANKLE_Y] }, [128, 124]], armsAlongside, -55, 44, { head: -35 }), ms: 800, hold: 600 },
    ],
  },
  'reverse-lunge': {
    frames: [
      { p: stand(80, handsOnHips), hold: 200 },
      { p: lunge(true, 84, 44, [64, 88]), ms: 900, hold: 200 },
      { p: stand(80, handsOnHips), ms: 900, hold: 200 },
      { p: lunge(false, 84, 44, [64, 88]), ms: 900, hold: 200 },
    ],
  },
  'walking-lunge': {
    frames: [
      { p: stand(70, handsOnHips), hold: 150 },
      { p: lunge(true, 106, 68, [88, 88]), ms: 900, hold: 200 },
      { p: stand(70, handsOnHips), ms: 900, hold: 150 },
      { p: lunge(false, 106, 68, [88, 88]), ms: 900, hold: 200 },
    ],
  },
  'bulgarian-split-squat': {
    props: [{ k: 'bench', x: 14, y: 86, w: 30 }],
    frames: [
      { p: { hip: [70, 66], torso: 176, legs: [{ to: [88, ANKLE_Y] }, { to: [36, 82] }], arms: [[10, 4], [-4, -2]], feet: [90, -95] }, hold: 200 },
      { p: { hip: [64, 87], torso: 166, legs: [{ to: [88, ANKLE_Y] }, { to: [36, 82] }], arms: [[14, 8], [0, 2]], feet: [90, -95] }, ms: 1000, hold: 200 },
    ],
  },
  'jumping-lunge': {
    frames: [
      { p: lunge(false, 100, 56, [76, 84]), hold: 150 },
      { p: lift({ hip: [78, 64], torso: 180, legs: [[30, -20], [-20, -40]], arms: armsDown }, 10, [60, 60]), ms: 380 },
      { p: lunge(true, 100, 56, [76, 84]), ms: 380, hold: 150 },
      { p: lift({ hip: [78, 64], torso: 180, legs: [[-20, -40], [30, -20]], arms: armsDown }, 10, [60, 60]), ms: 380 },
    ],
  },
  'pistol-squat': {
    frames: [
      { p: { hip: [80, STAND_HIP[1]], torso: 180, legs: [{ to: [81, ANKLE_Y] }, [24, 24]], arms: armsForward }, hold: 250 },
      { p: { hip: [66, 96], torso: 138, legs: [{ to: [81, ANKLE_Y] }, [88, 88]], arms: [[98, 95], [94, 92]] }, ms: 1400, hold: 250 },
    ],
  },
  'side-lunge': {
    view: 'front',
    frames: [
      { p: frontStand(20, [{ to: [-2, 16], rel: 'neck', bend: 1 }, { to: [2, 16], rel: 'neck', bend: -1 }]), hold: 200 },
      { p: { hip: [62, 86], torso: 172, legs: [{ to: [57, ANKLE_Y], bend: -1 }, { to: [104, ANKLE_Y], bend: 1 }], arms: [{ to: [-2, 16], rel: 'neck', bend: 1 }, { to: [2, 16], rel: 'neck', bend: -1 }] }, ms: 900, hold: 200 },
      { p: frontStand(20, [{ to: [-2, 16], rel: 'neck', bend: 1 }, { to: [2, 16], rel: 'neck', bend: -1 }]), ms: 900, hold: 200 },
      { p: { hip: [98, 86], torso: 188, legs: [{ to: [56, ANKLE_Y], bend: -1 }, { to: [103, ANKLE_Y], bend: 1 }], arms: [{ to: [-2, 16], rel: 'neck', bend: 1 }, { to: [2, 16], rel: 'neck', bend: -1 }] }, ms: 900, hold: 200 },
    ],
  },
  'wall-sit': {
    props: [{ k: 'wall', x: 38 }],
    frames: [
      { p: { hip: [46, STAND_HIP[1] + 2], torso: 178, legs: [{ to: [60, ANKLE_Y] }, { to: [58, ANKLE_Y] }], arms: armsDown }, hold: 300 },
      { p: { hip: [46, 88], torso: 180, legs: [{ to: [70, ANKLE_Y] }, { to: [68, ANKLE_Y] }], arms: [{ to: [64, 86] }, { to: [62, 86] }] }, ms: 1000, hold: 2600 },
    ],
  },
  'calf-raise': {
    frames: [
      { p: stand(), hold: 200 },
      { p: { hip: [82, STAND_HIP[1] - 9], torso: 180, legs: [{ to: [83, ANKLE_Y - 9] }, { to: [81, ANKLE_Y - 9] }], arms: armsDown, feet: [28, 28] }, ms: 600, hold: 500 },
    ],
  },
  'incline-pushup': {
    props: [{ k: 'bench', x: 88, y: 90, w: 34 }],
    frames: [
      { p: pushup([28, TOE_Y], 56, [98, 88]), hold: 200 },
      { p: pushup([28, TOE_Y], 80, [98, 88]), ms: 900, hold: 150 },
    ],
  },
  'knee-pushup': {
    frames: [
      { p: pushup([48, FLOOR - 4], 76, pushHands, { knees: true }), hold: 200 },
      { p: pushup([48, FLOOR - 4], 100, pushHands, { knees: true }), ms: 900, hold: 150 },
    ],
  },
  'wall-pushup': {
    props: [{ k: 'wall', x: 120 }],
    frames: [
      { p: plankFrom([62, ANKLE_Y], 158, [{ to: [118, 44], bend: 1 }, { to: [118, 46], bend: 1 }], { feet: [70, 70] }), hold: 200 },
      { p: plankFrom([62, ANKLE_Y], 145, [{ to: [118, 44], bend: 1 }, { to: [118, 46], bend: 1 }], { feet: [70, 70] }), ms: 900, hold: 150 },
    ],
  },
  'pushup': { frames: [{ p: pushUp, hold: 200 }, { p: pushDown, ms: 900, hold: 150 }] },
  'wide-pushup': {
    view: 'front',
    note: 'Seen from the front',
    frames: [
      { p: frontPush(80, 78, [[50, ANKLE_Y], [110, ANKLE_Y]]), hold: 200 },
      { p: frontPush(80, 94, [[50, ANKLE_Y], [110, ANKLE_Y]]), ms: 900, hold: 150 },
    ],
  },
  'diamond-pushup': {
    frames: [
      { p: pushup(pushFoot, 75, [90, ANKLE_Y]), hold: 200 },
      { p: pushup(pushFoot, 100, [90, ANKLE_Y]), ms: 900, hold: 150 },
    ],
  },
  'decline-pushup': {
    props: [{ k: 'bench', x: 8, y: 88, w: 30 }],
    frames: [
      { p: pushup([26, 86], 76, [104, ANKLE_Y], { feet: [-30, -30] }), hold: 200 },
      { p: pushup([26, 86], 98, [104, ANKLE_Y], { feet: [-30, -30] }), ms: 900, hold: 150 },
    ],
  },
  'clap-pushup': {
    frames: [
      { p: pushUp, hold: 150 },
      { p: pushDown, ms: 700, hold: 60 },
      { p: pushup(pushFoot, 66, pushHands, { far: [100, ANKLE_Y] }), ms: 220 },
      { p: { ...pushup(pushFoot, 62, pushHands), arms: [{ to: [8, 18], rel: 'neck' }, { to: [8, 18], rel: 'neck' }] }, ms: 160, hold: 80 },
      { p: pushup(pushFoot, 80, pushHands), ms: 220 },
    ],
  },
  'archer-pushup': {
    view: 'front',
    note: 'Seen from the front',
    frames: [
      { p: frontPush(80, 82, [[52, ANKLE_Y], [108, ANKLE_Y]]), hold: 200 },
      { p: frontPush(64, 95, [[52, ANKLE_Y], [108, ANKLE_Y]]), ms: 1000, hold: 200 },
      { p: frontPush(80, 82, [[52, ANKLE_Y], [108, ANKLE_Y]]), ms: 1000, hold: 200 },
      { p: frontPush(96, 95, [[52, ANKLE_Y], [108, ANKLE_Y]]), ms: 1000, hold: 200 },
    ],
  },
  'pike-pushup': {
    frames: [
      { p: { hip: [60, 66], torso: 44, legs: [{ to: [42, ANKLE_Y] }, { to: [40, ANKLE_Y] }], arms: [{ to: [100, ANKLE_Y] }, { to: [98, ANKLE_Y] }], feet: [70, 70] }, hold: 200 },
      { p: { hip: [64, 68], torso: 30, legs: [{ to: [42, ANKLE_Y] }, { to: [40, ANKLE_Y] }], arms: [{ to: [100, ANKLE_Y] }, { to: [98, ANKLE_Y] }], feet: [70, 70] }, ms: 900, hold: 150 },
    ],
  },
  'wall-hspu': {
    props: [{ k: 'wall', x: 46 }],
    box: [0, -10, 160, 124],
    frames: [
      { p: { neck: [66, 78], torso: -6, legs: [[184, 182], [186, 184]], arms: [{ to: [70, ANKLE_Y], bend: 1 }, { to: [68, ANKLE_Y], bend: 1 }], feet: [170, 170] }, hold: 200 },
      { p: { neck: [68, 95], torso: -8, legs: [[185, 183], [187, 185]], arms: [{ to: [70, ANKLE_Y], bend: 1 }, { to: [68, ANKLE_Y], bend: 1 }], feet: [170, 170] }, ms: 1000, hold: 150 },
    ],
  },
  'bench-dip': {
    props: [{ k: 'bench', x: 26, y: 82, w: 32 }],
    frames: [
      { p: { neck: [62, 49], torso: 178, legs: [{ to: [100, ANKLE_Y] }, { to: [98, ANKLE_Y] }], arms: [{ to: [56, 80] }, { to: [54, 80] }] }, hold: 200 },
      { p: { neck: [63, 68], torso: 176, legs: [{ to: [100, ANKLE_Y] }, { to: [98, ANKLE_Y] }], arms: [{ to: [56, 80] }, { to: [54, 80] }] }, ms: 900, hold: 150 },
    ],
  },
  'parallel-dip': {
    props: [{ k: 'bar', x: 80, y: 56, w: 26, post: 'both' }],
    frames: [
      { p: { neck: [80, 22], torso: 178, legs: [[8, -60], [2, -66]], arms: [{ to: [81, 56] }, { to: [79, 56] }] }, hold: 200 },
      { p: { neck: [84, 42], torso: 165, legs: [[22, -60], [16, -66]], arms: [{ to: [81, 56] }, { to: [79, 56] }] }, ms: 1000, hold: 150 },
    ],
  },
  'pull-up': {
    floor: false, box: HANG_BOX,
    props: [{ k: 'bar', x: 80, y: BAR_Y, w: 56 }],
    frames: [
      { p: hang(BAR_Y + 35, hangLegs), hold: 250 },
      { p: hang(BAR_Y + 9, hangLegs, 178), ms: 1000, hold: 250 },
    ],
  },
  'chin-up': {
    floor: false, box: HANG_BOX,
    props: [{ k: 'bar', x: 80, y: BAR_Y, w: 56 }],
    frames: [
      { p: hang(BAR_Y + 35, hangLegs), hold: 250 },
      { p: hang(BAR_Y + 9, hangLegs, 178), ms: 1000, hold: 250 },
    ],
  },
  'inverted-row': {
    props: [{ k: 'bar', x: 108, y: 66, w: 28, post: 'right' }],
    frames: [
      { p: { ...plankFrom([24, ANKLE_Y], bodyAngle(98, [24, ANKLE_Y]), [{ to: [102, 66] }, { to: [100, 66] }]), feet: [180, 180] }, hold: 200 },
      { p: { ...plankFrom([24, ANKLE_Y], bodyAngle(74, [24, ANKLE_Y]), [{ to: [102, 66] }, { to: [100, 66] }]), feet: [180, 180] }, ms: 900, hold: 250 },
    ],
  },
  'superman': {
    frames: [
      { p: { neck: [100, LIE_Y], torso: 90, legs: [[-90, -90], [-90, -90]], arms: [[90, 90], [90, 90]], feet: [-90, -90] }, hold: 300 },
      { p: { hip: [70, LIE_Y], torso: 102, legs: [[-98, -100], [-97, -99]], arms: [[106, 108], [104, 106]], feet: [-100, -100] }, ms: 700, hold: 900 },
    ],
  },
  'reverse-snow-angel': {
    view: 'front', floor: false, note: 'Seen from above, lying face down',
    frames: [
      { p: frontStand(4, [[-12, -8], [12, 8]]), hold: 200 },
      { p: frontStand(4, [[-90, -95], [90, 95]]), ms: 800 },
      { p: frontStand(4, [[-165, -170], [165, 170]]), ms: 800, hold: 300 },
      { p: frontStand(4, [[-90, -95], [90, 95]]), ms: 800 },
    ],
  },
  'forearm-plank': {
    frames: [
      { p: plankFrom([48, FLOOR - 4], bodyAngle(91, [48, FLOOR - 4], 53), [[0, 90], [0, 90]], { knees: true }), hold: 200 },
      { p: plankFrom([26, TOE_Y], bodyAngle(91, [26, TOE_Y]), [[0, 90], [-2, 90]]), ms: 800, hold: 2800 },
    ],
  },
  'side-plank': {
    note: 'Seen from the front',
    frames: [
      { p: { neck: [108, 89], torso: 105, legs: [[-70, -80], [-70, -80]], arms: [[0, 90], [175, 178]], feet: [60, 60] }, hold: 200 },
      { p: plankFrom([32, TOE_Y], bodyAngle(91, [32, TOE_Y]), [[0, 90], [178, 180]]), ms: 800, hold: 2800 },
    ],
  },
  'dead-bug': {
    frames: [
      { p: onBack([[180, 90], [180, 90]], [[180, 180], [180, 180]]), hold: 150 },
      { p: onBack([[180, 90], [100, 98]], [[260, 260], [180, 180]]), ms: 900, hold: 250 },
      { p: onBack([[180, 90], [180, 90]], [[180, 180], [180, 180]]), ms: 900, hold: 150 },
      { p: onBack([[100, 98], [180, 90]], [[180, 180], [260, 260]]), ms: 900, hold: 250 },
    ],
  },
  'crunch': {
    frames: [
      { p: onBack(kneesBent, [{ to: [10, -6], rel: 'neck', bend: 1 }, { to: [10, -6], rel: 'neck', bend: 1 }]), hold: 200 },
      { p: { hip: [74, LIE_Y], torso: -116, legs: kneesBent, arms: [{ to: [12, -8], rel: 'neck', bend: 1 }, { to: [12, -8], rel: 'neck', bend: 1 }] }, ms: 700, hold: 300 },
    ],
  },
  'bicycle-crunch': {
    frames: [
      { p: { hip: [74, LIE_Y], torso: -118, legs: [[215, 85], [100, 100]], arms: [{ to: [-4, -12], rel: 'neck', bend: 1 }, { to: [-4, -12], rel: 'neck', bend: 1 }] }, ms: 600, hold: 120 },
      { p: { hip: [74, LIE_Y], torso: -112, legs: [[100, 100], [215, 85]], arms: [{ to: [-4, -12], rel: 'neck', bend: 1 }, { to: [-4, -12], rel: 'neck', bend: 1 }] }, ms: 600, hold: 120 },
    ],
  },
  'bird-dog': {
    frames: [
      { p: { hip: [56, 85], torso: 98, legs: [[0, -90], [0, -90]], arms: [{ to: [87, ANKLE_Y] }, { to: [85, ANKLE_Y] }], feet: [-90, -90] }, hold: 150 },
      { p: { hip: [56, 85], torso: 98, legs: [[0, -90], [-92, -92]], arms: [[94, 94], { to: [85, ANKLE_Y] }], feet: [-90, -90] }, ms: 900, hold: 400 },
      { p: { hip: [56, 85], torso: 98, legs: [[0, -90], [0, -90]], arms: [{ to: [87, ANKLE_Y] }, { to: [85, ANKLE_Y] }], feet: [-90, -90] }, ms: 900, hold: 150 },
      { p: { hip: [56, 85], torso: 98, legs: [[-92, -92], [0, -90]], arms: [{ to: [87, ANKLE_Y] }, [94, 94]], feet: [-90, -90] }, ms: 900, hold: 400 },
    ],
  },
  'jumping-jacks': {
    view: 'front',
    frames: [
      { p: frontStand(3, [[-6, -3], [6, 3]]), ms: 380, hold: 40 },
      { p: frontStand(20, [[-160, -170], [160, 170]], STAND_HIP[1] + 1), ms: 380, hold: 40 },
    ],
  },
  'mountain-climbers': {
    frames: [
      { p: { ...plankHi, legs: [{ to: [68, 104] }, { to: [28, TOE_Y] }], feet: [60, 60] }, ms: 300 },
      { p: { ...plankHi, legs: [{ to: [30, TOE_Y] }, { to: [68, 104] }], feet: [60, 60] }, ms: 300 },
    ],
  },
  'lying-leg-raise': {
    frames: [
      { p: onBack([[94, 94], [93, 93]], armsAlongside), hold: 200 },
      { p: onBack([[180, 180], [178, 178]], armsAlongside), ms: 1100, hold: 250 },
    ],
  },
  'hollow-hold': {
    frames: [
      { p: onBack([[92, 92], [92, 92]], [[-90, -90], [-90, -90]]), hold: 300 },
      { p: { hip: [74, FLOOR - 5], torso: -104, legs: [[103, 103], [103, 103]], arms: [[-98, -100], [-98, -100]] }, ms: 800, hold: 2800 },
    ],
  },
  'burpee': {
    frames: [
      { p: s, ms: 300, hold: 150 },
      { p: { hip: [74, 90], torso: 130, legs: [{ to: [81, ANKLE_Y] }, { to: [79, ANKLE_Y] }], arms: [{ to: [100, ANKLE_Y] }, { to: [98, ANKLE_Y] }] }, ms: 450 },
      { p: { ...pushup([30, TOE_Y], 78, [100, ANKLE_Y]), legs: [{ to: [31, TOE_Y] }, { to: [29, TOE_Y] }] }, ms: 300, hold: 150 },
      { p: { hip: [74, 90], torso: 130, legs: [{ to: [81, ANKLE_Y] }, { to: [79, ANKLE_Y] }], arms: [{ to: [100, ANKLE_Y] }, { to: [98, ANKLE_Y] }] }, ms: 300 },
      { p: lift(stand(80, armsUp), 12, [25, 25]), ms: 350, hold: 60 },
    ],
    key: 2,
  },
  'v-up': {
    frames: [
      { p: { hip: [74, LIE_Y], torso: -90, legs: [[90, 90], [90, 90]], arms: [[-90, -90], [-90, -90]] }, hold: 200 },
      { p: { hip: [74, FLOOR - 4], torso: -138, legs: [[132, 132], [132, 132]], arms: [[-208, -210], [-206, -208]] }, ms: 800, hold: 150 },
    ],
  },
  'tuck-jump': {
    frames: [
      { p: s, ms: 300, hold: 200 },
      { p: squat(72, 80, 155, [[-20, -10], [-24, -14]]), ms: 400 },
      { p: { hip: [80, 44], torso: 172, legs: [[100, -10], [96, -14]], arms: [[60, 100], [56, 96]], feet: [40, 40] }, ms: 300, hold: 60 },
      { p: squat(72, 80, 155, armsForward), ms: 300 },
    ],
  },
  'nordic-curl': {
    props: [{ k: 'block', x: 18, y: 96, w: 20, h: 9 }],
    frames: [
      { p: kneel([52, FLOOR - 4], 180, [[4, 0], [-4, -2]]), hold: 300 },
      { p: kneel([52, FLOOR - 4], 128, [[100, 100], [96, 96]]), ms: 1800 },
      { p: kneel([52, FLOOR - 4], 112, [{ to: [104, ANKLE_Y] }, { to: [102, ANKLE_Y] }]), ms: 500, hold: 200 },
    ],
  },
  'dragon-flag': {
    props: [{ k: 'bench', x: 18, y: 98, w: 92 }],
    box: [0, -10, 160, 124],
    frames: [
      { p: { neck: [40, 93], torso: 2, head: -92, legs: [[180, 180], [180, 180]], arms: [{ to: [24, 98], bend: -1 }, { to: [22, 98], bend: -1 }], feet: [190, 190] }, hold: 250 },
      { p: { neck: [40, 93], torso: -70, head: -20, legs: [[110, 110], [110, 110]], arms: [{ to: [24, 98], bend: -1 }, { to: [22, 98], bend: -1 }], feet: [120, 120] }, ms: 1800, hold: 200 },
    ],
  },
  'l-sit': {
    frames: [
      { p: { hip: [60, FLOOR - 5], torso: 180, legs: [[90, 90], [90, 90]], arms: [{ to: [63, ANKLE_Y] }, { to: [61, ANKLE_Y] }] }, hold: 300 },
      { p: { hip: [60, FLOOR - 9], torso: 178, legs: [[86, 86], [86, 86]], arms: [{ to: [63, ANKLE_Y] }, { to: [61, ANKLE_Y] }] }, ms: 700, hold: 2600 },
    ],
  },
  'hanging-knee-raise': {
    floor: false, box: HANG_BOX,
    props: [{ k: 'bar', x: 80, y: BAR_Y, w: 56 }],
    frames: [
      { p: hang(BAR_Y + 35, [[2, -4], [-2, -8]]), hold: 200 },
      { p: hang(BAR_Y + 35, [[100, 10], [96, 6]], 176), ms: 900, hold: 250 },
    ],
  },
  'hanging-leg-raise': {
    floor: false, box: HANG_BOX,
    props: [{ k: 'bar', x: 80, y: BAR_Y, w: 56 }],
    frames: [
      { p: hang(BAR_Y + 35, [[2, 2], [-2, -2]]), hold: 200 },
      { p: hang(BAR_Y + 35, [[94, 94], [91, 91]], 172), ms: 1100, hold: 250 },
    ],
  },
};

/** The demo for an exercise, if there is one (a newer catalog can have exercises this page doesn't know). */
export function motionFor(id: string): Motion | undefined {
  return MOTIONS[id];
}

/* ---------------- Drawing ---------------- */

const r1 = (v: number) => Math.round(v * 10) / 10;
const poly = (pts: Pt[]) => pts.map((q, i) => (i ? 'L' : 'M') + r1(q[0]) + ',' + r1(q[1])).join(' ');

export interface FigurePaths { torso: string; head: Pt; legs: [string, string]; arms: [string, string] }

/** SVG path data for a pose. */
export function figurePaths(p: Pose, front = false): FigurePaths {
  const k = skeleton(p, front);
  let torso = poly([k.hip, k.neck]);
  if (front) torso += ' ' + poly([k.legs[0][0], k.legs[1][0]]) + ' ' + poly([k.arms[0][0], k.arms[1][0]]);
  return {
    torso, head: [r1(k.head[0]), r1(k.head[1])],
    // a foreshortened body hides the legs behind it
    legs: (p.short ?? 1) < 0.5 ? ['', ''] : [poly(k.legs[0]), poly(k.legs[1])],
    arms: [poly(k.arms[0]), poly(k.arms[1])],
  };
}
