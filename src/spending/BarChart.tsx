import type { Appearance } from '../shared/appearance';
import { ChartCanvas, cssVar } from '../shared/components/ChartCanvas';
import { fmtMoney } from '../shared/format';

/** Accent-colored bar chart; colors are re-read from CSS on every appearance change. */
export function BarChart({ id, labels, data, appearance }: { id: string; labels: string[]; data: number[]; appearance: Appearance }) {
  return (
    <div className="chart-wrap">
      <ChartCanvas
        id={id}
        deps={[labels.join('|'), data.join('|'), appearance]}
        config={() => {
          const accent = cssVar('--accent'), muted = cssVar('--muted'), border = cssVar('--border');
          return {
            type: 'bar',
            data: { labels, datasets: [{ data, backgroundColor: accent, borderRadius: 6, maxBarThickness: 42 }] },
            options: {
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmtMoney(ctx.parsed.y) } } },
              scales: {
                x: { grid: { display: false }, ticks: { color: muted, font: { weight: 600, size: 11 } } },
                y: { beginAtZero: true, grid: { color: border }, ticks: { color: muted, callback: v => '₱' + v } },
              },
            },
          };
        }}
      />
    </div>
  );
}
