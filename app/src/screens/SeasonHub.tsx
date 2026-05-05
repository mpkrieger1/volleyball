// Sprint 26 Task 26.5: Season Hub — the post-pick coach dashboard.
//
// This is now the default landing screen (`useNavStore.screen` defaults to
// `'season-hub'`). It composes existing stores into a single view:
//
//   - Header: user team name + dynasty year + record (placeholder until
//     Sprint 27 standings).
//   - Phase chip: "Week N · PHASE" derived from useSeasonStore.
//   - SeasonPanel: existing component handles the "Advance week" action.
//   - Action grid: large CTAs that route via useNavStore.setScreen to the
//     screens the user actually needs (Recruiting, Schedule, Bracket,
//     Awards, etc.).
//
// No new IPC contracts. Pure composition. Sprint 27 will refactor this
// to use `Season.currentDate` semantics (per-day advance) once Task 27.4
// lands.

import { useEffect, useMemo } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useSeasonStore } from '../store/useSeasonStore';
import { useUserTeamStore } from '../store/useUserTeamStore';
import { useScheduleStore } from '../store/useScheduleStore';
import { useNavStore, type ActiveScreen } from '../store/useNavStore';
import { useRecruitingStore } from '../store/useRecruitingStore';
import { SeasonPanel } from './SeasonPanel';
import { WeeklyChecklist, buildChecklist } from '../components/WeeklyChecklist';
import { OffseasonPanel } from '../components/OffseasonPanel';
import { PracticeFocusPicker } from '../components/PracticeFocusPicker';
import { usePracticeFocusStore } from '../store/usePracticeFocusStore';

type ActionCard = {
  id: ActiveScreen;
  label: string;
  blurb: string;
  visibleIn: 'always' | 'regular' | 'postseason' | 'offseason';
};

const ACTION_CARDS: ActionCard[] = [
  { id: 'recruiting', label: 'Recruiting', blurb: 'Manage your board, take actions, sign your class.', visibleIn: 'always' },
  { id: 'portal', label: 'Transfer Portal', blurb: 'Browse the portal and pursue transfers.', visibleIn: 'always' },
  { id: 'nil', label: 'NIL', blurb: 'Manage NIL deals for your roster.', visibleIn: 'always' },
  { id: 'staff', label: 'Staff', blurb: 'Hire, fire, and contract your assistants.', visibleIn: 'always' },
  { id: 'schedule', label: 'Schedule', blurb: 'View the season calendar and matchups.', visibleIn: 'always' },
  { id: 'poll', label: 'Poll', blurb: 'See the AVCA Top 25.', visibleIn: 'always' },
  { id: 'bracket', label: 'Bracket', blurb: 'NCAA tournament bracket.', visibleIn: 'postseason' },
  { id: 'awards', label: 'Awards', blurb: 'AVCA All-Americans and season honors.', visibleIn: 'offseason' },
  { id: 'analytics', label: 'Analytics', blurb: 'Match-by-match deep-dive charts.', visibleIn: 'always' },
  { id: 'live-play', label: 'Play Match', blurb: 'Start a live match — pick a scheduled game, control rotations, timeouts, subs.', visibleIn: 'always' },
  { id: 'match-hub', label: 'Match Replay', blurb: 'Replay a finished match or simulate an exhibition.', visibleIn: 'always' },
];

function phaseGroup(phase: string): 'preseason' | 'regular' | 'postseason' | 'offseason' {
  switch (phase) {
    case 'PRESEASON':
      return 'preseason';
    case 'REGULAR':
      return 'regular';
    case 'CONF_TOURNEY':
    case 'NCAA':
      return 'postseason';
    case 'OFFSEASON':
    case 'RECRUITING':
    case 'PORTAL':
      return 'offseason';
    default:
      return 'regular';
  }
}

function shouldShowCard(card: ActionCard, group: ReturnType<typeof phaseGroup>): boolean {
  if (card.visibleIn === 'always') return true;
  if (card.visibleIn === 'regular') return group === 'regular' || group === 'preseason';
  if (card.visibleIn === 'postseason') return group === 'postseason';
  if (card.visibleIn === 'offseason') return group === 'offseason';
  return true;
}

