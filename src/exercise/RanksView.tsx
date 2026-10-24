// Every rank and tier with its badge and the level it unlocks at, so players can see what's ahead.
import { levelInfo, nextRank, RANKS, rankAt, rankLevel, rankOf, TIERS_PER_RANK, totalXp, xpForLevel } from './derive';
import { RankBadge } from './RankBadge';
import type { ExerciseState } from './store';

const TIERS = Array.from({ length: TIERS_PER_RANK }, (_, i) => i + 1);

export function RanksView({ state }: { state: ExerciseState }) {
  const xp = totalXp(state.days);
  const { level } = levelInfo(xp);
  const rank = rankOf(level);
  const next = nextRank(level);
  const toGo = Math.max(0, xpForLevel(next.level) - xp);
  return (
    <>
      <div className="card-x fade-in ranks-hero">
        <RankBadge rank={rank} size={104} />
        <div className="min-w-0">
          <div className="player-rank">Your rank</div>
          <div className="ranks-hero-name">{rank.label}</div>
          <div className="head-note">
            Level {level} · Next: <b>{next.rank.label}</b> at Level {next.level} ({toGo} XP to go)
          </div>
        </div>
        <div className="ranks-next ms-auto">
          <RankBadge rank={next.rank} size={56} />
          <span>Next</span>
        </div>
      </div>
      <p className="fine-print ranks-note">
        A new tier every 5 levels, a new rank every 25. The badge grows with the rank; its colour shows the tier, from pale (1) to purple (5).
      </p>

      <div className="ranks-list">
        {RANKS.map((r, index) => {
          const from = rankLevel(index, 1);
          const last = index === RANKS.length - 1;
          return (
            <div key={r.name} className={'card-x rank-card fade-in' + (index === rank.index ? ' current' : '') + (level < from ? ' locked' : '')}>
              <div className="rank-card-head">
                <div className="rank-card-name">{r.name}</div>
                <span className="head-note">
                  {last ? 'Level ' + from + '+' : 'Levels ' + from + '–' + (rankLevel(index + 1, 1) - 1)}
                  {level < from && <> · <i className="bi bi-lock-fill"></i> {xpForLevel(from).toLocaleString()} XP</>}
                </span>
              </div>
              <div className="tier-row">
                {TIERS.map(t => {
                  const at = rankLevel(index, t);
                  const here = index === rank.index && t === rank.tier;
                  return (
                    <div key={t} className={'tier' + (here ? ' here' : '') + (level >= at ? ' reached' : '')}>
                      <RankBadge rank={rankAt(index, t)} size={58} />
                      <div className="tier-label">{r.name} {t}</div>
                      <div className="tier-sub">
                        {here ? 'You’re here' : level >= at ? <><i className="bi bi-check-lg"></i>Lv {at}</> : 'Lv ' + at}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
