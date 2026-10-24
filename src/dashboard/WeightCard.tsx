import type { Appearance } from '../shared/appearance';
import { ChartCanvas, cssVar } from '../shared/components/ChartCanvas';
import { fmtRange } from '../shared/dates';
import { fmtNum, plain } from '../shared/format';
import { sortedWeeks, weightAllTime, type WeeksMap } from '../weight/derive';

const HUES = [244, 330, 20, 160, 45, 200, 280, 5];
const lineColor = (i: number) => 'hsl(' + HUES[i % HUES.length] + ', 72%, 55%)';

interface Props { weeks: WeeksMap; ready: boolean; appearance: Appearance }

export function WeightCard({ weeks, ready, appearance }: Props) {
  const list = sortedWeeks(weeks);
  const empty = ready && !list.length;
  const { rows, weekLabels } = weightAllTime(weeks);
  const done = rows.filter(r => r.overall !== null);
  const net = done.reduce((a, r) => a + (r.overall as number), 0);
  const losers = done.filter(r => (r.overall as number) < 0).length;
  const gainers = done.filter(r => (r.overall as number) > 0).length;
  const sorted = rows.slice().sort((a, b) => (a.overall ?? Infinity) - (b.overall ?? Infinity));

  // Before the first snapshot the legacy page showed its static placeholders; keep that.
  const rangeLabel = !ready ? '—' : !list.length ? 'No weeks yet' : fmtRange(list[list.length - 1].startDate, list[0].endDate);

  return (
    <section className="card-x fade-in">
      <div className="card-x-head">
        <div className="app-card-head">
          <div className="app-card-icon" style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))' }}><i className="bi bi-activity"></i></div>
          <div>
            <h2 className="card-x-title" style={{ margin: 0 }}>WeighIn</h2>
            <div className="section-label" style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0, fontSize: '.76rem' }}>{rangeLabel}</div>
          </div>
        </div>
        {!empty && (
          <span className="chip chip-live ms-auto">{ready ? list.length + (list.length === 1 ? ' week' : ' weeks') : '—'}</span>
        )}
      </div>
      <div className="card-x-body">
        {empty ? (
          <div id="wEmpty" className="empty">
            <div className="empty-icon"><i className="bi bi-calendar2-week"></i></div>
            <h3>No weeks yet</h3>
            <p>Start a challenge week to see weigh-in progress here.</p>
          </div>
        ) : (
          <div id="wContent">
            <div className="stats">
              <div className="stat">
                <div className="stat-label"><i className="bi bi-people"></i>Participants</div>
                <div className="stat-value">{ready ? rows.length : 0}</div>
                <div className="stat-sub">{!ready ? '—' : done.length ? losers + ' lost · ' + gainers + ' gained' : 'awaiting results'}</div>
              </div>
              <div className="stat">
                <div className="stat-label"><i className="bi bi-arrow-left-right"></i>Group net</div>
                <div className="stat-value" style={{ color: done.length && ready ? (net < 0 ? 'var(--good)' : net > 0 ? 'var(--bad)' : undefined) : undefined }}>
                  {ready && done.length ? fmtNum(net) + ' kg' : '—'}
                </div>
                <div className="stat-sub">{!ready ? '—' : done.length ? done.length + '/' + rows.length + ' with results' : 'no results yet'}</div>
              </div>
            </div>
            <div className="wp-list">
              {ready && !sorted.length && (
                <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--muted)', fontSize: '.84rem' }}>
                  <i className="bi bi-graph-down-arrow" style={{ fontSize: '1.3rem', display: 'block', marginBottom: '.35rem', color: 'var(--accent)' }}></i>
                  No results logged yet.
                </div>
              )}
              {ready && sorted.map(r => {
                const cls = r.overall === null ? 'same' : r.overall < 0 ? 'loss' : r.overall > 0 ? 'gain' : 'same';
                return (
                  <div className="wp-row" key={r.key}>
                    <div className="wp-name">{r.name || 'Unnamed'}</div>
                    <div className="wp-weights">{plain(r.first) + ' → ' + plain(r.last) + ' kg'}</div>
                    <div className={'wp-diff ' + cls}>{r.overall === null ? '—' : fmtNum(r.overall) + ' kg'}</div>
                  </div>
                );
              })}
            </div>
            {(!ready || weekLabels.length > 0) && (
              <div className="chart-wrap">
                {ready && (
                  <ChartCanvas
                    id="wChart"
                    deps={[JSON.stringify(rows), weekLabels.join('|'), appearance]}
                    config={() => {
                      const muted = cssVar('--muted'), border = cssVar('--border');
                      const datasets = rows.map((r, i) => ({
                        label: r.name || 'Unnamed', data: r.data,
                        borderColor: lineColor(i), backgroundColor: lineColor(i),
                        spanGaps: true, tension: 0.35, pointRadius: 3, pointHoverRadius: 4, borderWidth: 2,
                      }));
                      return {
                        type: 'line',
                        data: { labels: weekLabels, datasets },
                        options: {
                          responsive: true, maintainAspectRatio: false,
                          plugins: {
                            legend: { display: datasets.length > 1, position: 'bottom', labels: { color: muted, boxWidth: 10, font: { size: 10, weight: 600 } } },
                            tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtNum(ctx.parsed.y) + ' kg' } },
                          },
                          scales: {
                            x: { grid: { display: false }, ticks: { color: muted, font: { weight: 600, size: 10 } } },
                            y: { grid: { color: border }, ticks: { color: muted, font: { size: 10 }, callback: v => fmtNum(Number(v)) } },
                          },
                        },
                      };
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}
        <div className="card-cta"><a href="weight.html" className="btn-primary-x"><i className="bi bi-activity me-2"></i>Open Weight Tracker</a></div>
      </div>
    </section>
  );
}
