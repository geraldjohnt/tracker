// Front + back body outline with the worked muscles highlighted: primary muscles in the
// accent colour, secondary ones in a lighter tint. Shapes are drawn for the figure's
// right-hand side of the screen (x < 60) and mirrored; `center` shapes aren't mirrored.
import { MUSCLE_LABELS, type Muscle } from './catalog';

const MIRROR = 'matrix(-1 0 0 1 120 0)';

const SILHOUETTE = [
  'M60 38 L44 40 Q36 42 34 50 L38 76 Q40 96 44 112 L46 124 L60 126 Z', // torso
  'M36 44 Q28 44 26 54 L22 90 L31 92 L37 62 Z', // upper arm
  'M22 91 L31 92 L27 130 L19 129 Z', // forearm
  'M44 112 L60 116 L60 140 L42 136 Q41 124 44 112 Z', // hips
  'M42 132 L60 138 L58 150 L56 192 L46 192 Q40 160 42 132 Z', // thigh
  'M46 191 L56 191 L55 236 L49 236 Q44 214 46 191 Z', // shin
  'M48 235 L56 235 L57 244 L44 245 Q44 239 48 235 Z', // foot
];

type Shape = { m: Muscle; d: string; center?: boolean };

const ARMS: Shape[] = [
  { m: 'shoulders', d: 'M36 43 Q28 44 27 54 Q31 57 38 52 L42 44 Z' },
  { m: 'forearms', d: 'M23 95 L30 95 Q29 112 27 126 L21 126 Q21 110 23 95 Z' },
];

const FRONT: Shape[] = [
  ...ARMS,
  { m: 'traps', d: 'M54 38 L46 42 L55 43 Z' },
  { m: 'chest', d: 'M59 46 L45 45 Q39 48 39 56 Q42 66 52 66 Q57 66 59 63 Z' },
  { m: 'biceps', d: 'M28 58 Q26 72 27 86 Q31 88 33 84 Q36 70 35 58 Q31 56 28 58 Z' },
  { m: 'abs', d: 'M53 68 L67 68 L66 112 Q60 116 54 112 Z', center: true },
  { m: 'obliques', d: 'M42 70 L51 70 L52 110 L46 108 Q42 90 42 70 Z' },
  { m: 'quads', d: 'M44 138 L57 144 L56 184 Q51 188 47 184 Q42 162 44 138 Z' },
  { m: 'calves', d: 'M47 198 L55 198 L54 226 L50 228 Q46 212 47 198 Z' },
];

const BACK: Shape[] = [
  ...ARMS,
  { m: 'traps', d: 'M52 37 L68 37 L77 44 L66 50 L60 68 L54 50 L43 44 Z', center: true },
  { m: 'back', d: 'M44 48 L54 52 L58 70 L58 96 Q50 96 46 88 Q41 70 44 48 Z' },
  { m: 'triceps', d: 'M28 58 Q26 72 27 86 Q31 88 33 84 Q36 70 35 58 Q31 56 28 58 Z' },
  { m: 'lowerBack', d: 'M52 97 L68 97 L67 114 L53 114 Z', center: true },
  { m: 'glutes', d: 'M44 116 L59 120 L59 140 Q50 144 43 136 Q41 124 44 116 Z' },
  { m: 'hamstrings', d: 'M44 143 L57 147 L56 184 Q51 188 47 184 Q42 162 44 143 Z' },
  { m: 'calves', d: 'M46 194 L56 194 Q57 210 54 224 L50 226 Q45 210 46 194 Z' },
];

function Figure({ shapes, x, label, primary, secondary }: { shapes: Shape[]; x: number; label: string; primary: Set<Muscle>; secondary: Set<Muscle> }) {
  const cls = (m: Muscle) => 'bm-muscle' + (primary.has(m) ? ' bm-primary' : secondary.has(m) ? ' bm-secondary' : '');
  return (
    <g transform={'translate(' + x + ' 0)'}>
      <ellipse className="bm-body" cx="60" cy="20" rx="11" ry="13" />
      <rect className="bm-body" x="54" y="30" width="12" height="10" rx="3" />
      {SILHOUETTE.map((d, i) => <g key={i}><path className="bm-body" d={d} /><path className="bm-body" d={d} transform={MIRROR} /></g>)}
      {[22, 98].map(cx => <ellipse key={cx} className="bm-body" cx={cx} cy="138" rx="4.5" ry="8" />)}
      {shapes.map((s, i) => (
        <g key={i} className={cls(s.m)}>
          <title>{MUSCLE_LABELS[s.m]}</title>
          <path d={s.d} />
          {!s.center && <path d={s.d} transform={MIRROR} />}
        </g>
      ))}
      <text className="bm-label" x="60" y="258" textAnchor="middle">{label}</text>
    </g>
  );
}

export function BodyMap({ primary, secondary, className }: { primary: Muscle[]; secondary: Muscle[]; className?: string }) {
  const p = new Set(primary);
  const s = new Set(secondary.filter(m => !p.has(m)));
  const names = [...p].map(m => MUSCLE_LABELS[m]).join(', ');
  return (
    <svg className={'body-map' + (className ? ' ' + className : '')} viewBox="0 0 250 262" role="img" aria-label={'Muscles worked: ' + names}>
      <Figure shapes={FRONT} x={0} label="Front" primary={p} secondary={s} />
      <Figure shapes={BACK} x={130} label="Back" primary={p} secondary={s} />
    </svg>
  );
}
