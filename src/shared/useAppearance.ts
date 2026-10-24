import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { applyAppearance, isPalette, isTemplate, isTheme, loadAppearance, type Appearance } from './appearance';
import { getBackend } from './store';

/**
 * Appearance state for a page. With `syncRoot`, the choice is also mirrored to
 * `<syncRoot>/settings/{theme,template,palette}` and incoming changes from other
 * devices are applied (only when they differ, to avoid redundant re-renders).
 */
export function useAppearance(prefix: string, syncRoot?: string) {
  const [appearance, setAppearance] = useState<Appearance>(() => loadAppearance(prefix));

  useLayoutEffect(() => { applyAppearance(prefix, appearance); }, [prefix, appearance]);

  useEffect(() => {
    const b = syncRoot ? getBackend() : null;
    if (!b) return;
    const unsubs = [
      b.on(syncRoot + '/settings/theme', v => { if (isTheme(v)) setAppearance(a => (a.theme === v ? a : { ...a, theme: v })); }),
      b.on(syncRoot + '/settings/template', v => { if (isTemplate(v)) setAppearance(a => (a.template === v ? a : { ...a, template: v })); }),
      b.on(syncRoot + '/settings/palette', v => { if (isPalette(v)) setAppearance(a => (a.palette === v ? a : { ...a, palette: v })); }),
    ];
    return () => unsubs.forEach(u => u());
  }, [syncRoot]);

  const change = useCallback((patch: Partial<Appearance>) => {
    setAppearance(a => ({ ...a, ...patch }));
    const b = syncRoot ? getBackend() : null;
    if (b) for (const [k, v] of Object.entries(patch)) b.set(syncRoot + '/settings/' + k, v).catch(console.error);
  }, [syncRoot]);

  return [appearance, change] as const;
}
