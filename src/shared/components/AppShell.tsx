import { useState, type ReactNode } from 'react';
import logoUrl from '../../../logo.png';

export type PageKey = 'dashboard' | 'weight' | 'spending';

interface Props {
  page: PageKey;
  title: string;
  subtitle: string;
  /** localStorage key remembering the desktop collapsed state, e.g. "dashboard.sidebar". */
  sidebarKey: string;
  /** Extra in-page links rendered above the cross-tracker links (e.g. a tracker's own sub-pages). */
  sidebarExtra?: ReactNode;
  headerActions: ReactNode;
  containerClass?: string;
  children: ReactNode;
}

const isMobile = () => matchMedia('(max-width:767.98px)').matches;

export function AppShell({ page, title, subtitle, sidebarKey, sidebarExtra, headerActions, containerClass, children }: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(sidebarKey) === '1' && !isMobile(); } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Only a desktop toggle saves the preference — loading on a phone must not overwrite it.
  const toggle = () => {
    if (isMobile()) { setMobileOpen(o => !o); return; }
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(sidebarKey, next ? '1' : '0'); } catch { /* ignore */ }
  };
  const link = (key: PageKey, href: string, icon: string, label: string) => (
    <a href={href} className={'sidebar-link' + (page === key ? ' active' : '')} title={label}>
      <i className={'bi ' + icon}></i><span>{label}</span>
    </a>
  );

  return (
    <div className="app-shell">
      <aside id="sidebar" className={'sidebar' + (collapsed ? ' collapsed' : '') + (mobileOpen ? ' mobile-open' : '')}>
        <div className="sidebar-head">
          <div className="brand-logo" style={{ width: 34, height: 34, flex: '0 0 34px' }}><img src={logoUrl} alt="Logo" /></div>
          <div className="sidebar-brand-text">
            <div className="brand-name" style={{ fontSize: '.92rem' }}>{title}</div>
            <div className="brand-sub">{subtitle}</div>
          </div>
        </div>
        <nav className="sidebar-nav" onClick={() => setMobileOpen(false)}>
          {sidebarExtra}
          {link('dashboard', 'index.html', 'bi-grid-1x2', 'Dashboard')}
          <div className="sidebar-divider"></div>
          {link('weight', 'weight.html', 'bi-activity', 'Weight Tracker')}
          {link('spending', 'spending.html', 'bi-wallet2', 'Spending Tracker')}
        </nav>
      </aside>
      <div id="sidebarBackdrop" className={'sidebar-backdrop' + (mobileOpen ? ' show' : '')} onClick={() => setMobileOpen(false)}></div>

      <div className="content-col">
        <header className="app-header">
          <div className="container">
            <button id="menuBtn" className="btn btn-ghost btn-sm btn-icon" title="Toggle menu" onClick={toggle}><i className="bi bi-list"></i></button>
            <div className="brand">
              <div className="brand-logo"><img src={logoUrl} alt="Logo" /></div>
              <div>
                <div className="brand-name">{title}</div>
                <div className="brand-sub">{subtitle}</div>
              </div>
            </div>
            <div className="header-actions">{headerActions}</div>
          </div>
        </header>
        <main className={'container' + (containerClass ? ' ' + containerClass : '')}>{children}</main>
      </div>
    </div>
  );
}
