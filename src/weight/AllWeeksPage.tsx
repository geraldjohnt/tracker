import { fmtRange, todayISO } from '../shared/dates';
import { fmtNum, num, plain } from '../shared/format';
import type { Unit } from '../shared/types';
import { delta, peopleOf, sortedWeeks, weekStatus, type WeeksMap } from './derive';
import { cw } from './units';
import { MiniAvatar, tcls } from './WeekView';

/** Every week ever created, with its participants, start/final weights and change. */
export function AllWeeksPage({ weeks, unit: u, onOpenWeek, onNewWeek }: {
  weeks: WeeksMap; unit: Unit; onOpenWeek: (id: string) => void; onNewWeek: () => void;
}) {
  const list = sortedWeeks(weeks);
  const today = todayISO();
  return (
    <div id="pageAllWeeks" className="page">
      <div className="d-flex align-items-center mb-1" style={{ margin: '1.15rem 0 0' }}>
        <div>
          <div className="section-label">Overview</div>
          <h2 style={{ fontWeight: 800, letterSpacing: '-.02em', fontSize: '1.25rem', margin: '.2rem 0 0' }}>All Weeks</h2>
        </div>
      </div>

      {!list.length && (
        <div id="allWeeksEmpty" className="empty fade-in mt-3">
          <div className="empty-icon"><i className="bi bi-collection"></i></div>
          <h3>No weeks yet</h3>
          <p>Once you create a challenge week, it'll show up here with everyone's start weight, final weight, and change.</p>
          <button className="btn btn-primary-x" onClick={onNewWeek}><i className="bi bi-plus-lg me-1"></i>Start first week</button>
        </div>
      )}

      <div id="allWeeksList">
        {list.map(w => {
          const st = weekStatus(w, today);
          const people = peopleOf(w);
          return (
            <section className="card-x mt-3 fade-in" key={w.id}>
              <div className="card-x-head">
                <h2 className="card-x-title"><i className="bi bi-calendar2-week"></i>{fmtRange(w.startDate, w.endDate)}</h2>
                <span className={'chip ' + st.cls}>{st.text}</span>
                <span className="section-label ms-auto d-none d-sm-inline">{people.length + ' ' + (people.length === 1 ? 'person' : 'people')}</span>
                <button className="btn btn-ghost btn-sm btn-icon" title="Open this week" onClick={() => onOpenWeek(w.id)}><i className="bi bi-arrow-right"></i></button>
              </div>
              <div className="card-x-body">
                <div className="at-wrap"><table className="at">
                  <thead><tr><th>Participant</th><th>{'Start (' + u + ')'}</th><th>{'Final (' + u + ')'}</th><th>Change</th></tr></thead>
                  <tbody>
                    {people.length ? people.map(p => {
                      const d = delta(p);
                      return (
                        <tr key={p.id}>
                          <td><div style={{ display: 'flex', alignItems: 'center', gap: '.55rem' }}><MiniAvatar name={p.name} /><span style={{ fontWeight: 700 }}>{p.name || 'Unnamed'}</span></div></td>
                          <td>{plain(cw(num(p.startWeight), u))}</td>
                          <td>{plain(cw(num(p.endWeight), u))}</td>
                          <td className={d.has ? tcls(d.diff as number) : 't-same'}>{d.has ? fmtNum(cw(d.diff, u)) + ' ' + u : '—'}</td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1.25rem', border: 0 }}>No participants added yet.</td></tr>
                    )}
                  </tbody>
                </table></div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
