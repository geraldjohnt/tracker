// Rank badges. The rank (Rookie … Legend) decides how ornate the badge is: a plain disc for
// Rookie, then rings, a hexagon, a shield, crossed swords, laurels, a crest, rays and a gem,
// and finally a crown and wings. The tier (1–5) decides the colours, the same for every rank:
// 1 pale stone, 2 green, 3 blue, 4 gold, 5 purple and magenta with gold trim.
import { useId } from 'react';
import type { Rank } from './derive';

interface TierColors { stops: string[]; edge: string; trim: [string, string]; glyph: string; glow: string }
export const TIER_COLORS: TierColors[] = [
  { stops: ['#fafaf9', '#e7e5e4', '#a8a29e'], edge: '#78716c', trim: ['#f5f5f4', '#a8a29e'], glyph: '#57534e', glow: '#d6d3d1' },
  { stops: ['#bbf7d0', '#4ade80', '#15803d'], edge: '#14532d', trim: ['#dcfce7', '#22c55e'], glyph: '#ffffff', glow: '#4ade80' },
  { stops: ['#bfdbfe', '#3b82f6', '#1e40af'], edge: '#1e3a8a', trim: ['#e0f2fe', '#38bdf8'], glyph: '#ffffff', glow: '#60a5fa' },
  { stops: ['#fef08a', '#f59e0b', '#c2410c'], edge: '#7c2d12', trim: ['#fef9c3', '#f59e0b'], glyph: '#ffffff', glow: '#fbbf24' },
  { stops: ['#f5d0fe', '#d946ef', '#9333ea', '#4c1d95'], edge: '#3b0764', trim: ['#fef08a', '#f59e0b'], glyph: '#ffffff', glow: '#e879f9' },
];
export const tierColors = (tier: number) => TIER_COLORS[Math.min(Math.max(tier, 1), 5) - 1];

/* ---------- geometry (viewBox -50 -50 100 100) ---------- */

export const pts = (list: Array<[number, number]>) => list.map(([x, y]) => x.toFixed(2) + ',' + y.toFixed(2)).join(' ');
export const polar = (r: number, deg: number): [number, number] => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];

export function starPoints(points: number, outer: number, inner: number, cy = 0): string {
  return pts(Array.from({ length: points * 2 }, (_, i) => {
    const [x, y] = polar(i % 2 ? inner : outer, -90 + (180 / points) * i);
    return [x, y + cy] as [number, number];
  }));
}

const SHIELD = 'M0,-31 L27,-22 L27,1 C27,19 14,29 0,35 C-14,29 -27,19 -27,1 L-27,-22 Z';
const HEXAGON = pts(Array.from({ length: 6 }, (_, i) => polar(31, -90 + 60 * i)));

type ShapeKind = 'circle' | 'hexagon' | 'shield';
function Shape({ kind, ...p }: { kind: ShapeKind } & React.SVGProps<SVGPathElement & SVGCircleElement & SVGPolygonElement>) {
  if (kind === 'circle') return <circle r={30} {...p} />;
  if (kind === 'hexagon') return <polygon points={HEXAGON} {...p} />;
  return <path d={SHIELD} {...p} />;
}

/** One side's laurel branch (the left one; the right is mirrored). */
export function Laurel({ fill, stroke }: { fill: string; stroke: string }) {
  const leaves = [];
  for (let i = 0; i < 7; i++) {
    const deg = 108 + i * 16;
    const [x, y] = polar(40, deg);
    for (const side of [-1, 1]) {
      const [ox, oy] = polar(3.2 * side, deg);
      leaves.push(<ellipse key={i + ':' + side} cx={x + ox} cy={y + oy} rx={5.6} ry={2.3}
        transform={`rotate(${deg + 90 + side * 32} ${x + ox} ${y + oy})`} fill={fill} stroke={stroke} strokeWidth={0.6} />);
    }
  }
  const [sx, sy] = polar(40, 100);
  const [ex, ey] = polar(40, 214);
  return <g><path d={`M${sx},${sy} A40,40 0 0 1 ${ex},${ey}`} fill="none" stroke={stroke} strokeWidth={1.4} />{leaves}</g>;
}

function Sword({ angle, steel, guard, edge }: { angle: number; steel: string; guard: string; edge: string }) {
  return (
    <g transform={`rotate(${angle})`}>
      <path d="M-2.6,-47 L0,-51 L2.6,-47 L2.6,30 L-2.6,30 Z" fill={steel} stroke={edge} strokeWidth={0.8} />
      <rect x={-9} y={30} width={18} height={4} rx={1.5} fill={guard} stroke={edge} strokeWidth={0.8} />
      <rect x={-2} y={34} width={4} height={10} rx={1} fill={edge} />
      <circle cy={46} r={2.6} fill={guard} stroke={edge} strokeWidth={0.8} />
    </g>
  );
}

