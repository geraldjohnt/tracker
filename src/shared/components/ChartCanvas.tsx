import { useEffect, useRef } from 'react';
import { Chart, type ChartConfiguration } from 'chart.js/auto';

/** Read a CSS custom property off :root, so chart colors follow the current theme/palette. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * A Chart.js canvas. The chart is destroyed and recreated whenever `deps`
 * change (same approach as the legacy pages) — include the appearance in deps
 * so a theme/palette switch re-reads the CSS colors.
 */
export function ChartCanvas({ config, deps, id }: { config: () => ChartConfiguration; deps: unknown[]; id?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, config());
    return () => chart.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return <canvas id={id} ref={ref}></canvas>;
}
