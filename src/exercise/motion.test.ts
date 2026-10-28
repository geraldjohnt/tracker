import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { BONES, cycleMs, FLOOR, MOTIONS, motionFor, poseAt, skeleton, type Pt } from './motion';

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const samples = (id: string) => {
  const m = MOTIONS[id];
  return Array.from({ length: 48 }, (_, i) => skeleton(poseAt(m, (cycleMs(m) * i) / 48), m.view === 'front'));
};

describe('movement demos', () => {
  it('has a demo for every catalog exercise, and none for unknown ids', () => {
    for (const ex of CATALOG) expect(motionFor(ex.id), ex.id).toBeDefined();
    expect(motionFor('no-such-exercise')).toBeUndefined();
  });

  it('keeps every bone its length through the whole loop', () => {
    for (const id of Object.keys(MOTIONS)) {
      for (const k of samples(id)) {
        if (k.front) continue; // front view may foreshorten
        for (const leg of k.legs) {
          expect(dist(leg[0], leg[1]), id + ' thigh').toBeCloseTo(BONES.thigh, 1);
          expect(dist(leg[1], leg[2]), id + ' shin').toBeCloseTo(BONES.shin, 1);
        }
        for (const arm of k.arms) {
          expect(dist(arm[0], arm[1]), id + ' upper arm').toBeCloseTo(BONES.upperArm, 1);
          expect(dist(arm[1], arm[2]), id + ' forearm').toBeCloseTo(BONES.forearm, 1);
        }
        expect(dist(k.hip, k.neck), id + ' torso').toBeCloseTo(BONES.torso, 1);
      }
    }
  });

  it('never puts the body through the floor', () => {
    for (const [id, m] of Object.entries(MOTIONS)) {
      if (m.floor === false) continue;
      for (const k of samples(id)) {
        const pts = [k.hip, k.neck, ...k.legs.flat(), ...k.arms.flat()];
        for (const p of pts) expect(p[1], id).toBeLessThanOrEqual(FLOOR + 1);
        expect(k.head[1] + BONES.headR, id + ' head').toBeLessThanOrEqual(FLOOR + 1);
      }
    }
  });

  it('keeps planted feet still (squat)', () => {
    const ks = samples('air-squat');
    for (const k of ks) expect(dist(k.legs[0][2], ks[0].legs[0][2])).toBeLessThan(0.5);
    expect(Math.min(...ks.map(k => k.hip[1]))).toBeLessThan(Math.max(...ks.map(k => k.hip[1])) - 15); // and the hips really drop
  });

  it('loops smoothly: the end of the cycle matches the start', () => {
    for (const [id, m] of Object.entries(MOTIONS)) {
      const a = skeleton(poseAt(m, 0), m.view === 'front'), b = skeleton(poseAt(m, cycleMs(m) - 1), m.view === 'front');
      expect(dist(a.neck, b.neck), id).toBeLessThan(1);
    }
  });
});
