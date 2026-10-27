// The calisthenics exercise catalog, shared by every account.
//
// This bundled copy is the source of truth. The owner's account publishes it to
// the database at `exercises/` (see publishCatalog in store.ts) whenever
// CATALOG_VERSION is newer than what's there, and every signed-in account reads it
// from there. The app falls back to this copy until the catalog is published, or
// when it's offline. Bump CATALOG_VERSION after any change here.
//
// `gender` is a recommendation only. Anyone can take any quest.
//
// Owner rule: only calisthenics that can be done at home (no running, jogging, gyms).
// Exercises that need any equipment (`equipment` other than 'none') are optional quests
// only; daily quests use bodyweight-only exercises.

export const CATALOG_VERSION = 4;

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'elite'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const MUSCLES = [
  'chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'obliques',
  'traps', 'back', 'lowerBack', 'glutes', 'quads', 'hamstrings', 'calves',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Chest', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  abs: 'Abs', obliques: 'Obliques', traps: 'Traps', back: 'Upper back / lats', lowerBack: 'Lower back',
  glutes: 'Glutes', quads: 'Quads', hamstrings: 'Hamstrings', calves: 'Calves',
};

export type Category = 'legs' | 'push' | 'pull' | 'core' | 'full';
export type Measure = 'reps' | 'seconds';
export type Gender = 'any' | 'female' | 'male';
/**
 * How the camera form check follows the exercise (see pose.ts): most kinds count reps from a joint
 * angle (with form checks); plank/wallsit/hollow/lsit count seconds held in position. Every bundled
 * exercise has one. A page that doesn't know a kind (an older page, a newer catalog) only checks
 * that you're in view.
 */
export const TRACKERS = [
  'squat', 'jumpsquat', 'lunge', 'sidelunge', 'calfraise', 'pushup', 'wallpush', 'pike', 'archer', 'hspu', 'dip', 'pullup', 'row',
  'bridge', 'superman', 'snowangel', 'crunch', 'bicycle', 'deadbug', 'birddog', 'legraise', 'kneeraise', 'vup', 'climber', 'jack',
  'burpee', 'tuckjump', 'nordic', 'dragonflag', 'plank', 'wallsit', 'hollow', 'lsit',
] as const;
export type TrackerKind = (typeof TRACKERS)[number];

/** What you need at home. Anything but 'none' counts as equipment and is never a daily quest. */
export type Equipment = 'none' | 'wall' | 'chair' | 'bar' | 'dip' | 'anchor';

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  none: 'No equipment', wall: 'A wall', chair: 'A sturdy chair or bench', bar: 'A doorway pull-up bar (or a sturdy table for rows)',
  dip: 'Two sturdy chairs (or dip bars)', anchor: 'Something heavy to hook your feet under, or a partner',
};

export interface Exercise {
  id: string;
  name: string;
  /** Which version of the movement this is, and the starting position. */
  variant: string;
  category: Category;
  difficulty: Difficulty;
  measure: Measure;
  /** Amount at level 0 (reps or seconds). */
  base: number;
  /** Added per level. */
  perLevel: number;
  /** The amount is per side (each leg / each arm). */
  perSide: boolean;
  gender: Gender;
  equipment: Equipment;
  primary: Muscle[];
  secondary: Muscle[];
  summary: string;
  steps: string[];
  form: string[];
  mistakes: string[];
  easier: string;
  /** Camera counter for this exercise, if it has one yet. */
  tracker?: TrackerKind;
}

type Def = Omit<Exercise, 'perSide' | 'gender' | 'equipment'> & Partial<Pick<Exercise, 'perSide' | 'gender' | 'equipment'>>;
const ex = (d: Def): Exercise => ({ perSide: false, gender: 'any', equipment: 'none', ...d });

