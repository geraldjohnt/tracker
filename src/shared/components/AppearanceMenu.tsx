import 'bootstrap/js/dist/dropdown'; // registers Bootstrap's data-bs-toggle="dropdown" handler
import { PALETTES, TEMPLATES, type Appearance } from '../appearance';

interface Props {
  appearance: Appearance;
  onChange: (patch: Partial<Appearance>) => void;
}

export function AppearanceMenu({ appearance, onChange }: Props) {
  const dark = appearance.theme === 'dark';
  return (
    <div className="dropdown">
      <button id="appearanceBtn" className="btn btn-ghost btn-sm btn-icon" type="button" data-bs-toggle="dropdown"
        data-bs-auto-close="outside" aria-expanded="false" title="Appearance">
        <i className="bi bi-palette2"></i>
      </button>
      <div className="dropdown-menu dropdown-menu-end appearance-menu" aria-labelledby="appearanceBtn">
        <div className="appearance-label">Mode</div>
        <button type="button" id="themeBtn" className="btn btn-ghost btn-sm appearance-mode-btn"
          onClick={() => onChange({ theme: dark ? 'light' : 'dark' })}>
          <i className={'bi ' + (dark ? 'bi-sun' : 'bi-moon-stars')}></i><span>{dark ? 'Dark' : 'Light'}</span>
        </button>
        <div className="dropdown-divider"></div>
        <div className="appearance-label">Design</div>
        <div className="template-grid" id="templateGrid">
          {TEMPLATES.map(t => (
            <button key={t.id} type="button" className={'tpl-opt' + (t.id === appearance.template ? ' active' : '')}
              onClick={() => onChange({ template: t.id })}>
              <i className={'bi ' + t.icon}></i><span>{t.name}</span>
            </button>
          ))}
        </div>
        <div className="dropdown-divider"></div>
        <div className="appearance-label">Color</div>
        <div className="palette-grid" id="paletteGrid">
          {PALETTES.map(p => (
            <button key={p.id} type="button" className={'pal-opt' + (p.id === appearance.palette ? ' active' : '')}
              title={p.name} style={{ '--sw1': p.c1, '--sw2': p.c2 } as React.CSSProperties}
              onClick={() => onChange({ palette: p.id })}>
              <i className="bi bi-check-lg pal-check"></i>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
