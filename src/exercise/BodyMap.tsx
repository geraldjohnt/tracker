// Anatomical front + back figure with the worked muscles highlighted: primary muscles in the
// accent colour, secondary ones in a lighter tint, the rest in a muted tone. Each figure is
// 200 × 450 units, centred on x = 100. Shapes are drawn for the left half of the screen
// (x < 100) and mirrored; `center` shapes aren't mirrored. Parts without `m` are anatomy that
// the catalog doesn't track (serratus, adductors, tibialis, …): drawn, never highlighted.
// `a` is the fibre direction in degrees (0 = horizontal): the muscle gets strands at that angle.
import { useId } from 'react';
import { MUSCLE_LABELS, type Muscle } from './catalog';

const MIRROR = 'matrix(-1 0 0 1 200 0)';

type Part = { m?: Muscle; d: string; a?: number; center?: boolean };

const HEAD = 'M100,6 C86,6 79,17 79,32 C79,41 81,47 84,52 C88,58 94,62 100,62 C106,62 112,58 116,52 C119,47 121,41 121,32 C121,17 114,6 100,6 Z';

// Body pieces (left half). Drawn twice: a thick outline pass, then a fill pass on top, so the
// overlapping pieces read as one silhouette.
const BODY = [
  'M81,27 C76,26 75,31 76,36 C77,41 79,44 82,43 Z', // ear
  'M89,46 L89,70 C89,75 93,79 100,80 L100,46 Z', // neck
  'M100,72 L90,72 C82,78 70,80 60,82 C51,84 45,90 43,99 C41,108 42,116 46,121 L62,118 C64,140 66,160 68,180 C69,190 68,200 66,210 C63,222 62,232 63,242 L100,252 Z', // torso
  'M50,88 C40,96 34,112 32,132 C30,150 30,162 30,172 L48,175 C50,160 54,142 58,126 C60,114 60,100 56,92 Z', // upper arm
  'M30,168 C26,184 22,200 20,214 C19,224 20,234 21,242 L33,244 C36,232 40,218 44,200 C46,190 48,182 48,172 Z', // forearm
  'M21,240 C18,250 16,262 17,274 C18,282 22,288 27,286 C31,284 33,276 34,268 C35,258 34,250 33,243 Z', // hand
  'M100,230 L64,226 C58,244 56,268 58,290 C60,308 64,322 67,334 L93,336 C94,320 96,296 98,278 C99,266 100,258 100,252 Z', // thigh
  'M67,332 C65,346 64,360 66,376 C68,392 72,408 74,418 L88,418 C88,408 88,394 89,380 C91,362 94,348 93,334 Z', // shin
  'M74,414 C72,422 66,430 64,436 C63,440 66,442 72,442 L90,442 C91,436 90,424 88,414 Z', // foot
];

const FOREARMS: Part[] = [
  { m: 'forearms', a: 97, d: 'M30,172 C25,184 21,200 20,214 C21,222 22,230 24,236 C26,222 29,206 33,192 C35,184 36,176 34,172 Z' },
  { m: 'forearms', a: 100, d: 'M37,174 C35,186 31,204 28,222 C27,230 27,236 28,240 L32,240 C35,226 39,212 43,198 C46,188 47,180 46,174 Z' },
];

