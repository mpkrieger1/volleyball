import { SaveSlots } from './screens/SaveSlots';
import { MatchHub } from './screens/MatchHub';
import { ScheduleView } from './screens/ScheduleView';
import { PollView } from './screens/PollView';
import { BracketView } from './screens/BracketView';
import { RecruitingBoard } from './screens/RecruitingBoard';
import { PortalView } from './screens/PortalView';
import { NilView } from './screens/NilView';
import { PreseasonView } from './screens/PreseasonView';
import { StaffView } from './screens/StaffView';
import { AwardsView } from './screens/AwardsView';
import { AnalyticsView } from './screens/AnalyticsView';
import { useEffect } from 'react';
import { useSaveSlotsStore } from './store/useSaveSlotsStore';
import { useNavStore, type ActiveScreen } from './store/useNavStore';
import { useUserTeamStore } from './store/useUserTeamStore';
import { useSettingsStore, FONT_SIZES, type FontSize } from './store/useSettingsStore';

const TABS: Array<{ id: ActiveScreen; label: string }> = [
  { id: 'match-hub', label: 'Match Hub' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'poll', label: 'Poll' },
  { id: 'bracket', label: 'Bracket' },
  { id: 'recruiting', label: 'Recruiting' },
  { id: 'portal', label: 'Portal' },
  { id: 'nil', label: 'NIL' },
  { id: 'offseason', label: 'Offseason' },
  { id: 'staff', label: 'Staff' },
  { id: 'awards', label: 'Awards' },
  { id: 'analytics', label: 'Analytics' },
];

export function App() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const { screen, setScreen } = useNavStore();
  const loadUserTeam = useUserTeamStore((s) => s.load);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);

  // Sprint 21: load Season.userTeamId whenever a save opens. Subsequent
  // screens (RecruitingBoard / PortalView / NilView) read from the store.
  useEffect(() => {
    if (openedSlotId) void loadUserTeam(openedSlotId);
  }, [openedSlotId, loadUserTeam]);

  // Sprint 21: apply font-size class to <body> for global CSS scaling.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.remove('fs-sm', 'fs-md', 'fs-lg');
    document.body.classList.add(`fs-${fontSize}`);
  }, [fontSize]);

  // Sprint 23: sync renderer's persisted crash-reporting opt-in to the
  // main-process recorder on startup and whenever the user toggles it.
  const crashReportingEnabled = useSettingsStore((s) => s.crashReportingEnabled);
  useEffect(() => {
    if (window.vcd?.crash?.setEnabled) {
      void window.vcd.crash.setEnabled(crashReportingEnabled);
    }
  }, [crashReportingEnabled]);

  if (!openedSlotId) return <main><SaveSlots /></main>;

  return (
    <main>
      <nav className="app-nav" aria-label="Primary">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={screen === t.id ? 'page' : undefined}
            onClick={() => setScreen(t.id)}
            className={screen === t.id ? 'app-nav__btn app-nav__btn--active' : 'app-nav__btn'}
          >
            {t.label}
          </button>
        ))}
        <FontSizePicker fontSize={fontSize} onChange={setFontSize} />
      </nav>
      {screen === 'match-hub' && <MatchHub />}
      {screen === 'schedule' && <ScheduleView />}
      {screen === 'poll' && <PollView />}
      {screen === 'bracket' && <BracketView />}
      {screen === 'recruiting' && <RecruitingBoard />}
      {screen === 'portal' && <PortalView />}
      {screen === 'nil' && <NilView />}
      {screen === 'offseason' && <PreseasonView />}
      {screen === 'staff' && <StaffView />}
      {screen === 'awards' && <AwardsView />}
      {screen === 'analytics' && <AnalyticsView />}
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