/** One side's wing (the left one; the right is mirrored). */
export function Wing({ feathers, fill, stroke }: { feathers: number; fill: string; stroke: string }) {
  return (
    <g>
      {Array.from({ length: feathers }, (_, i) => {
        const deg = 168 + (i * 70) / (feathers - 1); // fan from left to up-left
        const len = 26 + i * (12 / (feathers - 1));
        return <path key={i} d={`M0,0 Q${len * 0.45},-7.5 ${len},-1 Q${len * 0.55},6 0,0 Z`}
          transform={`translate(-16,-6) rotate(${deg})`} fill={fill} stroke={stroke} strokeWidth={0.9} strokeLinejoin="round" />;
      })}
    </g>
  );
}

export function Gem({ fill, facet }: { fill: string; facet: string }) {
  return (
    <g>
      <polygon points="-15,-6 -8,-16 8,-16 15,-6 0,18" fill={fill} stroke={facet} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M-15,-6 L15,-6 M-8,-16 L-4,-6 L0,18 M8,-16 L4,-6 L0,18 M-4,-6 L0,-16 L4,-6" fill="none" stroke={facet} strokeWidth={0.9} strokeOpacity={0.7} />
      <polygon points="-8,-16 -4,-6 -15,-6" fill="#fff" fillOpacity={0.45} />
    </g>
  );
}

