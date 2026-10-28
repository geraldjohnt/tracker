// The Achievements tab: every achievement with its badge, current level and progress to the next
// one. Tapping one opens all 10 levels, so players can see the badges still ahead.
import { useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { useBsModal } from '../shared/components/useBsModal';
import { AchievementBadge, levelColors } from './AchievementBadge';
import { ACHIEVEMENT_LEVELS, achievementProgress, achievementStats, fmtValue, goalText, type AchievementProgress } from './achievements';
import type { ExerciseState } from './store';

export function AchievementsView({ state }: { state: ExerciseState }) {
  const list = useMemo(
    () => achievementProgress(achievementStats(state.days, state.weeks, state.byId, state.targets, state.today)),
    [state.days, state.weeks, state.byId, state.targets, state.today],
  );
  const modalRef = useRef<AchievementModalHandle>(null);
  const earned = list.reduce((sum, a) => sum + a.level, 0);
  const total = list.length * ACHIEVEMENT_LEVELS;
  return (
    <>
      <div className="card-x fade-in ach-hero">
        <div className="ach-hero-badges" aria-hidden="true">
          {[...list].sort((a, b) => b.level - a.level).slice(0, 3).map(a => <AchievementBadge key={a.def.id} def={a.def} level={a.level} size={52} />)}
        </div>
        <div className="min-w-0">
          <div className="player-rank">Achievements</div>
          <div className="ranks-hero-name">{earned} <span className="ach-of">/ {total} levels</span></div>
          <div className="xp-bar"><div className="xp-fill" style={{ width: (earned / total) * 100 + '%' }}></div></div>
        </div>
      </div>
      <p className="fine-print ranks-note">
        Every achievement has {ACHIEVEMENT_LEVELS} levels. The colour shows the level, from bronze (I) to prismatic (X); the frame gets grander as you go.
        Everything you’ve done so far counts.
      </p>
      <div className="ach-grid">
        {list.map(a => (
          <button type="button" key={a.def.id} className={'card-x ach-card fade-in' + (a.level ? '' : ' locked')} onClick={() => modalRef.current?.open(a)}>
            <AchievementBadge def={a.def} level={a.level} size={68} />
            <div className="ach-body">
              <div className="ach-name">{a.def.name}</div>
              <div className="ach-level">{a.level ? 'Level ' + a.level + ' · ' + levelColors(a.level).name : 'Not started'}</div>
              <div className="ach-measure">{a.def.measure}: <b>{fmtValue(a.value, a.def.format)}</b></div>
              <div className="ach-bar"><div style={{ width: a.pct * 100 + '%' }}></div></div>
              <div className="ach-next">{a.next === null ? 'Every level done!' : 'Next: ' + goalText(a.def, a.level + 1)}</div>
            </div>
          </button>
        ))}
      </div>
      <AchievementModal ref={modalRef} />
    </>
  );
}

interface AchievementModalHandle { open(a: AchievementProgress): void }

function AchievementModal({ ref }: { ref: Ref<AchievementModalHandle> }) {
  const modal = useBsModal();
  const [a, setA] = useState<AchievementProgress | null>(null);
  useImperativeHandle(ref, () => ({ open(p) { setA(p); modal.show(); } }), [modal]);
  return createPortal(
    <div className="modal fade" id="achievementModal" tabIndex={-1} ref={modal.ref} aria-labelledby="achievementModalTitle">
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          {a && <>
            <div className="modal-header">
              <div className="ach-modal-head min-w-0">
                <AchievementBadge def={a.def} level={a.level} size={56} />
                <div className="min-w-0">
                  <h5 className="modal-title" id="achievementModalTitle">{a.def.name}</h5>
                  <div className="ex-variant">{a.def.measure}: {fmtValue(a.value, a.def.format)}</div>
                </div>
              </div>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="ach-levels">
                {a.def.thresholds.map((_, i) => {
                  const lv = i + 1;
                  const got = a.level >= lv;
                  return (
                    <div key={lv} className={'ach-lv' + (got ? ' got' : '') + (lv === a.level + 1 ? ' next' : '')}>
                      <AchievementBadge def={a.def} level={lv} size={54} className={got ? '' : 'ahead'} />
                      <div className="min-w-0">
                        <div className="ach-lv-name">Level {lv} · {levelColors(lv).name}</div>
                        <div className="ach-lv-goal">{goalText(a.def, lv)}</div>
                      </div>
                      <div className="ach-lv-state">
                        {got ? <i className="bi bi-check-circle-fill"></i>
                          : lv === a.level + 1 ? <span>{Math.round(a.pct * 100)}%</span> : <i className="bi bi-lock-fill"></i>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
