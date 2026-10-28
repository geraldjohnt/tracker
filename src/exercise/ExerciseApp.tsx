import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { AuthUser } from '../shared/auth';
import { AccountMenu } from '../shared/components/AccountMenu';
import { AppShell, SidebarDivider, SidebarLink } from '../shared/components/AppShell';
import { AppearanceMenu } from '../shared/components/AppearanceMenu';
import { ConnPill } from '../shared/components/ConnPill';
import { Toasts } from '../shared/components/Toasts';
import { addDays, daysBetween, fmtDate, startOfWeek } from '../shared/dates';
import { useConnection } from '../shared/hooks';
import { isSampleMode } from '../shared/store';
import { EXERCISE_ROOT, userRoot } from '../shared/types';
import { useAppearance } from '../shared/useAppearance';
import { AchievementsView } from './AchievementsView';
import { BodyMap } from './BodyMap';
import { CameraModal, type CameraModalHandle, type CameraQuest } from './CameraModal';
import { DIFFICULTIES, MUSCLE_LABELS, type Difficulty, type Exercise } from './catalog';
import { CelebrationOverlay } from './Celebration';
import {
  challengeProgress, challengeXp, DAILY_SLOTS, dailyDone, dailyXpTotal, dayGain, DIFFICULTY_INFO, focusOn, FOCUS_INFO, isRestDay, levelInfo, manualXp,
  nextRank, questAmount, questXp, rankOf, streak, STREAK_BONUSES, streakBonusPct, streakBonusXp, streakWithToday, totalXp, type QuestKind, type QuestSlot,
} from './derive';
import { ExerciseModal, type ExerciseModalHandle } from './ExerciseModal';
import { RankBadge } from './RankBadge';
import { RankingView } from './RankingView';
import { RanksView } from './RanksView';
import { WeeklyPlanModal, WeeklyStrip, type WeeklyPlanHandle } from './WeeklyPlan';
import { CATEGORY_ICONS, CATEGORY_LABELS, fmtAmount, GenderTag } from './parts';
import { exerciseStore, type ExerciseState } from './store';

type View = 'quests' | 'ranks' | 'achievements' | 'ranking' | 'library' | 'history';
const VIEWS: Array<[View, string]> = [
  ['quests', 'Quests'], ['ranks', 'Ranks'], ['achievements', 'Achievements'], ['ranking', 'Ranking'], ['library', 'Exercises'], ['history', 'History'],
];

export function ExerciseApp({ user }: { user: AuthUser }) {
  const state = useSyncExternalStore(exerciseStore.subscribe, exerciseStore.getState);
  const conn = useConnection();
  const [appearance, setAppearance] = useAppearance('exercise', userRoot(user.uid, EXERCISE_ROOT));
  const [view, setView] = useState<View>('quests');
  const modalRef = useRef<ExerciseModalHandle>(null);
  const planRef = useRef<WeeklyPlanHandle>(null);
  const camRef = useRef<CameraModalHandle>(null);
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
            {view === 'quests' && <QuestsView state={state} level={info.level} onInfo={openEx} onRanks={() => setView('ranks')} onPlan={() => planRef.current?.open()} onCamera={q => camRef.current?.open(q)} />}
            {view === 'ranks' && <RanksView state={state} />}
            {view === 'achievements' && <AchievementsView state={state} />}
            {view === 'ranking' && <RankingView state={state} uid={user.uid} />}
            {view === 'library' && <LibraryView catalog={state.catalog} level={info.level} onInfo={openEx} />}
            {view === 'history' && <HistoryView state={state} />}
          </>}
      </AppShell>
      <ExerciseModal ref={modalRef} level={info.level} />
      <CameraModal ref={camRef} />
      <CelebrationOverlay item={state.celebrations[0]} onClose={dismissCelebration} />
      {state.today && <WeeklyPlanModal ref={planRef} targets={state.targets} today={state.today} canRetargetToday={exerciseStore.canRetargetToday()} />}
      <Toasts />
    </>
  );
}

