// Sprint 19: polished Match Hub. Scout panel, paced PBP ticker, set-by-set
// scoreboard with rally-duration bars, timeout/sub banners, final box score.

import { useEffect, useMemo } from 'react';
import { sim } from '@vcd/shared';
import { useMatchHubStore } from '../store/useMatchHubStore';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import type { ReplaySpeed } from '../match/replayScheduler';

const SPEEDS: ReplaySpeed[] = ['1x', '2x', '4x', 'instant'];

function fmtHit(milli: number): string {
  return (milli / 1000).toFixed(3);
}

export function MatchHub() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const {
    phase,
    teams,
    selectedHomeId,
    selectedAwayId,
    scout,
    match,
    visibleTicker,
    speed,
    scoreHome,
    scoreAway,
    setIndex,
    setHomeScores,
    setAwayScores,
    banner,
    error,
  } = useMatchHubStore();
  const loadTeams = useMatchHubStore((s) => s.loadTeams);
  const setHomeTeam = useMatchHubStore((s) => s.setHome);
  const setAwayTeam = useMatchHubStore((s) => s.setAway);
  const loadScout = useMatchHubStore((s) => s.loadScout);
  const simulateAndLoad = useMatchHubStore((s) => s.simulateAndLoad);
  const play = useMatchHubStore((s) => s.play);
  const pause = useMatchHubStore((s) => s.pause);
  const setSpeedAction = useMatchHubStore((s) => s.setSpeed);
  const finishInstantly = useMatchHubStore((s) => s.finishInstantly);
  const reset = useMatchHubStore((s) => s.reset);

  useEffect(() => {
    if (openedSlotId && teams.length === 0 && phase === 'select') {
      void loadTeams(openedSlotId);
    }
  }, [openedSlotId, teams.length, phase, loadTeams]);

  // Auto-fetch scout when both teams selected and not yet loaded for this opponent.
  useEffect(() => {
    if (!openedSlotId || !selectedAwayId) return;
    if (scout && scout.opponentTeamId === selectedAwayId) return;
    if (selectedHomeId && selectedAwayId && selectedHomeId !== selectedAwayId) {
      void loadScout(openedSlotId, selectedAwayId);
    }
  }, [openedSlotId, selectedHomeId, selectedAwayId, scout, loadScout]);

  // Keyboard: Space toggles play/pause.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (phase === 'playing') pause();
        else if (phase === 'replay-ready' || phase === 'paused') play();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, play, pause]);

  const awayTeam = useMemo(() => teams.find((t) => t.id === selectedAwayId) ?? null, [teams, selectedAwayId]);

  const canSimulate =
    !!selectedHomeId &&
    !!selectedAwayId &&
    selectedHomeId !== selectedAwayId &&
    (phase === 'select' || phase === 'ready-to-play');

  const isPlaying = phase === 'playing';
  const showReplayControls = match !== null && (phase === 'replay-ready' || phase === 'playing' || phase === 'paused' || phase === 'done');

  if (!openedSlotId) return null;

  return (
    <section aria-labelledby="match-hub-heading" className="match-hub">
      <header className="match-hub__header">
        <h1 id="match-hub-heading">Match Hub</h1>
        <p className="match-hub__sub" data-testid="match-status">
          {phaseLabel(phase)}
        </p>
      </header>

      <div className="match-hub__pickers" role="group" aria-label="Team selection">
        <label>
          <span>Home</span>
          <select
            value={selectedHomeId ?? ''}
            onChange={(e) => setHomeTeam(e.target.value)}
            aria-label="Home team"
          >
            <option value="">Select home team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.schoolName} ({t.abbr})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Away</span>
          <select
            value={selectedAwayId ?? ''}
            onChange={(e) => setAwayTeam(e.target.value)}
            aria-label="Away team"
          >
            <option value="">Select away team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.schoolName} ({t.abbr})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            if (openedSlotId) void simulateAndLoad(openedSlotId);
          }}
          disabled={!canSimulate}
        >
          {phase === 'simulating' || phase === 'loading-replay' ? 'Loading…' : 'Play match'}
        </button>
        {(phase === 'replay-ready' || phase === 'paused' || phase === 'done') && (
          <button type="button" onClick={() => reset()}>
            New match
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      {scout && awayTeam && (
        <ScoutPanel scout={scout} awayName={awayTeam.schoolName} />
      )}

      {showReplayControls && match && (
        <>
          <div className="match-hub__replay-controls" role="group" aria-label="Replay controls">
            <button
              type="button"
              onClick={() => (isPlaying ? pause() : play())}
              aria-pressed={isPlaying}
              data-testid="play-toggle"
            >
              {isPlaying ? 'Pause' : phase === 'done' ? 'Done' : 'Play'}
            </button>
            <fieldset className="match-hub__speed" data-testid="speed-control">
              <legend>Speed</legend>
              {SPEEDS.map((s) => (
                <label key={s}>
                  <input
                    type="radio"
                    name="match-speed"
                    value={s}
                    checked={speed === s}
                    onChange={() => setSpeedAction(s)}
                  />
                  {s}
                </label>
              ))}
            </fieldset>
            <button type="button" onClick={() => finishInstantly()} disabled={phase === 'done'}>
              Skip to end
            </button>
          </div>

          <Scoreboard
            match={match}
            scoreHome={scoreHome}
            scoreAway={scoreAway}
            setIndex={setIndex}
            setHomeScores={setHomeScores}
            setAwayScores={setAwayScores}
          />

          {banner && (
            <div role="alert" className="match-hub__banner" data-testid="match-banner">
              {banner.text}
            </div>
          )}

          <Ticker entries={visibleTicker} match={match} />

          {phase === 'done' && (
            <div className="match-hub__results">
              <h2>
                {match.home.teamName} {match.boxScore.homeSetsWon} — {match.boxScore.awaySetsWon}{' '}
                {match.away.teamName}
              </h2>
              <div className="match-hub__boxscore-wrap">
                <TeamBoxScore name={match.home.teamName} box={match.boxScore.home} />
                <TeamBoxScore name={match.away.teamName} box={match.boxScore.away} />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case 'select': return 'Select two teams.';
    case 'loading-teams': return 'Loading teams…';
    case 'loading-scout': return 'Loading scout report…';
    case 'ready-to-play': return 'Ready to play.';
    case 'simulating': return 'Simulating…';
    case 'loading-replay': return 'Loading replay…';
    case 'replay-ready': return 'Replay ready. Click Play.';
    case 'playing': return 'Playing…';
    case 'paused': return 'Paused.';
    case 'done': return 'Match complete.';
    case 'error': return 'Error.';
    default: return phase;
  }
}

function ScoutPanel(props: {
  scout: { opponentName: string; opponentAbbr: string; system: string; topHitters: { playerId: string; playerName: string; position: string; killsPerSet: number }[]; recentForm: { matchId: string; result: 'W' | 'L' }[] };
  awayName: string;
}) {
  const { scout } = props;
  return (
    <section className="match-hub__scout" aria-label="Scout report">
      <h2>Scout — {scout.opponentName}</h2>
      <dl>
        <dt>System</dt>
        <dd>{scout.system}</dd>
        <dt>Recent form</dt>
        <dd>
          {scout.recentForm.length === 0 ? (
            <span>No prior matches.</span>
          ) : (
            scout.recentForm.map((m) => (
              <span
                key={m.matchId}
                className={m.result === 'W' ? 'match-hub__form-w' : 'match-hub__form-l'}
                aria-label={m.result === 'W' ? 'Win' : 'Loss'}
              >
                {m.result}
              </span>
            ))
          )}
        </dd>
      </dl>
      {scout.topHitters.length > 0 && (
        <table className="match-hub__scout-table">
          <caption>Top hitters</caption>
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Pos</th>
              <th scope="col">K/set</th>
            </tr>
          </thead>
          <tbody>
            {scout.topHitters.map((h) => (
              <tr key={h.playerId}>
                <td>{h.playerName}</td>
                <td>{h.position}</td>
                <td>{h.killsPerSet.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Scoreboard(props: {
  match: { home: { teamAbbr: string }; away: { teamAbbr: string }; sets: { index: number; home: number; away: number; durationSec: number }[] };
  scoreHome: number;
  scoreAway: number;
  setIndex: number;
  setHomeScores: number[];
  setAwayScores: number[];
}) {
  const completedSets = props.setHomeScores.length;
  const maxDuration = Math.max(1, ...props.match.sets.map((s) => s.durationSec));
  return (
    <section className="match-hub__scoreboard" aria-label="Scoreboard">
      <table>
        <caption>Set scores</caption>
        <thead>
          <tr>
            <th scope="col">Team</th>
            {props.match.sets.map((s) => (
              <th scope="col" key={s.index}>S{s.index + 1}</th>
            ))}
            <th scope="col">Live</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{props.match.home.teamAbbr}</th>
            {props.match.sets.map((s, i) => (
              <td key={s.index}>{i < completedSets ? props.setHomeScores[i] : '—'}</td>
            ))}
            <td data-testid="live-home">{props.scoreHome}</td>
          </tr>
          <tr>
            <th scope="row">{props.match.away.teamAbbr}</th>
            {props.match.sets.map((s, i) => (
              <td key={s.index}>{i < completedSets ? props.setAwayScores[i] : '—'}</td>
            ))}
            <td data-testid="live-away">{props.scoreAway}</td>
          </tr>
        </tbody>
      </table>
      <div className="match-hub__rally-bars" aria-label="Rally durations">
        {props.match.sets.map((s) => (
          <div
            key={s.index}
            className="match-hub__rally-bar"
            style={{ width: `${(s.durationSec / maxDuration) * 100}%` }}
            title={`Set ${s.index + 1} — ${s.durationSec}s`}
          />
        ))}
      </div>
    </section>
  );
}

function Ticker(props: {
  entries: { kind: string; setIndex: number; rallyIndex?: number; event?: sim.RallyEvent }[];
  match: { home: { lineupSlots: string[]; teamName: string }; away: { lineupSlots: string[]; teamName: string } };
}) {
  const lineup: sim.FormatLineup = {
    home: props.match.home.lineupSlots,
    away: props.match.away.lineupSlots,
    homeTeamName: props.match.home.teamName,
    awayTeamName: props.match.away.teamName,
  };
  return (
    <ol className="match-hub__ticker" aria-label="Play-by-play" data-testid="ticker">
      {props.entries.map((entry, idx) => (
        <li key={idx}>
          {entry.kind === 'event' && entry.event ? (
            <span>S{entry.setIndex + 1} R{entry.rallyIndex !== undefined ? entry.rallyIndex + 1 : '?'}: {sim.formatRallyEvent(entry.event, lineup)}</span>
          ) : entry.kind === 'timeout' ? (
            <span>— TIMEOUT —</span>
          ) : entry.kind === 'substitution' ? (
            <span>— SUB —</span>
          ) : entry.kind === 'set_break' ? (
            <span>— END OF SET {entry.setIndex + 1} —</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function TeamBoxScore(props: {
  name: string;
  box: sim.TeamBoxScore;
}) {
  return (
    <table className="match-hub__boxscore">
      <caption>{props.name}</caption>
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">K</th>
          <th scope="col">E</th>
          <th scope="col">TA</th>
          <th scope="col">Hit%</th>
          <th scope="col">A</th>
          <th scope="col">SA</th>
          <th scope="col">SE</th>
          <th scope="col">RE</th>
          <th scope="col">D</th>
          <th scope="col">BS</th>
          <th scope="col">BA</th>
        </tr>
      </thead>
      <tbody>
        {props.box.players.map((p) => (
          <tr key={p.slotIndex}>
            <td>{p.slotIndex + 1}</td>
            <td>{p.kills}</td>
            <td>{p.errors}</td>
            <td>{p.totalAttacks}</td>
            <td>{fmtHit(p.hittingPctMilli)}</td>
            <td>{p.assists}</td>
            <td>{p.serviceAces}</td>
            <td>{p.serviceErrors}</td>
            <td>{p.receptionErrors}</td>
            <td>{p.digs}</td>
            <td>{p.blockSolos}</td>
            <td>{p.blockAssists}</td>
          </tr>
        ))}
        <tr className="match-hub__totals">
          <th scope="row">Total</th>
          <td>{props.box.totals.kills}</td>
          <td>{props.box.totals.errors}</td>
          <td>{props.box.totals.totalAttacks}</td>
          <td>{fmtHit(props.box.totals.hittingPctMilli)}</td>
          <td>{props.box.totals.assists}</td>
          <td>{props.box.totals.serviceAces}</td>
          <td>{props.box.totals.serviceErrors}</td>
          <td>{props.box.totals.receptionErrors}</td>
          <td>{props.box.totals.digs}</td>
          <td>{props.box.totals.blockSolos}</td>
          <td>{props.box.totals.blockAssists}</td>
        </tr>
      </tbody>
    </table>
  );
}
