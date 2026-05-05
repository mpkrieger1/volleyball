// Sprint 28 Task 28.5B: rewritten for the new screen.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { axe } from 'jest-axe';
import { RecruitingBoard } from '../../app/src/screens/RecruitingBoard';
import { useRecruitingStore } from '../../app/src/store/useRecruitingStore';
import { useSaveSlotsStore } from '../../app/src/store/useSaveSlotsStore';
import { useUserTeamStore } from '../../app/src/store/useUserTeamStore';
import { useScheduleStore } from '../../app/src/store/useScheduleStore';
import type { rosterIpc, matchIpc } from '@vcd/shared';

type Recruit = {
  recruitId: string;
  firstName: string;
  lastName: string;
  position: string;
  stars: number;
  height: number;
  hometownCity: string;
  hometownState: string;
  hometownRegion: string;
  commitState: string;
  commitTeamId: string | null;
  interest: number;
  actionsSpent: number;
  leaderAbbr: string | null;
};

const mkRecruit = (over: Partial<Recruit> = {}): Recruit => ({
  recruitId: `r${crypto.randomUUID().slice(0, 7)}`,
  firstName: 'Test',
  lastName: 'Recruit',
  position: 'OH',
  stars: 3,
  height: 185,
  hometownCity: 'Lincoln',
  hometownState: 'NE',
  hometownRegion: 'CENTRAL',
  commitState: 'PENDING',
  commitTeamId: null,
  interest: 200,
  actionsSpent: 0,
  leaderAbbr: null,
  ...over,
});

const mkDetail = (recruitId: string) => ({
  recruitId,
  firstName: 'Alice',
  lastName: 'Recruit',
  position: 'OH',
  stars: 5,
  height: 188,
  hometownCity: 'Lincoln',
  hometownState: 'NE',
  hometownRegion: 'CENTRAL',
  commitState: 'PENDING',
  commitTeamId: null,
  scoutLevel: 1,
  scoutReport: [
    { skill: 'Attack', grade: 'A' as const },
    { skill: 'Block', grade: 'B' as const },
    { skill: 'Serve', grade: 'C' as const },
    { skill: 'Pass', grade: '?' as const },
    { skill: 'Set', grade: '?' as const },
    { skill: 'Dig', grade: '?' as const },
    { skill: 'Athleticism', grade: '?' as const },
    { skill: 'IQ', grade: '?' as const },
    { skill: 'Stamina', grade: '?' as const },
  ],
  interestMeter: [
    { teamId: 'team-1', teamAbbr: 'NEB', interest: 800, isUserTeam: true },
    { teamId: 'team-2', teamAbbr: 'STAN', interest: 700, isUserTeam: false },
  ],
  actionsSpent: 2,
  // Sprint 37 Task 37.4: extended payload (priorities, pitch reasons,
  // recruiter quality, NIL).
  priorities: {
    playingTime: 5,
    proximityToHome: 5,
    prestige: 5,
    facilities: 5,
    nilDeal: 0,
  },
  wantsToLeaveHome: false,
  pitchReasons: [],
  recruiterQualityByCoach: [],
  nilBudgetCents: 0,
  nilBudgetUsedCents: 0,
  nilOfferCents: 0,
});

function makeVcd(recruits: Recruit[]) {
  (window as unknown as { vcd: Window['vcd'] }).vcd = {
    version: '0.1.0',
    saveSlots: {} as Window['vcd']['saveSlots'],
    match: {
      listTeams: vi.fn().mockResolvedValue({
        ok: true,
        teams: [{ id: 'team-1', abbr: 'NEB', schoolName: 'Nebraska' }],
      }),
      simulate: vi.fn(),
    } as unknown as Window['vcd']['match'],
    schedule: {} as Window['vcd']['schedule'],
    season: {} as Window['vcd']['season'],
    poll: {} as Window['vcd']['poll'],
    bracket: {} as Window['vcd']['bracket'],
    postseason: {} as Window['vcd']['postseason'],
    recruiting: {
      state: vi.fn().mockResolvedValue({
        ok: true,
        phase: 'RECRUITING',
        week: 3,
        budgetRemaining: 30,
        recruits,
      }),
      open: vi.fn(),
      action: vi.fn().mockResolvedValue({ ok: true, newInterest: 230, budgetRemaining: 28, week: 3 }),
      advance: vi.fn(),
      close: vi.fn(),
      budget: vi.fn().mockResolvedValue({
        ok: true,
        total: 35,
        spent: 5,
        remaining: 30,
        breakdown: { base: 20, hc: 10, ahc: 3, ac: 2 },
        week: 3,
      }),
      teamNeeds: vi.fn().mockResolvedValue({
        ok: true,
        needs: [
          { position: 'OH', rosterCount: 4, graduatingCount: 2, thinness: 2 },
          { position: 'S', rosterCount: 1, graduatingCount: 0, thinness: 1 },
        ],
      }),
      detail: vi.fn().mockImplementation((_slot: string, _team: string, recruitId: string) =>
        Promise.resolve({ ok: true, detail: mkDetail(recruitId) }),
      ),
    } as unknown as Window['vcd']['recruiting'],
  } as unknown as Window['vcd'];
}

