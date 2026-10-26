import { describe, expect, it } from 'vitest';
import { CATALOG, TRACKERS } from './catalog';
import { angle, cameraGoal, cameraProgress, createCounter, LM, tilt, type Landmark } from './pose';

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

  it('the phase-5 exercises all have a counter', () => {
    for (const id of ['air-squat', 'reverse-lunge', 'pushup', 'knee-pushup', 'wall-pushup', 'glute-bridge', 'forearm-plank', 'wall-sit']) {
      const ex = CATALOG.find(e => e.id === id)!;
      expect(ex.tracker, id).toBeTruthy();
      expect(createCounter(ex).mode, id).toBe(ex.measure === 'seconds' ? 'hold' : 'reps');
    }
    for (const e of CATALOG) if (e.tracker) expect(TRACKERS).toContain(e.tracker);
  });
});
