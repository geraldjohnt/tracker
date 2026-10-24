// The weekly plan: what each weekday's daily quests train (legs, upper body, core or full body).
// Shown as a strip on the Quests view; tapping it opens an editor.
import { forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { useBsModal } from '../shared/components/useBsModal';
import { DEFAULT_TARGETS, FOCUS_INFO, FOCUSES, weekdayOf, WEEKDAY_LABELS, WEEKDAYS, type Targets } from './derive';
import { exerciseStore } from './store';

export interface WeeklyPlanHandle { open: () => void }

export function WeeklyStrip({ targets, today, onEdit }: { targets: Targets; today: string; onEdit: () => void }) {
  const wd = weekdayOf(today);
  return (
    <div className="card-x fade-in">
      <div className="card-x-head">
        <h2 className="card-x-title"><i className="bi bi-calendar-week"></i>Weekly plan</h2>
        <span className="head-note">Daily quests follow each day’s target.</span>
        <button type="button" className="btn btn-ghost btn-sm ms-auto" onClick={onEdit}><i className="bi bi-pencil me-1"></i>Edit</button>
      </div>
      <div className="card-x-body">
        <div className="week-strip">
          {WEEKDAYS.map(d => {
            const f = FOCUS_INFO[targets[d]];
            return (
              <button type="button" key={d} className={'week-day' + (d === wd ? ' today' : '')} onClick={onEdit} title={WEEKDAY_LABELS[d] + ': ' + f.label}>
                <span className="week-day-name">{WEEKDAY_LABELS[d].slice(0, 3)}</span>
                <i className={'bi ' + f.icon}></i>
                <span className="week-day-focus">{f.short}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const WeeklyPlanModal = forwardRef<WeeklyPlanHandle, { targets: Targets; today: string; canRetargetToday: boolean }>(
  function WeeklyPlanModal({ targets, today, canRetargetToday }, ref) {
    const modal = useBsModal();
    useImperativeHandle(ref, () => ({ open: modal.show }), [modal.show]);
    const wd = weekdayOf(today);
    const isDefault = WEEKDAYS.every(d => targets[d] === DEFAULT_TARGETS[d]);
    return createPortal(
      <div className="modal fade" id="planModal" tabIndex={-1} ref={modal.ref}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title fw-bold"><i className="bi bi-calendar-week me-2"></i>Weekly plan</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p className="head-note mt-0">Pick what each day’s 3 daily quests train. Optional quests stay a mix of everything.</p>
              <div className="plan-rows">
                {WEEKDAYS.map(d => (
                  <div key={d} className={'plan-row' + (d === wd ? ' today' : '')}>
                    <div className="plan-day">
                      {WEEKDAY_LABELS[d]}
                      {d === wd && <span className="you-tag">Today</span>}
                    </div>
                    <div className="plan-choices" role="radiogroup" aria-label={WEEKDAY_LABELS[d]}>
                      {FOCUSES.map(f => (
                        <button type="button" key={f} role="radio" aria-checked={targets[d] === f}
                          className={'chip' + (targets[d] === f ? ' active' : '')} onClick={() => exerciseStore.setTarget(d, f)}>
                          <i className={'bi ' + FOCUS_INFO[f].icon}></i>{FOCUS_INFO[f].label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="fine-print mb-0">
                {canRetargetToday
                  ? 'Changing today’s target picks new daily quests for today.'
                  : 'You’ve already done a daily quest today, so today’s quests stay as they are.'}
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost me-auto" disabled={isDefault} onClick={() => exerciseStore.resetTargets()}>Reset to default</button>
              <button type="button" className="btn-primary-x btn-sm-x" data-bs-dismiss="modal">Done</button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  },
);
