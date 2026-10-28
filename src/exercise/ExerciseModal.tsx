import { useImperativeHandle, useState, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { useBsModal } from '../shared/components/useBsModal';
import { BodyMap } from './BodyMap';
import { MovementFigure } from './MovementFigure';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, type Exercise } from './catalog';
import { DIFFICULTY_INFO, questAmount } from './derive';
import { fmtAmount, GenderTag } from './parts';

export interface ExerciseModalHandle { open(ex: Exercise): void }

/** How to do an exercise: a movement demo, form, steps, mistakes, the muscles it works, and today's targets at your level. */
export function ExerciseModal({ ref, level }: { ref: Ref<ExerciseModalHandle>; level: number }) {
  const modal = useBsModal();
  const [ex, setEx] = useState<Exercise | null>(null);
  useImperativeHandle(ref, () => ({ open(e) { setEx(e); modal.show(); } }), [modal]);

  return createPortal(
    <div className="modal fade" id="exerciseModal" tabIndex={-1} ref={modal.ref} aria-labelledby="exerciseModalTitle">
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
        <div className="modal-content">
          {ex && <>
            <div className="modal-header">
              <div className="min-w-0">
                <h5 className="modal-title" id="exerciseModalTitle">{ex.name}</h5>
                <div className="ex-variant">{ex.variant}</div>
              </div>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="ex-tags">
                <span className={'diff-badge diff-' + ex.difficulty}>{DIFFICULTY_INFO[ex.difficulty].label}</span>
                <GenderTag gender={ex.gender} long />
                <span className="ex-tag"><i className="bi bi-box"></i>{EQUIPMENT_LABELS[ex.equipment]}</span>
              </div>
              <p className="ex-summary">{ex.summary}</p>

              <div className="ex-detail-grid">
                <div className="ex-map-wrap">
                  <MovementFigure key={ex.id} exId={ex.id} className="ex-movement" />
                  <BodyMap primary={ex.primary} secondary={ex.secondary} />
                  <div className="bm-legend">
                    <span><i className="bm-dot bm-primary"></i>Main: {ex.primary.map(m => MUSCLE_LABELS[m]).join(', ')}</span>
                    {ex.secondary.length > 0 && <span><i className="bm-dot bm-secondary"></i>Also: {ex.secondary.map(m => MUSCLE_LABELS[m]).join(', ')}</span>}
                  </div>
                </div>
                <div>
                  <div className="ex-targets">
                    <div><div className="section-label">Daily at level {level}</div><div className="ex-target-val">{fmtAmount(ex, questAmount(ex, level, 'daily'))}</div></div>
                    <div><div className="section-label">Optional quest</div><div className="ex-target-val">{fmtAmount(ex, questAmount(ex, level, 'optional'))}</div></div>
                  </div>
                  <h6 className="ex-h">How to do it</h6>
                  <ol className="ex-steps">{ex.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                </div>
              </div>

              <div className="ex-two">
                <div>
                  <h6 className="ex-h"><i className="bi bi-check2-circle good"></i>Good form</h6>
                  <ul className="ex-list">{ex.form.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
                <div>
                  <h6 className="ex-h"><i className="bi bi-x-circle bad"></i>Common mistakes</h6>
                  <ul className="ex-list">{ex.mistakes.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              </div>
              <div className="ex-easier"><i className="bi bi-lightbulb"></i><div><b>Too hard? </b>{ex.easier}</div></div>
            </div>
          </>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
