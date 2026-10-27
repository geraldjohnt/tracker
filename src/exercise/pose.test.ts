import { describe, expect, it } from 'vitest';
import { CATALOG, TRACKERS } from './catalog';
import { angle, cameraGoal, cameraProgress, createCounter, elevation, hasCounter, LM, tilt, type Landmark } from './pose';

type P = [number, number];
/** A 33-landmark frame with the given joints on the left side; the right side is hidden unless given. */
function frame(joints: Partial<Record<keyof typeof LM, P>>): Landmark[] {
  const lms: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.1 }));
  for (const [k, [x, y]] of Object.entries(joints)) lms[LM[k as keyof typeof LM]] = { x, y, visibility: 0.95 };
  return lms;
}
const rad = (d: number) => (d * Math.PI) / 180;
/** Point at distance `len` from `from`, at `deg` degrees (0 = right, 90 = down). */
const at = (from: P, deg: number, len: number): P => [from[0] + len * Math.cos(rad(deg)), from[1] + len * Math.sin(rad(deg))];

/** Side-on squat with the given knee angle: shin vertical, thigh rotated by the angle. */
function squat(kneeDeg: number) {
  const ankle: P = [0.5, 0.9], knee: P = [0.5, 0.7];
  const hip = at(knee, -90 - (180 - kneeDeg), 0.2); // thigh swings back from straight up
  const shoulder = at(hip, -80, 0.3);
  return frame({ lAnkle: ankle, lKnee: knee, lHip: hip, lShoulder: shoulder });
}
/** Side-on push-up with the given elbow angle; `sag` drops the hips (body-line degrees off straight). */
function pushup(elbowDeg: number, sag = 0, torsoDeg = 0) {
  const wrist: P = [0.3, 0.8], elbow: P = [0.3, 0.65];
  const shoulder = at(elbow, 90 + elbowDeg, 0.15);
  const hip = at(shoulder, torsoDeg + sag, 0.3);
  const knee = at(hip, torsoDeg - sag, 0.25);
  return frame({ lShoulder: shoulder, lElbow: elbow, lWrist: wrist, lHip: hip, lKnee: knee });
}
/** Lying glute bridge with the given hip angle (shoulder–hip–knee). */
function bridge(hipDeg: number) {
  const shoulder: P = [0.2, 0.8];
  const hip = at(shoulder, -15, 0.25);
  const knee = at(hip, 165 + hipDeg, 0.2);
  return frame({ lShoulder: shoulder, lHip: hip, lKnee: knee });
}
/** Forearm plank, side-on: `sag` bends the body line at the hip. */
function plank(sag = 0, torsoDeg = 5) {
  const shoulder: P = [0.2, 0.6];
  const hip = at(shoulder, torsoDeg + sag, 0.3);
  const ankle = at(hip, torsoDeg - sag, 0.35);
  return frame({ lShoulder: shoulder, lHip: hip, lAnkle: ankle });
}

/** Feeds frames 1/30 s apart and returns the final state. */
function run(c: ReturnType<typeof createCounter>, frames: Landmark[][], t0 = 0) {
  let st = c.state();
  frames.forEach((f, i) => { st = c.update(f, t0 + i / 30, 1); });
  return st;
}
/** Smoothly moves an angle from a to b over n frames. */
const sweep = (a: number, b: number, n = 8) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
const reps = (make: (d: number) => Landmark[], restDeg: number, workDeg: number, n: number) =>
  Array.from({ length: n }, () => [...sweep(restDeg, workDeg), ...sweep(workDeg, restDeg)]).flat().map(make);

