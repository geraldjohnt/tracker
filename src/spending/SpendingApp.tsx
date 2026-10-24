import { useState, useSyncExternalStore } from 'react';
import type { AuthUser } from '../shared/auth';
import { AccountMenu } from '../shared/components/AccountMenu';
import { AppShell, SidebarDivider, SidebarLink } from '../shared/components/AppShell';
import { AppearanceMenu } from '../shared/components/AppearanceMenu';
import { ConnPill } from '../shared/components/ConnPill';
import { Toasts } from '../shared/components/Toasts';
import { todayISO } from '../shared/dates';
import { useConnection } from '../shared/hooks';
import { isSampleMode } from '../shared/store';
import { SPEND_ROOT, userRoot } from '../shared/types';
import { useAppearance } from '../shared/useAppearance';
import { spendingStore } from './store';
import { CalendarView, DayView, MonthView, WeekView, YearView } from './views';

type View = 'day' | 'calendar' | 'week' | 'month' | 'year';
const VIEWS: Array<[View, string]> = [['day', 'Day'], ['calendar', 'Calendar'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']];

export function SpendingApp({ user }: { user: AuthUser }) {
  const { expenses, ready, usingLocal } = useSyncExternalStore(spendingStore.subscribe, spendingStore.getState);
  const conn = useConnection();
  const [appearance, setAppearance] = useAppearance('spendly', userRoot(user.uid, SPEND_ROOT));

  // One anchor per view, so switching views and back keeps your place.
  const today = todayISO();
  const [view, setView] = useState<View>('day');
  const [dayDate, setDayDate] = useState(today);
  const [calMonth, setCalMonth] = useState(today.slice(0, 7));
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [monthAnchor, setMonthAnchor] = useState(today.slice(0, 7));
  const [yearAnchor, setYearAnchor] = useState(today.slice(0, 4));

  const openDay = (d: string) => { setDayDate(d); setView('day'); };
  const status = usingLocal ? 'local' : conn;
  const localLabel = isSampleMode() && !usingLocal ? 'Sample data' : 'Local only';

  return (
    <>
      <AppShell
        title="Spendly"
        subtitle="Daily spending tracker"
        sidebarKey="spendly.sidebar"
        page="spending"
        nav={<>
          <SidebarLink href="index.html" icon="bi-grid-1x2" label="Dashboard" />
          <SidebarDivider />
          <SidebarLink href="weight.html" icon="bi-activity" label="Weight Tracker" />
          <SidebarLink href="spending.html" icon="bi-wallet2" label="Spending Tracker" active />
        </>}
        headerActions={<>
          <ConnPill status={status} localLabel={localLabel} />
          <AppearanceMenu appearance={appearance} onChange={setAppearance} />
          <AccountMenu user={user} />
        </>}
      >
        <div className="tabs-wrap">
          <div className="tabs" id="viewTabs">
            {VIEWS.map(([v, label]) => (
              <button type="button" key={v} data-view={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{label}</button>
            ))}
          </div>
        </div>

        {(view === 'day' || !ready) && <DayView expenses={expenses} date={dayDate} setDate={setDayDate} ready={ready} />}
        {ready && view === 'calendar' && <CalendarView expenses={expenses} ym={calMonth} setYm={setCalMonth} onPickDay={openDay} />}
        {ready && view === 'week' && <WeekView expenses={expenses} anchor={weekAnchor} setAnchor={setWeekAnchor} onPickDay={openDay} appearance={appearance} />}
        {ready && view === 'month' && <MonthView expenses={expenses} ym={monthAnchor} setYm={setMonthAnchor} appearance={appearance} />}
        {ready && view === 'year' && (
          <YearView expenses={expenses} year={yearAnchor} setYear={setYearAnchor} appearance={appearance}
            onPickMonth={ym => { setMonthAnchor(ym); setView('month'); }} />
        )}
      </AppShell>
      <Toasts />
    </>
  );
}
