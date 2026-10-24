import { useRef, useState, useSyncExternalStore } from 'react';
import type { AuthUser } from '../shared/auth';
import { AccountMenu } from '../shared/components/AccountMenu';
import { AppShell, SidebarDivider, SidebarLink } from '../shared/components/AppShell';
import { AppearanceMenu } from '../shared/components/AppearanceMenu';
import { ConfirmModal, type ConfirmHandle } from '../shared/components/ConfirmModal';
import { ConnPill } from '../shared/components/ConnPill';
import { Toasts } from '../shared/components/Toasts';
import { fmtRange, todayISO } from '../shared/dates';
import { useConnection } from '../shared/hooks';
import { isSampleMode } from '../shared/store';
import { toast } from '../shared/toast';
import { WEIGHT_ROOT, userRoot } from '../shared/types';
import { useAppearance } from '../shared/useAppearance';
import { AllWeeksPage } from './AllWeeksPage';
import { exportRows, sortedWeeks, weekStatus } from './derive';
import { weightStore } from './store';
import { cw } from './units';
import { WeekModal, type WeekModalHandle } from './WeekModal';
import { WeekView } from './WeekView';

type Page = 'week' | 'weeks';
const PAGE_KEY = 'weighin.page';

function loadPage(): Page {
  try { return localStorage.getItem(PAGE_KEY) === 'weeks' ? 'weeks' : 'week'; } catch { return 'week'; }
}

export function WeightApp({ user }: { user: AuthUser }) {
  const { weeks, unit, ready, usingLocal } = useSyncExternalStore(weightStore.subscribe, weightStore.getState);
  const conn = useConnection();
  const [appearance, setAppearance] = useAppearance('weighin', userRoot(user.uid, WEIGHT_ROOT));
  const [page, setPageState] = useState<Page>(loadPage);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const weekModal = useRef<WeekModalHandle>(null);
  const confirm = useRef<ConfirmHandle>(null);

  const setPage = (p: Page) => {
    setPageState(p);
    try { localStorage.setItem(PAGE_KEY, p); } catch { /* ignore */ }
  };

  const list = sortedWeeks(weeks);
  // Default to the newest week whenever the selection is missing or was deleted.
  const current = (selectedId && weeks[selectedId]) || list[0] || null;
  const today = todayISO();

  const exportCsv = () => {
    const rows = exportRows(weeks, unit, kg => cw(kg, unit));
    if (rows.length === 1) { toast('Nothing to export yet', true); return; }
    const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'weighin-' + todayISO() + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('CSV exported');
  };

  const status = usingLocal ? 'local' : conn;
  const localLabel = isSampleMode() && !usingLocal ? 'Sample data' : 'Local only';

  return (
    <>
      <AppShell
        title="WeighIn"
        subtitle="Weekly weight challenge"
        sidebarKey="weighin.sidebar"
        page="weight"
        nav={<>
          <SidebarLink href="index.html" icon="bi-grid-1x2" label="Dashboard" />
          <SidebarDivider />
          <SidebarLink icon="bi-calendar2-week" label="This Week" active={page === 'week'} onClick={() => setPage('week')} />
          <SidebarLink icon="bi-collection" label="All Weeks" active={page === 'weeks'} onClick={() => setPage('weeks')} />
          <SidebarDivider />
          <SidebarLink href="spending.html" icon="bi-wallet2" label="Spending Tracker" />
          <SidebarLink href="exercise.html" icon="bi-person-arms-up" label="Exercise" />
        </>}
        headerActions={<>
          <ConnPill status={status} localLabel={localLabel} />
          <button id="unitBtn" className="btn btn-ghost btn-sm" title="Toggle unit" style={{ minWidth: 44 }} onClick={() => weightStore.toggleUnit()}>{unit}</button>
          <AppearanceMenu appearance={appearance} onChange={setAppearance} />
          <AccountMenu user={user} />
        </>}
      >
        <div className="page-toggle-wrap">
          <div className="tabs page-toggle" role="tablist" aria-label="View">
            <button type="button" role="tab" aria-selected={page === 'week'} className={page === 'week' ? 'active' : ''} onClick={() => setPage('week')}>This Week</button>
            <button type="button" role="tab" aria-selected={page === 'weeks'} className={page === 'weeks' ? 'active' : ''} onClick={() => setPage('weeks')}>All Weeks</button>
          </div>
        </div>
        {page === 'week' ? (
          <div id="pageWeek" className="page">
            <div className="toolbar">
              <select id="weekSelect" className="week-select" aria-label="Select week" disabled={ready && !list.length}
                value={current?.id ?? ''} onChange={e => setSelectedId(e.target.value)}>
                {ready && !list.length && <option>No weeks yet</option>}
                {ready && list.map(w => {
                  const n = Object.keys(w.participants || {}).length;
                  return (
                    <option key={w.id} value={w.id}>
                      {fmtRange(w.startDate, w.endDate) + '  ·  ' + n + ' ' + (n === 1 ? 'person' : 'people') + '  ·  ' + weekStatus(w, today).text}
                    </option>
                  );
                })}
              </select>
              <button id="newWeekBtn" className="btn btn-primary-x" onClick={() => weekModal.current?.open('new')}><i className="bi bi-plus-lg me-1"></i>New week</button>
              <button id="exportBtn" className="btn btn-ghost btn-sm btn-icon" title="Export CSV" onClick={exportCsv}><i className="bi bi-download"></i></button>
            </div>

            {ready && !current && (
              <div id="emptyState" className="empty fade-in">
                <div className="empty-icon"><i className="bi bi-calendar2-week"></i></div>
                <h3>No weeks yet</h3>
                <p>Start a challenge week, add everyone who's joining, and log their starting weight. At the end of the week you'll fill in the new numbers and see who moved the most.</p>
                <button className="btn btn-primary-x" onClick={() => weekModal.current?.open('new')}><i className="bi bi-plus-lg me-1"></i>Start first week</button>
              </div>
            )}

            {ready && current && (
              <WeekView
                week={current}
                weeks={weeks}
                unit={unit}
                onEditDates={() => weekModal.current?.open('edit')}
                onDeleteWeek={() => confirm.current?.ask(
                  'Delete the week of ' + fmtRange(current.startDate, current.endDate) + '? This removes all its weigh-ins.',
                  () => { weightStore.deleteWeek(current.id); setSelectedId(null); },
                )}
                onRemovePerson={p => confirm.current?.ask(
                  'Remove ' + (p.name || 'this participant') + ' from this week?',
                  () => weightStore.removeParticipant(current.id, p.id),
                )}
              />
            )}
          </div>
        ) : (
          ready && (
            <AllWeeksPage
              weeks={weeks}
              unit={unit}
              onOpenWeek={id => { setSelectedId(id); setPage('week'); }}
              onNewWeek={() => { setPage('week'); weekModal.current?.open('new'); }}
            />
          )
        )}
      </AppShell>

      <WeekModal ref={weekModal} unit={unit} currentWeek={current} latestWeek={list[0]} onCreated={setSelectedId} />
      <ConfirmModal ref={confirm} />
      <Toasts />
    </>
  );
}