beforeEach(() => {
  useRecruitingStore.setState({
    phase: 'OFFSEASON',
    week: 0,
    budgetRemaining: 0,
    recruits: [],
    status: 'idle',
    error: null,
    filter: {},
    tab: 'targets',
    detailOpen: false,
    detail: null,
    detailStatus: 'idle',
    budget: null,
    teamNeeds: [],
  });
  useSaveSlotsStore.setState({ slots: [], status: 'idle', error: null, openedSlotId: 'slot-1' });
  useUserTeamStore.setState({ userTeamId: 'team-1', status: 'ready', error: null });
  const team: matchIpc.TeamSummary = {
    id: 'team-1',
    schoolName: 'Nebraska',
    abbr: 'NEB',
    conferenceId: 'bigten',
    primaryColor: '#000',
    secondaryColor: '#fff',
    prestige: 95,
  };
  useScheduleStore.setState({
    teams: [team],
    selectedTeamId: null,
    rows: [],
    status: 'ready',
    error: null,
    stats: null,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('<RecruitingBoard /> (Sprint 28)', () => {
  it('renders the header strip with budget breakdown', async () => {
    makeVcd([mkRecruit({ recruitId: 'r1' })]);
    render(<RecruitingBoard />);
    const header = await screen.findByTestId('recruiting-header');
    expect(header).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('recruiting-header-budget')).toHaveTextContent('30');
    });
  });

  it('All Recruits tab shows all recruits; My Targets filters to actioned', async () => {
    makeVcd([
      mkRecruit({ recruitId: 'r1', firstName: 'Alice', actionsSpent: 0 }),
      mkRecruit({ recruitId: 'r2', firstName: 'Bob', actionsSpent: 3 }),
    ]);
    useRecruitingStore.setState({ tab: 'all' });
    render(<RecruitingBoard />);
    await waitFor(() => {
      expect(screen.getByTestId('recruit-row-r1')).toBeInTheDocument();
      expect(screen.getByTestId('recruit-row-r2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('tab-targets'));
    await waitFor(() => {
      expect(screen.queryByTestId('recruit-row-r1')).toBeNull();
      expect(screen.getByTestId('recruit-row-r2')).toBeInTheDocument();
    });
  });

  it('clicking a row opens the detail modal', async () => {
    makeVcd([mkRecruit({ recruitId: 'r1', firstName: 'Alice', actionsSpent: 1 })]);
    render(<RecruitingBoard />);
    const row = await screen.findByTestId('recruit-row-r1');
    fireEvent.click(row);
    await waitFor(() => {
      expect(screen.getByTestId('recruit-detail-modal')).toBeInTheDocument();
    });
  });

  it('detail modal action button calls recruiting.action', async () => {
    makeVcd([mkRecruit({ recruitId: 'r1', actionsSpent: 1 })]);
    render(<RecruitingBoard />);
    fireEvent.click(await screen.findByTestId('recruit-row-r1'));
    await screen.findByTestId('recruit-detail-modal');
    // Wait for budget to load so the buttons are not disabled.
    await waitFor(() => {
      const btn = screen.getByTestId('action-PHONE_CALL') as HTMLButtonElement;
      expect(btn).not.toBeDisabled();
    });
    fireEvent.click(screen.getByTestId('action-PHONE_CALL'));
    await waitFor(() => {
      expect(window.vcd.recruiting.action).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PHONE_CALL', teamId: 'team-1' }),
      );
    });
  });

  it('ESC closes the detail modal', async () => {
    makeVcd([mkRecruit({ recruitId: 'r1', actionsSpent: 1 })]);
    render(<RecruitingBoard />);
    fireEvent.click(await screen.findByTestId('recruit-row-r1'));
    await screen.findByTestId('recruit-detail-modal');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('recruit-detail-modal')).toBeNull();
    });
  });

  it('"interested in user team" filter narrows to recruits with interest > 0', async () => {
    makeVcd([
      mkRecruit({ recruitId: 'r1', firstName: 'Alice', interest: 0 }),
      mkRecruit({ recruitId: 'r2', firstName: 'Bob', interest: 250 }),
    ]);
    useRecruitingStore.setState({ tab: 'all' });
    render(<RecruitingBoard />);
    await waitFor(() => {
      expect(screen.getByTestId('recruit-row-r1')).toBeInTheDocument();
      expect(screen.getByTestId('recruit-row-r2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('filter-interested'));
    await waitFor(() => {
      expect(screen.queryByTestId('recruit-row-r1')).toBeNull();
      expect(screen.getByTestId('recruit-row-r2')).toBeInTheDocument();
    });
  });

  it('renders the position needs cards for all 6 positions', async () => {
    makeVcd([mkRecruit({ recruitId: 'r1' })]);
    render(<RecruitingBoard />);
    await screen.findByTestId('team-needs-cards');
    for (const pos of ['S', 'OH', 'MB', 'OPP', 'L', 'DS']) {
      expect(screen.getByTestId(`team-needs-card-${pos}`)).toBeInTheDocument();
    }
  });

  it('axe-clean on the recruiting screen', async () => {
    makeVcd([mkRecruit({ recruitId: 'r1', firstName: 'Alice', actionsSpent: 2 })]);
    useRecruitingStore.setState({ tab: 'targets' });
    const { container } = render(<RecruitingBoard />);
    await screen.findByTestId('recruit-row-r1');
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});

// Silence the unused-import warning when rosterIpc isn't used directly here.
type _Unused = rosterIpc.RosterPlayer;
