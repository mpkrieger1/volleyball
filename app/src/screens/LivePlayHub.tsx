// Sprint 29 Task 29.3: Live Play Hub — 4-pane layout.
// Sprint 30 Task 30.5: Coaching Strategy pane gains timeouts + subs +
// active-boost banner + opponent-action banner. Rotation editor lands
// in Sprint 31.

import { useEffect, useMemo, useState } from 'react';
import { sim } from '@vcd/shared';
import { useLivePlayStore } from '../store/useLivePlayStore';
import { useNavStore } from '../store/useNavStore';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useUserTeamStore } from '../store/useUserTeamStore';
import { useScheduleStore } from '../store/useScheduleStore';
import { SkillTalkModal } from '../components/SkillTalkModal';
import { SubPicker } from '../components/SubPicker';
import { RotationEditorModal } from '../components/RotationEditorModal';
import { RotationTracker } from '../components/livePlay/RotationTracker';
import { KeyRallyBanner } from '../components/livePlay/KeyRallyBanner';
import { QuitMatchDialog } from '../components/QuitMatchDialog';

function formatPbpEvent(ev: sim.RallyEvent): string {
  switch (ev.kind) {
    case 'serve':
      return `${ev.team.toUpperCase()} serve (slot ${ev.server + 1}, ${ev.quality})`;
    case 'reception':
      return `${ev.team.toUpperCase()} reception (slot ${ev.receiver + 1}, grade ${ev.grade})`;
    case 'set':
      return `${ev.team.toUpperCase()} set (slot ${ev.setter + 1}, ${ev.quality})`;
    case 'attack':
      return `${ev.team.toUpperCase()} attack (slot ${ev.attacker + 1}, ${ev.outcome})`;
    case 'dig':
      return `${ev.team.toUpperCase()} dig (slot ${ev.digger + 1}, grade ${ev.grade})`;
    case 'point':
      return `→ POINT to ${ev.winner.toUpperCase()} (${ev.reason})`;
  }
}

