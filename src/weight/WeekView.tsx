import { useEffect, useRef, useState } from 'react';
import { DraftInput } from '../shared/components/DraftInput';
import { daysBetween, fmtDate, fmtRange, todayISO } from '../shared/dates';
import { fmtNum, num, plain } from '../shared/format';
import type { Unit, Week } from '../shared/types';
import { allTimeStats, avatarColor, delta, initials, peopleOf, weekStatus, type Person, type WeeksMap } from './derive';
import { weightStore } from './store';
import { cw, inputValue, unitToKg } from './units';

interface Props {
  week: Week;
  weeks: WeeksMap;
  unit: Unit;
  onEditDates: () => void;
  onDeleteWeek: () => void;
  onRemovePerson: (p: Person) => void;
}

export function WeekView({ week, weeks, unit, onEditDates, onDeleteWeek, onRemovePerson }: Props) {
  const [tab, setTab] = useState<'week' | 'all'>('week');
  return (
    <div id="weekView">
      <Hero week={week} onEditDates={onEditDates} onDeleteWeek={onDeleteWeek} />
      <Stats week={week} unit={unit} />
      <People week={week} unit={unit} onRemove={onRemovePerson} />

      <section className="card-x">
        <div className="card-x-head">
          <h2 className="card-x-title"><i className="bi bi-bar-chart-line"></i>Progress</h2>
          <div className="tabs ms-auto">
            <button id="tabWeek" className={tab === 'week' ? 'active' : ''} onClick={() => setTab('week')}>This week</button>
            <button id="tabAll" className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>All time</button>
          </div>
        </div>
        <div className="card-x-body">
          {tab === 'week'
            ? <div id="paneWeek"><Leaderboard week={week} unit={unit} /></div>
            : <div id="paneAll"><div className="at-wrap"><AllTimeTable weeks={weeks} unit={unit} /></div></div>}
        </div>
      </section>
    </div>
  );
}

const plural = (n: number, word: string) => n + ' ' + word + (n === 1 ? '' : 's');

function Hero({ week: w, onEditDates, onDeleteWeek }: { week: Week; onEditDates: () => void; onDeleteWeek: () => void }) {
  const today = todayISO();
  const st = weekStatus(w, today);
  const total = daysBetween(w.startDate, w.endDate);
  const elapsed = daysBetween(w.startDate, today);
  const left = total - elapsed;
  let meta = total + '-day challenge';
  if (elapsed < 0) meta += ' · starts in ' + plural(Math.abs(elapsed), 'day');
  else if (left > 0) meta += ' · ' + plural(left, 'day') + ' to go';
  else if (left === 0) meta += ' · final day — weigh in!';
  else meta += ' · ended ' + plural(Math.abs(left), 'day') + ' ago';
  const pct = total > 0 ? Math.max(0, Math.min(100, (elapsed / total) * 100)) : 0;

  return (
    <section className="hero fade-in">
      <div className="hero-top">
        <div style={{ minWidth: 0 }}>
          <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
            <span className="section-label">Challenge week</span>
            <span id="statusChip" className={'chip ' + st.cls}><i className="bi bi-circle-fill" style={{ fontSize: '.5rem' }}></i>{st.text}</span>
          </div>
          <div id="heroRange" className="hero-range">{fmtRange(w.startDate, w.endDate)}</div>
          <div id="heroMeta" className="hero-meta">{meta}</div>
        </div>
        <div className="hero-actions">
          <button className="btn btn-ghost btn-sm" onClick={onEditDates}><i className="bi bi-pencil me-1"></i>Edit dates</button>
          <button className="btn btn-ghost btn-sm" onClick={onDeleteWeek}><i className="bi bi-trash3"></i></button>
        </div>
      </div>
      <div className="track"><span id="trackFill" style={{ width: pct + '%' }}></span></div>
      <div className="track-legend">
        <span id="trackStart">{fmtDate(w.startDate, { month: 'short', day: 'numeric' })}</span>
        <span id="trackNow">{elapsed < 0 ? 'Not started' : left < 0 ? 'Finished' : 'Day ' + Math.max(0, elapsed) + ' of ' + total}</span>
        <span id="trackEnd">{fmtDate(w.endDate, { month: 'short', day: 'numeric' })}</span>
      </div>
    </section>
  );
}