describe('pose geometry', () => {
  it('angle and tilt', () => {
    expect(angle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90);
    expect(angle({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180);
    expect(tilt({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0);
    expect(tilt({ x: 0, y: 0 }, { x: -1, y: -1 })).toBeCloseTo(45);
    expect(tilt({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90);
  });
  it('the synthetic squat has the knee angle asked for', () => {
    const f = squat(95);
    const p = (i: number) => f[i];
    expect(angle(p(LM.lHip), p(LM.lKnee), p(LM.lAnkle))).toBeCloseTo(95);
  });
});

describe('rep counters', () => {
  const sq = () => createCounter({ tracker: 'squat' });

  it('counts full squats', () => {
    const c = sq();
    const st = run(c, [squat(170), ...reps(squat, 170, 90, 3)]);
    expect(st.reps).toBe(3);
    expect(st.inView).toBe(true);
    expect(cameraProgress(st, c.mode)).toBe(3);
  });

  it('jitter near the top never counts, and a shallow squat asks to go lower', () => {
    const c = sq();
    let st = run(c, [squat(170), ...[150, 160, 148, 165, 152, 170].map(squat)]);
    expect(st.reps).toBe(0);
    st = run(c, [...sweep(170, 125).map(squat), ...sweep(125, 170).map(squat)], 1);
    expect(st.reps).toBe(0);
    expect(st.cue).toMatch(/Go lower/);
  });

  it('starting at the bottom does not count until the starting position is seen', () => {
    const c = sq();
    let st = run(c, [squat(90), squat(90), ...sweep(90, 170).map(squat)]);
    expect(st.reps).toBe(0);
    st = run(c, reps(squat, 170, 90, 1), 1);
    expect(st.reps).toBe(1);
  });

  it('pauses when the joints are out of view', () => {
    const c = sq();
    const st = c.update(frame({ lHip: [0.5, 0.5] }), 0, 1);
    expect(st.inView).toBe(false);
    expect(st.cue).toMatch(/whole body/);
    expect(c.update(undefined, 0.1, 1).inView).toBe(false);
  });

  it('push-ups count only with a straight body, and not standing up', () => {
    const c = createCounter({ tracker: 'pushup' });
    expect(run(c, [pushup(170), ...reps(d => pushup(d), 170, 80, 2)]).reps).toBe(2);
    const st = run(c, reps(d => pushup(d, 25), 170, 80, 1), 2);
    expect(st.reps).toBe(2);
    expect(st.cue).toMatch(/rep not counted/);
    const standing = createCounter({ tracker: 'pushup' });
    expect(run(standing, [pushup(170, 0, 85), ...reps(d => pushup(d, 0, 85), 170, 80, 3)]).reps).toBe(0);
  });

  it('glute bridges count when the hips come up and back down', () => {
    const c = createCounter({ tracker: 'bridge' });
    expect(run(c, [bridge(130), ...reps(bridge, 130, 175, 4)]).reps).toBe(4);
  });

  it('lunges count on either leg', () => {
    const c = createCounter({ tracker: 'lunge' });
    const right = (d: number) => {
      const f = squat(d);
      // mirror the left joints onto the right side, and leave the left leg straight
      for (const j of ['Hip', 'Knee', 'Ankle', 'Shoulder'] as const) f[LM[('r' + j) as keyof typeof LM]] = { ...f[LM[('l' + j) as keyof typeof LM]] };
      const straight = squat(175);
      for (const j of ['Hip', 'Knee', 'Ankle', 'Shoulder'] as const) f[LM[('l' + j) as keyof typeof LM]] = straight[LM[('l' + j) as keyof typeof LM]];
      return f;
    };
    expect(run(c, [squat(170), ...reps(squat, 170, 95, 2), ...reps(right, 170, 95, 2)]).reps).toBe(4);
  });
});

describe('hold counters', () => {
  it('a plank counts seconds only while the body is straight', () => {
    const c = createCounter({ tracker: 'plank' });
    expect(c.mode).toBe('hold');
    let st = run(c, Array.from({ length: 31 }, () => plank()));
    expect(st.seconds).toBeCloseTo(1, 1);
    expect(st.cue).toBe('');
    st = run(c, Array.from({ length: 30 }, () => plank(20)), 2);
    expect(st.seconds).toBeCloseTo(1, 1);
    expect(st.cue).toMatch(/Hips/);
    st = run(c, Array.from({ length: 30 }, () => plank(0, 70)), 4);
    expect(st.seconds).toBeCloseTo(1, 1);
  });

  it('formOk (the green skeleton) needs the right position, not just being in view', () => {
    const c = createCounter({ tracker: 'pushup' });
    expect(c.update(pushup(170, 0, 85), 0, 1)).toMatchObject({ inView: true, formOk: false }); // standing
    expect(c.update(pushup(170), 0.1, 1)).toMatchObject({ inView: true, formOk: true });
    expect(c.update(pushup(120, 25), 0.2, 1)).toMatchObject({ inView: true, formOk: false }); // hips sagging
    expect(c.update(undefined, 0.3, 1).formOk).toBe(false);
    const s = createCounter({ tracker: 'squat' });
    expect(s.update(squat(90), 0, 1).formOk).toBe(false); // not in the starting position yet
    expect(run(s, Array.from({ length: 6 }, () => squat(170)), 0.1).formOk).toBe(true);
    const p = createCounter({ tracker: 'plank' });
    expect(p.update(plank(), 0, 1).formOk).toBe(true);
    expect(p.update(plank(20), 0.1, 1).formOk).toBe(false);
  });

  it('long gaps between frames (background tab) are not counted', () => {
    const c = createCounter({ tracker: 'plank' });
    c.update(plank(), 0, 1);
    expect(c.update(plank(), 10, 1).seconds).toBe(0);
  });

  it('a wall sit holds at about 90° knees', () => {
    const c = createCounter({ tracker: 'wallsit' });
    expect(run(c, Array.from({ length: 31 }, () => squat(95))).seconds).toBeCloseTo(1, 1);
    expect(run(c, Array.from({ length: 30 }, () => squat(150)), 2).cue).toMatch(/lower/);
  });
});

describe('watch mode and goals', () => {
  it('exercises without a counter time how long you are in view', () => {
    const c = createCounter({});
    expect(c.mode).toBe('watch');
    const st = run(c, Array.from({ length: 61 }, () => frame({ lShoulder: [0.4, 0.3], lHip: [0.4, 0.6] })));
    expect(st.seconds).toBeCloseTo(2, 1);
    expect(c.update(frame({}), 3, 1).inView).toBe(false);
  });

  it('goals: per-side amounts double; watch mode needs time per rep', () => {
    expect(cameraGoal({ measure: 'reps', perSide: false }, 12, 'reps')).toBe(12);
    expect(cameraGoal({ measure: 'reps', perSide: true }, 6, 'reps')).toBe(12);
    expect(cameraGoal({ measure: 'seconds', perSide: false }, 30, 'hold')).toBe(30);
    expect(cameraGoal({ measure: 'reps', perSide: false }, 10, 'watch')).toBe(15);
    expect(cameraGoal({ measure: 'seconds', perSide: true }, 20, 'watch')).toBe(40);
  });

  it('every catalog exercise has a counter (no more watch mode for bundled exercises)', () => {
    for (const k of TRACKERS) expect(hasCounter(k), k).toBe(true);
    for (const e of CATALOG) {
      expect(e.tracker, e.id).toBeTruthy();
      expect(createCounter(e).mode, e.id).toBe(e.measure === 'seconds' ? 'hold' : 'reps');
    }
    expect(hasCounter('somethingnew')).toBe(false);
  });

  it('the phase-5 exercises all have a counter', () => {
    for (const id of ['air-squat', 'reverse-lunge', 'pushup', 'knee-pushup', 'wall-pushup', 'glute-bridge', 'forearm-plank', 'wall-sit']) {
      const ex = CATALOG.find(e => e.id === id)!;
      expect(ex.tracker, id).toBeTruthy();
      expect(createCounter(ex).mode, id).toBe(ex.measure === 'seconds' ? 'hold' : 'reps');
    }
    for (const e of CATALOG) if (e.tracker) expect(TRACKERS).toContain(e.tracker);
  });
});

/* ---------------- phase 6 counters ---------------- */

/** Shifts every given landmark up by dy (a jump). */
const lift = (f: Landmark[], dy: number) => f.map(l => ({ ...l, y: l.y - dy }));
const hold = (f: Landmark[], n: number) => Array.from({ length: n }, () => f);
/** Linear blend of two frames (same landmarks). */
const blend = (a: Landmark[], b: Landmark[], n = 8) =>
  Array.from({ length: n + 1 }, (_, i) => a.map((l, j) => ({ ...l, x: l.x + ((b[j].x - l.x) * i) / n, y: l.y + ((b[j].y - l.y) * i) / n })));

describe('phase 6 rep counters', () => {
  it('helpers: elevation is signed', () => {
    expect(elevation({ x: 0, y: 0.5 }, { x: 1, y: 0.5 })).toBeCloseTo(0);
    expect(elevation({ x: 0, y: 0.5 }, { x: 1, y: -0.5 })).toBeCloseTo(45);
    expect(elevation({ x: 0, y: 0.5 }, { x: -1, y: 1.5 })).toBeCloseTo(-45);
  });

  it('calf raises count heel lifts, and not with bent knees', () => {
    const calf = (h: number, kneeBend = 0) => frame({
      lHip: [0.5 + kneeBend, 0.45], lKnee: [0.5, 0.65], lAnkle: [0.5, 0.85 - h], lHeel: [0.47, 0.88 - h * 1.5], lFoot: [0.58, 0.88],
    });
    const c = createCounter({ tracker: 'calfraise' });
    expect(run(c, [calf(0), ...reps(d => calf(d), 0, 0.03, 3)]).reps).toBe(3);
    const bent = createCounter({ tracker: 'calfraise' });
    expect(run(bent, [calf(0, 0.12), ...reps(d => calf(d, 0.12), 0, 0.03, 2)]).reps).toBe(0);
  });

  /** Facing the camera: arms raised `armDeg` from the sides, feet `feet` apart. */
  function jack(armDeg: number, feet: number) {
    const ls: P = [0.4, 0.3], rs: P = [0.6, 0.3];
    return frame({
      lShoulder: ls, rShoulder: rs, lHip: [0.45, 0.55], rHip: [0.55, 0.55],
      lWrist: at(ls, 90 + armDeg, 0.28), rWrist: at(rs, 90 - armDeg, 0.28),
      lKnee: [0.5 - feet / 2, 0.72], rKnee: [0.5 + feet / 2, 0.72], lAnkle: [0.5 - feet / 2, 0.9], rAnkle: [0.5 + feet / 2, 0.9],
    });
  }
  it('jumping jacks: arms overhead, and feet wide when facing the camera', () => {
    const c = createCounter({ tracker: 'jack' });
    const wide = (d: number) => jack(d, d > 90 ? 0.4 : 0.1);
    expect(run(c, [jack(10, 0.1), ...reps(wide, 10, 170, 3)]).reps).toBe(3);
    const st = run(c, reps(d => jack(d, 0.1), 10, 170, 1), 2);
    expect(st.reps).toBe(3);
    expect(st.cue).toMatch(/feet wide/);
  });

  /** High plank side-on; each leg's hip angle given separately (the far leg is the right one). */
  function climber(lHipDeg: number, rHipDeg: number) {
    const shoulder: P = [0.3, 0.5], hip: P = [0.6, 0.52];
    const toShoulder = (Math.atan2(shoulder[1] - hip[1], shoulder[0] - hip[0]) * 180) / Math.PI;
    const f = frame({ lShoulder: shoulder, lHip: hip, lKnee: at(hip, toShoulder - lHipDeg, 0.2) });
    for (const [i, v] of [[LM.rShoulder, shoulder], [LM.rHip, hip], [LM.rKnee, at(hip, toShoulder - rHipDeg, 0.2)]] as const) f[i] = { x: v[0], y: v[1], visibility: 0.9 };
    return f;
  }
  it('mountain climbers count each leg, even when the legs overlap', () => {
    const c = createCounter({ tracker: 'climber' });
    // the right leg runs half a cycle behind the left, so one is never back before the other leaves
    const cycle = (i: number) => 125 + 50 * Math.cos((i / 16) * 2 * Math.PI);
    const frames = Array.from({ length: 16 * 3 + 1 }, (_, i) => climber(cycle(i), cycle(i + 8)));
    const st = run(c, [climber(175, 175), ...frames]);
    expect(st.reps).toBeGreaterThanOrEqual(5);
    expect(st.reps).toBeLessThanOrEqual(6);
  });

  it('jump squats only count with a jump, which may come right after standing up', () => {
    const c = createCounter({ tracker: 'jumpsquat' });
    let st = run(c, [squat(170), ...reps(squat, 170, 95, 2), ...hold(squat(170), 30)]);
    expect(st.reps).toBe(0);
    expect(st.cue).toMatch(/Jump/);
    const jumpRep = [...sweep(170, 95), ...sweep(95, 175)].map(squat).concat(hold(lift(squat(175), 0.06), 4), hold(squat(170), 4));
    st = run(c, [...jumpRep, ...jumpRep], 3);
    expect(st.reps).toBe(2);
  });

  it('burpees: down into a straight plank, back up, and jump', () => {
    const stand = frame({ lShoulder: [0.5, 0.2], lHip: [0.5, 0.5], lKnee: [0.5, 0.7], lAnkle: [0.5, 0.9] });
    const plank = frame({ lShoulder: [0.3, 0.75], lHip: [0.55, 0.8], lKnee: [0.72, 0.85], lAnkle: [0.9, 0.9] });
    const piked = frame({ lShoulder: [0.3, 0.75], lHip: [0.5, 0.72], lKnee: [0.6, 0.62], lAnkle: [0.62, 0.9] }); // squat thrust: knees tucked
    const rep = (bottom: Landmark[]) => [...blend(stand, bottom), ...hold(bottom, 3), ...blend(bottom, stand), ...hold(lift(stand, 0.08), 4), ...hold(stand, 3)];
    const c = createCounter({ tracker: 'burpee' });
    expect(run(c, [...hold(stand, 3), ...rep(plank), ...rep(plank)]).reps).toBe(2);
    const st = run(c, rep(piked), 3);
    expect(st.reps).toBe(2);
    expect(st.cue).toMatch(/plank/);
  });

  /** Hanging from a bar at y 0.1; `d` is the shoulder's distance below the hands. */
  function hang(d: number) {
    const wrist: P = [0.5, 0.1], shoulder: P = [0.5, 0.1 + d];
    const elbow: P = [0.5 + Math.sqrt(Math.max(0, 0.15 ** 2 - (d / 2) ** 2)), 0.1 + d / 2];
    return frame({ lWrist: wrist, lShoulder: shoulder, lElbow: elbow, nose: [0.5, shoulder[1] - 0.12] });
  }
  it('pull-ups count only when the chin clears the bar', () => {
    const c = createCounter({ tracker: 'pullup' });
    expect(run(c, [hang(0.3), ...reps(hang, 0.3, 0.1, 2)]).reps).toBe(2);
    const st = run(c, reps(hang, 0.3, 0.16, 1), 2);
    expect(st.reps).toBe(2);
    expect(st.cue).toMatch(/chin/);
  });

  it('crunches count a small lift of the shoulders, not lying still', () => {
    const crunch = (deg: number) => { const hip: P = [0.6, 0.8]; return frame({ lHip: hip, lShoulder: at(hip, 180 + deg, 0.3), lKnee: [0.75, 0.65] }); };
    const c = createCounter({ tracker: 'crunch' });
    expect(run(c, [...hold(crunch(2), 5), ...reps(crunch, 2, 30, 3)]).reps).toBe(3);
    expect(run(c, hold(crunch(2), 20), 3).reps).toBe(3);
  });

  /** Facing the camera: hips lowered by `r` (1 = standing, 0 = thighs flat), knees `kneeGap` apart. */
  function frontSquat(r: number, kneeGap = 0.24) {
    const hipY = 0.7 - 0.2 * r;
    return frame({
      lShoulder: [0.38, hipY - 0.3], rShoulder: [0.62, hipY - 0.3], lHip: [0.44, hipY], rHip: [0.56, hipY],
      lKnee: [0.5 - kneeGap / 2, 0.7], rKnee: [0.5 + kneeGap / 2, 0.7], lAnkle: [0.38, 0.9], rAnkle: [0.62, 0.9],
    });
  }
  it('squats facing the camera count too, and caving knees void the rep', () => {
    const c = createCounter({ tracker: 'squat' });
    expect(run(c, [frontSquat(1), ...reps(r => frontSquat(r), 1, 0.05, 2)]).reps).toBe(2);
    const st = run(c, reps(r => frontSquat(r, r < 0.5 ? 0.1 : 0.24), 1, 0.05, 1), 2);
    expect(st.reps).toBe(2);
    expect(st.cue).toMatch(/Knees caving/);
  });

  it('side lunges need the other leg straight', () => {
    const legs = (bend: number, otherStraight = true) => {
      const f = squat(bend);
      const o = squat(otherStraight ? 175 : bend);
      for (const j of ['Hip', 'Knee', 'Ankle'] as const) f[LM[('r' + j) as keyof typeof LM]] = { ...o[LM[('l' + j) as keyof typeof LM]] };
      return f;
    };
    const c = createCounter({ tracker: 'sidelunge' });
    expect(run(c, [legs(175), ...reps(d => legs(d), 175, 110, 2)]).reps).toBe(2);
    const st = run(c, reps(d => legs(d, false), 175, 110, 1), 2);
    expect(st.reps).toBe(2);
    expect(st.cue).toMatch(/other leg/);
  });
});

describe('phase 6 lying and kneeling counters', () => {
  it('leg raises count straight legs to vertical, not bent ones', () => {
    const raise = (deg: number, bent = 0) => {
      const shoulder: P = [0.2, 0.8], hip: P = [0.5, 0.8], ankle = at(hip, deg - 180, 0.4);
      const knee: P = [(hip[0] + ankle[0]) / 2 + bent, (hip[1] + ankle[1]) / 2 + bent];
      return frame({ lShoulder: shoulder, lHip: hip, lKnee: knee, lAnkle: ankle });
    };
    const c = createCounter({ tracker: 'legraise' });
    expect(run(c, [raise(178), ...reps(d => raise(d), 178, 90, 2)]).reps).toBe(2);
    const bent = createCounter({ tracker: 'legraise' });
    expect(run(bent, [raise(178), ...reps(d => raise(d, 0.08), 178, 90, 2)]).reps).toBe(0);
  });

  it('dragon flags lower a straight body toward level', () => {
    const flag = (deg: number, pike = 0) => {
      const shoulder: P = [0.3, 0.6];
      return frame({ lShoulder: shoulder, lHip: at(shoulder, -deg + pike, 0.3), lKnee: at(shoulder, -deg, 0.5), lAnkle: at(shoulder, -deg, 0.7) });
    };
    const c = createCounter({ tracker: 'dragonflag' });
    expect(run(c, [flag(75), ...reps(d => flag(d), 75, 12, 2)]).reps).toBe(2);
    expect(run(c, reps(d => flag(d, 25), 75, 12, 1), 2).cue).toMatch(/straight/);
  });

  it('Nordic curls: lowering forward from kneeling, hips straight', () => {
    const nordic = (deg: number, bend = 0) => {
      const knee: P = [0.5, 0.85], hip = at(knee, -deg, 0.25);
      return frame({ lKnee: knee, lAnkle: [0.75, 0.85], lHip: hip, lShoulder: at(hip, -deg - bend, 0.3) });
    };
    const c = createCounter({ tracker: 'nordic' });
    expect(run(c, [nordic(92), ...reps(d => nordic(d), 92, 160, 2)]).reps).toBe(2);
    expect(run(c, reps(d => nordic(d, 60), 92, 160, 1), 2).reps).toBe(2);
  });

  it('dead bugs count each leg as it straightens', () => {
    const bug = (lDeg: number, rDeg: number) => {
      const hip: P = [0.5, 0.7], knee = at(hip, -90, 0.2);
      const f = frame({ lShoulder: [0.2, 0.7], lHip: hip, lKnee: knee, lAnkle: at(knee, 90 - lDeg, 0.2) });
      const pts: Array<[number, P]> = [[LM.rShoulder, [0.2, 0.7]], [LM.rHip, hip], [LM.rKnee, knee], [LM.rAnkle, at(knee, 90 - rDeg, 0.2)]];
      for (const [i, v] of pts) f[i] = { x: v[0], y: v[1], visibility: 0.9 };
      return f;
    };
    const c = createCounter({ tracker: 'deadbug' });
    const st = run(c, [bug(90, 90), ...reps(d => bug(d, 90), 90, 175, 2), ...reps(d => bug(90, d), 90, 175, 2)]);
    expect(st.reps).toBe(4);
  });
});

describe('phase 6 holds', () => {
  /** On the back side-on: shoulders lifted `up` degrees, legs `legs` degrees off the floor. */
  const hollow = (up: number, legs: number) => {
    const hip: P = [0.5, 0.8];
    const ankle = at(hip, -legs, 0.4);
    return frame({ lHip: hip, lShoulder: at(hip, 180 + up, 0.3), lKnee: [(hip[0] + ankle[0]) / 2, (hip[1] + ankle[1]) / 2], lAnkle: ankle });
  };
  it('hollow hold: shoulders and feet just off the floor', () => {
    const c = createCounter({ tracker: 'hollow' });
    expect(run(c, hold(hollow(15, 20), 31)).seconds).toBeCloseTo(1, 1);
    expect(run(c, hold(hollow(0, 20), 30), 2).cue).toMatch(/shoulders/);
    expect(run(c, hold(hollow(15, 0), 30), 4).cue).toMatch(/feet/);
    expect(c.state().seconds).toBeCloseTo(1, 1);
  });

  it('L-sit: straight arms, legs up level', () => {
    const lsit = (legsUp: boolean) => frame({
      lShoulder: [0.4, 0.3], lElbow: [0.4, 0.45], lWrist: [0.4, 0.6], lHip: [0.42, 0.55],
      lKnee: [0.6, legsUp ? 0.55 : 0.62], lAnkle: [0.78, legsUp ? 0.55 : 0.63],
    });
    const c = createCounter({ tracker: 'lsit' });
    expect(run(c, hold(lsit(true), 31)).seconds).toBeCloseTo(1, 1);
    expect(run(c, hold(lsit(false), 30), 2).formOk).toBe(false);
  });
});