export function LivePlayHub() {
  const phase = useLivePlayStore((s) => s.phase);
  const state = useLivePlayStore((s) => s.state);
  const homeName = useLivePlayStore((s) => s.homeName);
  const awayName = useLivePlayStore((s) => s.awayName);
  const pausedFor = useLivePlayStore((s) => s.pausedFor);
  const error = useLivePlayStore((s) => s.error);
  const playRallies = useLivePlayStore((s) => s.playRallies);
  const playToSetEnd = useLivePlayStore((s) => s.playToSetEnd);
  const playToMatchEnd = useLivePlayStore((s) => s.playToMatchEnd);
  const pause = useLivePlayStore((s) => s.pause);
  const simulateRest = useLivePlayStore((s) => s.simulateRest);
  const reset = useLivePlayStore((s) => s.reset);
  const callTimeout = useLivePlayStore((s) => s.callTimeout);
  const substitute = useLivePlayStore((s) => s.substitute);
  const setRotation = useLivePlayStore((s) => s.setRotation);
  const setScreen = useNavStore((s) => s.setScreen);

  // Sprint 30 Task 30.5 + Sprint 31 Task 31.1: modal state.
  const [showSkillTalk, setShowSkillTalk] = useState(false);
  const [showSubPicker, setShowSubPicker] = useState(false);
  const [showRotationEditor, setShowRotationEditor] = useState(false);
  // Retro fix #1: quit dialog state.
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  // Retro fix #8: rotation-seen state lives in store so it survives nav away/back.
  const seenRotationForSet = useLivePlayStore((s) => s.rotationEditorSeenForSet);
  const markRotationEditorSeen = useLivePlayStore((s) => s.markRotationEditorSeen);

  // Sprint 30 Task 30.5 + Sprint 31 Task 31.1: keyboard shortcuts T (timeout) /
  // S (sub) / R (rotation editor) when not focused on an input.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (showSkillTalk || showSubPicker || showRotationEditor) return;
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setShowSkillTalk(true);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setShowSubPicker(true);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setShowRotationEditor(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSkillTalk, showSubPicker, showRotationEditor]);

  // Sprint 31 Task 31.1: auto-open rotation editor at set boundaries.
  // Triggers when (set hasn't been seen yet AND rallyIdxInSet === 0 AND
  // user team is set). Skip if user already saved a rotation for this set
  // (detected via coachActionLog last entry kind === 'rotation' for this setIndex).
  const state31 = useLivePlayStore((s) => s.state);
  useEffect(() => {
    if (!state31 || state31.userTeam === 'none') return;
    const idx = state31.currentSet.index;
    if (state31.currentSet.rallyIdxInSet !== 0) return;
    if (seenRotationForSet >= idx) return;
    if (showRotationEditor || showSkillTalk || showSubPicker) return;
    setShowRotationEditor(true);
    markRotationEditorSeen(idx);
  }, [state31, seenRotationForSet, showRotationEditor, showSkillTalk, showSubPicker, markRotationEditorSeen]);

  // Last 30 events from current set's most recent rallies.
  const recentEvents = useMemo(() => {
    if (!state) return [] as sim.RallyEvent[];
    const out: sim.RallyEvent[] = [];
    // Walk current set's rallies in reverse, then the latest completed set
    // if current set has fewer than 30 events.
    const sets = [state.currentSet, ...[...state.completedSets].reverse()];
    for (const s of sets) {
      const ralliesArray = 'rallies' in s ? s.rallies : [];
      for (let i = ralliesArray.length - 1; i >= 0; i--) {
        const r = ralliesArray[i]!;
        for (let j = r.events.length - 1; j >= 0; j--) {
          out.push(r.events[j]!);
          if (out.length >= 30) return out.reverse();
        }
      }
      if (out.length >= 30) break;
    }
    return out.reverse();
  }, [state]);

  // Cleanup on unmount: dispose registry entry.
  useEffect(() => {
    return () => {
      // Don't reset if user navigated away mid-match — keep state.
      // Sprint 29 minimal: always reset (will be replaced by quit dialog).
      // For now, leave state in place so revisit works.
    };
  }, []);

  const onClose = () => {
    // Retro fix #1: if a match is in progress (state exists, not finished),
    // intercept with the 3-way dialog. Otherwise (idle/finished) just close.
    const s = useLivePlayStore.getState().state;
    if (s && s.status === 'in_progress') {
      setShowQuitDialog(true);
      return;
    }
    void reset();
    setScreen('match-hub');
  };

  if (phase === 'idle') {
    return <LivePlayIdleScreen />;
  }

  if (phase === 'starting') {
    return (
      <section className="live-play-hub" aria-busy="true">
        <h1>Live Play</h1>
        <p>Starting live match…</p>
      </section>
    );
  }

  if (phase === 'error') {
    return (
      <section className="live-play-hub" aria-labelledby="live-play-heading">
        <h1 id="live-play-heading">Live Play</h1>
        <p role="alert" className="live-play-hub__error">Error: {error}</p>
        <button type="button" onClick={onClose}>Back to Match Hub</button>
      </section>
    );
  }

  if (!state) {
    return (
      <section className="live-play-hub">
        <h1>Live Play</h1>
        <p>No state loaded.</p>
      </section>
    );
  }

  const isPlaying = phase === 'playing';
  const isFinished = phase === 'finished';
  const home = state.home.lineup;
  const away = state.away.lineup;
  const cs = state.currentSet;
  const homeBox = computeLiveBox(state, 'home');

  return (
    <section className="live-play-hub" aria-labelledby="live-play-heading">
      <header className="live-play-hub__header">
        <h1 id="live-play-heading">
          Live Play — {homeName ?? 'Home'} vs. {awayName ?? 'Away'}
        </h1>
        <button type="button" onClick={onClose}>Close</button>
      </header>

      {/* Retro fix #9: dedicated key-rally banner with inline action buttons. */}
      {pausedFor === 'key_rally' && phase === 'paused' && (
        <KeyRallyBanner
          open={true}
          state={state}
          homeName={homeName ?? 'Home'}
          awayName={awayName ?? 'Away'}
          onContinue={() => {
            // Clear pausedFor by playing one rally — the next rally fires
            // and the banner condition no longer holds (set point will
            // transition to a point or stay; user can re-engage).
            void playRallies(1);
          }}
          onCallTimeout={() => {
            setShowSkillTalk(true);
          }}
        />
      )}
      {pausedFor && pausedFor !== 'key_rally' && phase === 'paused' && (
        <div role="status" className="live-play-hub__banner">
          Paused: {humanizePauseReason(pausedFor)}
        </div>
      )}

      <div className="live-play-hub__grid">
        {/* Top-left: PBP ticker */}
        <section className="live-play-hub__pane" aria-labelledby="pbp-pane-heading">
          <h2 id="pbp-pane-heading">Play-by-Play</h2>
          <ol className="live-play-hub__pbp">
            {recentEvents.map((ev, i) => (
              <li key={`${state.rallyCursor}:${i}`} className="live-play-hub__pbp-row">
                {formatPbpEvent(ev)}
              </li>
            ))}
            {recentEvents.length === 0 && <li>No rallies yet.</li>}
          </ol>
        </section>

        {/* Top-right: Scoreboard + match stats + momentum */}
        <section className="live-play-hub__pane" aria-labelledby="score-pane-heading">
          <h2 id="score-pane-heading">Scoreboard</h2>
          <div className="live-play-hub__sets">
            Sets: {homeName} {state.setsWon.home} — {state.setsWon.away} {awayName}
          </div>
          <div className="live-play-hub__current-score">
            <strong>Set {cs.index + 1}</strong> (to {cs.targetScore}):
            {' '}{homeName} <strong>{cs.home}</strong> — <strong>{cs.away}</strong> {awayName}
          </div>
          <p>Server: <strong>{state.server === 'home' ? homeName : awayName}</strong></p>
          <MomentumMeter
            homeName={homeName ?? 'Home'}
            awayName={awayName ?? 'Away'}
            homeMomentum={state.liveMomentum.home}
            awayMomentum={state.liveMomentum.away}
          />
          {isFinished && (
            <p className="live-play-hub__final" role="status">
              Final: {state.winner === 'home' ? homeName : awayName} wins {state.setsWon.home}–{state.setsWon.away}
            </p>
          )}
          {state.userTeam !== 'none' && (
            <RotationTracker
              rotation={(state.userTeam === 'home' ? state.home : state.away).rotation}
              libero={(state.userTeam === 'home' ? state.home : state.away).libero}
              nameForSlot={(slotIdx) => {
                const team = state.userTeam === 'home' ? state.home : state.away;
                const pid = team.playerIdsBySlot[slotIdx];
                if (!pid) return `Slot ${slotIdx + 1}`;
                const benchMatch = team.bench.find((b) => b.playerId === pid);
                if (benchMatch) return `${benchMatch.lastName || benchMatch.firstName || pid}`;
                return pid;
              }}
              teamLabel={state.userTeam === 'home' ? homeName ?? 'Home' : awayName ?? 'Away'}
            />
          )}
        </section>

        {/* Bottom-left: My team stats (per-player) */}
        <section className="live-play-hub__pane" aria-labelledby="team-stats-heading">
          <h2 id="team-stats-heading">{homeName} Stats</h2>
          <table className="live-play-hub__stats">
            <thead>
              <tr>
                <th>Player</th>
                <th>K</th>
                <th>E</th>
                <th>TA</th>
                <th>Hit%</th>
                <th>D</th>
              </tr>
            </thead>
            <tbody>
              {homeBox.map((row) => {
                // Sprint 37 (post-launch UAT): show on-court player names
                // pulled from `lineupNamesBySlot` (Sprint 37 schema add)
                // instead of slot indices.
                const name = state.home.lineupNamesBySlot[row.slotIndex];
                return (
                  <tr key={row.slotIndex}>
                    <td>{name && name !== '' ? name : `Slot ${row.slotIndex + 1}`}</td>
                    <td>{row.kills}</td>
                    <td>{row.errors}</td>
                    <td>{row.totalAttacks}</td>
                    <td>{(row.hittingPctMilli / 1000).toFixed(3)}</td>
                    <td>{row.digs}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Bottom-right: Coaching strategy */}
        <section className="live-play-hub__pane" aria-labelledby="coach-pane-heading">
          <h2 id="coach-pane-heading">Coaching Strategy</h2>
          <p className="live-play-hub__hint">Shortcuts: T = call timeout, S = substitute. Rotation editor lands in Sprint 31.</p>
          <div className="live-play-hub__sim-controls">
            <button type="button" onClick={() => void playRallies(1)} disabled={isPlaying || isFinished}>
              Next point
            </button>
            <button type="button" onClick={() => void playRallies(5)} disabled={isPlaying || isFinished}>
              Next 5
            </button>
            <button type="button" onClick={() => void playRallies(10)} disabled={isPlaying || isFinished}>
              Next 10
            </button>
            <button type="button" onClick={() => void playToSetEnd()} disabled={isPlaying || isFinished}>
              End of set
            </button>
            <button type="button" onClick={() => void playToMatchEnd()} disabled={isPlaying || isFinished}>
              End of match
            </button>
            {isPlaying && (
              <button type="button" onClick={() => void pause()}>Pause</button>
            )}
          </div>

          <hr />

          {/* Sprint 30 Task 30.1 + 30.5: Timeout section */}
          <section aria-labelledby="timeout-section-heading" className="live-play-hub__action-section">
            <h3 id="timeout-section-heading">Timeouts</h3>
            <p>
              TOs left this set: <strong>{(state.userTeam === 'away' ? state.timeoutsAway : state.timeoutsHome).remaining}/2</strong>
            </p>
            {state.activeBoost && (
              <p role="status" className="live-play-hub__boost-banner">
                Active boost: <strong>+5% {state.activeBoost.skill}</strong> ({state.activeBoost.pointsRemaining} pts left)
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowSkillTalk(true)}
              disabled={
                isPlaying ||
                isFinished ||
                state.userTeam === 'none' ||
                (state.userTeam === 'away' ? state.timeoutsAway.remaining : state.timeoutsHome.remaining) <= 0
              }
            >
              Call timeout (T)
            </button>
          </section>

          {/* Sprint 30 Task 30.3 + 30.5: Substitution section */}
          <section aria-labelledby="sub-section-heading" className="live-play-hub__action-section">
            <h3 id="sub-section-heading">Substitutions</h3>
            <p>
              Subs used this set: <strong>{state.userTeam === 'away' ? state.subsAway : state.subsHome}/15</strong>
            </p>
            <button
              type="button"
              onClick={() => setShowSubPicker(true)}
              disabled={
                isPlaying ||
                isFinished ||
                state.userTeam === 'none' ||
                (state.userTeam === 'away' ? state.subsAway : state.subsHome) >= 15
              }
            >
              Substitute (S)
            </button>
          </section>

          {/* Sprint 31 Task 31.4: Rotation summary + Edit button */}
          {state.userTeam !== 'none' && (
            <section aria-labelledby="rotation-section-heading" className="live-play-hub__action-section">
              <h3 id="rotation-section-heading">Rotation</h3>
              <p>
                System: <strong>{(state.userTeam === 'home' ? state.home : state.away).system?.system ?? '5-1'}</strong>
                {' · '}
                Hint: <strong style={{ textTransform: 'capitalize' }}>
                  {(state.userTeam === 'home' ? state.home : state.away).tacticalHint}
                </strong>
              </p>
              <button
                type="button"
                onClick={() => setShowRotationEditor(true)}
                disabled={isPlaying || isFinished || state.currentSet.rallyIdxInSet > 0}
                title={
                  state.currentSet.rallyIdxInSet > 0
                    ? 'Rotation can only be edited between sets'
                    : 'Open rotation editor (R)'
                }
              >
                Edit rotation (R)
              </button>
            </section>
          )}
          <hr />
          <div className="live-play-hub__quit-controls">
            <button type="button" onClick={() => void pause()} disabled={isFinished}>
              Pause + leave
            </button>
            <button type="button" onClick={() => void simulateRest()} disabled={isFinished}>
              Simulate rest
            </button>
          </div>
        </section>
      </div>

      {/* unused refs to silence linter */}
      <span hidden>{home.players.length}{away.players.length}</span>

      {/* Sprint 30 Task 30.5: Skill-talk modal (opens via Call Timeout / T key) */}
      <SkillTalkModal
        open={showSkillTalk}
        onConfirm={(skill) => {
          setShowSkillTalk(false);
          void callTimeout(skill);
        }}
        onSkip={() => {
          setShowSkillTalk(false);
          void callTimeout(undefined);
        }}
        onCancel={() => setShowSkillTalk(false)}
      />

      {/* Sprint 30 Task 30.5: Sub picker modal (opens via Substitute / S key) */}
      {state.userTeam !== 'none' && (
        <SubPicker
          open={showSubPicker}
          homeTeamName={(state.userTeam === 'home' ? homeName : awayName) ?? 'Team'}
          team={state.userTeam === 'home' ? state.home : state.away}
          liberoSlot={(state.userTeam === 'home' ? state.home.libero : state.away.libero)?.liberoIndex ?? -1}
          subsRemaining={15 - (state.userTeam === 'home' ? state.subsHome : state.subsAway)}
          onConfirm={(outIdx, inPlayerId) => {
            setShowSubPicker(false);
            void substitute(outIdx, inPlayerId);
          }}
          onCancel={() => setShowSubPicker(false)}
        />
      )}

      {/* Retro fix #1: Quit-mid-match dialog (Return / Pause / Sim Rest) */}
      <QuitMatchDialog
        open={showQuitDialog}
        onReturn={() => setShowQuitDialog(false)}
        onPause={async () => {
          setShowQuitDialog(false);
          await pause();
          reset();
          setScreen('match-hub');
        }}
        onSimRest={async () => {
          setShowQuitDialog(false);
          await simulateRest();
          reset();
          setScreen('match-hub');
        }}
      />

      {/* Sprint 31 Task 31.1: Rotation editor modal (auto-opens at set boundaries; R key) */}
      {state.userTeam !== 'none' && (
        <RotationEditorModal
          open={showRotationEditor}
          roster={(() => {
            const team = state.userTeam === 'home' ? state.home : state.away;
            // Combine current on-court (with placeholder bio) + bench.
            const onCourt = team.playerIdsBySlot.map((pid, i) => ({
              playerId: pid,
              firstName: '',
              lastName: pid || `Slot ${i + 1}`,
              position: 'OH',
              jersey: 0,
              isLibero: team.libero?.liberoIndex === i,
            }));
            return [...onCourt, ...team.bench.map((b) => ({
              playerId: b.playerId,
              firstName: b.firstName,
              lastName: b.lastName,
              position: b.position,
              jersey: b.jersey,
              isLibero: b.isLibero,
            }))];
          })()}
          suggestedSlots={(() => {
            const team = state.userTeam === 'home' ? state.home : state.away;
            return {
              P1: team.playerIdsBySlot[0],
              P2: team.playerIdsBySlot[1],
              P3: team.playerIdsBySlot[2],
              P4: team.playerIdsBySlot[3],
              P5: team.playerIdsBySlot[4],
              P6: team.playerIdsBySlot[5],
            };
          })()}
          defaults={{
            system: (state.userTeam === 'home' ? state.home : state.away).system?.system ?? '5-1',
            hint: (state.userTeam === 'home' ? state.home : state.away).tacticalHint,
          }}
          setIndex={state.currentSet.index}
          onConfirm={(req) => {
            setShowRotationEditor(false);
            void setRotation(req);
          }}
          onCancel={() => setShowRotationEditor(false)}
        />
      )}
    </section>
  );
}

function humanizePauseReason(reason: string): string {
  switch (reason) {
    case 'set_complete': return 'set complete';
    case 'match_complete': return 'match complete';
    case 'set_point': return 'set point';
    case 'momentum_swing': return 'momentum swing';
    case 'opponent_timeout': return 'opponent called timeout';
    case 'opponent_substitution': return 'opponent made a substitution';
    case 'key_rally': return 'key rally — set or match point';
    default: return reason;
  }
}

/**
 * Compute per-slot box-score lines from the live state's accumulated rallies.
 * Reuses the same applyEventsToFrame walker as workers.computeBoxScore.
 */
function computeLiveBox(state: sim.LiveMatchState, side: 'home' | 'away'): sim.PlayerBoxScore[] {
  const home = Array.from({ length: 6 }, (_, i): sim.PlayerBoxScore => ({
    slotIndex: i,
    kills: 0, errors: 0, totalAttacks: 0, hittingPctMilli: 0,
    assists: 0, serviceAces: 0, serviceErrors: 0, receptionErrors: 0,
    digs: 0, blockSolos: 0, blockAssists: 0, rotationMinutes: 0,
  }));
  const away = Array.from({ length: 6 }, (_, i): sim.PlayerBoxScore => ({
    slotIndex: i,
    kills: 0, errors: 0, totalAttacks: 0, hittingPctMilli: 0,
    assists: 0, serviceAces: 0, serviceErrors: 0, receptionErrors: 0,
    digs: 0, blockSolos: 0, blockAssists: 0, rotationMinutes: 0,
  }));
  for (const cs of state.completedSets) {
    for (const r of cs.rallies) sim.applyEventsToFrame(r.events, home, away);
  }
  for (const r of state.currentSet.rallies) sim.applyEventsToFrame(r.events, home, away);
  const rows = side === 'home' ? home : away;
  for (const row of rows) {
    row.hittingPctMilli = row.totalAttacks > 0
      ? Math.round(((row.kills - row.errors) / row.totalAttacks) * 1000)
      : 0;
  }
  return rows;
}


// Sprint 37 (post-launch UAT): idle-screen routing fix. The user's
// previous flow was "Hub → Match Hub → pick teams → click Play Live".
// That dumped them on the legacy MatchHub UI and they never saw the
// Sprint 29-31 live-play work. This screen now shows the user team's
// upcoming scheduled matches with a Play Live button per row, plus a
// secondary link to Match Hub for replays of past games.
function LivePlayIdleScreen() {
  const setScreen = useNavStore((s) => s.setScreen);
  const startNewMatch = useLivePlayStore((s) => s.startNewMatch);
  const livePhase = useLivePlayStore((s) => s.phase);
  const slotId = useSaveSlotsStore((s) => s.openedSlotId);
  const userTeamId = useUserTeamStore((s) => s.userTeamId);
  const teams = useScheduleStore((s) => s.teams);
  const rows = useScheduleStore((s) => s.rows);
  const selectedTeamId = useScheduleStore((s) => s.selectedTeamId);
  const selectTeam = useScheduleStore((s) => s.selectTeam);
  const loadTeams = useScheduleStore((s) => s.loadTeams);

  useEffect(() => {
    if (slotId && teams.length === 0) void loadTeams(slotId);
  }, [slotId, teams.length, loadTeams]);

  useEffect(() => {
    if (slotId && userTeamId && selectedTeamId !== userTeamId) {
      void selectTeam(slotId, userTeamId);
    }
  }, [slotId, userTeamId, selectedTeamId, selectTeam]);

  const userTeam = useMemo(
    () => (userTeamId ? teams.find((t) => t.id === userTeamId) ?? null : null),
    [userTeamId, teams],
  );

  const upcoming = useMemo(() => {
    return rows
      .filter((r) => r.winnerId === null && !r.isTournament)
      .slice(0, 5);
  }, [rows]);

  const onPlayLive = async (matchRow: typeof rows[number]) => {
    if (!slotId || !userTeamId) return;
    const opponent = teams.find((t) => t.id === matchRow.opponentId);
    const myName = userTeam?.schoolName ?? 'My Team';
    const oppName = opponent?.schoolName ?? matchRow.opponentSchool;
    const homeId = matchRow.isHome ? userTeamId : matchRow.opponentId;
    const awayId = matchRow.isHome ? matchRow.opponentId : userTeamId;
    const homeName = matchRow.isHome ? myName : oppName;
    const awayName = matchRow.isHome ? oppName : myName;
    await startNewMatch(slotId, homeId, awayId, homeName, awayName);
  };

  return (
    <section className="live-play-hub" aria-labelledby="live-play-heading">
      <h1 id="live-play-heading">Live Play</h1>
      {!slotId && <p>Open a save first.</p>}
      {slotId && !userTeamId && (
        <p>Pick your team from the Hub before starting a live match.</p>
      )}
      {slotId && userTeamId && upcoming.length === 0 && (
        <p>
          No upcoming scheduled matches. The schedule generates at the
          start of the regular season — finish preseason events first.
        </p>
      )}
      {slotId && userTeamId && upcoming.length > 0 && (
        <>
          <p className="live-play-hub__sub">
            Pick a scheduled match to play live, rally by rally — full
            coach controls (rotations, timeouts with skill talks, subs,
            momentum swings). NCAA-accurate: 2 timeouts per set per team.
          </p>
          <ul className="live-play-hub__upcoming">
            {upcoming.map((m) => (
              <li
                key={m.matchId}
                className="live-play-hub__upcoming-row"
                data-testid={`live-upcoming-${m.matchId}`}
              >
                <span className="live-play-hub__upcoming-week">
                  Wk {m.weekIndex + 1} · {m.isoDate}
                </span>
                <span className="live-play-hub__upcoming-opp">
                  {m.isHome ? 'vs' : '@'}{' '}
                  <strong>{m.opponentAbbr}</strong> {m.opponentSchool}
                  {m.opponentOverall !== null && (
                    <span className="live-play-hub__upcoming-ovr">
                      {' '}
                      · OVR {m.opponentOverall}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="ui-btn ui-btn--primary"
                  disabled={livePhase === 'starting'}
                  onClick={() => void onPlayLive(m)}
                  data-testid={`live-play-${m.matchId}`}
                >
                  {livePhase === 'starting' ? 'Starting…' : 'Play Live'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="live-play-hub__alt">
        Looking for a finished match?{' '}
        <button
          type="button"
          className="ui-btn ui-btn--link"
          onClick={() => setScreen('match-hub')}
        >
          Go to Match Hub for replays
        </button>
      </p>
    </section>
  );
}

// Sprint 37 (post-launch UAT): visual momentum meter. Shows where
// momentum sits between the two teams and the active multiplicative
// skill bonus per tier (per `liveSkillMultiplier` in shared/sim/live).
// Tier 0 → 1.000×, tier 1 → 1.025×, tier 2 → 1.051×, tier 3 → 1.077×.
function MomentumMeter(props: {
  homeName: string;
  awayName: string;
  homeMomentum: number;
  awayMomentum: number;
}) {
  const homeTier = sim.tierFor(props.homeMomentum);
  const awayTier = sim.tierFor(props.awayMomentum);
  // Net "lean": positive = home advantage, negative = away.
  // Range = [-3, +3] (tier-based).
  const lean = homeTier - awayTier;
  // Scale lean to [0, 100] for the bar position (50 = neutral).
  const pct = 50 + (lean / 3) * 50;
  const homeMult = sim.liveSkillMultiplier(props.homeMomentum);
  const awayMult = sim.liveSkillMultiplier(props.awayMomentum);
  return (
    <section
      className="live-play-hub__momentum"
      aria-labelledby="momentum-meter-heading"
      data-testid="momentum-meter"
    >
      <h3 id="momentum-meter-heading">Momentum</h3>
      <div
        className="live-play-hub__momentum-bar"
        role="meter"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${props.homeName} momentum vs ${props.awayName}`}
      >
        <span
          className="live-play-hub__momentum-fill live-play-hub__momentum-fill--home"
          style={{ width: `${pct}%` }}
        />
        <span
          className="live-play-hub__momentum-fill live-play-hub__momentum-fill--away"
          style={{ width: `${100 - pct}%`, left: `${pct}%` }}
        />
        <span className="live-play-hub__momentum-tick" style={{ left: '50%' }} />
      </div>
      <div className="live-play-hub__momentum-rows">
        <div className="live-play-hub__momentum-row">
          <strong>{props.homeName}</strong>
          <span>
            {props.homeMomentum} pts · tier {homeTier} ·{' '}
            <span title="Skill multiplier — every action gets this boost">
              ×{homeMult.toFixed(3)}
            </span>
          </span>
        </div>
        <div className="live-play-hub__momentum-row">
          <strong>{props.awayName}</strong>
          <span>
            {props.awayMomentum} pts · tier {awayTier} ·{' '}
            <span title="Skill multiplier — every action gets this boost">
              ×{awayMult.toFixed(3)}
            </span>
          </span>
        </div>
      </div>
      {(homeTier > 0 || awayTier > 0) && (
        <p className="live-play-hub__momentum-impact">
          {homeTier > awayTier
            ? `${props.homeName} is rolling — every skill +${((homeMult - 1) * 100).toFixed(1)}%. Call a timeout to halve it.`
            : awayTier > homeTier
              ? `${props.awayName} is rolling — every skill +${((awayMult - 1) * 100).toFixed(1)}%. Call a timeout to halve it.`
              : 'Even momentum.'}
        </p>
      )}
    </section>
  );
}
