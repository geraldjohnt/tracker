// Theme (light/dark), design template and color palette, applied as attributes
// on <html> (data-bs-theme / data-template / data-palette). Each page keeps its
// own localStorage keys (`<prefix>.theme` etc.); trackers additionally mirror the
// choice to `<root>/settings/*` in the database, the dashboard stays local-only.
import type { Theme } from './types';

export const TEMPLATES = [
  { id: 'default', name: 'Default', icon: 'bi-square' },
  { id: 'neomorphism', name: 'Neomorphism', icon: 'bi-circle-square' },
  { id: 'glassmorphism', name: 'Glassmorphism', icon: 'bi-droplet-half' },
  { id: 'claymorphism', name: 'Claymorphism', icon: 'bi-cloud' },
  { id: 'minimalism', name: 'Minimalism', icon: 'bi-dash-square' },
  { id: 'liquidglass', name: 'Liquid Glass', icon: 'bi-moisture' },
  { id: 'spatial', name: 'Spatial UI', icon: 'bi-boxes' },
] as const;

export const PALETTES = [
  { id: 'indigo', name: 'Indigo', c1: '#6366f1', c2: '#8b5cf6' },
  { id: 'rose', name: 'Rose', c1: '#f43f5e', c2: '#fb7185' },
  { id: 'emerald', name: 'Emerald', c1: '#10b981', c2: '#34d399' },
  { id: 'amber', name: 'Amber', c1: '#d97706', c2: '#f59e0b' },
  { id: 'ocean', name: 'Ocean', c1: '#0284c7', c2: '#22d3ee' },
  { id: 'violet', name: 'Violet', c1: '#a855f7', c2: '#ec4899' },
  { id: 'slate', name: 'Slate', c1: '#475569', c2: '#64748b' },
  { id: 'sunset', name: 'Sunset', c1: '#ea580c', c2: '#ef4444' },
] as const;

export type TemplateId = (typeof TEMPLATES)[number]['id'];
export type PaletteId = (typeof PALETTES)[number]['id'];

export interface Appearance {
  theme: Theme;
  template: TemplateId;
  palette: PaletteId;
}

export const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark';
export const isTemplate = (v: unknown): v is TemplateId => TEMPLATES.some(t => t.id === v);
export const isPalette = (v: unknown): v is PaletteId => PALETTES.some(p => p.id === v);

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch { /* ignore */ }
}

/** Saved appearance for a page, falling back to prefers-color-scheme / default / indigo. */
export function loadAppearance(prefix: string): Appearance {
  const t = read(prefix + '.theme'), tpl = read(prefix + '.template'), pal = read(prefix + '.palette');
  const prefersDark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  return {
    theme: isTheme(t) ? t : prefersDark ? 'dark' : 'light',
    template: isTemplate(tpl) ? tpl : 'default',
    palette: isPalette(pal) ? pal : 'indigo',
  };
}

/** Apply to <html> and remember it on this device. */
export function applyAppearance(prefix: string, a: Appearance) {
  const el = document.documentElement;
  el.setAttribute('data-bs-theme', a.theme);
  el.setAttribute('data-template', a.template);
  el.setAttribute('data-palette', a.palette);
  write(prefix + '.theme', a.theme);
  write(prefix + '.template', a.template);
  write(prefix + '.palette', a.palette);
}
