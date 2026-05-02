import { useEffect, useMemo } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import {
  usePostseasonStore,
  type Region,
  type TourneyMatch,
} from '../store/usePostseasonStore';
import type { postseasonIpc } from '@vcd/shared';
import { ChampionCrown } from './ChampionCrown';

const NCAA_REGIONS: Region[] = ['REGION_1', 'REGION_2', 'REGION_3', 'REGION_4'];
const NCAA_REGION_LABELS: Record<string, string> = {
  REGION_1: 'Region 1',
  REGION_2: 'Region 2',
  REGION_3: 'Region 3',
  REGION_4: 'Region 4',
  FINAL_FOUR: 'Final Four',
};

const NCAA_REGIONAL_ROUNDS: postseasonIpc.TournamentRound[] = [
  'NCAA_R64',
  'NCAA_R32',
  'NCAA_S16',
  'NCAA_E8',
];
const NCAA_GLOBAL_ROUNDS: postseasonIpc.TournamentRound[] = ['NCAA_FF', 'NCAA_CHAMP'];
const CT_ROUNDS: postseasonIpc.TournamentRound[] = ['CT_R1', 'CT_SF', 'CT_F'];

const ROUND_LABELS: Record<postseasonIpc.TournamentRound, string> = {
  CT_R1: 'Quarterfinals',
  CT_SF: 'Semifinals',
  CT_F: 'Final',
  NCAA_R64: 'R64',
  NCAA_R32: 'R32',
  NCAA_S16: 'Sweet 16',
  NCAA_E8: 'Elite 8',
  NCAA_FF: 'Final Four',
  NCAA_CHAMP: 'Championship',
};