const dismissCelebration = () => exerciseStore.dismissCelebration();

/* ---------------- Quests ---------------- */

function PlayerCard({ state, onRanks }: { state: ExerciseState; onRanks: () => void }) {
  const info = levelInfo(totalXp(state.days));
  const rank = rankOf(info.level);
  const next = nextRank(info.level);
  const pct = Math.min(100, (info.into / info.need) * 100);
  const days = streak(state.days, state.today, state.targets);
  return (
    <div className="card-x player fade-in">
      <button type="button" className={'rank-emblem rank-' + rank.index} onClick={onRanks} title={rank.label + ' · see all ranks'} aria-label={rank.label + ', see all ranks'}>
        <i className={'bi ' + rank.icon}></i>
        <RankBadge rank={rank} size={40} className="emblem-badge" />
      </button>
      <div className="player-main">
        <div className="player-rank">{rank.label}</div>
        <div className="player-level">Level {info.level}</div>
        <div className="xp-bar" role="progressbar" aria-valuenow={info.into} aria-valuemin={0} aria-valuemax={info.need} aria-label="XP to next level">
          <div className="xp-fill" style={{ width: pct + '%' }}></div>
        </div>
        <div className="xp-meta">
          <span><b>{info.into}</b> / {info.need} XP to Level {info.level + 1}</span>
          <button type="button" className="link-btn" onClick={onRanks}>{next.rank.label} at Level {next.level}</button>
        </div>
      </div>
      <div className="player-stats">
        <div className="pstat"><div className="pstat-val">{info.total}</div><div className="pstat-label">Total XP</div></div>
        <div className="pstat"><div className="pstat-val"><i className="bi bi-fire streak-icon"></i>{days}</div><div className="pstat-label">Day streak</div></div>
      </div>
    </div>
  );
}

