import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { AuthUser } from '../shared/auth';
import { AccountMenu } from '../shared/components/AccountMenu';
import { AppShell, SidebarDivider, SidebarLink } from '../shared/components/AppShell';
import { AppearanceMenu } from '../shared/components/AppearanceMenu';
import { ConnPill } from '../shared/components/ConnPill';
import { Toasts } from '../shared/components/Toasts';
import { addDays, daysBetween, fmtDate } from '../shared/dates';
import { useConnection } from '../shared/hooks';
import { isSampleMode } from '../shared/store';
import { EXERCISE_ROOT, userRoot } from '../shared/types';
import { useAppearance } from '../shared/useAppearance';
import { BodyMap } from './BodyMap';
import { DIFFICULTIES, MUSCLE_LABELS, type Difficulty, type Exercise } from './catalog';
import {
  DAILY_SLOTS, dailyDone, dailyXpTotal, dayGain, DIFFICULTY_INFO, LEVELS_PER_RANK, levelInfo, questAmount, questXp, rankOf,
  streak, totalXp, type QuestKind, type QuestSlot,
} from './derive';
import { ExerciseModal, type ExerciseModalHandle } from './ExerciseModal';
import { CATEGORY_ICONS, CATEGORY_LABELS, fmtAmount, GenderTag } from './parts';
import { exerciseStore, type ExerciseState } from './store';

type View = 'quests' | 'library' | 'history';
const VIEWS: Array<[View, string]> = [['quests', 'Quests'], ['library', 'Exercises'], ['history', 'History']];

export function ExerciseApp({ user }: { user: AuthUser }) {
  const state = useSyncExternalStore(exerciseStore.subscribe, exerciseStore.getState);
  const conn = useConnection();
  const [appearance, setAppearance] = useAppearance('exercise', userRoot(user.uid, EXERCISE_ROOT));
  const [view, setView] = useState<View>('quests');
  const modalRef = useRef<ExerciseModalHandle>(null);
  const info = levelInfo(totalXp(state.days));
  const openEx = (ex: Exercise) => modalRef.current?.open(ex);

  const status = state.usingLocal ? 'local' : conn;
  const localLabel = isSampleMode() && !state.usingLocal ? 'Sample data' : 'Local only';

  return (
    <>
      <AppShell
        title="LevelUp"
        subtitle="Calisthenics quests"
        sidebarKey="exercise.sidebar"
        page="exercise"
        nav={<>
          <SidebarLink href="index.html" icon="bi-grid-1x2" label="Dashboard" />
          <SidebarDivider />
          <SidebarLink href="weight.html" icon="bi-activity" label="Weight Tracker" />
          <SidebarLink href="spending.html" icon="bi-wallet2" label="Spending Tracker" />
          <SidebarLink href="exercise.html" icon="bi-person-arms-up" label="Exercise" active />
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
              <button type="button" key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{label}</button>
            ))}
          </div>
        </div>

        {!state.ready || !state.today
          ? <div className="text-center py-5"><div className="spinner-border spinner-border-sm" role="status"><span className="visually-hidden">Loading</span></div></div>
          : <>
            {view === 'quests' && <QuestsView state={state} level={info.level} onInfo={openEx} />}
            {view === 'library' && <LibraryView catalog={state.catalog} level={info.level} onInfo={openEx} />}
            {view === 'history' && <HistoryView state={state} />}
          </>}
      </AppShell>
      <ExerciseModal ref={modalRef} level={info.level} />
      <Toasts />
    </>
  );
}

/* ---------------- Quests ---------------- */

function PlayerCard({ state }: { state: ExerciseState }) {
  const info = levelInfo(totalXp(state.days));
  const rank = rankOf(info.level);
  const nextRankLevel = (Math.floor(info.level / LEVELS_PER_RANK) + 1) * LEVELS_PER_RANK;
  const pct = Math.min(100, (info.into / info.need) * 100);
  const days = streak(state.days, state.today);
  return (
    <div className="card-x player fade-in">
      <div className={'rank-emblem rank-' + rank.index}><i className={'bi ' + rank.icon}></i><span>{rank.tier}</span></div>
      <div className="player-main">
        <div className="player-rank">{rank.label}</div>
        <div className="player-level">Level {info.level}</div>
        <div className="xp-bar" role="progressbar" aria-valuenow={info.into} aria-valuemin={0} aria-valuemax={info.need} aria-label="XP to next level">
          <div className="xp-fill" style={{ width: pct + '%' }}></div>
        </div>
        <div className="xp-meta">
          <span><b>{info.into}</b> / {info.need} XP to Level {info.level + 1}</span>
          <span>{rankOf(nextRankLevel).label} at Level {nextRankLevel}</span>
        </div>
      </div>
      <div className="player-stats">
        <div className="pstat"><div className="pstat-val">{info.total}</div><div className="pstat-label">Total XP</div></div>
        <div className="pstat"><div className="pstat-val"><i className="bi bi-fire streak-icon"></i>{days}</div><div className="pstat-label">Day streak</div></div>
      </div>
    </div>
  );
}