export function SeasonHub() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const userTeamId = useUserTeamStore((s) => s.userTeamId);
  const userTeamStatus = useUserTeamStore((s) => s.status);
  const phase = useSeasonStore((s) => s.phase);
  const currentWeek = useSeasonStore((s) => s.currentWeek);
  const teams = useScheduleStore((s) => s.teams);
  const rows = useScheduleStore((s) => s.rows);
  const selectedTeamId = useScheduleStore((s) => s.selectedTeamId);
  const loadScheduleTeams = useScheduleStore((s) => s.loadTeams);
  const selectTeam = useScheduleStore((s) => s.selectTeam);
  const recruitingPhase = useRecruitingStore((s) => s.phase);
  const recruitingBudget = useRecruitingStore((s) => s.budget);
  const loadRecruitingHeader = useRecruitingStore((s) => s.loadHeader);
  const setScreen = useNavStore((s) => s.setScreen);
  // Sprint 34: practice focus tile.
  const practiceFocusState = usePracticeFocusStore((s) => s.weekState);
  const loadPracticeFocus = usePracticeFocusStore((s) => s.loadWeekState);
  const setPracticeFocusPick = usePracticeFocusStore((s) => s.setPick);

  // Hydrate teams list (used to resolve userTeamId → school name).
  useEffect(() => {
    if (openedSlotId && teams.length === 0) {
      void loadScheduleTeams(openedSlotId);
    }
  }, [openedSlotId, teams.length, loadScheduleTeams]);

  // Load this user team's schedule rows for the weekly checklist + lazy-load
  // recruiting header so the checklist knows the budget remaining.
  useEffect(() => {
    if (!openedSlotId || !userTeamId) return;
    if (selectedTeamId !== userTeamId) {
      void selectTeam(openedSlotId, userTeamId);
    }
    void loadRecruitingHeader(openedSlotId, userTeamId);
  }, [openedSlotId, userTeamId, selectedTeamId, selectTeam, loadRecruitingHeader]);

  // Sprint 34: load the practice-focus week state when in REGULAR phase
  // for the user's team + current week.
  useEffect(() => {
    if (!openedSlotId || !userTeamId) return;
    if (phase !== 'REGULAR') return;
    void loadPracticeFocus(openedSlotId, userTeamId, currentWeek);
  }, [openedSlotId, userTeamId, phase, currentWeek, loadPracticeFocus]);

  const userTeam = useMemo(
    () => (userTeamId ? teams.find((t) => t.id === userTeamId) ?? null : null),
    [teams, userTeamId],
  );

  const group = phaseGroup(phase);
  const visibleCards = ACTION_CARDS.filter((c) => shouldShowCard(c, group));

  const checklistItems = useMemo(
    () =>
      buildChecklist({
        phase,
        currentWeek,
        rows: selectedTeamId === userTeamId ? rows : [],
        recruitingPhase,
        recruitingBudgetRemaining: recruitingBudget?.remaining ?? 0,
      }),
    [phase, currentWeek, rows, selectedTeamId, userTeamId, recruitingPhase, recruitingBudget],
  );

  if (!openedSlotId) return null;

  // Sprint 21 fallback: if no userTeamId is set on this save (legacy save
  // pre-dating the Sprint 21 picker), guide the user to the Match Hub
  // where the modal-based picker fires. Keeps the Hub from rendering an
  // empty header and stranding the user.
  const showLegacyFallback = userTeamStatus === 'ready' && userTeamId === null;

  return (
    <section aria-labelledby="season-hub-heading" className="season-hub">
      <header className="season-hub__header">
        <h1 id="season-hub-heading">
          {userTeam ? userTeam.schoolName : 'Coach'}
        </h1>
        <p className="season-hub__sub" data-testid="season-hub-phase">
          {currentWeek === 0 ? 'Pre-season' : `Week ${currentWeek}`} · {phase}
        </p>
      </header>

      {showLegacyFallback && (
        <div role="status" className="season-hub__legacy-banner" data-testid="legacy-banner">
          This save was created before team picking was added. Visit the
          Match Hub to choose your team.
          <button
            type="button"
            onClick={() => setScreen('match-hub')}
            className="season-hub__legacy-cta"
          >
            Go to Match Hub
          </button>
        </div>
      )}

      <SeasonPanel />

      {/* Sprint 28: Offseason / Preseason actions used to live in their
          own tab. Folded into the Hub here — visible only when the
          phase is OFFSEASON or PRESEASON, hidden the rest of the year. */}
      {userTeamId && <OffseasonPanel teamId={userTeamId} />}

      {/* Sprint 34: weekly practice focus picker. Visible during REGULAR
          when an upcoming match exists for the user team. Practice focus
          is a per-match buff only (~3-5%) — no rating mutation. */}
      {phase === 'REGULAR' && practiceFocusState && practiceFocusState.hasUpcomingMatch && (
        <PracticeFocusPicker
          state={practiceFocusState}
          onPick={(off, def) => {
            if (openedSlotId && userTeamId) {
              void setPracticeFocusPick(openedSlotId, userTeamId, currentWeek, off, def);
            }
          }}
        />
      )}

      <WeeklyChecklist items={checklistItems} onNavigate={setScreen} />

      <h2 className="season-hub__h2">What now?</h2>
      <ul className="season-hub__cards" aria-label="Coach actions">
        {visibleCards.map((card) => (
          <li key={card.id}>
            <button
              type="button"
              className="season-hub__card"
              onClick={() => setScreen(card.id)}
              data-testid={`action-${card.id}`}
            >
              <strong className="season-hub__card-label">{card.label}</strong>
              <span className="season-hub__card-blurb">{card.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