/** The symbol in the middle; it gets bolder with each rank. */
function Glyph({ index, color, tier }: { index: number; color: string; tier: TierColors }) {
  const line = { fill: 'none', stroke: color, strokeWidth: 6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (index) {
    case 0: return <path d="M-12,2 L0,-8 L12,2" {...line} />;
    case 1: return <g {...line}><path d="M-12,-4 L0,-14 L12,-4" /><path d="M-12,8 L0,-2 L12,8" /></g>;
    case 2: return <polygon points="5,-21 -11,2 -1,2 -5,19 11,-5 1,-5" fill={color} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />;
    case 3: case 4: return <polygon points={starPoints(5, 16, 7, -1)} fill={color} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />;
    case 5: case 6: return (
      <g>
        <circle cy={-1} r={17} fill="none" stroke={color} strokeWidth={1.6} strokeOpacity={0.7} />
        <polygon points={starPoints(5, 14, 6, -1)} fill={color} stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
      </g>
    );
    case 7: case 8: return <g transform="translate(0,-1) scale(.9)"><Gem fill={color} facet={tier.edge} /></g>;
    default: return (
      <g>
        <polygon points={starPoints(8, 21, 9, -1)} fill={color} fillOpacity={0.9} />
        <g transform="translate(0,-1) scale(.62)"><Gem fill={tier.stops[1]} facet={tier.edge} /></g>
      </g>
    );
  }
}

/** Tier pips per row: one row up to 3, then two rows (4 → 2 + 2, 5 → 3 + 2) so they stay inside the trim. */
const pipRows = (n: number) => n <= 3 ? [n] : [Math.ceil(n / 2), Math.floor(n / 2)];

export function RankBadge({ rank, size = 48, className, title }: { rank: Rank; size?: number; className?: string; title?: string }) {
  const id = 'rb' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const r = rank.index;
  const c = tierColors(rank.tier);
  const shape: ShapeKind = r <= 1 ? 'circle' : r === 2 ? 'hexagon' : 'shield';
  const scale = r <= 1 ? 1.4 : r <= 3 ? 1.3 : r <= 5 ? 1 : 0.94;
  const dy = shape === 'shield' ? -2 * scale : 0;
  const pips = Math.min(rank.tier, 5);
  const label = title ?? rank.label;
  const body = `url(#${id}b)`;
  const trim = `url(#${id}t)`;
  return (
    <svg className={'rank-badge' + (r >= 9 ? ' rb-legend' : '') + (className ? ' ' + className : '')} width={size} height={size}
      viewBox="-50 -50 100 100" role="img" aria-label={label}>
      <title>{label}</title>
      <defs>
        <linearGradient id={id + 'b'} x1="0" y1="0" x2="0.35" y2="1">
          {c.stops.map((s, i) => <stop key={i} offset={i / (c.stops.length - 1)} stopColor={s} />)}
        </linearGradient>
        <linearGradient id={id + 't'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.trim[0]} /><stop offset="1" stopColor={c.trim[1]} />
        </linearGradient>
        <linearGradient id={id + 's'} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f8fafc" /><stop offset=".5" stopColor="#cbd5e1" /><stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
        <radialGradient id={id + 'g'}>
          <stop offset="0.35" stopColor={c.glow} stopOpacity={0.75} /><stop offset="1" stopColor={c.glow} stopOpacity={0} />
        </radialGradient>
        <clipPath id={id + 'c'}><g transform={`translate(0,${dy}) scale(${scale})`}><Shape kind={shape} /></g></clipPath>
      </defs>

      {r >= 7 && <circle r={50} fill={`url(#${id}g)`} className="rb-glow" />}
      {r >= 6 && (
        <polygon points={starPoints(r >= 8 ? 16 : 12, 49, 26)} fill={c.stops[0]} fillOpacity={0.55} stroke={c.trim[1]} strokeOpacity={0.5} strokeWidth={0.6}
          className="rb-rays" />
      )}
      {r >= 4 && <>
        <Sword angle={-42} steel={`url(#${id}s)`} guard={trim} edge={c.edge} />
        <Sword angle={42} steel={`url(#${id}s)`} guard={trim} edge={c.edge} />
      </>}
      {r >= 5 && <>
        <Laurel fill={trim} stroke={c.edge} />
        <g transform="scale(-1,1)"><Laurel fill={trim} stroke={c.edge} /></g>
      </>}
      {r >= 8 && <>
        <Wing feathers={r >= 9 ? 6 : 5} fill={trim} stroke={c.edge} />
        <g transform="scale(-1,1)"><Wing feathers={r >= 9 ? 6 : 5} fill={trim} stroke={c.edge} /></g>
      </>}
      {r === 6 || r === 7 ? (
        <g fill={trim} stroke={c.edge} strokeWidth={0.9} strokeLinejoin="round">
          <polygon points="-17,-27 -13,-43 -8,-29" /><polygon points="17,-27 13,-43 8,-29" /><polygon points="-6,-30 0,-49 6,-30" />
        </g>
      ) : null}

      <g transform={`translate(0,${dy}) scale(${scale})`}>
        <Shape kind={shape} fill={body} stroke={c.edge} strokeWidth={r === 0 ? 2 : 2.6} strokeLinejoin="round" />
        {r >= 1 && <g transform="scale(.84)"><Shape kind={shape} fill="none" stroke={trim} strokeWidth={r >= 3 ? 2.2 : 1.6} strokeOpacity={0.85} /></g>}
        {r >= 3 && <g transform="scale(.94)"><Shape kind={shape} fill="none" stroke={c.edge} strokeWidth={0.8} strokeOpacity={0.6} /></g>}
        <g transform="translate(0,-3)"><Glyph index={r} color={c.glyph} tier={c} /></g>
        <g>
          {pipRows(pips).flatMap((n, row, rows) => Array.from({ length: n }, (_, i) => (
            <circle key={row + ':' + i} cx={(i - (n - 1) / 2) * (rows.length > 1 ? 5.4 : 6)} cy={rows.length > 1 ? 16 + row * 5.4 : 20}
              r={rows.length > 1 ? 1.8 : 2} fill={c.glyph} fillOpacity={0.95} stroke={c.edge} strokeWidth={0.5} />
          )))}
        </g>
      </g>
      {r >= 1 && <ellipse cx={-10} cy={-18} rx={20} ry={11} fill="#fff" fillOpacity={0.22} clipPath={`url(#${id}c)`} transform="rotate(-20)" />}

      {r >= 8 && (
        <g transform="translate(0,-37)">
          <path d="M-15,8 L-17,-7 L-8,0 L0,-11 L8,0 L17,-7 L15,8 Z" fill={trim} stroke={c.edge} strokeWidth={1} strokeLinejoin="round" />
          {r >= 9 && <><circle cx={-17} cy={-7} r={2} fill={c.stops[1]} /><circle cy={-11} r={2.4} fill={c.stops[1]} /><circle cx={17} cy={-7} r={2} fill={c.stops[1]} /></>}
          <rect x={-15} y={5} width={30} height={3.5} rx={1} fill={c.edge} fillOpacity={0.6} />
        </g>
      )}
      {r >= 9 && (
        <g fill="#fff" className="rb-sparkles">
          {[[-41, -36, 1], [42, -30, 0.8], [-44, 28, 0.7], [40, 36, 1]].map(([x, y, s], i) => (
            <polygon key={i} points={starPoints(4, 6 * s, 1.6 * s)} transform={`translate(${x},${y})`} style={{ animationDelay: i * 0.4 + 's' }} />
          ))}
        </g>
      )}
    </svg>
  );
}