export function BracketView() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const {
    phase,
    seasonYear,
    championTeamId,
    matches,
    status,
    error,
    view,
    selectedRegion,
    load,
    setView,
    setRegion,
    startCt,
    startNcaa,
    advanceRound,
  } = usePostseasonStore();

  useEffect(() => {
    if (openedSlotId) void load(openedSlotId);
  }, [openedSlotId, load]);

  if (!openedSlotId) return null;

  if (view === 'champion' && championTeamId) {
    return <ChampionCrown />;
  }

  const latestRound = computeLatestRound(matches);
  const allMatches = matches;

  return (
    <section aria-labelledby="bracket-heading" className="bracket-view">
      <header className="match-hub__header">
        <h1 id="bracket-heading">Post-season Bracket</h1>
        <p className="match-hub__sub">
          Season {seasonYear} · Phase: {phase}
          {latestRound ? ` · Current round: ${ROUND_LABELS[latestRound]}` : ''}
        </p>
      </header>

      <div className="bracket-view__controls" role="group" aria-label="Bracket controls">
        <button
          type="button"
          onClick={() => setView('conf')}
          aria-current={view === 'conf' ? 'true' : undefined}
          className={view === 'conf' ? 'app-nav__btn app-nav__btn--active' : 'app-nav__btn'}
        >
          Conference Tournaments
        </button>
        <button
          type="button"
          onClick={() => setView('ncaa')}
          aria-current={view === 'ncaa' ? 'true' : undefined}
          className={view === 'ncaa' ? 'app-nav__btn app-nav__btn--active' : 'app-nav__btn'}
        >
          NCAA Bracket
        </button>
        {championTeamId && (
          <button
            type="button"
            onClick={() => setView('champion')}
            className="app-nav__btn"
          >
            Champion
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      {view === 'conf' && (
        <ConfView
          matches={allMatches}
          phase={phase}
          status={status}
          onStartCt={() => openedSlotId && void startCt(openedSlotId)}
          onAdvance={(r) => openedSlotId && void advanceRound(openedSlotId, r)}
          onGoNcaa={() => openedSlotId && void startNcaa(openedSlotId, seasonYear)}
        />
      )}

      {view === 'ncaa' && (
        <NcaaView
          matches={allMatches}
          phase={phase}
          status={status}
          selectedRegion={selectedRegion}
          onSelectRegion={(r) => setRegion(r)}
          onAdvance={(r) => openedSlotId && void advanceRound(openedSlotId, r)}
        />
      )}

      {status === 'loading' && <p>Loading…</p>}
    </section>
  );
}

function computeLatestRound(
  matches: TourneyMatch[],
): postseasonIpc.TournamentRound | null {
  const order: postseasonIpc.TournamentRound[] = [
    'CT_R1',
    'CT_SF',
    'CT_F',
    'NCAA_R64',
    'NCAA_R32',
    'NCAA_S16',
    'NCAA_E8',
    'NCAA_FF',
    'NCAA_CHAMP',
  ];
  let latest: postseasonIpc.TournamentRound | null = null;
  for (const m of matches) {
    const idx = order.indexOf(m.round);
    const curIdx = latest ? order.indexOf(latest) : -1;
    if (idx > curIdx) latest = m.round;
  }
  return latest;
}

// ────────────────────────────── Conference view ──────────────────────────────

function ConfView(props: {
  matches: TourneyMatch[];
  phase: string;
  status: string;
  onStartCt: () => void;
  onGoNcaa: () => void;
  onAdvance: (r: postseasonIpc.TournamentRound) => void;
}) {
  const ctMatches = props.matches.filter((m) => CT_ROUNDS.includes(m.round));
  const confs = useMemo(() => {
    const set = new Set<string>();
    for (const m of ctMatches) set.add(m.bracketGroupKey);
    return [...set].sort();
  }, [ctMatches]);

  const allCtPlayed =
    ctMatches.length > 0 && ctMatches.every((m) => m.winnerId !== null);
  const currentCtRound = currentUnplayedRound(ctMatches, CT_ROUNDS);

  return (
    <div className="bracket-view__conf">
      <div className="bracket-view__actions">
        {ctMatches.length === 0 && props.phase === 'REGULAR' && (
          <button type="button" onClick={props.onStartCt} disabled={props.status === 'advancing'}>
            Start Conference Tournaments
          </button>
        )}
        {currentCtRound && (
          <button
            type="button"
            onClick={() => props.onAdvance(currentCtRound)}
            disabled={props.status === 'advancing'}
          >
            Advance {ROUND_LABELS[currentCtRound]}
          </button>
        )}
        {allCtPlayed && props.phase === 'CONF_TOURNEY' && (
          <button type="button" onClick={props.onGoNcaa} disabled={props.status === 'advancing'}>
            Start NCAA Tournament
          </button>
        )}
      </div>

      {ctMatches.length === 0 ? (
        <p className="match-hub__sub">No conference tournament matches yet.</p>
      ) : (
        <div className="bracket-view__conf-grid">
          {confs.map((confId) => (
            <ConfTable
              key={confId}
              confId={confId}
              matches={ctMatches.filter((m) => m.bracketGroupKey === confId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConfTable(props: { confId: string; matches: TourneyMatch[] }) {
  const sorted = props.matches
    .slice()
    .sort((a, b) => {
      const ra = CT_ROUNDS.indexOf(a.round);
      const rb = CT_ROUNDS.indexOf(b.round);
      if (ra !== rb) return ra - rb;
      return a.bracketSlot - b.bracketSlot;
    });
  return (
    <table className="poll-view__table bracket-view__table">
      <caption>{props.confId}</caption>
      <thead>
        <tr>
          <th scope="col">Round</th>
          <th scope="col">Match</th>
          <th scope="col">Score</th>
          <th scope="col">Winner</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((m) => (
          <MatchRow key={m.matchId} m={m} />
        ))}
      </tbody>
    </table>
  );
}

// ────────────────────────────── NCAA view ──────────────────────────────────

function NcaaView(props: {
  matches: TourneyMatch[];
  phase: string;
  status: string;
  selectedRegion: Region;
  onSelectRegion: (r: Region) => void;
  onAdvance: (r: postseasonIpc.TournamentRound) => void;
}) {
  const ncaaMatches = props.matches.filter((m) =>
    NCAA_REGIONAL_ROUNDS.includes(m.round) || NCAA_GLOBAL_ROUNDS.includes(m.round),
  );
  const currentRound = currentUnplayedRound(
    ncaaMatches,
    [...NCAA_REGIONAL_ROUNDS, ...NCAA_GLOBAL_ROUNDS],
  );

  const regions: Region[] = [...NCAA_REGIONS, 'FINAL_FOUR'];

  return (
    <div className="bracket-view__ncaa">
      <div className="bracket-view__actions">
        {currentRound && (
          <button
            type="button"
            onClick={() => props.onAdvance(currentRound)}
            disabled={props.status === 'advancing'}
          >
            Advance {ROUND_LABELS[currentRound]}
          </button>
        )}
      </div>

      {ncaaMatches.length === 0 ? (
        <p className="match-hub__sub">
          NCAA bracket not yet generated. Complete conference tournaments first.
        </p>
      ) : (
        <>
          <div role="tablist" aria-label="Region" className="bracket-view__tabs">
            {regions.map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={props.selectedRegion === r}
                type="button"
                onClick={() => props.onSelectRegion(r)}
                className={
                  props.selectedRegion === r
                    ? 'app-nav__btn app-nav__btn--active'
                    : 'app-nav__btn'
                }
              >
                {NCAA_REGION_LABELS[r]}
              </button>
            ))}
          </div>
          <RegionTable region={props.selectedRegion} matches={ncaaMatches} />
        </>
      )}
    </div>
  );
}

function RegionTable(props: { region: Region; matches: TourneyMatch[] }) {
  const rounds =
    props.region === 'FINAL_FOUR' ? NCAA_GLOBAL_ROUNDS : NCAA_REGIONAL_ROUNDS;
  const filtered =
    props.region === 'FINAL_FOUR'
      ? props.matches.filter((m) => NCAA_GLOBAL_ROUNDS.includes(m.round))
      : props.matches.filter((m) => m.bracketGroupKey === props.region);

  return (
    <table className="poll-view__table bracket-view__table">
      <caption>{NCAA_REGION_LABELS[props.region]}</caption>
      <thead>
        <tr>
          <th scope="col">Round</th>
          <th scope="col">Match</th>
          <th scope="col">Score</th>
          <th scope="col">Winner</th>
        </tr>
      </thead>
      <tbody>
        {rounds.flatMap((r) => {
          const rMatches = filtered
            .filter((m) => m.round === r)
            .sort((a, b) => a.bracketSlot - b.bracketSlot);
          return rMatches.map((m) => <MatchRow key={m.matchId} m={m} />);
        })}
      </tbody>
    </table>
  );
}

// ────────────────────────────── Shared bits ────────────────────────────────

function MatchRow(props: { m: TourneyMatch }) {
  const m = props.m;
  const home = `${m.homeTeamAbbr}`;
  const away = `${m.awayTeamAbbr}`;
  const score =
    m.setScores.length > 0
      ? m.setScores.map((s) => `${s.home}-${s.away}`).join(', ')
      : m.winnerId
        ? '—'
        : 'TBD';
  const winnerAbbr =
    m.winnerId === m.homeTeamId
      ? m.homeTeamAbbr
      : m.winnerId === m.awayTeamId
        ? m.awayTeamAbbr
        : '';
  return (
    <tr>
      <td>{ROUND_LABELS[m.round]}</td>
      <td>
        {home} vs {away}
      </td>
      <td>{score}</td>
      <td>{winnerAbbr}</td>
    </tr>
  );
}

function currentUnplayedRound(
  matches: TourneyMatch[],
  order: postseasonIpc.TournamentRound[],
): postseasonIpc.TournamentRound | null {
  for (const r of order) {
    const inRound = matches.filter((m) => m.round === r);
    if (inRound.length === 0) continue;
    if (inRound.some((m) => m.winnerId === null)) return r;
  }
  return null;
}