const FRONT: Part[] = [
  { d: 'M74,346 C73,362 75,382 79,402 C82,386 82,364 80,346 Z' }, // tibialis anterior
  { d: 'M89,52 C91,60 94,69 97,77 L94,78 C92,69 89,60 88,54 Z' }, // sternocleidomastoid
  { d: 'M66,236 C74,256 82,286 89,318 C90,324 91,328 91,330 L88,330 C83,300 74,266 63,240 Z' }, // sartorius
  { d: 'M37,160 C36,166 37,170 40,174 C42,170 43,166 42,160 Z' }, // brachialis
  { d: 'M64,230 C61,237 61,244 63,250 C68,245 72,238 75,231 Z' }, // tensor fasciae latae
  { d: 'M98,256 C92,262 88,274 88,290 C92,285 96,277 99,268 Z' }, // adductors
  { d: 'M70,124 C67,127 65,130 64,133 C68,133 72,131 75,128 Z M70,134 C67,137 65,140 65,143 C69,143 73,141 76,138 Z M71,144 C68,147 66,150 66,153 C70,153 74,151 77,148 Z' }, // serratus
  { m: 'traps', a: -21, d: 'M90,71 C84,76 74,79 64,81 C74,83 84,82 93,78 Z' },
  { m: 'shoulders', a: 114, d: 'M67,82 C57,80 48,86 43,96 C39,106 37,118 38,130 C43,125 48,118 54,110 C60,102 65,94 70,87 Z' },
  { m: 'chest', a: 165, d: 'M98,86 C88,84 78,84 71,88 C65,95 61,104 58,112 C63,121 71,131 80,135 C88,138 94,137 98,133 Z' },
  { m: 'back', a: 80, d: 'M62,117 C64,129 66,141 66,153 C68,144 70,134 69,122 Z' }, // lats seen from the front
  { m: 'biceps', a: 98, d: 'M53,116 C45,122 40,134 39,147 C38,157 40,165 45,171 C51,167 55,157 57,144 C58,132 57,122 53,116 Z' },
  { m: 'triceps', a: 100, d: 'M37,132 C33,144 32,156 32,168 L35,168 C35,156 36,144 39,134 Z' }, // lateral head sliver
  ...FOREARMS,
  { m: 'abs', a: 90, d: 'M99,140 C93,139 89,140 87,142 C86,148 86,154 87,159 L99,160 Z' },
  { m: 'abs', a: 90, d: 'M99,164 L87,163 C86,170 86,176 87,182 L99,183 Z' },
  { m: 'abs', a: 90, d: 'M99,187 L87,186 C86,193 87,200 88,206 L99,207 Z' },
  { m: 'abs', a: 90, d: 'M99,211 L88,210 C88,220 91,230 99,238 Z' },
  { m: 'obliques', a: 68, d: 'M84,150 C78,151 72,155 68,161 C69,176 69,190 68,204 C72,214 78,223 85,230 C85,214 84,196 84,180 C84,170 84,160 84,150 Z' },
  { m: 'quads', a: 84, d: 'M62,248 C57,264 56,284 58,302 C60,316 65,327 71,332 C74,320 74,304 73,290 C72,274 69,260 62,248 Z' }, // vastus lateralis
  { m: 'quads', a: 88, d: 'M77,250 C73,266 73,286 75,304 C77,316 80,325 83,328 C86,316 88,300 88,286 C87,270 83,258 77,250 Z' }, // rectus femoris
  { m: 'quads', a: 110, d: 'M90,288 C86,297 84,310 85,322 C87,330 91,333 94,332 C95,320 95,306 93,294 Z' }, // vastus medialis
  { m: 'calves', a: 93, d: 'M68,344 C63,356 63,372 66,388 C70,380 72,366 72,350 Z' },
  { m: 'calves', a: 87, d: 'M88,342 C94,354 93,372 89,390 C85,378 84,362 85,348 Z' },
];

const BACK: Part[] = [
  { d: 'M62,262 C60,282 61,304 64,326 L67,326 C64,304 63,282 65,262 Z' }, // IT band
  { d: 'M77,404 C79,410 80,414 81,418 L85,418 C85,414 85,410 85,404 Z' }, // Achilles tendon
  { m: 'shoulders', a: 110, d: 'M62,84 C52,84 46,90 43,98 C39,108 37,120 37,130 C42,124 48,116 54,108 C58,100 62,94 66,90 Z' },
  { m: 'back', a: 160, d: 'M67,93 C61,99 59,107 61,114 C67,117 75,115 82,109 C84,103 83,97 79,93 Z' }, // infraspinatus / teres
  { m: 'back', a: 70, d: 'M61,119 C63,133 65,150 69,167 C73,181 81,196 92,206 C96,200 98,190 98,180 C96,166 92,148 88,132 C82,123 72,118 61,119 Z' }, // lats
  { m: 'traps', a: 0, center: true, d: 'M100,64 C96,70 92,74 88,76 C80,80 70,82 62,84 C72,88 82,92 90,100 C94,112 97,128 100,146 C103,128 106,112 110,100 C118,92 128,88 138,84 C130,82 120,80 112,76 C108,74 104,70 100,64 Z' },
  { m: 'lowerBack', a: 90, d: 'M99,150 C94,153 91,161 90,173 C89,190 90,206 92,222 L99,224 Z' },
  { m: 'triceps', a: 95, d: 'M56,113 C50,117 44,125 40,135 C38,147 38,158 42,168 L50,168 C54,158 57,146 58,132 C59,124 58,117 56,113 Z' },
  ...FOREARMS,
  { m: 'obliques', a: 60, d: 'M68,170 C69,186 68,198 66,210 C72,212 78,214 84,214 C78,202 72,188 68,170 Z' },
  { m: 'glutes', a: 128, d: 'M66,212 C64,220 64,228 66,234 C74,228 84,223 94,219 C86,214 76,212 66,212 Z' }, // gluteus medius
  { m: 'glutes', a: 145, d: 'M98,222 C86,222 72,228 65,240 C60,252 62,265 69,272 C80,279 92,279 99,275 Z' }, // gluteus maximus
  { m: 'hamstrings', a: 92, d: 'M67,277 C63,293 63,311 67,329 L77,334 C79,318 80,300 80,282 Z' }, // biceps femoris
  { m: 'hamstrings', a: 88, d: 'M83,280 C83,298 83,316 85,334 L92,334 C94,318 96,298 96,278 Z' }, // semitendinosus
  { m: 'calves', a: 95, d: 'M68,340 C64,352 64,366 68,378 C72,384 77,384 80,380 C80,366 79,352 76,342 Z' }, // gastrocnemius, lateral head
  { m: 'calves', a: 85, d: 'M82,342 C80,354 81,368 84,382 C88,384 92,380 92,372 C94,360 93,348 90,340 Z' }, // gastrocnemius, medial head
  { m: 'calves', a: 90, d: 'M68,384 C70,392 73,399 76,405 L86,405 C88,398 90,390 91,382 C86,388 80,390 76,389 C72,389 70,387 68,384 Z' }, // soleus
];

