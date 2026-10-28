// Achievement badges. The symbol in the middle shows what the achievement is for (a flame for the
// streak, a stopwatch for holds, …). The level (1–10) sets the colours, the same for every
// achievement, from bronze up to prismatic, and how ornate the frame is: a plain medal at 1, then a
// rim, studs, a rosette, ribbons, rays, laurels, wings and a crown, with sparkles at 10. The hardest
// achievements (difficulty 3) also get a gem crest from level 4.
import { useId } from 'react';
import type { AchievementDef } from './achievements';
import { Gem, Laurel, polar, pts, starPoints, Wing } from './RankBadge';

interface LevelColors { name: string; stops: string[]; edge: string; trim: [string, string]; glow: string }
/** Level 1–10 colours, each easy to tell apart, getting cooler as they go up. */
export const LEVEL_COLORS: LevelColors[] = [
  { name: 'Bronze', stops: ['#fde1c4', '#d08a4f', '#8a4b1c'], edge: '#5c2f0e', trim: ['#ffe8d1', '#c27a3e'], glow: '#f0b27a' },
  { name: 'Silver', stops: ['#ffffff', '#d1d5db', '#6b7280'], edge: '#374151', trim: ['#ffffff', '#9ca3af'], glow: '#e5e7eb' },
  { name: 'Gold', stops: ['#fff7cc', '#facc15', '#b45309'], edge: '#78350f', trim: ['#fef9c3', '#eab308'], glow: '#fde047' },
  { name: 'Emerald', stops: ['#a7f3d0', '#10b981', '#065f46'], edge: '#064e3b', trim: ['#d1fae5', '#34d399'], glow: '#34d399' },
  { name: 'Sapphire', stops: ['#bfdbfe', '#2563eb', '#1e1b4b'], edge: '#172554', trim: ['#dbeafe', '#60a5fa'], glow: '#60a5fa' },
  { name: 'Amethyst', stops: ['#f3e8ff', '#a855f7', '#4c1d95'], edge: '#2e1065', trim: ['#fae8ff', '#c084fc'], glow: '#c084fc' },
  { name: 'Ruby', stops: ['#ffe4e6', '#e11d48', '#4c0519'], edge: '#4c0519', trim: ['#fef3c7', '#f59e0b'], glow: '#fb7185' },
  { name: 'Aurora', stops: ['#99f6e4', '#22d3ee', '#6366f1', '#c026d3'], edge: '#312e81', trim: ['#ccfbf1', '#a5b4fc'], glow: '#67e8f9' },
  { name: 'Magma', stops: ['#fde047', '#f97316', '#b91c1c', '#1c1917'], edge: '#0c0a09', trim: ['#fef08a', '#ef4444'], glow: '#fb923c' },
  { name: 'Prismatic', stops: ['#f43f5e', '#f59e0b', '#facc15', '#22c55e', '#06b6d4', '#6366f1', '#d946ef'], edge: '#1e1b4b', trim: ['#ffffff', '#fde68a'], glow: '#e9d5ff' },
];
export const levelColors = (level: number) => LEVEL_COLORS[Math.min(Math.max(level, 1), 10) - 1];

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** The scalloped rosette behind the medal (levels 4+). */
const ROSETTE = pts(Array.from({ length: 64 }, (_, i) => polar(36 + 2.6 * Math.cos((i / 64) * Math.PI * 2 * 16), (360 / 64) * i)));

