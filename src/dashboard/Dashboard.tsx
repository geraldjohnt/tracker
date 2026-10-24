// Read-only overview of both trackers. Appearance is device-local
// (dashboard.* in localStorage) and never synced to either tracker's settings.
import { useEffect, useState } from 'react';
import { AppShell, SidebarDivider, SidebarLink } from '../shared/components/AppShell';
import { AppearanceMenu } from '../shared/components/AppearanceMenu';
import { ConnPill } from '../shared/components/ConnPill';
import { todayISO } from '../shared/dates';
import { fmtMoney } from '../shared/format';
import { useConnection, useLiveValue } from '../shared/hooks';
import { isSampleMode } from '../shared/store';
import { SPEND_ROOT, WEIGHT_ROOT } from '../shared/types';
import { useAppearance } from '../shared/useAppearance';
import { dayTotal, normalizeExpenses } from '../spending/derive';
import { normalizeWeeks, peopleOf, sortedWeeks } from '../weight/derive';
import { SpendCard } from './SpendCard';
import { WeightCard } from './WeightCard';

const OFFLINE_FALLBACK_MS = 4000; // render with whatever we have if Firebase never answers

export function Dashboard() {
  const [appearance, setAppearance] = useAppearance('dashboard');
  const conn = useConnection();
  const weeksLive = useLiveValue<Record<string, never> | null>(WEIGHT_ROOT + '/weeks', null);
  const expLive = useLiveValue<Record<string, never> | null>(SPEND_ROOT + '/expenses', null);

  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), OFFLINE_FALLBACK_MS);
    return () => clearTimeout(t);
  }, []);
  const weightReady = weeksLive.ready || timedOut;
  const spendReady = expLive.ready || timedOut;

  const weeks = normalizeWeeks(weeksLive.value);
  const expenses = normalizeExpenses(expLive.value);
  const today = todayISO();

  const bits: string[] = [];
  if (weightReady) {
    const w = sortedWeeks(weeks)[0];
    if (w) bits.push(peopleOf(w).length + ' logging this week');
  }
  if (spendReady) bits.push(fmtMoney(dayTotal(expenses, today)) + ' spent today');

  return (
    <AppShell
      title="Dashboard"
      subtitle="Tracker overview"
      sidebarKey="dashboard.sidebar"
      nav={<>
        <SidebarLink href="index.html" icon="bi-grid-1x2" label="Dashboard" active />
        <SidebarDivider />
        <SidebarLink href="weight.html" icon="bi-activity" label="Weight Tracker" />
        <SidebarLink href="spending.html" icon="bi-wallet2" label="Spending Tracker" />
      </>}
      headerActions={<>
        <ConnPill status={conn} localLabel={isSampleMode() ? 'Sample data' : 'Unavailable'} />
        <AppearanceMenu appearance={appearance} onChange={setAppearance} />
      </>}
    >
      <section className="hero fade-in">
        <div className="hero-greet" id="heroGreet">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <div className="hero-sub" id="heroSub">
          {bits.length ? bits.join(' · ') : "Here's where things stand across both trackers."}
        </div>
      </section>

      <div className="dash-grid">
        <WeightCard weeks={weeks} ready={weightReady} appearance={appearance} />
        <SpendCard expenses={expenses} ready={spendReady} appearance={appearance} />
      </div>
    </AppShell>
  );
}
