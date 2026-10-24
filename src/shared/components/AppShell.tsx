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

export type AppPage = 'dashboard' | 'weight' | 'spending';

const BOTTOM_NAV: [AppPage, string, string, string][] = [
  ['dashboard', 'index.html', 'bi-grid-1x2', 'Home'],
  ['weight', 'weight.html', 'bi-activity', 'Weight'],
  ['spending', 'spending.html', 'bi-wallet2', 'Spendly'],
];

/** Mobile-only app tab bar; replaces the sidebar below 768px. */
function BottomNav({ page }: { page: AppPage }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {BOTTOM_NAV.map(([p, href, icon, label]) => (
        <a key={p} href={href} className={'bottom-nav-link' + (p === page ? ' active' : '')} aria-current={p === page ? 'page' : undefined}>
          <i className={'bi ' + icon}></i><span>{label}</span>
        </a>
      ))}
    </nav>
  );
}

interface Props {
  title: string;
  subtitle: string;
  /** localStorage key remembering the desktop collapsed state, e.g. "dashboard.sidebar". */
  sidebarKey: string;
  /** Desktop sidebar contents: SidebarLink / SidebarDivider elements. Hidden on mobile. */
  nav: ReactNode;
  /** Which page this is; marks its tab in the mobile bottom nav. */
  page: AppPage;
  headerActions: ReactNode;
  containerClass?: string;
  children: ReactNode;
}

export function AppShell({ title, subtitle, sidebarKey, nav, page, headerActions, containerClass, children }: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(sidebarKey) === '1'; } catch { return false; }
  });

  // The menu button only exists on desktop (CSS hides it on mobile, where the bottom nav is used).
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(sidebarKey, next ? '1' : '0'); } catch { /* ignore */ }
  };
  return (
    <div className="app-shell">
      <aside id="sidebar" className={'sidebar' + (collapsed ? ' collapsed' : '')}>
        <div className="sidebar-head">
          <div className="brand-logo" style={{ width: 34, height: 34, flex: '0 0 34px' }}><img src={logoUrl} alt="Logo" /></div>
          <div className="sidebar-brand-text">
            <div className="brand-name" style={{ fontSize: '.92rem' }}>{title}</div>
            <div className="brand-sub">{subtitle}</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {nav}
        </nav>
      </aside>

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
      <BottomNav page={page} />
    </div>
  );
}
