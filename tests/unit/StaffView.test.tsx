import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { StaffView } from '../../app/src/screens/StaffView';
import { useCoachingStore } from '../../app/src/store/useCoachingStore';
import { useSaveSlotsStore } from '../../app/src/store/useSaveSlotsStore';
import { useUserTeamStore } from '../../app/src/store/useUserTeamStore';
import { useScheduleStore } from '../../app/src/store/useScheduleStore';

const staff = [
  {
    coachId: 'c-hc',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 'HC' as const,
    contractYears: 3,
    salaryCents: 200_000_00,
    ratingRecruit: 82,
    ratingDevelop: 78,
    ratingStrategy: 80,
    hireSeason: 2026,
  },
  {
    coachId: 'c-ahc',
    firstName: 'Bob',
    lastName: 'Jones',
    role: 'AHC' as const,
    contractYears: 2,
    salaryCents: 80_000_00,
    ratingRecruit: 75,
    ratingDevelop: 60,
    ratingStrategy: 55,
    hireSeason: 2026,
  },
];

const pool = [
  {
    poolId: 'pool-1',
    firstName: 'Max',
    lastName: 'Power',
    preferredRole: 'AC' as const,
    askingSalaryCents: 40_000_00,
    ratingRecruit: 70,
    ratingDevelop: 65,
    ratingStrategy: 60,
    ageYears: 35,
  },
];

function makeVcd() {
  (window as unknown as { vcd: Window['vcd'] }).vcd = {
    version: '0.1.0',
    saveSlots: {} as Window['vcd']['saveSlots'],
    match: {
      listTeams: vi.fn().mockResolvedValue({
        ok: true,
        teams: [{ id: 'team-1', abbr: 'NEB', schoolName: 'Nebraska' }],
      }),
      simulate: vi.fn(),
    } as Window['vcd']['match'],
    schedule: {} as Window['vcd']['schedule'],
    season: {} as Window['vcd']['season'],
    poll: {} as Window['vcd']['poll'],
    bracket: {} as Window['vcd']['bracket'],
    postseason: {} as Window['vcd']['postseason'],
    recruiting: {} as Window['vcd']['recruiting'],
    portal: {} as Window['vcd']['portal'],
    nil: {} as Window['vcd']['nil'],
    offseason: {} as Window['vcd']['offseason'],
    coaching: {
      listStaff: vi.fn().mockResolvedValue({
        ok: true,
        staff,
        operatingBudgetCents: 500_000_00,
      }),
      listPool: vi.fn().mockResolvedValue({ ok: true, pool }),
      hire: vi
        .fn()
        .mockResolvedValue({ ok: true, coachId: 'c-new', replacedCoachId: null }),
      fire: vi.fn().mockResolvedValue({
        ok: true,
        buyoutCents: 100_000_00,
        newBudgetCents: 400_000_00,
        backfilledCoachId: null,
      }),
    } as Window['vcd']['coaching'],
  };
}

beforeEach(() => {
  useCoachingStore.setState({
    staff: [],
    pool: [],
    budgetCents: 0,
    status: 'idle',
    error: null,
  });
  useSaveSlotsStore.setState({
    slots: [],
    status: 'idle',
    error: null,
    openedSlotId: 'slot-1',
  });
  // Sprint 28: StaffView early-returns a placeholder when userTeamId is null.
  // Tests need to set a user team to actually render staff rows.
  useUserTeamStore.setState({ userTeamId: 'team-1', status: 'ready', error: null });
  useScheduleStore.setState({
    teams: [{ id: 'team-1', schoolName: 'Nebraska', abbr: 'NEB' } as never],
    selectedTeamId: 'team-1',
    rows: [],
    status: 'ready',
    error: null,
    stats: null,
  });
});

describe('<StaffView />', () => {
  it('renders current staff rows', async () => {
    makeVcd();
    render(<StaffView />);
    await waitFor(() => {
      // Sprint 28: StaffView renders <strong>{lastName}</strong><span>{firstName}</span>;
      // the full "Jane Smith" string is split across elements. Match the
      // last name in the strong element instead.
      expect(screen.getByText('Smith', { selector: 'strong' })).toBeInTheDocument();
      expect(screen.getByText('Jones', { selector: 'strong' })).toBeInTheDocument();
    });
  });

  it('renders hiring pool rows', async () => {
    makeVcd();
    render(<StaffView />);
    await waitFor(() => {
      expect(screen.getByText('Power', { selector: 'strong' })).toBeInTheDocument();
    });
  });

  it('fires a coach when Fire is clicked', async () => {
    makeVcd();
    render(<StaffView />);
    await waitFor(() => expect(screen.getByText('Smith', { selector: 'strong' })).toBeInTheDocument());
    const fireBtns = screen.getAllByRole('button', { name: 'Fire' });
    fireEvent.click(fireBtns[0]!);
    await waitFor(() => {
      expect(window.vcd.coaching.fire).toHaveBeenCalledWith({
        slotId: 'slot-1',
        teamId: 'team-1',
        coachId: 'c-hc',
      });
    });
  });

  it('opens hire dialog and confirms a hire', async () => {
    makeVcd();
    render(<StaffView />);
    await waitFor(() => expect(screen.getByText('Power', { selector: 'strong' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Hire' }));
    const confirm = await screen.findByRole('button', { name: 'Confirm hire' });
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(window.vcd.coaching.hire).toHaveBeenCalledWith(
        expect.objectContaining({
          slotId: 'slot-1',
          teamId: 'team-1',
          poolId: 'pool-1',
          role: 'AC',
          salaryCents: 40_000_00,
        }),
      );
    });
  });

  it('is axe-clean', async () => {
    makeVcd();
    const { container } = render(<StaffView />);
    await waitFor(() => expect(screen.getByText('Smith', { selector: 'strong' })).toBeInTheDocument());
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