function Stats({ week, unit: u }: { week: Week; unit: Unit }) {
  const people = peopleOf(week);
  const done = people.filter(p => delta(p).has);
  const diff = (p: Person) => delta(p).diff as number;
  const losers = done.filter(p => diff(p) < 0).length;
  const gainers = done.filter(p => diff(p) > 0).length;
  const net = done.reduce((a, p) => a + diff(p), 0);
  const best = done.slice().sort((a, b) => diff(a) - diff(b))[0];
  const bestD = best ? delta(best) : null;
  const hasBest = !!bestD && (bestD.diff as number) < 0;

  return (
    <section className="stats">
      <div className="stat">
        <div className="stat-label"><i className="bi bi-people"></i>Participants</div>
        <div className="stat-value" id="sPeople">{people.length}</div>
        <div className="stat-sub" id="sPeopleSub">{done.length ? losers + ' lost · ' + gainers + ' gained' : 'awaiting results'}</div>
      </div>
      <div className="stat">
        <div className="stat-label"><i className="bi bi-arrow-left-right"></i>Group net</div>
        <div className="stat-value" id="sNet" style={{ color: done.length ? (net < 0 ? 'var(--good)' : net > 0 ? 'var(--bad)' : undefined) : undefined }}>
          {done.length ? fmtNum(cw(net, u)) + ' ' + u : '—'}
        </div>
        <div className="stat-sub" id="sNetSub">{done.length ? 'avg ' + fmtNum(cw(net / done.length, u)) + ' ' + u + ' each' : 'no results yet'}</div>
      </div>
      <div className="stat">
        <div className="stat-label"><i className="bi bi-trophy"></i>Top loser</div>
        <div className="stat-value" id="sBest" style={{ color: hasBest ? 'var(--good)' : undefined }}>
          {hasBest ? fmtNum(cw(bestD!.diff, u)) + ' ' + u : '—'}
        </div>
        <div className="stat-sub" id="sBestSub">
          {hasBest ? best!.name + (bestD!.pct !== null ? ' · ' + fmtNum(bestD!.pct) + '%' : '') : done.length ? 'nobody lost yet' : 'no results yet'}
        </div>
      </div>
      <div className="stat">
        <div className="stat-label"><i className="bi bi-clipboard-check"></i>Logged</div>
        <div className="stat-value" id="sDone">{done.length + '/' + people.length}</div>
        <div className="stat-sub" id="sDoneSub">final weights entered</div>
      </div>
    </section>
  );
}

function DeltaBadge({ p, unit }: { p: Person; unit: Unit }) {
  const d = delta(p);
  if (!d.has) {
    const need = num(p.startWeight) === null ? 'Enter start weight' : 'Awaiting final weight';
    return <div className="delta pending"><i className="bi bi-hourglass-split"></i>{need}</div>;
  }
  if (d.diff === 0) return <div className="delta same"><i className="bi bi-dash-lg"></i>No change</div>;
  const gain = (d.diff as number) > 0;
  return (
    <div className={'delta ' + (gain ? 'gain' : 'loss')}>
      <i className={'bi ' + (gain ? 'bi-arrow-up-right' : 'bi-arrow-down-right')}></i>
      <span>{fmtNum(cw(d.diff, unit)) + ' ' + unit}</span>
      {d.pct !== null && <small>{fmtNum(d.pct) + '%'}</small>}
    </div>
  );
}

function People({ week, unit, onRemove }: { week: Week; unit: Unit; onRemove: (p: Person) => void }) {
  const people = peopleOf(week);
  const [name, setName] = useState('');
  const [focusPid, setFocusPid] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // After adding someone, jump straight to their start weight (legacy behavior).
  useEffect(() => {
    if (!focusPid) return;
    listRef.current?.querySelector<HTMLInputElement>(`.p-row[data-pid="${focusPid}"] input[data-field="startWeight"]`)?.focus();
    setFocusPid(null);
  }, [focusPid]);

  const add = () => {
    const id = weightStore.addParticipant(week.id, name);
    setName('');
    if (id) setFocusPid(id);
  };

  const weightField = (p: Person, field: 'startWeight' | 'endWeight', cls: string, label: string) => (
    <div className={cls + ' field' + (num(p[field]) === null ? ' is-empty' : '')}>
      <label>{label + ' (' + unit + ')'}</label>
      <DraftInput type="number" step="0.1" min="0" inputMode="decimal" data-field={field} placeholder="0.0"
        value={inputValue(p[field], unit)}
        onValue={t => weightStore.setField(week.id, p.id, field, unitToKg(t, unit))}
        onBlur={weightStore.flushSaves} />
    </div>
  );

  return (
    <section className="card-x mt-3">
      <div className="card-x-head">
        <h2 className="card-x-title"><i className="bi bi-clipboard2-pulse"></i>Weigh-ins</h2>
        <span className="section-label ms-auto d-none d-md-inline">Green = lost · Red = gained</span>
      </div>
      <div className="card-x-body">
        <div id="pList" className="p-list" ref={listRef}>
          {people.map(p => (
            <div className="p-row" data-pid={p.id} key={p.id}>
              <div className="p-name">
                <div className="avatar" style={{ background: avatarColor(p.name) }}>{initials(p.name)}</div>
                <DraftInput className="name-input" data-field="name" placeholder="Name" aria-label="Name"
                  value={p.name} onValue={t => weightStore.setField(week.id, p.id, 'name', t)} onBlur={weightStore.flushSaves} />
              </div>
              {weightField(p, 'startWeight', 'p-start', 'Start')}
              {weightField(p, 'endWeight', 'p-end', 'Final')}
              <div className="p-delta"><DeltaBadge p={p} unit={unit} /></div>
              <button className="btn-trash p-act" data-action="del" title="Remove" onClick={() => onRemove(p)}><i className="bi bi-trash3"></i></button>
            </div>
          ))}
        </div>
        {!people.length && (
          <div id="pEmpty" className="text-center" style={{ padding: '1.5rem 0', color: 'var(--muted)', fontSize: '.9rem' }}>
            <i className="bi bi-person-plus" style={{ fontSize: '1.5rem', display: 'block', marginBottom: '.4rem', color: 'var(--accent)' }}></i>
            No one is in this week yet — add a name below.
          </div>
        )}
        <div className="add-row">
          <input id="addName" type="text" placeholder="Add a participant's name…" autoComplete="off" value={name}
            onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
          <button id="addBtn" className="btn btn-primary-x" onClick={add}><i className="bi bi-person-plus me-1"></i>Add</button>
        </div>
      </div>
    </section>
  );
}