// Thin anatomy lines (not muscles): collarbones, sternum, fibre direction, kneecaps, spine.
const FRONT_LINES = [
  'M98,84 C90,81 78,81 66,82', 'M96,98 Q78,100 62,110', 'M96,112 Q80,114 63,115', 'M96,125 Q81,126 67,120',
  'M73,342 C76,338 82,338 86,342 C84,348 76,348 73,342 Z',
];
const BACK_LINES = ['M100,150 L100,230', 'M90,100 C84,110 80,118 78,124', 'M65,160 Q78,180 92,200'];

const ANGLES = [...new Set([...FRONT, ...BACK].flatMap(p => p.a === undefined ? [] : [p.a]))];
const angleKey = (a: number) => String(a).replace('-', 'n');

function Figure({ parts, lines, x, label, primary, secondary, fibre }: {
  parts: Part[]; lines: string[]; x: number; label: string; primary: Set<Muscle>; secondary: Set<Muscle>; fibre: string;
}) {
  const cls = (m?: Muscle) => !m ? 'bm-part' : 'bm-muscle' + (primary.has(m) ? ' bm-primary' : secondary.has(m) ? ' bm-secondary' : '');
  const both = (d: string, k: number) => <g key={k}><path d={d} /><path d={d} transform={MIRROR} /></g>;
  return (
    <g transform={'translate(' + x + ' 0)'}>
      <g className="bm-outline"><path d={HEAD} />{BODY.map(both)}</g>
      <g className="bm-body"><path d={HEAD} />{BODY.map(both)}</g>
      {parts.map((p, i) => (
        <g key={i} className={cls(p.m)}>
          {p.m && <title>{MUSCLE_LABELS[p.m]}</title>}
          <path d={p.d} />
          {!p.center && <path d={p.d} transform={MIRROR} />}
          {p.a !== undefined && <g className="bm-fibre" fill={`url(#${fibre}${angleKey(p.a)})`}>
            <path d={p.d} />
            {!p.center && <path d={p.d} transform={MIRROR} />}
          </g>}
        </g>
      ))}
      <g className="bm-line">{lines.map(both)}</g>
      <text className="bm-label" x="100" y="462" textAnchor="middle">{label}</text>
    </g>
  );
}

export function BodyMap({ primary, secondary, className }: { primary: Muscle[]; secondary: Muscle[]; className?: string }) {
  const p = new Set(primary);
  const s = new Set(secondary.filter(m => !p.has(m)));
  const names = [...p].map(m => MUSCLE_LABELS[m]).join(', ');
  const fibre = 'bm' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg className={'body-map' + (className ? ' ' + className : '')} viewBox="0 0 410 468" role="img" aria-label={'Muscles worked: ' + names}>
      <defs>
        {ANGLES.map(a => (
          <pattern key={a} id={fibre + angleKey(a)} patternUnits="userSpaceOnUse" width="6" height="2.6" patternTransform={`rotate(${a})`}>
            <path className="bm-strand" d="M0,.7 H6" /><path className="bm-strand-hi" d="M0,1.7 H6" />
          </pattern>
        ))}
      </defs>
      <Figure parts={FRONT} lines={FRONT_LINES} x={0} label="Front" primary={p} secondary={s} fibre={fibre} />
      <Figure parts={BACK} lines={BACK_LINES} x={210} label="Back" primary={p} secondary={s} fibre={fibre} />
    </svg>
  );
}