export const CATALOG: Exercise[] = [
  /* ---------------- Easy ---------------- */
  ex({
    id: 'air-squat', name: 'Bodyweight Squat', variant: 'Air squat: feet shoulder-width apart, toes slightly out, arms reaching forward',
    category: 'legs', difficulty: 'easy', measure: 'reps', base: 10, perLevel: 2, tracker: 'squat',
    primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves', 'abs'],
    summary: 'The basic squat. Builds leg strength and teaches the hip-and-knee bend used in almost every lower-body move.',
    steps: [
      'Stand tall with your feet shoulder-width apart and your toes turned out a little.',
      'Brace your stomach as if you are about to be poked, and lift your arms straight in front of you for balance.',
      'Push your hips back and bend your knees at the same time, as if sitting into a chair behind you.',
      'Go down until your thighs are about parallel to the floor, or as low as you can while your heels stay down.',
      'Push the floor away through your whole foot and stand back up, squeezing your glutes at the top.',
    ],
    form: ['Chest up and back flat, eyes looking forward', 'Knees travel in the same direction as your toes', 'Heels stay on the floor the whole time', 'Breathe in on the way down, out on the way up'],
    mistakes: ['Knees caving inward', 'Heels lifting off the floor', 'Rounding the lower back at the bottom'],
    easier: 'Squat down to a chair and lightly tap it with your glutes before standing up.',
  }),
  ex({
    id: 'glute-bridge', name: 'Glute Bridge', variant: 'Two-leg floor bridge: lying on your back, knees bent, feet flat',
    category: 'legs', difficulty: 'easy', measure: 'reps', base: 12, perLevel: 2, gender: 'female', tracker: 'bridge',
    primary: ['glutes'], secondary: ['hamstrings', 'lowerBack', 'abs'],
    summary: 'Lifts the hips off the floor to strengthen the glutes and back of the legs without loading the knees.',
    steps: [
      'Lie on your back with your knees bent and your feet flat on the floor, hip-width apart, close enough that your fingertips can touch your heels.',
      'Rest your arms on the floor by your sides, palms down.',
      'Tighten your stomach, then push through your heels to lift your hips toward the ceiling.',
      'Stop when your body makes a straight line from shoulders to knees, and squeeze your glutes for one second.',
      'Lower your hips slowly back to the floor.',
    ],
    form: ['Push through your heels, not your toes', 'Ribs stay down; do not arch your lower back at the top', 'Knees stay hip-width, not falling in or out'],
    mistakes: ['Over-arching the back instead of using the glutes', 'Feet too far away (you feel it mostly in the hamstrings)', 'Rushing the top squeeze'],
    easier: 'Do smaller lifts, only halfway up, until you can hold the top position.',
  }),
  ex({
    id: 'reverse-lunge', name: 'Reverse Lunge', variant: 'Alternating reverse lunge: stepping backward from a standing position',
    category: 'legs', difficulty: 'easy', measure: 'reps', base: 6, perLevel: 1, perSide: true, tracker: 'lunge',
    primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves'],
    summary: 'A one-leg-at-a-time squat that builds balance. Stepping back is easier on the knees than stepping forward.',
    steps: [
      'Stand tall with your feet hip-width apart and your hands on your hips.',
      'Take a big step backward with one foot, landing on the ball of that foot.',
      'Bend both knees until your back knee hovers just above the floor and your front thigh is about parallel to the ground.',
      'Push through the heel of your front foot to bring your back leg forward and stand up.',
      'Repeat on the other leg. One rep on each leg counts as one.',
    ],
    form: ['Front knee stays over the ankle, not pushed far past the toes', 'Torso upright', 'Both knees bend to about 90 degrees at the bottom'],
    mistakes: ['Steps too short, so the front knee shoots forward', 'Leaning the chest forward', 'Slamming the back knee into the floor'],
    easier: 'Hold a wall or chair back with one hand for balance, and do not go as deep.',
  }),
  ex({
    id: 'wall-sit', name: 'Wall Sit', variant: 'Back flat against a wall, knees bent to 90 degrees, held still',
    category: 'legs', difficulty: 'easy', measure: 'seconds', base: 20, perLevel: 5, equipment: 'wall', tracker: 'wallsit',
    primary: ['quads'], secondary: ['glutes', 'calves'],
    summary: 'An isometric hold: you stay still in a half-squat to build leg endurance.',
    steps: [
      'Stand with your back against a wall and your feet about two foot-lengths in front of it, hip-width apart.',
      'Slide your back down the wall until your knees are bent to about 90 degrees, like sitting on an invisible chair.',
      'Check that your knees are straight above your ankles. Move your feet forward or back if needed.',
      'Keep your back and head against the wall, rest your hands on your thighs or let them hang, and hold.',
      'Slide back up the wall to finish.',
    ],
    form: ['Thighs parallel to the floor', 'Knees above ankles', 'Weight in your heels', 'Keep breathing steadily'],
    mistakes: ['Pushing on your thighs with your hands', 'Knees past the toes', 'Holding your breath'],
    easier: 'Slide only halfway down, with your knees bent less than 90 degrees.',
  }),
  ex({
    id: 'calf-raise', name: 'Standing Calf Raise', variant: 'Two-leg calf raise on flat ground (or on a step edge for extra range)',
    category: 'legs', difficulty: 'easy', measure: 'reps', base: 15, perLevel: 2, tracker: 'calfraise',
    primary: ['calves'], secondary: [],
    summary: 'Rising onto your toes to strengthen the calves and ankles, which helps with walking, running and jumping.',
    steps: [
      'Stand tall with your feet hip-width apart. Lightly hold a wall or chair if you need balance.',
      'Push through the balls of your feet and rise up onto your toes as high as you can.',
      'Pause for one second at the top.',
      'Lower your heels slowly back to the floor.',
    ],
    form: ['Rise straight up, not rocking forward', 'Weight over the big toe and second toe', 'Slow on the way down'],
    mistakes: ['Bouncing quickly through the reps', 'Rolling out onto the little toes', 'Bending the knees to cheat'],
    easier: 'Do the raises while sitting on a chair, pressing down on your knees with your hands.',
  }),
  ex({
    id: 'incline-pushup', name: 'Incline Push-up', variant: 'Hands on a sturdy chair, bench or table edge, body in a straight line',
    category: 'push', difficulty: 'easy', measure: 'reps', base: 8, perLevel: 2, gender: 'female', equipment: 'chair', tracker: 'pushup',
    primary: ['chest', 'triceps'], secondary: ['shoulders', 'abs'],
    summary: 'A push-up with your hands raised. The higher the hands, the easier it is. A great first step toward floor push-ups.',
    steps: [
      'Put your hands on the edge of a sturdy bench, table or chair pushed against a wall, slightly wider than your shoulders.',
      'Walk your feet back until your body is in a straight line from head to heels, up on your toes.',
      'Bend your elbows to lower your chest toward the edge, keeping your elbows at about 45 degrees from your body.',
      'Stop when your chest is close to the edge.',
      'Push the edge away to straighten your arms again.',
    ],
    form: ['Body stays in one straight line, like a plank', 'Elbows angle back, not flared straight out', 'Squeeze your glutes and stomach'],
    mistakes: ['Hips sagging', 'Only moving the head forward', 'Using a chair that can slide'],
    easier: 'Use a higher surface, such as a kitchen counter.',
  }),
  ex({
    id: 'knee-pushup', name: 'Knee Push-up', variant: 'Push-up from the knees, hands under the shoulders',
    category: 'push', difficulty: 'easy', measure: 'reps', base: 8, perLevel: 1, gender: 'female', tracker: 'pushup',
    primary: ['chest', 'triceps'], secondary: ['shoulders', 'abs'],
    summary: 'A shorter-lever push-up that builds the chest, shoulders and arms for full push-ups.',
    steps: [
      'Kneel on a mat and place your hands on the floor slightly wider than your shoulders.',
      'Walk your hands forward until your body is a straight line from your head to your knees. Cross your ankles if you like.',
      'Bend your elbows to lower your chest toward the floor, elbows at about 45 degrees.',
      'Go down until your chest is a fist-height from the floor.',
      'Push the floor away to straighten your arms.',
    ],
    form: ['Straight line from head to knees, hips not bent', 'Hands under or slightly outside the shoulders', 'Lower slowly, push up strongly'],
    mistakes: ['Hips piked up in the air', 'Elbows flared straight out to the sides', 'Half reps'],
    easier: 'Do incline push-ups instead, or only lower halfway.',
  }),
  ex({
    id: 'wall-pushup', name: 'Wall Push-up', variant: 'Standing push-up with hands flat on a wall at chest height',
    category: 'push', difficulty: 'easy', measure: 'reps', base: 12, perLevel: 2, equipment: 'wall', tracker: 'wallpush',
    primary: ['chest', 'shoulders'], secondary: ['triceps'],
    summary: 'The gentlest push-up. Good for complete beginners and for warming up the shoulders.',
    steps: [
      'Stand about an arm’s length from a wall, feet hip-width apart.',
      'Place your palms flat on the wall at chest height, a little wider than your shoulders.',
      'Keeping your body straight, bend your elbows and lean your chest toward the wall.',
      'Stop when your nose is close to the wall.',
      'Push back to the start by straightening your arms.',
    ],
    form: ['Heels can lift; body stays straight', 'Elbows at about 45 degrees', 'Control both directions'],
    mistakes: ['Bending at the hips', 'Standing too close (very little movement)'],
    easier: 'Stand closer to the wall.',
  }),
  ex({
    id: 'superman', name: 'Superman', variant: 'Lying face down, lifting arms and legs together, short hold at the top',
    category: 'pull', difficulty: 'easy', measure: 'reps', base: 10, perLevel: 1, tracker: 'superman',
    primary: ['lowerBack', 'glutes'], secondary: ['back', 'shoulders', 'hamstrings'],
    summary: 'Strengthens the muscles along the back of the body that keep your posture upright.',
    steps: [
      'Lie face down on a mat with your arms stretched out in front of you and your legs straight.',
      'Look at the floor so your neck stays in line with your spine.',
      'Squeeze your glutes and lift your arms, chest and legs a few centimetres off the floor at the same time.',
      'Hold for two seconds at the top.',
      'Lower everything slowly back to the floor.',
    ],
    form: ['Lift with the back and glutes, not by throwing the arms', 'Neck neutral; do not look up', 'Small, controlled lift'],
    mistakes: ['Cranking the head back', 'Lifting too high and pinching the lower back', 'Holding your breath'],
    easier: 'Lift only the arms, then only the legs, instead of both together.',
  }),
  ex({
    id: 'reverse-snow-angel', name: 'Reverse Snow Angel', variant: 'Lying face down, chest slightly lifted, arms sweeping from hips to overhead',
    category: 'pull', difficulty: 'easy', measure: 'reps', base: 8, perLevel: 1, tracker: 'snowangel',
    primary: ['back', 'shoulders', 'traps'], secondary: ['lowerBack'],
    summary: 'Works the upper back and rear shoulders without equipment. Helps undo hunched posture.',
    steps: [
      'Lie face down with your arms by your sides, palms facing the floor, and your forehead just off the mat.',
      'Squeeze your shoulder blades together and lift your chest and arms slightly off the floor.',
      'Keeping your arms straight and off the floor, sweep them out to the sides and up until your hands meet above your head.',
      'Sweep them back down to your hips the same way.',
    ],
    form: ['Arms stay off the floor the whole time', 'Shoulder blades pulled back and down', 'Slow, smooth sweep'],
    mistakes: ['Shrugging the shoulders up to the ears', 'Letting the arms drag on the floor', 'Rushing'],
    easier: 'Keep your elbows slightly bent and make the sweep smaller.',
  }),
  ex({
    id: 'forearm-plank', name: 'Forearm Plank', variant: 'Elbows under shoulders, up on the toes, body in a straight line, held still',
    category: 'core', difficulty: 'easy', measure: 'seconds', base: 20, perLevel: 5, tracker: 'plank',
    primary: ['abs'], secondary: ['shoulders', 'glutes', 'obliques'],
    summary: 'The classic core hold. Teaches you to keep your trunk stiff, which protects your back in every other exercise.',
    steps: [
      'Lie face down and place your forearms on the floor with your elbows directly under your shoulders.',
      'Tuck your toes under and lift your body so only your forearms and toes touch the floor.',
      'Make a straight line from your head to your heels: squeeze your glutes and pull your belly button toward your spine.',
      'Look at the floor just in front of your hands and hold, breathing steadily.',
    ],
    form: ['Hips level with the shoulders, not up or down', 'Elbows under shoulders', 'Glutes and stomach squeezed'],
    mistakes: ['Hips sagging toward the floor', 'Hips piked high', 'Holding your breath'],
    easier: 'Hold the plank on your knees instead of your toes.',
  }),
  ex({
    id: 'dead-bug', name: 'Dead Bug', variant: 'Lying on your back, arms up, knees bent at 90 degrees, extending opposite arm and leg',
    category: 'core', difficulty: 'easy', measure: 'reps', base: 6, perLevel: 1, perSide: true, tracker: 'deadbug',
    primary: ['abs'], secondary: ['obliques'],
    summary: 'A slow core exercise that trains your stomach to keep your lower back flat while your limbs move.',
    steps: [
      'Lie on your back with your arms pointing straight up at the ceiling.',
      'Lift your legs so your knees are bent at 90 degrees, directly above your hips.',
      'Press your lower back gently into the floor.',
      'Slowly lower your right arm behind your head and straighten your left leg toward the floor, stopping just above it.',
      'Bring them back to the start and repeat with the left arm and right leg. One each side counts as one.',
    ],
    form: ['Lower back stays pressed into the floor', 'Move slowly', 'Breathe out as you extend'],
    mistakes: ['Back arching off the floor', 'Moving the same arm and leg', 'Going too fast'],
    easier: 'Move only the legs, keeping the arms still.',
  }),
  ex({
    id: 'crunch', name: 'Crunch', variant: 'Lying on your back, knees bent, lifting only the shoulder blades',
    category: 'core', difficulty: 'easy', measure: 'reps', base: 12, perLevel: 2, tracker: 'crunch',
    primary: ['abs'], secondary: ['obliques'],
    summary: 'A short, controlled curl of the upper body that targets the front of the stomach.',
    steps: [
      'Lie on your back with your knees bent and feet flat on the floor.',
      'Cross your arms over your chest, or rest your fingertips lightly behind your ears.',
      'Tighten your stomach and curl your head, neck and shoulder blades off the floor.',
      'Pause at the top for one second.',
      'Lower slowly back down.',
    ],
    form: ['Leave a fist-sized gap between chin and chest', 'Lower back stays on the floor', 'The stomach does the lifting'],
    mistakes: ['Pulling on your head with your hands', 'Sitting all the way up using momentum', 'Dropping back down fast'],
    easier: 'Do smaller lifts with your hands reaching toward your knees.',
  }),
  ex({
    id: 'bird-dog', name: 'Bird Dog', variant: 'On hands and knees, reaching the opposite arm and leg out straight',
    category: 'core', difficulty: 'easy', measure: 'reps', base: 6, perLevel: 1, perSide: true, gender: 'female', tracker: 'birddog',
    primary: ['lowerBack', 'glutes', 'abs'], secondary: ['shoulders'],
    summary: 'A balance exercise that strengthens the core and back together. Good for back health.',
    steps: [
      'Start on your hands and knees: hands under shoulders, knees under hips, back flat like a table.',
      'Tighten your stomach.',
      'Reach your right arm straight forward and your left leg straight back at the same time, until both are level with your body.',
      'Hold for two seconds without letting your hips tilt.',
      'Return to the start and switch sides. One each side counts as one.',
    ],
    form: ['Back stays flat; imagine a glass of water on it', 'Hips stay square to the floor', 'Reach long rather than high'],
    mistakes: ['Lifting the leg too high and arching the back', 'Twisting the hips', 'Rushing'],
    easier: 'Move only one arm or one leg at a time.',
  }),
  ex({
    id: 'jumping-jacks', name: 'Jumping Jacks', variant: 'Standard star jump: feet together to wide, arms down to overhead',
    category: 'full', difficulty: 'easy', measure: 'reps', base: 20, perLevel: 3, tracker: 'jack',
    primary: ['calves', 'shoulders'], secondary: ['quads', 'glutes'],
    summary: 'A whole-body warm-up move that raises your heart rate.',
    steps: [
      'Stand tall with your feet together and your arms by your sides.',
      'Jump your feet out wider than your shoulders while swinging your arms out and up over your head.',
      'Jump your feet back together while bringing your arms back down to your sides.',
      'Keep a steady rhythm. Each out-and-in counts as one.',
    ],
    form: ['Land softly on the balls of your feet', 'Knees slightly bent', 'Arms straight but relaxed'],
    mistakes: ['Landing flat-footed and heavy', 'Locked knees'],
    easier: 'Step one foot out at a time instead of jumping.',
  }),

  /* ---------------- Medium ---------------- */
  ex({
    id: 'pushup', name: 'Push-up', variant: 'Standard floor push-up: hands slightly wider than shoulders, up on the toes',
    category: 'push', difficulty: 'medium', measure: 'reps', base: 10, perLevel: 1, tracker: 'pushup',
    primary: ['chest', 'triceps'], secondary: ['shoulders', 'abs'],
    summary: 'The foundation of upper-body calisthenics. Works the chest, shoulders, arms and core together.',
    steps: [
      'Place your hands on the floor slightly wider than your shoulders and step your feet back so you are on your toes.',
      'Make a straight line from head to heels: squeeze your glutes and brace your stomach.',
      'Bend your elbows to lower your whole body together until your chest is about a fist-height from the floor.',
      'Keep your elbows about 45 degrees from your body, like an arrow, not a T.',
      'Push the floor away until your arms are straight.',
    ],
    form: ['Body moves as one plank', 'Elbows at about 45 degrees', 'Full range: chest low, arms straight at the top'],
    mistakes: ['Hips sagging or piking up', 'Head dropping toward the floor', 'Only going halfway down'],
    easier: 'Do knee push-ups or incline push-ups.',
  }),
  ex({
    id: 'wide-pushup', name: 'Wide Push-up', variant: 'Floor push-up with hands about one and a half shoulder-widths apart',
    category: 'push', difficulty: 'medium', measure: 'reps', base: 8, perLevel: 1, tracker: 'pushup',
    primary: ['chest', 'shoulders'], secondary: ['triceps', 'abs'],
    summary: 'A push-up variation that shifts more work onto the chest.',
    steps: [
      'Start in a push-up position, then walk your hands out until they are about one and a half times your shoulder width, fingers pointing forward.',
      'Brace your stomach and glutes so your body is straight.',
      'Lower your chest toward the floor between your hands.',
      'Push back up to straight arms.',
    ],
    form: ['Body straight from head to heels', 'Wrists under or just outside the elbows at the bottom', 'Controlled lowering'],
    mistakes: ['Hands so wide the shoulders hurt', 'Sagging hips', 'Shortened reps'],
    easier: 'Do them from your knees.',
  }),
  ex({
    id: 'jump-squat', name: 'Jump Squat', variant: 'Bodyweight squat with an explosive vertical jump, soft landing',
    category: 'legs', difficulty: 'medium', measure: 'reps', base: 8, perLevel: 1, tracker: 'jumpsquat',
    primary: ['quads', 'glutes', 'calves'], secondary: ['hamstrings'],
    summary: 'Adds a jump to the squat to build power and get your heart rate up.',
    steps: [
      'Stand with your feet shoulder-width apart.',
      'Squat down until your thighs are nearly parallel to the floor, swinging your arms back.',
      'Drive up explosively and jump straight up, swinging your arms forward.',
      'Land softly on the balls of your feet, then roll to your heels and sink straight into the next squat.',
    ],
    form: ['Land quietly with bent knees', 'Knees follow the toes on landing', 'Chest up'],
    mistakes: ['Landing on straight legs', 'Knees collapsing inward on landing', 'Jumping forward instead of up'],
    easier: 'Do fast bodyweight squats rising up onto your toes instead of jumping.',
  }),
  ex({
    id: 'walking-lunge', name: 'Walking Lunge', variant: 'Forward lunges that travel: step, lower, then step through with the back leg',
    category: 'legs', difficulty: 'medium', measure: 'reps', base: 8, perLevel: 1, perSide: true, tracker: 'lunge',
    primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves'],
    summary: 'A moving lunge that challenges balance and leg strength over distance.',
    steps: [
      'Stand tall with your hands on your hips and clear space in front of you.',
      'Take a long step forward and bend both knees until your back knee hovers just above the floor.',
      'Push through your front heel and bring your back foot forward, stepping straight into the next lunge on the other leg.',
      'Keep going, alternating legs. Each step counts as one for that leg.',
    ],
    form: ['Torso upright', 'Front knee over the ankle', 'Steps long enough that both knees reach about 90 degrees'],
    mistakes: ['Wobbling side to side (feet on a tightrope)', 'Short steps', 'Pushing off the back toes instead of the front heel'],
    easier: 'Do stationary reverse lunges instead.',
  }),
  ex({
    id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', variant: 'Rear foot raised on a chair or bench behind you, front foot about two steps forward',
    category: 'legs', difficulty: 'medium', measure: 'reps', base: 6, perLevel: 1, perSide: true, equipment: 'chair', tracker: 'lunge',
    primary: ['quads', 'glutes'], secondary: ['hamstrings'],
    summary: 'A single-leg squat with the back foot raised. One of the best leg exercises without weights.',
    steps: [
      'Stand about two steps in front of a sturdy chair or bench, facing away from it.',
      'Reach one foot back and rest the top of that foot on the seat.',
      'Keeping your chest up, bend your front knee and lower straight down until your front thigh is about parallel to the floor.',
      'Push through your front heel to stand back up.',
      'Do all reps on one leg, then switch.',
    ],
    form: ['Most of your weight on the front leg', 'Front knee follows the toes', 'Lower straight down, not forward'],
    mistakes: ['Front foot too close to the chair', 'Pushing off the back foot', 'Front knee caving in'],
    easier: 'Do it with the back foot on the floor (a split squat) and hold a wall.',
  }),
  ex({
    id: 'single-leg-bridge', name: 'Single-Leg Glute Bridge', variant: 'Floor bridge with one foot down and the other leg straight up or extended',
    category: 'legs', difficulty: 'medium', measure: 'reps', base: 8, perLevel: 1, perSide: true, gender: 'female', tracker: 'bridge',
    primary: ['glutes', 'hamstrings'], secondary: ['abs', 'lowerBack'],
    summary: 'A harder bridge that works one glute at a time and fixes left-right imbalances.',
    steps: [
      'Lie on your back with your knees bent and feet flat.',
      'Straighten one leg and lift it so your thighs stay level with each other.',
      'Push through the heel of the foot on the floor and lift your hips until your body is straight from shoulders to knee.',
      'Squeeze for one second, then lower slowly.',
      'Do all reps on one side, then switch.',
    ],
    form: ['Hips stay level; do not let one side drop', 'Push through the heel', 'Ribs down'],
    mistakes: ['Twisting the hips', 'Arching the back', 'Using momentum'],
    easier: 'Do two-leg glute bridges, or keep the raised foot lightly on the floor.',
  }),
  ex({
    id: 'side-lunge', name: 'Side Lunge', variant: 'Lateral lunge: stepping wide to the side, sitting back into one hip',
    category: 'legs', difficulty: 'medium', measure: 'reps', base: 6, perLevel: 1, perSide: true, gender: 'female', tracker: 'sidelunge',
    primary: ['quads', 'glutes'], secondary: ['hamstrings'],
    summary: 'Moves the legs sideways, working the inner thighs and hips that forward exercises miss.',
    steps: [
      'Stand with your feet together and hands clasped in front of your chest.',
      'Take a wide step out to the right.',
      'Push your hips back and bend your right knee, keeping your left leg straight, until your right thigh is near parallel to the floor.',
      'Push off your right foot to return to the start.',
      'Alternate sides, or do all reps on one side first.',
    ],
    form: ['Both feet point forward', 'Bent knee follows the toes', 'Chest up, hips back'],
    mistakes: ['Knee shooting past the toes', 'Rounding the back', 'Step too narrow'],
    easier: 'Make the step narrower and do not go as low.',
  }),
  ex({
    id: 'bench-dip', name: 'Bench Dip', variant: 'Hands on the edge of a chair or bench behind you, knees bent, feet flat',
    category: 'push', difficulty: 'medium', measure: 'reps', base: 8, perLevel: 1, equipment: 'chair', tracker: 'dip',
    primary: ['triceps'], secondary: ['shoulders', 'chest'],
    summary: 'Works the back of the arms using just a chair.',
    steps: [
      'Sit on the edge of a sturdy chair or bench (not one with wheels) and grip the edge beside your hips, fingers facing forward.',
      'Slide your hips off the edge, with your knees bent and feet flat on the floor.',
      'Bend your elbows straight back to lower your hips toward the floor until your upper arms are about parallel to the floor.',
      'Push through your palms to straighten your arms again.',
    ],
    form: ['Back stays close to the chair', 'Elbows point straight back, not out', 'Shoulders down, away from the ears'],
    mistakes: ['Going too low and straining the shoulders', 'Elbows flaring out', 'Pushing with the legs'],
    easier: 'Bring your feet closer to the chair so your legs help more.',
  }),
  ex({
    id: 'inverted-row', name: 'Inverted Row', variant: 'Hanging under a low bar or sturdy table, heels on the floor, pulling the chest up',
    category: 'pull', difficulty: 'medium', measure: 'reps', base: 6, perLevel: 1, equipment: 'bar', tracker: 'row',
    primary: ['back', 'biceps'], secondary: ['traps', 'shoulders', 'forearms'],
    summary: 'A horizontal pull that builds the back and arms, and prepares you for pull-ups.',
    steps: [
      'Lie under a low bar (about waist height) or a very sturdy table, and grab the edge with your hands shoulder-width apart.',
      'Straighten your body so only your heels touch the floor, arms straight.',
      'Squeeze your shoulder blades together and pull your chest up to the bar.',
      'Lower slowly until your arms are straight.',
    ],
    form: ['Body stays straight like a plank', 'Pull your elbows back toward your hips', 'Chest to the bar'],
    mistakes: ['Hips sagging', 'Pulling with the neck', 'Using a table that could tip; test it first'],
    easier: 'Bend your knees and put your feet flat, or use a higher bar so your body is more upright.',
  }),
  ex({
    id: 'mountain-climbers', name: 'Mountain Climbers', variant: 'From a high plank, driving knees to the chest one at a time',
    category: 'core', difficulty: 'medium', measure: 'reps', base: 10, perLevel: 2, perSide: true, tracker: 'climber',
    primary: ['abs'], secondary: ['shoulders', 'quads', 'obliques'],
    summary: 'A fast core exercise that also works as cardio.',
    steps: [
      'Start in a high plank: hands under shoulders, arms straight, body in a straight line.',
      'Drive your right knee toward your chest.',
      'Quickly switch: send the right leg back while bringing the left knee in.',
      'Keep alternating at a steady pace. Each knee drive counts as one for that side.',
    ],
    form: ['Hips stay low, level with the shoulders', 'Shoulders over the hands', 'Stomach braced'],
    mistakes: ['Hips bouncing up and down', 'Shoulders drifting behind the hands', 'Feet barely moving'],
    easier: 'Step the knees in slowly, one at a time, or put your hands on a chair.',
  }),
  ex({
    id: 'side-plank', name: 'Side Plank', variant: 'On one forearm, elbow under shoulder, feet stacked, hips lifted, held still',
    category: 'core', difficulty: 'medium', measure: 'seconds', base: 15, perLevel: 3, perSide: true, tracker: 'plank',
    primary: ['obliques'], secondary: ['abs', 'shoulders', 'glutes'],
    summary: 'A sideways plank that strengthens the sides of the waist.',
    steps: [
      'Lie on your side with your legs straight and stacked, and your elbow directly under your shoulder.',
      'Lift your hips off the floor so your body forms a straight line from head to feet.',
      'Put your top hand on your hip or reach it to the ceiling.',
      'Hold, then switch sides. The time is for each side.',
    ],
    form: ['Hips pushed up and forward, not sagging back', 'Elbow under shoulder', 'Head in line with the spine'],
    mistakes: ['Hips dropping', 'Rolling forward or back', 'Shoulder shrugged to the ear'],
    easier: 'Bend your knees and keep them on the floor.',
  }),
  ex({
    id: 'bicycle-crunch', name: 'Bicycle Crunch', variant: 'Lying on your back, elbow to opposite knee while the other leg extends',
    category: 'core', difficulty: 'medium', measure: 'reps', base: 10, perLevel: 1, perSide: true, tracker: 'bicycle',
    primary: ['obliques', 'abs'], secondary: [],
    summary: 'A twisting crunch that works both the front and sides of the stomach.',
    steps: [
      'Lie on your back with your fingertips lightly behind your ears and your knees lifted to 90 degrees.',
      'Lift your shoulder blades off the floor.',
      'Twist to bring your right elbow toward your left knee while straightening your right leg out.',
      'Switch sides in a smooth pedalling motion. Each twist counts as one for that side.',
    ],
    form: ['Rotate from the ribs, not just the elbows', 'Lower back stays down', 'Slow and controlled'],
    mistakes: ['Yanking the neck with the hands', 'Moving so fast the stomach does not work', 'Legs too high'],
    easier: 'Keep both feet on the floor and twist the upper body only.',
  }),
  ex({
    id: 'lying-leg-raise', name: 'Lying Leg Raise', variant: 'On your back, legs straight, lifting them to vertical and lowering slowly',
    category: 'core', difficulty: 'medium', measure: 'reps', base: 8, perLevel: 1, tracker: 'legraise',
    primary: ['abs'], secondary: ['obliques'],
    summary: 'Works the lower part of the stomach by lifting your legs.',
    steps: [
      'Lie on your back with your legs straight and your hands flat under your glutes for support.',
      'Press your lower back into the floor.',
      'Keeping your legs straight and together, lift them until they point at the ceiling.',
      'Lower them slowly until they are just above the floor, without letting your back arch.',
    ],
    form: ['Lower back stays pressed down', 'Legs straight and together', 'Slow on the way down'],
    mistakes: ['Back arching as the legs lower', 'Swinging the legs', 'Touching the floor and resting'],
    easier: 'Bend your knees, or only lower your legs halfway.',
  }),
  ex({
    id: 'hollow-hold', name: 'Hollow Body Hold', variant: 'On your back, arms overhead, shoulders and legs lifted into a shallow banana shape',
    category: 'core', difficulty: 'medium', measure: 'seconds', base: 15, perLevel: 3, tracker: 'hollow',
    primary: ['abs'], secondary: ['obliques', 'quads'],
    summary: 'A gymnastics core hold that builds the body tension used in advanced moves.',
    steps: [
      'Lie on your back with your arms stretched overhead and your legs straight.',
      'Press your lower back firmly into the floor.',
      'Lift your arms, head, shoulders and legs a few centimetres off the floor so your body forms a shallow curve.',
      'Hold, keeping your lower back glued to the floor.',
    ],
    form: ['Lower back never lifts', 'Legs together, toes pointed', 'Chin slightly tucked'],
    mistakes: ['Back arching off the floor', 'Legs too low for your strength', 'Holding your breath'],
    easier: 'Bend your knees and keep your arms by your sides (a tuck hollow hold).',
  }),
  ex({
    id: 'burpee', name: 'Burpee', variant: 'Squat, kick back to a plank, jump feet in, jump up (no push-up)',
    category: 'full', difficulty: 'medium', measure: 'reps', base: 6, perLevel: 1, tracker: 'burpee',
    primary: ['quads', 'chest', 'shoulders'], secondary: ['abs', 'triceps', 'calves', 'glutes'],
    summary: 'A full-body move that combines a squat, a plank and a jump. Great for conditioning.',
    steps: [
      'Stand with your feet shoulder-width apart.',
      'Squat down and place your hands on the floor in front of your feet.',
      'Jump or step your feet back into a high plank.',
      'Jump or step your feet back in toward your hands.',
      'Stand up and jump, reaching your arms overhead.',
    ],
    form: ['Plank stays straight; hips do not sag', 'Land softly', 'Keep a steady pace you can hold'],
    mistakes: ['Hips crashing to the floor in the plank', 'Rounded back when picking up', 'Landing on straight legs'],
    easier: 'Step back and in instead of jumping, and skip the jump at the top.',
  }),

  /* ---------------- Hard ---------------- */
  ex({
    id: 'diamond-pushup', name: 'Diamond Push-up', variant: 'Floor push-up with thumbs and index fingers touching to make a diamond under the chest',
    category: 'push', difficulty: 'hard', measure: 'reps', base: 6, perLevel: 1, gender: 'male', tracker: 'pushup',
    primary: ['triceps', 'chest'], secondary: ['shoulders', 'abs'],
    summary: 'A close-hand push-up that puts most of the work on the triceps.',
    steps: [
      'Get into a push-up position, then bring your hands together under your chest so your thumbs and index fingers form a diamond.',
      'Brace so your body is straight from head to heels.',
      'Bend your elbows, keeping them close to your sides, and lower your chest toward your hands.',
      'Push back up to straight arms.',
    ],
    form: ['Elbows brush your ribs', 'Chest comes down to the hands', 'Body straight'],
    mistakes: ['Elbows flaring out', 'Hips sagging', 'Shortened range'],
    easier: 'Do them from your knees, or with your hands slightly apart.',
  }),
  ex({
    id: 'decline-pushup', name: 'Decline Push-up', variant: 'Feet raised on a chair or bench, hands on the floor',
    category: 'push', difficulty: 'hard', measure: 'reps', base: 6, perLevel: 1, equipment: 'chair', tracker: 'pushup',
    primary: ['chest', 'shoulders'], secondary: ['triceps', 'abs'],
    summary: 'Raising the feet shifts more of your body weight onto your upper chest and shoulders.',
    steps: [
      'Place your feet on a sturdy chair or bench behind you and your hands on the floor, slightly wider than your shoulders.',
      'Make your body a straight line from head to heels.',
      'Lower your chest toward the floor, elbows at about 45 degrees.',
      'Push back up to straight arms.',
    ],
    form: ['No sagging at the hips', 'Head neutral', 'Full range'],
    mistakes: ['Piking the hips high', 'Dropping the head', 'Using a slippery chair'],
    easier: 'Use a lower step for your feet.',
  }),
  ex({
    id: 'pike-pushup', name: 'Pike Push-up', variant: 'Hips high in an upside-down V, lowering the head toward the floor',
    category: 'push', difficulty: 'hard', measure: 'reps', base: 5, perLevel: 1, tracker: 'pike',
    primary: ['shoulders', 'triceps'], secondary: ['traps', 'chest'],
    summary: 'A push-up done in a pike shape to target the shoulders. The first step toward handstand push-ups.',
    steps: [
      'Start in a push-up position, then walk your feet toward your hands and lift your hips high, making an upside-down V.',
      'Keep your arms and legs as straight as you can.',
      'Bend your elbows to lower the top of your head toward the floor, just in front of your hands.',
      'Push back up until your arms are straight.',
    ],
    form: ['Hips stay high', 'Head travels forward of the hands, forming a triangle', 'Elbows angle back, not out'],
    mistakes: ['Turning it into a regular push-up', 'Flared elbows', 'Banging the head on the floor'],
    easier: 'Lower only halfway, or put a cushion where your head goes.',
  }),
  ex({
    id: 'pull-up', name: 'Pull-up', variant: 'Overhand grip (palms facing away), hands slightly wider than shoulders, from a dead hang',
    category: 'pull', difficulty: 'hard', measure: 'reps', base: 3, perLevel: 1, gender: 'male', equipment: 'bar', tracker: 'pullup',
    primary: ['back', 'biceps'], secondary: ['forearms', 'shoulders', 'traps', 'abs'],
    summary: 'The king of upper-body pulling exercises. Builds a strong back and arms.',
    steps: [
      'Grab the bar with your palms facing away, hands slightly wider than your shoulders.',
      'Hang with your arms straight and your feet off the floor. Pull your shoulders down away from your ears.',
      'Pull your elbows down toward your ribs to lift your body until your chin is above the bar.',
      'Lower yourself slowly until your arms are straight again.',
    ],
    form: ['Start every rep from straight arms', 'Chest up, shoulders down', 'No swinging or kicking'],
    mistakes: ['Half reps that never straighten the arms', 'Kicking the legs for momentum', 'Craning the neck to reach the bar'],
    easier: 'Jump up to the top and lower yourself as slowly as you can (negatives), or do inverted rows.',
  }),
  ex({
    id: 'chin-up', name: 'Chin-up', variant: 'Underhand grip (palms facing you), hands shoulder-width apart, from a dead hang',
    category: 'pull', difficulty: 'hard', measure: 'reps', base: 4, perLevel: 1, equipment: 'bar', tracker: 'pullup',
    primary: ['biceps', 'back'], secondary: ['forearms', 'abs'],
    summary: 'A pull-up with palms facing you, which brings in more biceps and is usually a little easier.',
    steps: [
      'Grab the bar with your palms facing you, hands about shoulder-width apart.',
      'Hang with straight arms and pull your shoulders down.',
      'Pull your chest toward the bar until your chin is above it.',
      'Lower slowly to straight arms.',
    ],
    form: ['Full hang at the bottom', 'Elbows drive down and back', 'Body still'],
    mistakes: ['Swinging', 'Not reaching straight arms', 'Shrugging the shoulders up'],
    easier: 'Do negatives: jump to the top and lower slowly.',
  }),
  ex({
    id: 'parallel-dip', name: 'Parallel Bar Dip', variant: 'Supporting yourself on two parallel bars (or two sturdy chairs), lowering until elbows reach 90 degrees',
    category: 'push', difficulty: 'hard', measure: 'reps', base: 5, perLevel: 1, gender: 'male', equipment: 'dip', tracker: 'dip',
    primary: ['triceps', 'chest'], secondary: ['shoulders'],
    summary: 'A powerful upper-body push that builds the triceps, chest and shoulders.',
    steps: [
      'Grip the parallel bars and jump up so your arms are straight, holding your body above the bars.',
      'Lean your chest slightly forward and bend your knees if your feet would touch the floor.',
      'Bend your elbows to lower your body until your upper arms are about parallel to the floor.',
      'Push back up to straight arms.',
    ],
    form: ['Shoulders stay down, away from the ears', 'Elbows point back', 'Control the bottom; do not drop'],
    mistakes: ['Going too deep and straining the shoulders', 'Shrugging', 'Swinging'],
    easier: 'Do bench dips, or hold the top position and lower slowly.',
  }),
  ex({
    id: 'jumping-lunge', name: 'Jumping Lunge', variant: 'Lunge position, jumping to switch legs in the air, landing in a lunge',
    category: 'legs', difficulty: 'hard', measure: 'reps', base: 6, perLevel: 1, perSide: true, tracker: 'lunge',
    primary: ['quads', 'glutes', 'calves'], secondary: ['hamstrings'],
    summary: 'An explosive lunge that builds leg power and conditioning.',
    steps: [
      'Start in a lunge: one foot forward, one back, both knees bent.',
      'Jump straight up and switch your legs in the air.',
      'Land softly in a lunge with the other foot forward, sinking straight into the next rep.',
      'Each landing counts as one for the front leg.',
    ],
    form: ['Land softly with bent knees', 'Torso upright', 'Front knee over the ankle'],
    mistakes: ['Landing with a straight front leg', 'Back knee hitting the floor', 'Wobbling knees'],
    easier: 'Do walking lunges, or step back to switch legs instead of jumping.',
  }),
  ex({
    id: 'v-up', name: 'V-up', variant: 'On your back, lifting straight arms and straight legs to meet above the hips',
    category: 'core', difficulty: 'hard', measure: 'reps', base: 8, perLevel: 1, tracker: 'vup',
    primary: ['abs'], secondary: ['obliques', 'quads'],
    summary: 'A full-range sit-up where the arms and legs meet in a V. Very demanding on the stomach.',
    steps: [
      'Lie on your back with your arms stretched overhead and legs straight.',
      'In one movement, lift your legs and upper body, reaching your hands toward your toes.',
      'Balance briefly on your seat at the top, with your body in a V shape.',
      'Lower back down slowly with control.',
    ],
    form: ['Arms and legs stay straight', 'Move both halves at the same time', 'Control the way down'],
    mistakes: ['Throwing the arms for momentum', 'Crashing back down', 'Bent legs'],
    easier: 'Bend your knees into a tuck at the top (tuck-ups).',
  }),
  ex({
    id: 'hanging-knee-raise', name: 'Hanging Knee Raise', variant: 'Hanging from a bar, bringing the knees up to chest height',
    category: 'core', difficulty: 'hard', measure: 'reps', base: 6, perLevel: 1, equipment: 'bar', tracker: 'kneeraise',
    primary: ['abs'], secondary: ['forearms', 'obliques'],
    summary: 'Works the stomach while also building grip strength from hanging.',
    steps: [
      'Hang from a pull-up bar with your arms straight and shoulders pulled down.',
      'Tighten your stomach and lift your knees up toward your chest.',
      'Curl your hips up slightly at the top.',
      'Lower your legs slowly without swinging.',
    ],
    form: ['No swinging between reps', 'Curl the hips, not just the knees', 'Shoulders active'],
    mistakes: ['Using momentum', 'Dropping the legs fast', 'Letting go of shoulder tension'],
    easier: 'Lift one knee at a time, or do lying leg raises.',
  }),
  ex({
    id: 'tuck-jump', name: 'Tuck Jump', variant: 'Jumping straight up and pulling both knees to the chest',
    category: 'full', difficulty: 'hard', measure: 'reps', base: 6, perLevel: 1, tracker: 'tuckjump',
    primary: ['quads', 'calves', 'glutes'], secondary: ['abs'],
    summary: 'An explosive jump that builds power and spikes the heart rate.',
    steps: [
      'Stand with your feet hip-width apart and your arms at your sides.',
      'Dip into a quarter squat, then jump as high as you can.',
      'At the top, pull both knees up toward your chest.',
      'Straighten your legs to land softly on the balls of your feet, knees bent, and go straight into the next jump.',
    ],
    form: ['Soft, quiet landings', 'Knees come up, not the chest down', 'Land with knees over toes'],
    mistakes: ['Landing on straight legs', 'Rounding the back to fake the tuck', 'No rest when your form breaks'],
    easier: 'Do jump squats instead.',
  }),

  /* ---------------- Elite ---------------- */
  ex({
    id: 'pistol-squat', name: 'Pistol Squat', variant: 'Single-leg squat to full depth, the other leg held straight out in front',
    category: 'legs', difficulty: 'elite', measure: 'reps', base: 3, perLevel: 1, perSide: true, tracker: 'lunge',
    primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves', 'abs'],
    summary: 'A full squat on one leg. Takes strength, balance and mobility.',
    steps: [
      'Stand on one leg and lift the other straight out in front of you. Reach your arms forward for balance.',
      'Push your hips back and bend your standing knee, lowering slowly while keeping the free leg off the floor.',
      'Go down as low as you can with control, ideally until your hamstring touches your calf.',
      'Push through your whole foot to stand back up.',
      'Do all reps on one leg, then switch.',
    ],
    form: ['Standing heel stays down', 'Knee follows the toes', 'Slow, controlled descent'],
    mistakes: ['Knee caving in', 'Collapsing at the bottom', 'Heel lifting'],
    easier: 'Hold a doorframe for support, or squat down onto a chair on one leg.',
  }),
  ex({
    id: 'nordic-curl', name: 'Nordic Hamstring Curl', variant: 'Kneeling with ankles anchored, lowering the body forward slowly with straight hips',
    category: 'legs', difficulty: 'elite', measure: 'reps', base: 3, perLevel: 1, equipment: 'anchor', tracker: 'nordic',
    primary: ['hamstrings'], secondary: ['glutes', 'calves'],
    summary: 'One of the hardest hamstring exercises. Strongly protects against hamstring injuries.',
    steps: [
      'Kneel on a cushion with your ankles hooked under something heavy (a sofa) or held down by a partner.',
      'Keep your body straight from knees to head, hips pushed forward.',
      'Slowly lean forward, using your hamstrings to resist, for as long as you can.',
      'When you can no longer hold it, catch yourself with your hands in a push-up position.',
      'Push off gently with your hands and pull yourself back up with your hamstrings.',
    ],
    form: ['Hips stay straight; do not bend at the waist', 'Lower as slowly as possible', 'Hands ready to catch you'],
    mistakes: ['Bending at the hips to make it easier', 'Dropping fast', 'An anchor that slips'],
    easier: 'Only lower part of the way, and use your hands more to push back up.',
  }),
  ex({
    id: 'archer-pushup', name: 'Archer Push-up', variant: 'Very wide hands; lowering toward one hand while the other arm stays straight',
    category: 'push', difficulty: 'elite', measure: 'reps', base: 3, perLevel: 1, perSide: true, gender: 'male', tracker: 'archer',
    primary: ['chest', 'triceps'], secondary: ['shoulders', 'abs'],
    summary: 'A one-sided push-up that bridges the gap to one-arm push-ups.',
    steps: [
      'Get into a push-up position with your hands about twice shoulder-width apart, fingers pointing out a little.',
      'Shift your weight toward your right hand and bend your right elbow, keeping your left arm straight.',
      'Lower your chest close to your right hand.',
      'Push back up to the centre, then repeat on the left side.',
    ],
    form: ['Body stays straight', 'Straight arm stays fully straight', 'Working elbow stays close to the body'],
    mistakes: ['Bending the straight arm', 'Hips twisting', 'Shallow reps'],
    easier: 'Put the straight-arm hand on a raised surface, or do them from your knees.',
  }),
  ex({
    id: 'clap-pushup', name: 'Clap Push-up', variant: 'Explosive floor push-up with a hand clap in the air',
    category: 'push', difficulty: 'elite', measure: 'reps', base: 5, perLevel: 1, gender: 'male', tracker: 'pushup',
    primary: ['chest', 'triceps'], secondary: ['shoulders'],
    summary: 'A plyometric push-up that builds upper-body explosive power.',
    steps: [
      'Start in a strong push-up position on a soft surface like a mat.',
      'Lower your chest toward the floor.',
      'Push up as hard and fast as you can so your hands leave the floor.',
      'Clap once, then land with soft, slightly bent elbows and go straight into the next rep.',
    ],
    form: ['Body straight in the air', 'Land with bent elbows', 'Stop when you can no longer push high enough'],
    mistakes: ['Landing on locked arms', 'Hips sagging', 'Doing them when tired (risk of face-plants)'],
    easier: 'Do explosive push-ups where your hands just leave the floor, without clapping.',
  }),
  ex({
    id: 'wall-hspu', name: 'Wall Handstand Push-up', variant: 'Kick up to a handstand facing away from a wall, lowering the head toward the floor',
    category: 'push', difficulty: 'elite', measure: 'reps', base: 3, perLevel: 1, equipment: 'wall', tracker: 'hspu',
    primary: ['shoulders', 'triceps'], secondary: ['traps', 'abs'],
    summary: 'A push-up upside down. Moves your full body weight with your shoulders.',
    steps: [
      'Place your hands on the floor about a hand-length from a wall, shoulder-width apart.',
      'Kick up into a handstand so your heels rest against the wall. Practise this alone first.',
      'Brace your stomach and slowly bend your elbows to lower the top of your head toward a cushion on the floor.',
      'Push back up until your arms are straight.',
      'Come down one leg at a time when you finish.',
    ],
    form: ['Head and hands form a triangle at the bottom', 'Stomach tight so the back does not arch', 'Elbows angle back'],
    mistakes: ['Dropping onto the head', 'Over-arched back', 'Trying it before you can do pike push-ups well'],
    easier: 'Do pike push-ups with your feet raised on a chair.',
  }),
  ex({
    id: 'l-sit', name: 'L-sit', variant: 'Floor L-sit: seated, hands flat beside the hips, pressing the body up with straight legs held level',
    category: 'core', difficulty: 'elite', measure: 'seconds', base: 10, perLevel: 2, tracker: 'lsit',
    primary: ['abs', 'quads'], secondary: ['triceps', 'shoulders'],
    summary: 'A gymnastics hold where your body makes an L shape. Very hard on the core and hip flexors.',
    steps: [
      'Sit on the floor with your legs straight in front of you and your hands flat beside your hips, fingers forward. (Two sturdy chairs make it a little easier.)',
      'Press down hard through your hands to straighten your arms and lift your seat off the surface.',
      'Lift your straight legs so they are level with the floor, making an L.',
      'Hold, pushing your shoulders down away from your ears.',
    ],
    form: ['Arms locked straight', 'Legs straight and together, toes pointed', 'Shoulders pushed down'],
    mistakes: ['Bent knees (unless doing the easier version)', 'Shrugged shoulders', 'Leaning far back'],
    easier: 'Tuck your knees to your chest (tuck sit), or keep one foot on the floor.',
  }),
  ex({
    id: 'hanging-leg-raise', name: 'Hanging Leg Raise', variant: 'Hanging from a bar, lifting straight legs to at least hip height',
    category: 'core', difficulty: 'elite', measure: 'reps', base: 5, perLevel: 1, equipment: 'bar', tracker: 'legraise',
    primary: ['abs'], secondary: ['obliques', 'forearms'],
    summary: 'A straight-leg version of the knee raise that works the entire stomach and grip.',
    steps: [
      'Hang from a pull-up bar with straight arms and your shoulders pulled down.',
      'Keeping your legs straight and together, lift them until they are at least level with your hips.',
      'Pause briefly at the top.',
      'Lower slowly without swinging.',
    ],
    form: ['Legs stay straight', 'No swinging', 'Slow lowering'],
    mistakes: ['Using a swing', 'Bending the knees halfway through', 'Dropping fast'],
    easier: 'Do hanging knee raises.',
  }),
  ex({
    id: 'dragon-flag', name: 'Dragon Flag', variant: 'Lying on a bench gripping it behind your head, lowering a straight body from vertical',
    category: 'core', difficulty: 'elite', measure: 'reps', base: 3, perLevel: 1, equipment: 'chair', tracker: 'dragonflag',
    primary: ['abs'], secondary: ['obliques', 'lowerBack'],
    summary: 'An advanced core move where your whole body is held straight while pivoting on your shoulders.',
    steps: [
      'Lie on your back on a sturdy bench and grip its edge (or a heavy piece of furniture) behind your head.',
      'Lift your legs and hips up until your body is nearly vertical, resting on your upper back and shoulders.',
      'Keeping your body straight from shoulders to toes, slowly lower it toward the bench.',
      'Stop just above the bench, then raise back up to vertical.',
    ],
    form: ['Body stays straight like a plank; no bend at the hips', 'Weight on the upper back, not the neck', 'Very slow lowering'],
    mistakes: ['Bending at the hips', 'Putting pressure on the neck', 'Lowering faster than you can control'],
    easier: 'Bend your knees (tuck dragon flag), or only do the slow lowering part.',
  }),
];

export const CATALOG_BY_ID: Record<string, Exercise> = Object.fromEntries(CATALOG.map(e => [e.id, e]));