function Leaderboard({ week, unit }: { week: Week; unit: Unit }) {
  const done = peopleOf(week).filter(p => delta(p).has).sort((a, b) => (delta(a).diff as number) - (delta(b).diff as number));
  if (!done.length) {
    return (
      <div id="lb" className="lb">
        <div className="text-center" style={{ padding: '1.5rem 0', color: 'var(--muted)', fontSize: '.9rem' }}>
          <i className="bi bi-graph-down-arrow" style={{ fontSize: '1.5rem', display: 'block', marginBottom: '.4rem', color: 'var(--accent)' }}></i>
          Results appear once both a start and a final weight are entered.
        </div>
      </div>
    );
  }
  const max = Math.max(...done.map(p => Math.abs(delta(p).diff as number))) || 1;
  return (
    <div id="lb" className="lb">
      {done.map((p, i) => {
        const d = delta(p);
        const diff = d.diff as number;
        const cls = diff < 0 ? 'loss' : diff > 0 ? 'gain' : 'same';
        return (
          <div className="lb-row" key={p.id}>
            <div className={'lb-rank ' + (i < 3 && diff < 0 ? 'r' + (i + 1) : '')}>{i + 1}</div>
            <div style={{ minWidth: 0 }}>
              <div className="lb-name">{p.name || 'Unnamed'}</div>
              <div className="lb-bar"><span className={cls} style={{ width: Math.max(4, (Math.abs(diff) / max) * 100) + '%' }}></span></div>
            </div>
            <div className={'lb-val ' + cls}>
              {fmtNum(cw(diff, unit)) + ' ' + unit}
              {d.pct !== null && <div style={{ fontSize: '.72rem', fontWeight: 600, opacity: 0.75, textAlign: 'right' }}>{fmtNum(d.pct) + '%'}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const tcls = (n: number) => (n < 0 ? 't-loss' : n > 0 ? 't-gain' : 't-same');

export function MiniAvatar({ name }: { name: string }) {
  return (
    <div className="avatar" style={{ width: 30, height: 30, flex: '0 0 30px', borderRadius: 9, fontSize: '.7rem', background: avatarColor(name) }}>
      {initials(name)}
    </div>
  );
}

function AllTimeTable({ weeks, unit: u }: { weeks: WeeksMap; unit: Unit }) {
  const rows = allTimeStats(weeks);
  if (!rows.length) {
    return (
      <table className="at" id="atTable"><tbody><tr>
        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1.5rem', border: 0 }}>No history yet.</td>
      </tr></tbody></table>
    );
  }
  return (
    <table className="at" id="atTable">
      <thead><tr><th>Participant</th><th>Weeks</th><th>First</th><th>Latest</th><th>Best week</th><th>Net change</th></tr></thead>
      <tbody>
        {rows.map(r => {
          const overall = r.first !== null && r.last !== null ? r.last - r.first : null;
          return (
            <tr key={r.name.toLowerCase()}>
              <td><div style={{ display: 'flex', alignItems: 'center', gap: '.55rem' }}><MiniAvatar name={r.name} /><span style={{ fontWeight: 700 }}>{r.name}</span></div></td>
              <td>{r.weeks}</td>
              <td>{plain(cw(r.first, u))}</td>
              <td>{plain(cw(r.last, u))}</td>
              <td className={r.best === null ? 't-same' : tcls(r.best)}>{r.best === null ? '—' : fmtNum(cw(r.best, u)) + ' ' + u}</td>
              <td className={overall === null ? 't-same' : tcls(overall)}>{overall === null ? '—' : fmtNum(cw(overall, u)) + ' ' + u}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export { tcls };
