import { SaveSlots } from './screens/SaveSlots';
import { SeasonHub } from './screens/SeasonHub';
import { MatchHub } from './screens/MatchHub';
import { LivePlayHub } from './screens/LivePlayHub';
import { ScheduleView } from './screens/ScheduleView';
import { RosterView } from './screens/RosterView';
import { DepthChartView } from './screens/DepthChartView';
import { PollView } from './screens/PollView';
import { BracketView } from './screens/BracketView';
import { RecruitingBoard } from './screens/RecruitingBoard';
import { PortalView } from './screens/PortalView';
import { NilView } from './screens/NilView';
import { StaffView } from './screens/StaffView';
import { AwardsView } from './screens/AwardsView';
import { AnalyticsView } from './screens/AnalyticsView';
import { StandingsView } from './screens/StandingsView';
import { SeasonView } from './screens/SeasonView';
import { SettingsScreen } from './screens/SettingsScreen';
import { useEffect } from 'react';
import { useSaveSlotsStore } from './store/useSaveSlotsStore';
import { useNavStore, type ActiveScreen } from './store/useNavStore';
import { useUserTeamStore } from './store/useUserTeamStore';
import { useScheduleStore } from './store/useScheduleStore';
import { useSeasonStore } from './store/useSeasonStore';
import { useStandingsStore } from './store/useStandingsStore';
import { useMatchHubStore } from './store/useMatchHubStore';
import { useSettingsStore, FONT_SIZES, type FontSize } from './store/useSettingsStore';

// Sprint 28: nav restructured with a "Team" group for the screens scoped to
// the user's team. Top-level: Hub | Team▾ | Match Hub | Recruiting | ...
// The Team dropdown contains Roster, Depth Chart, Schedule, Staff, NIL,
// Analytics — everything that's primarily about your own team's state.
type FlatTab = { kind: 'flat'; id: ActiveScreen; label: string };
type GroupTab = {
  kind: 'group';
  label: string;
  /** When any of these screens is active, the group button highlights. */
  members: Array<{ id: ActiveScreen; label: string }>;
};
type Tab = FlatTab | GroupTab;

const TABS: Tab[] = [
  { kind: 'flat', id: 'season-hub', label: 'Hub' },
  {
    kind: 'group',
    label: 'Team',
    members: [
      { id: 'roster', label: 'Roster' },
      { id: 'depth-chart', label: 'Depth Chart' },
      { id: 'schedule', label: 'Schedule' },
      { id: 'staff', label: 'Staff' },
      { id: 'nil', label: 'NIL' },
      { id: 'analytics', label: 'Analytics' },
    ],
  },
  { kind: 'flat', id: 'match-hub', label: 'Match Hub' },
  { kind: 'flat', id: 'recruiting', label: 'Recruiting' },
  { kind: 'flat', id: 'portal', label: 'Portal' },
  // Sprint 28: Season parent screen — Standings / Poll / Bracket / Awards
  // are now sub-tabs inside SeasonView (see app/src/screens/SeasonView.tsx).
  { kind: 'flat', id: 'season', label: 'Season' },
  // Sprint 28: Offseason tab folded into the Hub. The OffseasonPanel
  // there auto-shows during OFFSEASON / PRESEASON and stays hidden the
  // rest of the year — same actions, fewer dead tabs.
  { kind: 'flat', id: 'settings', label: 'Settings' },
];

