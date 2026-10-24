import type { Appearance } from '../shared/appearance';
import { ChartCanvas, cssVar } from '../shared/components/ChartCanvas';
import { addDays, fmtDate, parseDate, startOfWeek, todayISO } from '../shared/dates';
import { fmtMoney, num } from '../shared/format';
import { dayTotal, expensesArr, expensesInRange, totalOf, type ExpensesMap } from '../spending/derive';

interface Props { expenses: ExpensesMap; ready: boolean; appearance: Appearance }

export function SpendCard({ expenses, ready, appearance }: Props) {
  const today = todayISO();
  const all = expensesArr(expenses);
  const empty = ready && all.length === 0;

  const weekStart = startOfWeek(today);
  const monthStart = today.slice(0, 7) + '-01';
  const dayOfMonth = Number(today.slice(8, 10));
  const monthTotal = totalOf(expensesInRange(expenses, monthStart, today));
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const totals = days.map(d => dayTotal(expenses, d));
  const labels = days.map(d => parseDate(d)!.toLocaleDateString(undefined, { weekday: 'short' }));
  const recent = all.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 4);

  const stat = (icon: string, label: string, value: number) => (
    <div className="stat">
      <div className="stat-label"><i className={'bi ' + icon}></i>{label}</div>
      <div className="stat-value">{fmtMoney(ready ? value : 0)}</div>
    </div>
  );

  return (
    <section className="card-x fade-in">
      <div className="card-x-head">
        <div className="app-card-head">
          <div className="app-card-icon" style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))' }}><i className="bi bi-wallet2"></i></div>
          <div>
            <h2 className="card-x-title" style={{ margin: 0 }}>Spendly</h2>
            <div className="section-label" style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0, fontSize: '.76rem' }}>
              {ready ? fmtDate(today, { weekday: 'long', month: 'long', day: 'numeric' }) : '—'}
            </div>
          </div>
        </div>
      </div>
      <div className="card-x-body">
        {empty ? (
          <div id="sEmpty" className="empty">
            <div className="empty-icon"><i className="bi bi-receipt"></i></div>
            <h3>No expenses yet</h3>
            <p>Log a purchase to see spending totals here.</p>
          </div>
        ) : (
          <div id="sContent">
            <div className="stats">
              {stat('bi-cash-coin', 'Today', dayTotal(expenses, today))}
              {stat('bi-calendar-week', 'This week', totalOf(expensesInRange(expenses, weekStart, today)))}
              {stat('bi-calendar3', 'This month', monthTotal)}
              {stat('bi-graph-up', 'Avg / day', monthTotal / dayOfMonth)}
            </div>
            <div className="chart-wrap">
              {ready && (
                <ChartCanvas
                  id="sChart"
                  deps={[totals.join('|'), labels.join('|'), appearance]}
                  config={() => {
                    const accent = cssVar('--accent'), muted = cssVar('--muted'), border = cssVar('--border');
                    return {
                      type: 'bar',
                      data: { labels, datasets: [{ data: totals, backgroundColor: accent, borderRadius: 6, maxBarThickness: 30 }] },
                      options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmtMoney(ctx.parsed.y) } } },
                        scales: {
                          x: { grid: { display: false }, ticks: { color: muted, font: { weight: 600, size: 10 } } },
                          y: { beginAtZero: true, grid: { color: border }, ticks: { display: false } },
                        },
                      },
                    };
                  }}
                />
              )}
            </div>
            <div className="recent-list">
              {ready && recent.map(e => (
                <div className="recent-row" key={e.id}>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div className="recent-item">{e.item || 'Untitled'}</div>
                    <div className="recent-date">{fmtDate(e.date)}</div>
                  </div>
                  <div className="recent-price">{fmtMoney(num(e.price) || 0)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="card-cta"><a href="spending.html" className="btn-primary-x"><i className="bi bi-wallet2 me-2"></i>Open Spending Tracker</a></div>
      </div>
    </section>
  );
}
