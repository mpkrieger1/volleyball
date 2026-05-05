// Sprint 19: polished Match Hub. Scout panel, paced PBP ticker, set-by-set
// scoreboard with rally-duration bars, timeout/sub banners, final box score.
// Sprint 27 (Task 27.2): locked to user-team matches when userTeamId is
// known. Dual-team picker is preserved as a fallback for legacy saves
// where userTeamId is null (Sprint 21 user-team-picker hadn't fired).

import { useEffect, useMemo, useState } from 'react';
import { sim } from '@vcd/shared';
import { useMatchHubStore } from '../store/useMatchHubStore';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useUserTeamStore } from '../store/useUserTeamStore';
import { useScheduleStore } from '../store/useScheduleStore';
import { useLivePlayStore } from '../store/useLivePlayStore';
import { useNavStore } from '../store/useNavStore';
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
  // Sprint 26 (Tasks 26.2 + 26.6): paused-replay coach controls.
  const homeTimeoutsRemaining = useMatchHubStore((s) => s.homeTimeoutsRemaining);
  const awayTimeoutsRemaining = useMatchHubStore((s) => s.awayTimeoutsRemaining);
  const injectUserTimeout = useMatchHubStore((s) => s.injectUserTimeout);
  const injectUserSub = useMatchHubStore((s) => s.injectUserSub);
  const userSubs = useMatchHubStore((s) => s.userSubs);
  // Sprint 27 (Task 27.2): user-team-locked match picker.
  const loadMatchForReplay = useMatchHubStore((s) => s.loadMatchForReplay);
  const userTeamId = useUserTeamStore((s) => s.userTeamId);
  const scheduleRows = useScheduleStore((s) => s.rows);
  const scheduleStatus = useScheduleStore((s) => s.status);
  const selectScheduleTeam = useScheduleStore((s) => s.selectTeam);

  useEffect(() => {
    if (openedSlotId && teams.length === 0 && phase === 'select') {
      void loadTeams(openedSlotId);
    }
  }, [openedSlotId, teams.length, phase, loadTeams]);

  // Sprint 27 (Task 27.2): when the Hub mounts and the user has a team,
  // load that team's schedule so the match list can render.
  useEffect(() => {
    if (!openedSlotId || !userTeamId) return;
    if (scheduleStatus === 'idle' || scheduleStatus === 'ready') {
      // Selecting the user's team also populates `rows` for them.
      void selectScheduleTeam(openedSlotId, userTeamId);
    }
  }, [openedSlotId, userTeamId, scheduleStatus, selectScheduleTeam]);

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

      {/* Retro fix #2: Resume Live banner */}
      <ResumeLiveBanner slotId={openedSlotId} />


      {userTeamId && (phase === 'select' || phase === 'loading-teams' || phase === 'ready-to-play' || phase === 'loading-scout') && (
        <UserTeamMatchList
          rows={scheduleRows}
          userTeamId={userTeamId}
          teams={teams}
          onSimulate={(opp, isUserHome) => {
            if (!openedSlotId) return;
            const home = isUserHome ? userTeamId : opp;
            const away = isUserHome ? opp : userTeamId;
            setHomeTeam(home);
            setAwayTeam(away);
          }}
          onPlayLive={async (opp, isUserHome) => {
            // Sprint 37 (post-launch UAT): "Play" on an unplayed match
            // routes to LivePlayHub (the Sprint 29-31 live UI). The old
            // instant-simulate path moved to a separate "Quick Sim"
            // button for users who don't want rally-by-rally play.
            if (!openedSlotId) return;
            const homeId = isUserHome ? userTeamId : opp.opponentId;
            const awayId = isUserHome ? opp.opponentId : userTeamId;
            const userTeam = teams.find((t) => t.id === userTeamId);
            const myName = userTeam?.schoolName ?? 'My Team';
            const oppName = opp.opponentSchool;
            const homeName = isUserHome ? myName : oppName;
            const awayName = isUserHome ? oppName : myName;
            await useLivePlayStore
              .getState()
              .startNewMatch(openedSlotId, homeId, awayId, homeName, awayName);
            useNavStore.getState().setScreen('live-play');
          }}
          onReplay={(matchId) => {
            if (!openedSlotId) return;
            void loadMatchForReplay(openedSlotId, matchId);
          }}
          phase={phase}
          openedSlotId={openedSlotId}
          simulateAndLoad={simulateAndLoad}
        />
      )}

      {!userTeamId && (
        <div className="match-hub__pickers" role="group" aria-label="Team selection (legacy)">
          <p className="match-hub__sub" data-testid="legacy-picker-banner">
            No user team is set on this save. Pick your team from the Hub
            for the proper experience. (This dual-team picker is a legacy
            fallback for pre-Sprint-21 saves.)
          </p>
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
      )}

      {(phase === 'replay-ready' || phase === 'paused' || phase === 'done') && userTeamId && (
        <div className="match-hub__pickers" role="group" aria-label="Match controls">
          <button type="button" onClick={() => reset()}>
            Back to match list
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      {scout && awayTeam && (
        <ScoutPanel scout={scout} awayName={awayTeam.schoolName} />
      )}

      {/* Sprint 29 Task 29.4: Play (Live) launcher. Shows when both teams are
          selected and we haven't already kicked off a sim/replay. */}
      {selectedHomeId && selectedAwayId && selectedHomeId !== selectedAwayId &&
       (phase === 'select' || phase === 'ready-to-play') && openedSlotId && (
        <PlayLiveButton
          slotId={openedSlotId}
          homeTeamId={selectedHomeId}
          awayTeamId={selectedAwayId}
          homeName={teams.find((t) => t.id === selectedHomeId)?.schoolName ?? 'Home'}
          awayName={teams.find((t) => t.id === selectedAwayId)?.schoolName ?? 'Away'}
        />
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

          {phase === 'paused' && (
            <CoachPanel
              homeAbbr={match.home.teamAbbr}
              awayAbbr={match.away.teamAbbr}
              homeTimeoutsRemaining={homeTimeoutsRemaining}
              awayTimeoutsRemaining={awayTimeoutsRemaining}
              homeLineup={match.home.lineupSlots}
              awayLineup={match.away.lineupSlots}
              userSubs={userSubs}
              onTimeout={(side) => injectUserTimeout(side)}
              onSub={(side, slot, playerId) => injectUserSub(side, slot, playerId)}
            />
          )}

          <Ticker entries={visibleTicker} match={match} />

          {phase === 'done' && (
            <div className="match-hub__results">
              <h2>
                {match.home.teamName} {match.boxScore.homeSetsWon} — {match.boxScore.awaySetsWon}{' '}
                {match.away.teamName}
              </h2>
              <div className="match-hub__boxscore-wrap">
                <TeamBoxScore
                  name={match.home.teamName}
                  box={match.boxScore.home}
                  lineupSlots={match.home.lineupSlots}
                />
                <TeamBoxScore
                  name={match.away.teamName}
                  box={match.boxScore.away}
                  lineupSlots={match.away.lineupSlots}
                />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/**
 * Sprint 27 (Task 27.2): user-team-locked match list. Replaces the legacy
 * dual-team picker for any save where Season.userTeamId is set.
 *
 * Lists the user team's matches grouped by date. Unplayed matches show a
 * "Play match" CTA → simulates with the user team as home or away
 * depending on `isHome`. Played matches show a "Replay" CTA → loads the
 * existing PBP/box-score via getById without re-simulating.
 */
function UserTeamMatchList(props: {
  rows: Array<{
    matchId: string;
    weekIndex: number;
    isoDate: string;
    opponentId: string;
    opponentSchool: string;
    opponentAbbr: string;
    isHome: boolean;
    isConference: boolean;
    isTournament: boolean;
    winnerId: string | null;
  }>;
  userTeamId: string;
  teams: Array<{ id: string; schoolName: string; abbr: string }>;
  onSimulate: (opponentId: string, isUserHome: boolean) => void;
  onPlayLive: (
    row: { opponentId: string; opponentSchool: string; matchId: string },
    isUserHome: boolean,
  ) => Promise<void> | void;
  onReplay: (matchId: string) => void;
  phase: string;
  openedSlotId: string;
  simulateAndLoad: (slotId: string, seed?: string) => Promise<void>;
}) {
  const userTeam = props.teams.find((t) => t.id === props.userTeamId);
  const userTeamName = userTeam?.schoolName ?? 'Your team';
  if (props.rows.length === 0) {
    return (
      <div className="match-hub__user-team-list" data-testid="user-team-match-list">
        <p className="match-hub__sub">
          No matches scheduled for {userTeamName} yet — the schedule
          auto-generates when you start the regular season from the Hub.
        </p>
      </div>
    );
  }
  // Unplayed matches first (the "what to play next" use-case), then a
  // recent-results section.
  const unplayed = props.rows.filter((r) => r.winnerId === null);
  const played = props.rows.filter((r) => r.winnerId !== null).slice(-5).reverse();
  const isLoading = props.phase === 'simulating' || props.phase === 'loading-replay';
  return (
    <div className="match-hub__user-team-list" data-testid="user-team-match-list">
      <h2 className="match-hub__list-h2">Your matches</h2>
      {unplayed.length > 0 && (
        <section className="match-hub__list-section" aria-label="Upcoming matches">
          <h3 className="match-hub__list-h3">Upcoming</h3>
          <ul className="match-hub__list">
            {unplayed.slice(0, 6).map((r) => (
              <li key={r.matchId} className="match-hub__list-item">
                <span className="match-hub__list-date">{r.isoDate}</span>
                <span className="match-hub__list-opp">
                  {r.isHome ? 'vs' : '@'} {r.opponentSchool}
                  <span className="match-hub__list-tag">
                    {' '}
                    {r.isTournament ? 'TRN' : r.isConference ? 'conf' : 'nc'}
                  </span>
                </span>
                <span className="match-hub__list-actions">
                  <button
                    type="button"
                    className="ui-btn ui-btn--primary"
                    data-testid={`play-match-${r.matchId}`}
                    disabled={isLoading}
                    onClick={() =>
                      void props.onPlayLive(
                        {
                          opponentId: r.opponentId,
                          opponentSchool: r.opponentSchool,
                          matchId: r.matchId,
                        },
                        r.isHome,
                      )
                    }
                    title="Play this match live, rally-by-rally, with full coach controls"
                  >
                    {isLoading ? 'Loading…' : 'Play Live'}
                  </button>
                  <button
                    type="button"
                    className="ui-btn"
                    data-testid={`sim-match-${r.matchId}`}
                    disabled={isLoading}
                    onClick={() => {
                      props.onSimulate(r.opponentId, r.isHome);
                      queueMicrotask(() => {
                        void props.simulateAndLoad(props.openedSlotId);
                      });
                    }}
                    title="Quick-simulate the match and watch the replay"
                  >
                    Quick Sim
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {played.length > 0 && (
        <section className="match-hub__list-section" aria-label="Recent results">
          <h3 className="match-hub__list-h3">Recent</h3>
          <ul className="match-hub__list">
            {played.map((r) => (
              <li key={r.matchId} className="match-hub__list-item">
                <span className="match-hub__list-date">{r.isoDate}</span>
                <span className="match-hub__list-opp">
                  {r.isHome ? 'vs' : '@'} {r.opponentSchool}
                  <span className="match-hub__list-tag">
                    {' '}
                    {r.winnerId === props.userTeamId ? 'W' : 'L'}
                  </span>
                </span>
                <button
                  type="button"
                  data-testid={`replay-match-${r.matchId}`}
                  disabled={isLoading}
                  onClick={() => props.onReplay(r.matchId)}
                >
                  Replay
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Sprint 26 (Tasks 26.2 + 26.6): Coach control panel visible during paused
 * replay. Lets the user call cosmetic timeouts and substitutions.
 *
 * Both controls are REPLAY-ONLY: nothing is persisted to the database, and
 * match outcomes are not affected. The bench list is read off the lineup
 * slots: positions 0..5 are on-court starters; we don't yet model the
 * actual roster bench in the match hub payload, so the "Bench" section
 * shows a deferred-message in v1.0 and the swap dropdown lists the OTHER
 * SIDE's slot players as a stand-in for "alternate players to swap in."
 * v1.1 work: surface a real bench list from `useUserTeamStore` once the
 * Match Hub is locked to user-team matches per Sprint 27 Task 27.2.
 */
function CoachPanel(props: {
  homeAbbr: string;
  awayAbbr: string;
  homeTimeoutsRemaining: number;
  awayTimeoutsRemaining: number;
  homeLineup: readonly string[];
  awayLineup: readonly string[];
  userSubs: Array<{ side: 'home' | 'away'; slotIndex: number }>;
  onTimeout: (side: 'home' | 'away') => boolean;
  onSub: (side: 'home' | 'away', slotIndex: number, incomingPlayerId: string) => boolean;
}) {
  return (
    <section className="match-hub__coach-panel" aria-label="Coach controls (paused)">
      <h3 className="match-hub__coach-panel-h3">Coach controls</h3>
      <div className="match-hub__coach-panel-row">
        <div className="match-hub__timeout-controls" role="group" aria-label="Call timeout">
          <span className="match-hub__coach-panel-label">Timeouts</span>
          <button
            type="button"
            disabled={props.homeTimeoutsRemaining <= 0}
            onClick={() => props.onTimeout('home')}
            data-testid="timeout-home"
          >
            {props.homeAbbr} timeout
            <span className="match-hub__timeout-count" aria-hidden="true">
              {' '}({props.homeTimeoutsRemaining} left)
            </span>
          </button>
          <button
            type="button"
            disabled={props.awayTimeoutsRemaining <= 0}
            onClick={() => props.onTimeout('away')}
            data-testid="timeout-away"
          >
            {props.awayAbbr} timeout
            <span className="match-hub__timeout-count" aria-hidden="true">
              {' '}({props.awayTimeoutsRemaining} left)
            </span>
          </button>
        </div>
      </div>

      <div className="match-hub__lineup-panel" data-testid="lineup-panel">
        <span className="match-hub__coach-panel-label">Lineup (paused) — slot/position</span>
        <CoachLineupSide
          side="home"
          abbr={props.homeAbbr}
          lineup={props.homeLineup}
          userSubs={props.userSubs.filter((s) => s.side === 'home')}
          onSub={(slot, pid) => props.onSub('home', slot, pid)}
        />
        <CoachLineupSide
          side="away"
          abbr={props.awayAbbr}
          lineup={props.awayLineup}
          userSubs={props.userSubs.filter((s) => s.side === 'away')}
          onSub={(slot, pid) => props.onSub('away', slot, pid)}
        />
        <p className="match-hub__coach-panel-note">
          Note: timeouts and substitutions during replay are visual only.
          They do not change the simulated match outcome.
        </p>
      </div>
    </section>
  );
}

function CoachLineupSide(props: {
  side: 'home' | 'away';
  abbr: string;
  lineup: readonly string[];
  userSubs: Array<{ slotIndex: number }>;
  onSub: (slotIndex: number, incomingPlayerId: string) => boolean;
}) {
  const LIBERO_SLOT = 5;
  return (
    <div className="match-hub__lineup-side" data-testid={`lineup-side-${props.side}`}>
      <strong>{props.abbr}</strong>
      <ol className="match-hub__lineup-slots" aria-label={`${props.abbr} on-court slots`}>
        {props.lineup.map((name, i) => {
          const swapped = props.userSubs.some((s) => s.slotIndex === i);
          const isLibero = i === LIBERO_SLOT;
          return (
            <li key={i} className="match-hub__lineup-slot">
              <span className="match-hub__lineup-slot-label">P{i + 1}</span>
              <span className="match-hub__lineup-slot-name">{name}</span>
              {isLibero ? (
                <span className="match-hub__lineup-slot-disabled" title="Libero subs follow special rules — coming in v1.1">
                  Libero
                </span>
              ) : (
                <button
                  type="button"
                  className="match-hub__lineup-slot-swap"
                  onClick={() => props.onSub(i, `bench-${props.side}-${i}`)}
                  data-testid={`sub-${props.side}-${i}`}
                  aria-label={`Substitute ${props.abbr} P${i + 1} (${name})`}
                >
                  {swapped ? 'Swapped' : 'Swap'}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
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

// Retro fix #2: Resume Live banner. Queries the DB for matches with
// non-null liveStateJson on mount and surfaces a Resume button per match.
function ResumeLiveBanner({ slotId }: { slotId: string }) {
  const [paused, setPaused] = useState<Array<{
    matchId: string;
    homeTeamName: string;
    awayTeamName: string;
    setIndex: number;
    homeScore: number;
    awayScore: number;
    setsHome: number;
    setsAway: number;
  }>>([]);
  const resumeMatch = useLivePlayStore((s) => s.resumeMatch);
  const setScreen = useNavStore((s) => s.setScreen);
  const refreshTick = useLivePlayStore((s) => s.phase); // re-query when live phase changes

  useEffect(() => {
    let cancelled = false;
    void window.vcd.match.live.listPaused(slotId).then((res) => {
      if (cancelled) return;
      if (res.ok) setPaused(res.matches);
    });
    return () => { cancelled = true; };
  }, [slotId, refreshTick]);

  if (paused.length === 0) return null;
  return (
    <div role="region" aria-labelledby="resume-live-heading" className="match-hub__resume-banner">
      <h2 id="resume-live-heading">Resume paused match{paused.length > 1 ? 'es' : ''}</h2>
      <ul>
        {paused.map((m) => (
          <li key={m.matchId}>
            <span>
              {m.homeTeamName} {m.setsHome} – {m.setsAway} {m.awayTeamName}
              {' · '}
              Set {m.setIndex + 1}: {m.homeScore}–{m.awayScore}
            </span>
            <button
              type="button"
              onClick={async () => {
                await resumeMatch(slotId, m.matchId, m.homeTeamName, m.awayTeamName);
                setScreen('live-play');
              }}
            >
              Resume Live
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlayLiveButton(props: {
  slotId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeName: string;
  awayName: string;
}) {
  const startNewMatch = useLivePlayStore((s) => s.startNewMatch);
  const setScreen = useNavStore((s) => s.setScreen);
  const phase = useLivePlayStore((s) => s.phase);
  const onClick = async () => {
    await startNewMatch(
      props.slotId,
      props.homeTeamId,
      props.awayTeamId,
      props.homeName,
      props.awayName,
    );
    setScreen('live-play');
  };
  return (
    <div className="match-hub__live-launch" role="group" aria-label="Live play">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={phase === 'starting'}
        title="Play this match live, rally by rally, with full coach control."
      >
        {phase === 'starting' ? 'Starting…' : 'Play (Live)'}
      </button>
    </div>
  );
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
  // Sprint 26 (Task 26.1): match-level set tally derived from completed-set
  // scores. Visible during replay so the user can see "Sets: 2 — 1" macro
  // state without waiting for the final box score.
  let matchSetHome = 0;
  let matchSetAway = 0;
  for (let i = 0; i < completedSets; i++) {
    const h = props.setHomeScores[i] ?? 0;
    const a = props.setAwayScores[i] ?? 0;
    if (h > a) matchSetHome += 1;
    else if (a > h) matchSetAway += 1;
  }
  return (
    <section className="match-hub__scoreboard" aria-label="Scoreboard">
      <div className="match-hub__sets-tally" aria-label="Match-level set tally" data-testid="sets-tally">
        <span className="match-hub__sets-tally-label">Sets won</span>
        <span className="match-hub__sets-tally-score">
          <strong data-testid="sets-tally-home">{matchSetHome}</strong>
          <span aria-hidden="true"> — </span>
          <strong data-testid="sets-tally-away">{matchSetAway}</strong>
        </span>
        <span className="match-hub__sets-tally-teams">
          {props.match.home.teamAbbr} — {props.match.away.teamAbbr}
        </span>
      </div>
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
  /** Sprint 37 (post-launch UAT): on-court player names indexed by slot. */
  lineupSlots?: readonly string[];
}) {
  return (
    <table className="match-hub__boxscore">
      <caption>{props.name}</caption>
      <thead>
        <tr>
          <th scope="col">Player</th>
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
        {props.box.players.map((p) => {
          const playerName = props.lineupSlots?.[p.slotIndex];
          return (
          <tr key={p.slotIndex}>
            <td>{playerName ?? `Slot ${p.slotIndex + 1}`}</td>
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
          );
        })}
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