export function App() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const closeSlot = useSaveSlotsStore((s) => s.close);
  const slots = useSaveSlotsStore((s) => s.slots);
  const { screen, setScreen } = useNavStore();
  const loadUserTeam = useUserTeamStore((s) => s.load);
  const userTeamId = useUserTeamStore((s) => s.userTeamId);
  const resetUserTeam = useUserTeamStore((s) => s.reset);
  const teams = useScheduleStore((s) => s.teams);
  const seasonPhase = useSeasonStore((s) => s.phase);
  const seasonWeek = useSeasonStore((s) => s.currentWeek);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);

  // Sprint 28: lookup the user's team + the active save slot's display
  // name for the team-strip header.
  const userTeam = userTeamId ? teams.find((t) => t.id === userTeamId) ?? null : null;
  const openedSlot = openedSlotId ? slots.find((s) => s.id === openedSlotId) ?? null : null;

  // Sprint 28: Save & Exit handler. SQLite persists every write inline so
  // there's no explicit "save" step; we just tear down the in-memory
  // session state (downstream stores) + clear `openedSlotId` so the App
  // re-renders the SaveSlots screen.
  function saveAndExit(): void {
    // Reset downstream stores to avoid stale data leaking on the next open.
    resetUserTeam();
    useScheduleStore.setState({
      teams: [],
      selectedTeamId: null,
      rows: [],
      status: 'idle',
      error: null,
      stats: null,
    });
    useSeasonStore.setState({
      currentWeek: 0,
      phase: 'PRESEASON',
      status: 'idle',
      error: null,
      progress: null,
      cancellationId: null,
      lastAdvanceElapsedMs: null,
    });
    useStandingsStore.setState({
      conferenceStandings: [],
      rpiTop25: [],
      statLeaders: {},
      status: 'idle',
      error: null,
    });
    useMatchHubStore.getState().reset();
    closeSlot();
    // Reset nav back to season-hub for the next save the user opens.
    setScreen('season-hub');
  }

  // Sprint 21: load Season.userTeamId whenever a save opens. Subsequent
  // screens (RecruitingBoard / PortalView / NilView) read from the store.
  useEffect(() => {
    if (openedSlotId) void loadUserTeam(openedSlotId);
  }, [openedSlotId, loadUserTeam]);

  // Sprint 28: hydrate season + teams when a save opens so the team-strip
  // header has data to render. (Previously these were loaded by individual
  // screens; the strip needs them at App scope.)
  const loadSeasonWeek = useSeasonStore((s) => s.loadCurrentWeek);
  const loadScheduleTeams = useScheduleStore((s) => s.loadTeams);
  useEffect(() => {
    if (openedSlotId) {
      void loadSeasonWeek(openedSlotId);
      void loadScheduleTeams(openedSlotId);
    }
  }, [openedSlotId, loadSeasonWeek, loadScheduleTeams]);

  // Sprint 28: the Offseason tab was folded into the Hub. If state from
  // an earlier session has `screen === 'offseason'` cached, redirect to
  // the Hub so the user lands on a valid screen.
  useEffect(() => {
    if ((screen as string) === 'offseason') setScreen('season-hub');
  }, [screen, setScreen]);

  // Sprint 28: ensure the slots list is hydrated so the strip can show the
  // current save's display name.
  const loadSlots = useSaveSlotsStore((s) => s.load);
  useEffect(() => {
    if (slots.length === 0) void loadSlots();
  }, [slots.length, loadSlots]);

  // Sprint 21: apply font-size class to <body> for global CSS scaling.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.remove('fs-sm', 'fs-md', 'fs-lg');
    document.body.classList.add(`fs-${fontSize}`);
  }, [fontSize]);

  // Sprint 23/24: sync renderer's persisted Diagnostics opt-in to the
  // main-process crash recorder on startup and whenever the user toggles it.
  const diagnosticsEnabled = useSettingsStore((s) => s.diagnosticsEnabled);
  useEffect(() => {
    if (window.vcd?.crash?.setEnabled) {
      void window.vcd.crash.setEnabled(diagnosticsEnabled);
    }
  }, [diagnosticsEnabled]);

  if (!openedSlotId) return <main><SaveSlots /></main>;

  return (
    <main>
      <div className="app-team-strip" data-testid="team-strip">
        <div className="app-team-strip__team">
          {userTeam ? (
            <>
              <span
                className="app-team-strip__color-swatch"
                style={{ background: userTeam.primaryColor }}
                aria-hidden="true"
              />
              <strong className="app-team-strip__abbr">{userTeam.abbr}</strong>
              <span className="app-team-strip__school">{userTeam.schoolName}</span>
            </>
          ) : userTeamId ? (
            // Sprint 28 bug fix: userTeamId is set but the team list
            // hasn't hydrated yet (loadScheduleTeams effect runs after the
            // first render). Show a loading state instead of falsely
            // claiming no team is selected.
            <span className="app-team-strip__no-team" data-testid="team-strip-loading">
              Loading team…
            </span>
          ) : (
            <span className="app-team-strip__no-team">
              No team selected — pick one from the Hub
            </span>
          )}
        </div>
        <div className="app-team-strip__meta">
          <span className="app-team-strip__phase" data-testid="team-strip-phase">
            {seasonWeek === 0 ? 'Pre-season' : `Week ${seasonWeek}`} · {seasonPhase}
          </span>
          {openedSlot && (
            <span className="app-team-strip__save" data-testid="team-strip-save">
              Save: <strong>{openedSlot.name}</strong>
            </span>
          )}
          <button
            type="button"
            onClick={saveAndExit}
            className="app-team-strip__exit"
            data-testid="save-and-exit"
            title="Save & exit — returns to the save-slots screen. Your progress is auto-saved on every action."
          >
            Save &amp; Exit
          </button>
        </div>
      </div>
      <nav className="app-nav" aria-label="Primary">
        {TABS.map((t) =>
          t.kind === 'flat' ? (
            <button
              key={t.id}
              type="button"
              aria-current={screen === t.id ? 'page' : undefined}
              onClick={() => setScreen(t.id)}
              className={screen === t.id ? 'app-nav__btn app-nav__btn--active' : 'app-nav__btn'}
            >
              {t.label}
            </button>
          ) : (
            // Sprint 28: group button. Highlights when any member screen
            // is active. Clicking jumps to the first member if not
            // already in the group; the secondary nav row below lists
            // all sibling tabs.
            <button
              key={t.label}
              type="button"
              aria-current={
                t.members.some((m) => m.id === screen) ? 'page' : undefined
              }
              onClick={() => {
                if (!t.members.some((m) => m.id === screen)) {
                  setScreen(t.members[0]!.id);
                }
              }}
              className={
                t.members.some((m) => m.id === screen)
                  ? 'app-nav__btn app-nav__btn--active'
                  : 'app-nav__btn'
              }
            >
              {t.label}
            </button>
          ),
        )}
        <FontSizePicker fontSize={fontSize} onChange={setFontSize} />
      </nav>

      {/* Sprint 28: secondary horizontal sub-nav. Visible whenever the
          active screen belongs to a group; lists all sibling tabs in
          that group so the user can jump between them at a glance. */}
      {(() => {
        const activeGroup = TABS.find(
          (t) => t.kind === 'group' && t.members.some((m) => m.id === screen),
        );
        if (!activeGroup || activeGroup.kind !== 'group') return null;
        return (
          <nav
            className="app-subnav"
            aria-label={`${activeGroup.label} sub-navigation`}
            data-testid="app-subnav"
          >
            {activeGroup.members.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-current={screen === m.id ? 'page' : undefined}
                onClick={() => setScreen(m.id)}
                className={
                  screen === m.id
                    ? 'app-subnav__btn app-subnav__btn--active'
                    : 'app-subnav__btn'
                }
              >
                {m.label}
              </button>
            ))}
          </nav>
        );
      })()}
      {screen === 'season-hub' && <SeasonHub />}
      {screen === 'match-hub' && <MatchHub />}
      {screen === 'live-play' && <LivePlayHub />}
      {screen === 'schedule' && <ScheduleView />}
      {screen === 'roster' && <RosterView />}
      {screen === 'depth-chart' && <DepthChartView />}
      {screen === 'season' && <SeasonView />}
      {screen === 'poll' && <PollView />}
      {screen === 'bracket' && <BracketView />}
      {screen === 'recruiting' && <RecruitingBoard />}
      {screen === 'portal' && <PortalView />}
      {screen === 'nil' && <NilView />}
      {screen === 'staff' && <StaffView />}
      {screen === 'awards' && <AwardsView />}
      {screen === 'analytics' && <AnalyticsView />}
      {screen === 'standings' && <StandingsView />}
      {screen === 'settings' && <SettingsScreen />}
    </main>
  );
}

function FontSizePicker(props: { fontSize: FontSize; onChange: (s: FontSize) => void }) {
  const labels: Record<FontSize, string> = { sm: 'A−', md: 'A', lg: 'A+' };
  return (
    <div className="app-nav__font-size" role="radiogroup" aria-label="Font size">
      {FONT_SIZES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={props.fontSize === s}
          aria-label={`Font size ${s === 'sm' ? 'small' : s === 'md' ? 'medium' : 'large'}`}
          onClick={() => props.onChange(s)}
          className={
            props.fontSize === s
              ? 'app-nav__btn app-nav__btn--active'
              : 'app-nav__btn'
          }
        >
          {labels[s]}
        </button>
      ))}
    </div>
  );
}