export function AchievementBadge({ def, level, size = 64, className, title }: { def: AchievementDef; level: number; size?: number; className?: string; title?: string }) {
  const id = 'ab' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const label = title ?? (level ? def.name + ' level ' + level : def.name + ', locked');
  if (!level) {
    return (
      <svg className={'ach-badge locked' + (className ? ' ' + className : '')} width={size} height={size} viewBox="-50 -50 100 100" role="img" aria-label={label}>
        <title>{label}</title>
        <circle r={30} className="ab-locked-disc" />
        <text className="ab-glyph ab-locked-glyph" y={1} fontSize={28}>{def.glyph}</text>
      </svg>
    );
  }
  const c = levelColors(level);
  const body = `url(#${id}b)`;
  const trim = `url(#${id}t)`;
  const hard = def.difficulty === 3;
  return (
    <svg className={'ach-badge' + (level >= 10 ? ' ab-top' : '') + (className ? ' ' + className : '')} width={size} height={size}
      viewBox="-50 -50 100 100" role="img" aria-label={label}>
      <title>{label}</title>
      <defs>
        <linearGradient id={id + 'b'} x1="0" y1="0" x2="0.4" y2="1">
          {c.stops.map((s, i) => <stop key={i} offset={i / (c.stops.length - 1)} stopColor={s} />)}
        </linearGradient>
        <linearGradient id={id + 't'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.trim[0]} /><stop offset="1" stopColor={c.trim[1]} />
        </linearGradient>
        <radialGradient id={id + 'g'}>
          <stop offset="0.35" stopColor={c.glow} stopOpacity={0.8} /><stop offset="1" stopColor={c.glow} stopOpacity={0} />
        </radialGradient>
        <clipPath id={id + 'c'}><circle r={30} /></clipPath>
      </defs>

      {level >= 8 && <circle r={50} fill={`url(#${id}g)`} className="ab-glow" />}
      {level >= 6 && (
        <polygon points={starPoints(level >= 10 ? 18 : 12, 49, 30)} fill={c.stops[0]} fillOpacity={0.6} stroke={c.trim[1]} strokeOpacity={0.6} strokeWidth={0.6}
          className="ab-rays" />
      )}
      {level >= 5 && (
        <g fill={body} stroke={c.edge} strokeWidth={1} strokeLinejoin="round">
          <path d="M-16,22 L-24,47 L-15,42 L-9,49 L-4,27 Z" /><path d="M16,22 L24,47 L15,42 L9,49 L4,27 Z" />
        </g>
      )}
      {level >= 7 && <><Laurel fill={trim} stroke={c.edge} /><g transform="scale(-1,1)"><Laurel fill={trim} stroke={c.edge} /></g></>}
      {level >= 8 && <>
        <Wing feathers={level >= 10 ? 6 : 5} fill={trim} stroke={c.edge} />
        <g transform="scale(-1,1)"><Wing feathers={level >= 10 ? 6 : 5} fill={trim} stroke={c.edge} /></g>
      </>}
      {level >= 4 && <polygon points={ROSETTE} fill={trim} stroke={c.edge} strokeWidth={1.2} strokeLinejoin="round" />}

      <circle r={30} fill={body} stroke={c.edge} strokeWidth={level === 1 ? 2 : 2.6} />
      {level >= 2 && <circle r={25.5} fill="none" stroke={trim} strokeWidth={level >= 4 ? 2.2 : 1.6} strokeOpacity={0.9} />}
      {level >= 3 && Array.from({ length: 12 }, (_, i) => {
        const [x, y] = polar(28.2, i * 30 + 15);
        return <circle key={i} cx={x} cy={y} r={1.3} fill={c.trim[0]} stroke={c.edge} strokeWidth={0.4} />;
      })}
      <text className="ab-glyph" y={-3} fontSize={level >= 6 ? 27 : 25} fill="#fff" stroke={c.edge} strokeWidth={2.4} paintOrder="stroke" strokeLinejoin="round">{def.glyph}</text>
      <text className="ab-level" y={19} fontSize={8.5} fill="#fff" stroke={c.edge} strokeWidth={2} paintOrder="stroke">{ROMAN[level]}</text>
      <ellipse cx={-10} cy={-18} rx={20} ry={11} fill="#fff" fillOpacity={0.22} clipPath={`url(#${id}c)`} transform="rotate(-20)" />

      {hard && level >= 4 && level < 9 && <g transform="translate(0,-37) scale(.42)"><Gem fill={trim} facet={c.edge} /></g>}
      {level >= 9 && (
        <g transform="translate(0,-37)">
          <path d="M-15,8 L-17,-7 L-8,0 L0,-11 L8,0 L17,-7 L15,8 Z" fill={trim} stroke={c.edge} strokeWidth={1} strokeLinejoin="round" />
          <circle cx={-17} cy={-7} r={2} fill={c.stops[1]} /><circle cy={-11} r={2.4} fill={hard ? '#fff' : c.stops[1]} /><circle cx={17} cy={-7} r={2} fill={c.stops[1]} />
          <rect x={-15} y={5} width={30} height={3.5} rx={1} fill={c.edge} fillOpacity={0.6} />
        </g>
      )}
      {level >= 10 && (
        <g fill="#fff" className="ab-sparkles">
          {[[-41, -36, 1], [42, -30, 0.8], [-44, 28, 0.7], [40, 36, 1]].map(([x, y, s], i) => (
            <polygon key={i} points={starPoints(4, 6 * s, 1.6 * s)} transform={`translate(${x},${y})`} style={{ animationDelay: i * 0.4 + 's' }} />
          ))}
        </g>
      )}
    </svg>
  );
}
