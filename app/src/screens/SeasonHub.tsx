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
import { SeasonPanel } from './SeasonPanel';

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
  { id: 'match-hub', label: 'Match Hub', blurb: 'Replay or simulate a specific match.', visibleIn: 'always' },
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
  const loadScheduleTeams = useScheduleStore((s) => s.loadTeams);
  const setScreen = useNavStore((s) => s.setScreen);

  // Hydrate teams list (used to resolve userTeamId → school name).
  useEffect(() => {
    if (openedSlotId && teams.length === 0) {
      void loadScheduleTeams(openedSlotId);
    }
  }, [openedSlotId, teams.length, loadScheduleTeams]);

  const userTeam = useMemo(
    () => (userTeamId ? teams.find((t) => t.id === userTeamId) ?? null : null),
    [teams, userTeamId],
  );

  const group = phaseGroup(phase);
  const visibleCards = ACTION_CARDS.filter((c) => shouldShowCard(c, group));

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
