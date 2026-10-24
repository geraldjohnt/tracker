// Small shared pieces of the Exercise page.
import type { Exercise, Gender } from './catalog';

/** "12 reps", "30 sec", "8 reps each side". */
export function fmtAmount(ex: Pick<Exercise, 'measure' | 'perSide'>, n: number): string {
  return n + (ex.measure === 'seconds' ? ' sec' : n === 1 ? ' rep' : ' reps') + (ex.perSide ? ' each side' : '');
}

const GENDER: Record<Gender, [icon: string, short: string, long: string]> = {
  any: ['bi-people', 'Everyone', 'Suits everyone'],
  female: ['bi-gender-female', 'Women', 'Recommended for women · anyone can do it'],
  male: ['bi-gender-male', 'Men', 'Recommended for men · anyone can do it'],
};

/** The recommended-gender tag. It's a reference only; every quest is open to everyone. */
export function GenderTag({ gender, long }: { gender: Gender; long?: boolean }) {
  const [icon, short, full] = GENDER[gender];
  return <span className={'ex-tag gender-' + gender} title={full}><i className={'bi ' + icon}></i>{long ? full : short}</span>;
}

export const CATEGORY_ICONS: Record<Exercise['category'], string> = {
  legs: 'bi-person-walking', push: 'bi-arrow-up-circle', pull: 'bi-arrow-down-circle', core: 'bi-bullseye', full: 'bi-lightning-charge',
};
export const CATEGORY_LABELS: Record<Exercise['category'], string> = {
  legs: 'Legs', push: 'Push', pull: 'Pull', core: 'Core', full: 'Full body',
};