function QuestsView({ state, level, onInfo }: { state: ExerciseState; level: number; onInfo: (ex: Exercise) => void }) {
  const day = state.days[state.today];
  const safe = dailyDone(day);
  const atRisk = dailyXpTotal(day, level, state.byId);
  const xp = totalXp(state.days);
  const s = state.lastSettlement;
  return (
    <>
      <PlayerCard state={state} />
      {s && (
        <div className={'settle-banner fade-in' + (s.xpLost ? ' lost' : '')}>
          <i className={'bi ' + (s.xpLost ? 'bi-heartbreak' : 'bi-info-circle')}></i>
          <div>
            You missed {s.missedDays} day{s.missedDays === 1 ? '' : 's'} of daily quests.{' '}
            {s.xpLost ? <b>−{s.xpLost} XP</b> : 'Nothing was taken, because you had no XP yet.'}
          </div>
          <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => exerciseStore.dismissSettlement()}></button>
        </div>
      )}

      <div className="card-x fade-in">
        <div className="card-x-head">
          <h2 className="card-x-title"><i className="bi bi-calendar-check"></i>Daily quests</h2>
          <span className="head-note">{fmtDate(state.today, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          <span className={'safe-pill ms-auto' + (safe ? ' safe' : '')}>
            {safe ? <><i className="bi bi-shield-check"></i>Safe for today</> : <><i className="bi bi-exclamation-triangle"></i>{Math.min(atRisk, xp) ? 'Do 1 by midnight or lose ' + Math.min(atRisk, xp) + ' XP' : 'Do at least 1 today'}</>}
          </span>
        </div>
        <div className="card-x-body quest-list">
          {DAILY_SLOTS.map(slot => {
            const q = day?.daily?.[slot];
            const ex = q && state.byId[q.ex];
            if (!q || !ex) return null;
            return <QuestRow key={slot} kind="daily" q={q} ex={ex} level={level} onInfo={onInfo}
              onComplete={() => exerciseStore.completeDaily(slot)} onUndo={() => exerciseStore.undoDaily(slot)} />;
          })}
        </div>
      </div>

      <div className="card-x fade-in">
        <div className="card-x-head">
          <h2 className="card-x-title"><i className="bi bi-stars"></i>Optional quests</h2>
          <span className="head-note">Accept a quest, then complete it for bonus XP. No penalty if you don’t finish.</span>
        </div>
        <div className="card-x-body quest-list">
          {DIFFICULTIES.map(d => {
            const q = day?.optional?.[d];
            const ex = q && state.byId[q.ex];
            if (!q || !ex) return null;
            return <QuestRow key={d} kind="optional" q={q} ex={ex} level={level} onInfo={onInfo}
              onAccept={() => exerciseStore.acceptOptional(d)} onAbandon={() => exerciseStore.abandonOptional(d)}
              onComplete={() => exerciseStore.completeOptional(d)} onUndo={() => exerciseStore.undoOptional(d)} />;
          })}
        </div>
      </div>
      <p className="fine-print">
        Quests reset at midnight. Rep targets grow with your level. Honour system for now: tap Complete only after you’ve done every rep with good form.
      </p>
    </>
  );
}

function QuestRow({ kind, q, ex, level, onInfo, onComplete, onUndo, onAccept, onAbandon }: {
  kind: QuestKind; q: QuestSlot; ex: Exercise; level: number; onInfo: (ex: Exercise) => void;
  onComplete: () => void; onUndo: () => void; onAccept?: () => void; onAbandon?: () => void;
}) {
  const done = !!q.done;
  const amount = done && q.amount ? q.amount : questAmount(ex, level, kind);
  const xp = done && q.xp !== undefined ? q.xp : questXp(ex.difficulty, level, kind);
  const locked = kind === 'optional' && !q.accepted;
  return (
    <div className={'quest' + (done ? ' done' : '') + (locked ? ' locked' : '')}>
      <button type="button" className="quest-icon" onClick={() => onInfo(ex)} title={'How to do ' + ex.name}>
        <i className={'bi ' + CATEGORY_ICONS[ex.category]}></i>
      </button>
      <div className="quest-main">
        <div className="quest-title">
          {kind === 'optional' && <span className={'diff-badge diff-' + ex.difficulty}>{DIFFICULTY_INFO[ex.difficulty].label}</span>}
          <button type="button" className="quest-name" onClick={() => onInfo(ex)}>{ex.name}</button>
        </div>
        <div className="quest-sub">
          <span className="quest-amount">{fmtAmount(ex, amount)}</span>
          <span className="dot-sep">·</span>
          <span>{ex.primary.map(m => MUSCLE_LABELS[m]).join(', ')}</span>
          <GenderTag gender={ex.gender} />
        </div>
      </div>
      <div className="quest-side">
        <span className="xp-chip">+{xp} XP</span>
        {done ? (
          <div className="quest-actions">
            <span className="done-tag"><i className="bi bi-check-circle-fill"></i>Done</span>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" title="Undo" aria-label="Undo" onClick={onUndo}><i className="bi bi-arrow-counterclockwise"></i></button>
          </div>
        ) : locked ? (
          <button type="button" className="btn-primary-x btn-sm-x" onClick={onAccept}>Accept</button>
        ) : (
          <div className="quest-actions">
            {kind === 'optional' && <button type="button" className="btn btn-ghost btn-sm btn-icon" title="Abandon" aria-label="Abandon" onClick={onAbandon}><i className="bi bi-x-lg"></i></button>}
            <button type="button" className="btn-primary-x btn-sm-x" onClick={onComplete}>Complete</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Library ---------------- */

function LibraryView({ catalog, level, onInfo }: { catalog: Exercise[]; level: number; onInfo: (ex: Exercise) => void }) {
  const [diff, setDiff] = useState<Difficulty | 'all'>('all');
  const [cat, setCat] = useState<Exercise['category'] | 'all'>('all');
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return catalog.filter(e => (diff === 'all' || e.difficulty === diff) && (cat === 'all' || e.category === cat)
      && (!needle || (e.name + ' ' + e.variant + ' ' + [...e.primary, ...e.secondary].map(m => MUSCLE_LABELS[m]).join(' ')).toLowerCase().includes(needle)));
  }, [catalog, diff, cat, q]);
  return (
    <>
      <div className="lib-filters">
        <input className="lib-search" type="search" placeholder="Search exercises or muscles" value={q} onChange={e => setQ(e.target.value)} aria-label="Search exercises" />
        <div className="chip-row">
          {(['all', ...DIFFICULTIES] as const).map(d => (
            <button type="button" key={d} className={'chip' + (diff === d ? ' active' : '')} onClick={() => setDiff(d)}>{d === 'all' ? 'All levels' : DIFFICULTY_INFO[d].label}</button>
          ))}
        </div>
        <div className="chip-row">
          {(['all', 'legs', 'push', 'pull', 'core', 'full'] as const).map(c => (
            <button type="button" key={c} className={'chip' + (cat === c ? ' active' : '')} onClick={() => setCat(c)}>{c === 'all' ? 'All types' : CATEGORY_LABELS[c]}</button>
          ))}
        </div>
      </div>
      <div className="lib-grid">
        {list.map(e => (
          <button type="button" key={e.id} className="lib-card fade-in" onClick={() => onInfo(e)}>
            <BodyMap primary={e.primary} secondary={e.secondary} className="mini" />
            <div className="lib-body">
              <div className="lib-head"><span className={'diff-badge diff-' + e.difficulty}>{DIFFICULTY_INFO[e.difficulty].label}</span><GenderTag gender={e.gender} /></div>
              <div className="lib-name">{e.name}</div>
              <div className="lib-variant">{e.variant}</div>
              <div className="lib-amount">Daily at your level: <b>{fmtAmount(e, questAmount(e, level, 'daily'))}</b></div>
            </div>
          </button>
        ))}
        {!list.length && <div className="empty"><h3>No exercises match</h3><p>Try a different filter.</p></div>}
      </div>
    </>
  );
}

/* ---------------- History ---------------- */

function HistoryView({ state }: { state: ExerciseState }) {
  const start = state.profile.startDate ?? state.today;
  const n = Math.max(0, daysBetween(start, state.today));
  const rows = Array.from({ length: Math.min(n + 1, 60) }, (_, i) => addDays(state.today, -i));
  return (
    <div className="card-x fade-in">
      <div className="card-x-head"><h2 className="card-x-title"><i className="bi bi-clock-history"></i>History</h2><span className="head-note">Last {rows.length} day{rows.length === 1 ? '' : 's'}</span></div>
      <div className="card-x-body list-rows">
        {rows.map(d => {
          const day = state.days[d];
          const gain = dayGain(day);
          const pen = day?.penalty ?? 0;
          const dailyCount = Object.values(day?.daily ?? {}).filter(s => s?.done).length;
          const optCount = Object.values(day?.optional ?? {}).filter(s => s?.done).length;
          const missed = d < state.today && !dailyCount;
          return (
            <div key={d} className={'hist-row' + (d === state.today ? ' is-today' : '') + (missed ? ' missed' : '')}>
              <div>
                <div className="list-row-label">{d === state.today ? 'Today' : fmtDate(d, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                <div className="hist-sub">{dailyCount}/3 daily · {optCount} optional{missed ? ' · missed' : ''}</div>
              </div>
              <div className="hist-xp">
                {gain > 0 && <span className="good">+{gain}</span>}
                {pen > 0 && <span className="bad">−{pen}</span>}
                {!gain && !pen && <span className="muted">0</span>}
                <span className="muted"> XP</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
