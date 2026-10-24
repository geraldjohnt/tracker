import { useState, type ReactNode } from 'react';
import logoUrl from '../../../logo.png';

/** A sidebar entry: a link to another page, or (with onClick) an in-page view switch. */
export function SidebarLink({ href, onClick, icon, label, active }: {
  href?: string; onClick?: () => void; icon: string; label: string; active?: boolean;
}) {
  const cls = 'sidebar-link' + (active ? ' active' : '');
  const body = <><i className={'bi ' + icon}></i><span>{label}</span></>;
  return href
    ? <a href={href} className={cls} title={label}>{body}</a>
    : <button type="button" className={cls} title={label} onClick={onClick}>{body}</button>;
}

export const SidebarDivider = () => <div className="sidebar-divider"></div>;

interface Props {
  title: string;
  subtitle: string;
  /** localStorage key remembering the desktop collapsed state, e.g. "dashboard.sidebar". */
  sidebarKey: string;
  /** Sidebar contents: SidebarLink / SidebarDivider elements. Clicking any closes the mobile drawer. */
  nav: ReactNode;
  headerActions: ReactNode;
  containerClass?: string;
  children: ReactNode;
}

const isMobile = () => matchMedia('(max-width:767.98px)').matches;

export function AppShell({ title, subtitle, sidebarKey, nav, headerActions, containerClass, children }: Props) {
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
          {nav}
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
