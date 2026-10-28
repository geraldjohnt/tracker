// A looping stick-figure demo of an exercise (poses in motion.ts). The animation runs on
// requestAnimationFrame and writes the SVG attributes directly, so React doesn't re-render per
// frame. It only runs while on screen, and starts paused for people who ask for reduced motion.
import { useEffect, useRef, useState } from 'react';
import { FLOOR, figurePaths, motionFor, poseAt, type Motion, type Prop } from './motion';

const BOX: [number, number, number, number] = [0, 0, 160, 120];

function PropShape({ p }: { p: Prop }) {
  switch (p.k) {
    case 'wall':
      return <><rect x={p.x - 3} y={-20} width={6} height={FLOOR + 20} className="mv-prop-fill" /><path d={`M${p.x},-20 V${FLOOR}`} className="mv-prop" /></>;
    case 'bench':
      return <><rect x={p.x} y={p.y} width={p.w} height={4} rx={1.5} className="mv-prop-fill" /><path d={`M${p.x + 3},${p.y + 4} V${FLOOR} M${p.x + p.w - 3},${p.y + 4} V${FLOOR}`} className="mv-prop" /></>;
    case 'bar': {
      const l = p.x - p.w / 2, r = p.x + p.w / 2;
      const posts = (p.post === 'left' || p.post === 'both' ? `M${l},${p.y} V${FLOOR}` : '') + (p.post === 'right' || p.post === 'both' ? ` M${r},${p.y} V${FLOOR}` : '');
      return <><path d={`M${l},${p.y} H${r}`} className="mv-bar" />{posts && <path d={posts} className="mv-prop" />}</>;
    }
    case 'block':
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={2} className="mv-prop-fill" />;
  }
}

function useReducedMotion() {
  const [reduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  return reduced;
}

/** The figure itself: drawn in its key pose, then animated while `playing`. */
function Figure({ m, playing }: { m: Motion; playing: boolean }) {
  const front = m.view === 'front';
  const first = figurePaths(m.frames[Math.min(m.key ?? 1, m.frames.length - 1)].p, front);
  const svg = useRef<SVGSVGElement>(null);
  const elapsed = useRef(0); // so pausing and playing again carries on from the same spot

  useEffect(() => {
    const el = svg.current;
    if (!playing || !el) return;
    const q = (c: string) => el.querySelector<SVGElement>('.' + c);
    const nodes = { torso: q('mv-torso'), head: q('mv-head'), l0: q('mv-leg0'), l1: q('mv-leg1'), a0: q('mv-arm0'), a1: q('mv-arm1') };
    let raf = 0, visible = true, last = performance.now();
    const tick = (now: number) => {
      elapsed.current += Math.min(now - last, 100);
      last = now;
      const f = figurePaths(poseAt(m, elapsed.current), front);
      nodes.torso?.setAttribute('d', f.torso);
      nodes.head?.setAttribute('cx', String(f.head[0]));
      nodes.head?.setAttribute('cy', String(f.head[1]));
      nodes.l0?.setAttribute('d', f.legs[0]); nodes.l1?.setAttribute('d', f.legs[1]);
      nodes.a0?.setAttribute('d', f.arms[0]); nodes.a1?.setAttribute('d', f.arms[1]);
      raf = requestAnimationFrame(tick);
    };
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([e]) => {
      const was = visible;
      visible = e.isIntersecting;
      if (visible && !was) { last = performance.now(); raf = requestAnimationFrame(tick); }
      if (!visible) cancelAnimationFrame(raf);
    }) : null;
    io?.observe(el);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); io?.disconnect(); };
  }, [m, playing, front]);

  const [x, y, w, h] = m.box ?? BOX;
  return (
    <svg ref={svg} className={'mv-svg' + (front ? ' mv-front' : '')} viewBox={`${x} ${y} ${w} ${h}`} role="img" aria-hidden="true">
      {(m.props ?? []).map((p, i) => <PropShape key={i} p={p} />)}
      {m.floor !== false && <path d={`M${x},${FLOOR + 1.5} H${x + w}`} className="mv-floor" />}
      <path className="mv-limb mv-far mv-leg1" d={first.legs[1]} />
      <path className="mv-limb mv-far mv-arm1" d={first.arms[1]} />
      <path className="mv-limb mv-torso" d={first.torso} />
      <circle className="mv-head" cx={first.head[0]} cy={first.head[1]} r={6.5} />
      <path className="mv-limb mv-leg0" d={first.legs[0]} />
      <path className="mv-limb mv-arm0" d={first.arms[0]} />
    </svg>
  );
}

/** Movement demo for an exercise, with a play/pause button. Renders nothing if there's no demo for it. */
export function MovementFigure({ exId, className, compact }: { exId: string; className?: string; compact?: boolean }) {
  const m = motionFor(exId);
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(!reduced);
  if (!m) return null;
  return (
    <div className={'mv' + (compact ? ' mv-compact' : '') + (className ? ' ' + className : '')}>
      <Figure m={m} playing={playing} />
      {!compact && (
        <div className="mv-foot">
          {m.note && <span className="mv-note">{m.note}</span>}
          <button type="button" className="mv-play" onClick={() => setPlaying(v => !v)} aria-label={playing ? 'Pause the demo' : 'Play the demo'} title={playing ? 'Pause' : 'Play'}>
            <i className={'bi ' + (playing ? 'bi-pause-fill' : 'bi-play-fill')}></i>
          </button>
        </div>
      )}
    </div>
  );
}
