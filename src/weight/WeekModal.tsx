import { useImperativeHandle, useState, type Ref } from 'react';
import { useBsModal } from '../shared/components/useBsModal';
import { addDays, daysBetween, parseDate, todayISO } from '../shared/dates';
import { num } from '../shared/format';
import type { Unit, Week } from '../shared/types';
import { peopleOf } from './derive';
import { weightStore } from './store';
import { inputValue, unitToKg } from './units';

export interface WeekModalHandle { open(mode: 'new' | 'edit'): void }

interface Props {
  ref: Ref<WeekModalHandle>;
  unit: Unit;
  currentWeek: Week | null;
  latestWeek: Week | undefined;
  onCreated: (id: string) => void;
}

type Row = { key: number; name: string; weight: string };
let rowKey = 0;
const row = (name = '', weight = ''): Row => ({ key: ++rowKey, name, weight });
const DEFAULT_HINT = 'End date auto-fills to 7 days after the start — you can still change it.';

/** New week (with optional carry-over) / edit week dates. */
export function WeekModal({ ref, unit, currentWeek, latestWeek, onCreated }: Props) {
  const modal = useBsModal();
  const [mode, setMode] = useState<'new' | 'edit'>('new');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [endTouched, setEndTouched] = useState(false);
  const [dateErr, setDateErr] = useState(false);
  const [hint, setHint] = useState(DEFAULT_HINT);
  const [carry, setCarry] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [prev, setPrev] = useState<Week | undefined>();

  // Carry-over: each person's final weight (falling back to start) becomes the new start weight.
  const carriedRows = (from: Week | undefined, on: boolean): Row[] => {
    const out = on && from ? peopleOf(from).map(p => row(p.name, inputValue(num(p.endWeight) ?? num(p.startWeight), unit))) : [];
    return out.length ? out : [row()];
  };

  useImperativeHandle(ref, () => ({
    open(m) {
      setMode(m);
      setEndTouched(false);
      setDateErr(false);
      setHint(DEFAULT_HINT);
      if (m === 'edit' && currentWeek) {
        setStart(currentWeek.startDate || todayISO());
        setEnd(currentWeek.endDate || addDays(todayISO(), 7));
        setEndTouched(true);
      } else {
        const p = latestWeek;
        const s = p && p.endDate ? p.endDate : todayISO();
        setStart(s);
        setEnd(addDays(s, 7));
        setPrev(p);
        setCarry(true);
        setRows(p ? carriedRows(p, true) : [row(), row()]);
      }
      modal.show();
      setTimeout(() => document.getElementById('mStart')?.focus(), 200);
    },
  }));

  const validate = (s: string, e: string) => {
    const ok = !!(s && e && parseDate(e)! > parseDate(s)!);
    setDateErr(!ok);
    if (ok) {
      const n = daysBetween(s, e);
      setHint(n === 7 ? 'A standard 7-day week. You can still change the end date.' : n + '-day week (default is 7 days).');
    }
    return ok;
  };

  const save = () => {
    if (!validate(start, end)) return;
    if (mode === 'edit') {
      if (!currentWeek) return;
      weightStore.updateWeekDates(currentWeek.id, start, end);
      modal.hide();
      return;
    }
    const id = weightStore.createWeek(start, end, rows.map(r => ({ name: r.name, startWeight: unitToKg(r.weight, unit) })));
    modal.hide();
    onCreated(id);
  };

  const editing = mode === 'edit';
  const setRow = (key: number, patch: Partial<Row>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className="modal fade" id="weekModal" tabIndex={-1} ref={modal.ref}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="weekModalTitle">{editing ? 'Edit week dates' : 'New challenge week'}</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-6">
                <label className="form-label" htmlFor="mStart">Start date</label>
                <input type="date" className="form-control" id="mStart" value={start}
                  onChange={e => {
                    const s = e.target.value;
                    setStart(s);
                    if (!s) return;
                    const newEnd = !endTouched || mode === 'new' ? addDays(s, 7) : end;
                    setEnd(newEnd);
                    validate(s, newEnd);
                  }} />
              </div>
              <div className="col-6">
                <label className="form-label" htmlFor="mEnd">End date</label>
                <input type="date" className="form-control" id="mEnd" value={end}
                  onChange={e => { setEnd(e.target.value); setEndTouched(true); validate(start, e.target.value); }} />
              </div>
            </div>
            <div className="hint" id="mDateHint"><i className="bi bi-info-circle"></i><span>{hint}</span></div>
            {dateErr && (
              <div id="mDateErr" className="hint" style={{ color: 'var(--bad)' }}>
                <i className="bi bi-exclamation-triangle" style={{ color: 'var(--bad)' }}></i><span>End date must be after the start date.</span>
              </div>
            )}

            {!editing && (
              <div id="mPeopleSection">
                <hr style={{ borderColor: 'var(--border)', margin: '1.1rem 0' }} />
                <div className="d-flex align-items-center mb-2">
                  <span className="section-label">Participants</span>
                  <button type="button" className="btn btn-ghost btn-sm ms-auto" id="mAddPerson"
                    onClick={() => {
                      const r = row();
                      setRows(rs => [...rs, r]);
                      setTimeout(() => document.querySelector<HTMLInputElement>(`[data-row="${r.key}"] .np-name`)?.focus(), 0);
                    }}>
                    <i className="bi bi-plus-lg me-1"></i>Add
                  </button>
                </div>
                {prev && (
                  <div id="mCarryWrap" className="mb-3">
                    <div className="form-check">
                      <input className="form-check-input" type="checkbox" id="mCarry" checked={carry}
                        onChange={e => { setCarry(e.target.checked); setRows(carriedRows(prev, e.target.checked)); }} />
                      <label className="form-check-label" htmlFor="mCarry" style={{ fontSize: '.85rem', fontWeight: 600 }}>
                        Carry over everyone from the previous week
                        <span className="d-block" style={{ fontSize: '.76rem', color: 'var(--muted)', fontWeight: 500 }}>Their final weight becomes this week's starting weight.</span>
                      </label>
                    </div>
                  </div>
                )}
                <div id="mPeople">
                  {rows.map(r => (
                    <div className="np-row" key={r.key} data-row={r.key}>
                      <input type="text" className="form-control np-name" placeholder="Name" value={r.name} onChange={e => setRow(r.key, { name: e.target.value })} />
                      <input type="number" step="0.1" min="0" inputMode="decimal" className="form-control np-w" placeholder={'Start (' + unit + ')'}
                        value={r.weight} onChange={e => setRow(r.key, { weight: e.target.value })} />
                      <button type="button" className="btn-trash" onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}><i className="bi bi-x-lg"></i></button>
                    </div>
                  ))}
                </div>
                <div className="hint"><i className="bi bi-lightbulb"></i><span>Starting weights are optional here — you can fill them in later.</span></div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" data-bs-dismiss="modal">Cancel</button>
            <button type="button" className="btn btn-primary-x" id="mSave" onClick={save}>{editing ? 'Save changes' : 'Create week'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