function QuestsView({ state, level, onInfo, onRanks, onPlan, onCamera }: {
  state: ExerciseState; level: number; onInfo: (ex: Exercise) => void; onRanks: () => void; onPlan: () => void; onCamera: (q: CameraQuest) => void;
}) {
  const day = state.days[state.today];
  const focus = FOCUS_INFO[day?.focus ?? focusOn(state.targets, state.today)];
  const rest = isRestDay(day, state.targets, state.today);
  const safe = rest || dailyDone(day);
  const atRisk = dailyXpTotal(day, level, state.byId);
  const streakToday = streakWithToday(state.days, state.today, state.targets);
  const bonusPct = streakBonusPct(streakToday);
  const nextBonus = [...STREAK_BONUSES].reverse().find(b => b.days > streakToday);
  const xp = totalXp(state.days);
  const s = state.lastSettlement;
  return (
    <>
      <PlayerCard state={state} onRanks={onRanks} />
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
          <button type="button" className="focus-chip" onClick={onPlan} title="Change the weekly plan"><i className={'bi ' + focus.icon}></i>{focus.day}<i className="bi bi-pencil"></i></button>
          <span className={'safe-pill ms-auto' + (safe ? ' safe' : '')}>
            {rest ? <><i className="bi bi-moon-stars"></i>Rest day · no penalty</>
              : safe ? <><i className="bi bi-shield-check"></i>Safe for today</>
                : <><i className="bi bi-exclamation-triangle"></i>{Math.min(atRisk, xp) ? 'Do 1 by midnight or lose ' + Math.min(atRisk, xp) + ' XP' : 'Do at least 1 today'}</>}
          </span>
        </div>
        {!rest && (bonusPct || nextBonus) ? (
          <div className={'streak-bonus' + (bonusPct ? ' on' : '')}>
            <i className="bi bi-fire"></i>
            {bonusPct
              ? <span><b>Streak bonus +{bonusPct}%</b> on today’s daily quests ({streakToday}-day streak).{nextBonus ? ' +' + nextBonus.pct + '% at ' + nextBonus.days + ' days.' : ''}</span>
              : <span>Keep your streak to <b>{nextBonus!.days} days</b> for <b>+{nextBonus!.pct}% XP</b> on daily quests.</span>}
          </div>
        ) : null}
        <div className="card-x-body quest-list">
          {rest ? (
            <div className="rest-note">
              <i className="bi bi-moon-stars"></i>
              <div>
                <b>Rest day.</b> No daily quests today and no penalty, and your streak stays as it is.
                Feel like moving? Complete an optional quest below: you still get its XP, and your streak goes up by a day.
              </div>
            </div>
          ) : DAILY_SLOTS.map(slot => {
            const q = day?.daily?.[slot];
            const ex = q && state.byId[q.ex];
            if (!q || !ex) return null;
            return <QuestRow key={slot} kind="daily" q={q} ex={ex} level={level} bonusPct={bonusPct} onInfo={onInfo} onCamera={onCamera}
              onComplete={camera => exerciseStore.completeDaily(slot, camera)} onUndo={() => exerciseStore.undoDaily(slot)} />;
          })}
        </div>
      </div>

      <ChallengeCard state={state} onInfo={onInfo} onCamera={onCamera} />

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
            return <QuestRow key={d} kind="optional" q={q} ex={ex} level={level} onInfo={onInfo} onCamera={onCamera}
              onAccept={() => exerciseStore.acceptOptional(d)} onAbandon={() => exerciseStore.abandonOptional(d)}
              onComplete={camera => exerciseStore.completeOptional(d, camera)} onUndo={() => exerciseStore.undoOptional(d)} />;
          })}
        </div>
      </div>
      <WeeklyStrip targets={state.targets} today={state.today} onEdit={onPlan} />
      <p className="fine-print">
        Quests reset at midnight. Rep targets grow with your level. Rest days keep your streak; a quest done on one adds to it. Start opens the camera, which counts your reps and checks your form;
        the video stays on your device and is never recorded. No camera, or access blocked? You can still complete a quest for half the XP (rounded down).
      </p>
    </>
  );
}

