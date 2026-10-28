// Read-only overview of all three trackers. Appearance is device-local
// (dashboard.* in localStorage) and never synced to either tracker's settings.
import { useEffect, useState } from 'react';
import type { AuthUser } from '../shared/auth';
import { AccountMenu } from '../shared/components/AccountMenu';
import { AppShell, SidebarDivider, SidebarLink } from '../shared/components/AppShell';
import { AppearanceMenu } from '../shared/components/AppearanceMenu';
import { ConnPill } from '../shared/components/ConnPill';
import { Toasts } from '../shared/components/Toasts';
import { todayISO } from '../shared/dates';
import { fmtMoney } from '../shared/format';
import { useConnection, useLiveValue } from '../shared/hooks';
import { isSampleMode } from '../shared/store';
import { EXERCISE_ROOT, SPEND_ROOT, WEIGHT_ROOT, userRoot } from '../shared/types';
import { useAppearance } from '../shared/useAppearance';
import { dayTotal, normalizeExpenses } from '../spending/derive';
import { exerciseSummary, normalizeDays, normalizeProfile, normalizeTargets } from '../exercise/derive';
import { normalizeWeeks, peopleOf, sortedWeeks } from '../weight/derive';
import { ExerciseCard } from './ExerciseCard';
import { SpendCard } from './SpendCard';
import { WeightCard } from './WeightCard';

const OFFLINE_FALLBACK_MS = 4000; // render with whatever we have if Firebase never answers

export function Dashboard({ user }: { user: AuthUser }) {
  const [appearance, setAppearance] = useAppearance('dashboard');
  const conn = useConnection();
  const weeksLive = useLiveValue<Record<string, never> | null>(userRoot(user.uid, WEIGHT_ROOT) + '/weeks', null);
  const expLive = useLiveValue<Record<string, never> | null>(userRoot(user.uid, SPEND_ROOT) + '/expenses', null);
  const exLive = useLiveValue<{ days?: unknown; profile?: unknown; settings?: { targets?: unknown } } | null>(userRoot(user.uid, EXERCISE_ROOT), null);

  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), OFFLINE_FALLBACK_MS);
    return () => clearTimeout(t);
  }, []);
  const weightReady = weeksLive.ready || timedOut;
  const spendReady = expLive.ready || timedOut;
  const exReady = exLive.ready || timedOut;

  const weeks = normalizeWeeks(weeksLive.value);
  const expenses = normalizeExpenses(expLive.value);
  const today = todayISO();
  const ex = exerciseSummary(normalizeDays(exLive.value?.days), normalizeProfile(exLive.value?.profile),
    normalizeTargets(exLive.value?.settings?.targets), today, user.uid);

  const bits: string[] = [];
  if (weightReady) {
    const w = sortedWeeks(weeks)[0];
    if (w) bits.push(peopleOf(w).length + ' logging this week');
  }
  if (spendReady) bits.push(fmtMoney(dayTotal(expenses, today)) + ' spent today');
  if (exReady && ex.started) bits.push(ex.rest ? 'rest day' : ex.doneCount + '/3 quests done');

  return (
    <>
    <AppShell
      title="Dashboard"
      subtitle="Tracker overview"
      sidebarKey="dashboard.sidebar"
      page="dashboard"
      nav={<>
        <SidebarLink href="index.html" icon="bi-grid-1x2" label="Dashboard" active />
        <SidebarDivider />
        <SidebarLink href="weight.html" icon="bi-activity" label="Weight Tracker" />
        <SidebarLink href="spending.html" icon="bi-wallet2" label="Spending Tracker" />
        <SidebarLink href="exercise.html" icon="bi-person-arms-up" label="Exercise" />
      </>}
      headerActions={<>
        <ConnPill status={conn} localLabel={isSampleMode() ? 'Sample data' : 'Unavailable'} />
        <AppearanceMenu appearance={appearance} onChange={setAppearance} />
        <AccountMenu user={user} />
      </>}
    >
      <section className="hero fade-in">
        <div className="hero-greet" id="heroGreet">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <div className="hero-sub" id="heroSub">
          {bits.length ? bits.join(' · ') : "Here's where things stand across your trackers."}
        </div>
      </section>

      <div className="dash-grid">
        <WeightCard weeks={weeks} ready={weightReady} appearance={appearance} />
        <SpendCard expenses={expenses} ready={spendReady} appearance={appearance} />
        <ExerciseCard summary={ex} ready={exReady} today={today} />
      </div>
    </AppShell>
    <Toasts />
    </>
  );
}
