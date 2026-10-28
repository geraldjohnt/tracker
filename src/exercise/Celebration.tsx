// The full-screen moment after a quest that reaches a new rank tier or achievement level: the new
// badge, a burst of confetti and a Continue button. Several in a row are shown one at a time.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AchievementBadge, levelColors } from './AchievementBadge';
import { ACHIEVEMENT_BY_ID, goalText } from './achievements';
import { RankBadge, tierColors } from './RankBadge';
import type { Celebration } from './store';

const CONFETTI = 28;

export function CelebrationOverlay({ item, onClose }: { item: Celebration | undefined; onClose: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!item) return;
    btn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [item, onClose]);
  if (!item) return null;

  const ach = item.kind === 'achievement' ? ACHIEVEMENT_BY_ID[item.id] : undefined;
  if (item.kind === 'achievement' && !ach) return null;
  const colors = item.kind === 'rank' ? tierColors(item.rank.tier).stops : levelColors(item.level).stops;
  const key = item.kind === 'rank' ? 'r' + item.level : item.id + item.level;
  const newRank = item.kind === 'rank' && item.rank.tier === 1;

  return createPortal(
    <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="celebrateTitle" key={key} onClick={onClose}>
      <div className="celebrate-confetti" aria-hidden="true">
        {Array.from({ length: CONFETTI }, (_, i) => (
          <i key={i} style={{
            left: ((i * 37) % 100) + '%', background: colors[i % colors.length],
            animationDelay: ((i * 0.07) % 0.9).toFixed(2) + 's', animationDuration: (2.2 + ((i * 13) % 10) / 10) + 's',
            ['--drift' as string]: (((i * 53) % 120) - 60) + 'px', ['--spin' as string]: ((i * 97) % 720) - 360 + 'deg',
          }}></i>
        ))}
      </div>
      <div className="celebrate-card" onClick={e => e.stopPropagation()}>
        <div className="celebrate-kicker">{item.kind === 'rank' ? (newRank ? 'New rank!' : 'Rank up!') : 'Achievement unlocked'}</div>
        <div className="celebrate-badge">
          {item.kind === 'rank'
            ? <RankBadge rank={item.rank} size={150} />
            : <AchievementBadge def={ach!} level={item.level} size={150} />}
        </div>
        <h2 className="celebrate-title" id="celebrateTitle">{item.kind === 'rank' ? item.rank.label : ach!.name}</h2>
        <p className="celebrate-sub">
          {item.kind === 'rank'
            ? 'You reached Level ' + item.level + '. Keep it going!'
            : 'Level ' + item.level + ' · ' + levelColors(item.level).name + ': ' + goalText(ach!, item.level)}
        </p>
        <button type="button" className="btn-primary-x" ref={btn} onClick={onClose}>Continue</button>
      </div>
    </div>,
    document.body,
  );
}