function QuestRow({ kind, q, ex, level, bonusPct = 0, onInfo, onCamera, onComplete, onUndo, onAccept, onAbandon }: {
  kind: QuestKind; q: QuestSlot; ex: Exercise; level: number; bonusPct?: number; onInfo: (ex: Exercise) => void; onCamera: (q: CameraQuest) => void;
  onComplete: (camera: boolean) => void; onUndo: () => void; onAccept?: () => void; onAbandon?: () => void;
}) {
  const done = !!q.done;
  const amount = done && q.amount ? q.amount : questAmount(ex, level, kind);
  const xp = done && q.xp !== undefined ? q.xp : questXp(ex.difficulty, level, kind);
  const bonus = done ? q.bonus ?? 0 : streakBonusXp(xp, bonusPct);
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
        <span className="xp-chip">+{xp} XP{bonus ? <span className="xp-bonus" title="Streak bonus"><i className="bi bi-fire"></i>+{bonus}</span> : null}</span>
        {done ? (
          <div className="quest-actions">
            {q.manual
              ? <span className="done-tag manual" title="Completed without the camera: half XP"><i className="bi bi-camera-video-off"></i>Done · ½ XP</span>
              : <span className="done-tag"><i className="bi bi-check-circle-fill"></i>Done</span>}
            <button type="button" className="btn btn-ghost btn-sm btn-icon" title="Undo" aria-label="Undo" onClick={onUndo}><i className="bi bi-arrow-counterclockwise"></i></button>
          </div>
        ) : locked ? (
          <button type="button" className="btn-primary-x btn-sm-x" onClick={onAccept}>Accept</button>
        ) : (
          <div className="quest-actions">
            {kind === 'optional' && <button type="button" className="btn btn-ghost btn-sm btn-icon" title="Abandon" aria-label="Abandon" onClick={onAbandon}><i className="bi bi-x-lg"></i></button>}
            <button type="button" className="btn-primary-x btn-sm-x" title="Do it on camera to complete it"
              onClick={() => onCamera({ ex, amount, xp, onComplete })}><i className="bi bi-camera-video me-1"></i>Start</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Weekly challenge ---------------- */

function ChallengeCard({ state, onInfo, onCamera }: { state: ExerciseState; onInfo: (ex: Exercise) => void; onCamera: (q: CameraQuest) => void }) {
  const monday = startOfWeek(state.today);
  const c = state.weeks[monday]?.challenge;
  const ex = c && state.byId[c.ex];
  if (!c || !ex) return null;
  const progress = Math.min(c.target, challengeProgress(c));
  const left = c.target - progress;
  const daysLeft = daysBetween(state.today, addDays(monday, 6));
  const unit = ex.measure === 'seconds' ? 's' : ' reps';
  const half = manualXp(c.reward);
  return (
    <div className={'card-x challenge fade-in' + (c.done ? ' done' : '')}>
      <div className="card-x-head">
        <h2 className="card-x-title"><i className="bi bi-trophy"></i>Weekly challenge</h2>
        <span className="head-note">{c.done ? 'Done this week. A new one comes on Monday.' : daysLeft ? daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + ' left (ends Sunday)' : 'Last day!'}</span>
        <span className="xp-chip ms-auto">+{c.done ? c.xp ?? challengeXp(c) : c.reward} XP</span>
      </div>
      <div className="card-x-body challenge-body">
        <button type="button" className="quest-icon" onClick={() => onInfo(ex)} title={'How to do ' + ex.name}><i className="bi bi-trophy"></i></button>
        <div className="challenge-main">
          <div className="quest-title">
            <button type="button" className="quest-name" onClick={() => onInfo(ex)}>{ex.name}</button>
          </div>
          <div className="quest-sub">
            {ex.measure === 'seconds' ? 'Hold for ' + c.target + ' s in total this week' : c.target + ' reps in total this week'}, in as many sessions as you like.
          </div>
          <div className="challenge-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={c.target} aria-label="Weekly challenge progress">
            <div style={{ width: (progress / c.target) * 100 + '%' }}></div>
          </div>
          <div className="challenge-meta">
            <span><b>{progress}</b> / {c.target}{unit}</span>
            {(c.man ?? 0) > 0 && <span className="muted">{c.man}{unit} without the camera (half XP)</span>}
          </div>
        </div>
        <div className="quest-side">
          {c.done
            ? <span className="done-tag"><i className="bi bi-check-circle-fill"></i>Done</span>
            : <button type="button" className="btn-primary-x btn-sm-x" title="Do some on camera; the count is saved when you stop"
              onClick={() => onCamera({
                ex, amount: left, xp: c.reward,
                onComplete: camera => exerciseStore.logChallenge(left, camera),
                onPartial: n => exerciseStore.logChallenge(n, true),
              })}><i className="bi bi-camera-video me-1"></i>Start</button>}
        </div>
      </div>
      {!c.done && <p className="fine-print challenge-note">Reps the camera counts earn the full XP; reps logged without the camera earn half (+{half} XP if none are on camera).</p>}
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
          const rest = isRestDay(day, state.targets, d);
          const missed = d < state.today && !dailyCount && !rest;
          return (
            <div key={d} className={'hist-row' + (d === state.today ? ' is-today' : '') + (missed ? ' missed' : '')}>
              <div>
                <div className="list-row-label">{d === state.today ? 'Today' : fmtDate(d, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                <div className="hist-sub">
                  {rest ? 'Rest day · ' + optCount + ' optional' : (day?.focus ? FOCUS_INFO[day.focus].label + ' · ' : '') + dailyCount + '/3 daily · ' + optCount + ' optional'}
                  {missed ? ' · missed' : ''}{day?.challengeXp ? ' · weekly challenge' : ''}
                </div>
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
