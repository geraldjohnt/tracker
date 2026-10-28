import { fmtDate } from '../shared/dates';
import { FOCUS_INFO, type ExerciseSummary } from '../exercise/derive';
import { fmtAmount } from '../exercise/parts';
import { RankBadge } from '../exercise/RankBadge';

interface Props { summary: ExerciseSummary; ready: boolean; today: string }

export function ExerciseCard({ summary: s, ready, today }: Props) {
  const empty = ready && !s.started;
  const focus = FOCUS_INFO[s.focus];
  const pct = Math.min(100, (s.info.into / s.info.need) * 100);

  const stat = (icon: string, label: string, value: React.ReactNode, sub?: string) => (
    <div className="stat">
      <div className="stat-label"><i className={'bi ' + icon}></i>{label}</div>
      <div className="stat-value">{ready ? value : '—'}</div>
      {sub !== undefined && <div className="stat-sub">{ready ? sub : '—'}</div>}
    </div>
  );

  return (
    <section className="card-x ex-card fade-in">
      <div className="card-x-head">
        <div className="app-card-head">
          <div className="app-card-icon" style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))' }}><i className="bi bi-person-arms-up"></i></div>
          <div>
            <h2 className="card-x-title" style={{ margin: 0 }}>LevelUp</h2>
            <div className="section-label" style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0, fontSize: '.76rem' }}>
              {ready ? fmtDate(today, { weekday: 'long', month: 'long', day: 'numeric' }) + ' · ' + focus.label + ' day' : '—'}
            </div>
          </div>
        </div>
        {ready && s.started && (
          <span className={'chip ms-auto ' + (s.safe ? 'chip-done' : 'chip-soon')}>
            {s.safe ? <><i className="bi bi-shield-check"></i>Safe for today</>
              : <><i className="bi bi-exclamation-triangle"></i>{s.atRisk ? s.atRisk + ' XP at risk' : 'Do 1 quest today'}</>}
          </span>
        )}
      </div>
      <div className="card-x-body">
        {empty ? (
          <div id="xEmpty" className="empty">
            <div className="empty-icon"><i className="bi bi-person-arms-up"></i></div>
            <h3>No quests yet</h3>
            <p>Open LevelUp to get your first daily quests and start earning XP.</p>
          </div>
        ) : (
          <div id="xContent" className="ex-grid">
            <div>
              <div className="ex-player">
                <RankBadge rank={s.rank} size={64} className="ex-badge" />
                <div className="ex-player-main">
                  <div className="ex-rank">{ready ? s.rank.label : '—'}</div>
                  <div className="ex-level">Level {ready ? s.info.level : '—'}</div>
                  <div className="ex-xp-bar" role="progressbar" aria-valuenow={s.info.into} aria-valuemin={0} aria-valuemax={s.info.need} aria-label="XP to next level">
                    <div className="ex-xp-fill" style={{ width: (ready ? pct : 0) + '%' }}></div>
                  </div>
                  <div className="ex-xp-meta">
                    <span><b>{ready ? s.info.into : 0}</b> / {s.info.need} XP</span>
                    <span>{ready ? s.next.rank.label + ' at Level ' + s.next.level : ''}</span>
                  </div>
                </div>
              </div>
              <div className="stats">
                {stat('bi-check2-square', 'Today', <>{s.doneCount}<span className="ex-of">/3</span></>, s.quests ? 'daily quests done' : 'not started yet')}
                {stat('bi-fire', 'Streak', s.streak, s.streak === 1 ? 'day' : 'days')}
                {stat('bi-star', 'Total XP', s.info.total, 'all time')}
                {stat('bi-calendar-week', 'This week', '+' + s.weekXp, 'XP earned')}
              </div>
            </div>
            <div>
              <div className="section-label ex-quests-label">Today’s daily quests</div>
              {ready && s.quests ? (
                <div className="recent-list ex-quests">
                  {s.quests.map((q, i) => (
                    <div className={'recent-row' + (q.done ? ' done' : '')} key={i}>
                      <div className="ex-quest-name">
                        <i className={'bi ' + (q.done ? 'bi-check-circle-fill' : 'bi-circle')}></i>
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <div className="recent-item">{q.ex ? q.ex.name : q.id}</div>
                          <div className="recent-date">{q.ex ? fmtAmount(q.ex, q.amount) : ''}{q.manual ? ' · no camera' : ''}</div>
                        </div>
                      </div>
                      <div className="recent-price">{q.done ? '+' : ''}{q.xp} XP</div>
                    </div>
                  ))}
                </div>
              ) : ready ? (
                <p className="ex-note">Today’s quests appear once you open LevelUp.</p>
              ) : null}
              {ready && s.pending.missedDays > 0 && (
                <div className="ex-warn">
                  <i className="bi bi-heartbreak"></i>
                  <span>
                    {s.pending.missedDays} missed day{s.pending.missedDays === 1 ? '' : 's'}
                    {s.pending.xpLost ? <>: <b>−{s.pending.xpLost} XP</b> when you next open LevelUp</> : ' (no XP to lose)'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="card-cta"><a href="exercise.html" className="btn-primary-x"><i className="bi bi-person-arms-up me-2"></i>Open LevelUp</a></div>
      </div>
    </section>
  );
}
