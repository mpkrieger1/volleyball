import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { RecruitingBoard } from '../../app/src/screens/RecruitingBoard';
import { useRecruitingStore } from '../../app/src/store/useRecruitingStore';
import { useSaveSlotsStore } from '../../app/src/store/useSaveSlotsStore';
import { useUserTeamStore } from '../../app/src/store/useUserTeamStore';

const mkRecruit = (
  over: Partial<Window['vcd']['recruiting'] extends { state: (a: string, b: string) => Promise<infer R> }
    ? R extends { ok: true; recruits: Array<infer T> }
      ? T
      : never
    : never> = {},
) => ({
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
  ...over,
});

function makeVcd() {
  (window as unknown as { vcd: Window['vcd'] }).vcd = {
    version: '0.1.0',
    saveSlots: {} as Window['vcd']['saveSlots'],
    match: {
      listTeams: vi
        .fn()
        .mockResolvedValue({ ok: true, teams: [{ id: 'team-1', abbr: 'NEB', schoolName: 'Nebraska' }] }),
      simulate: vi.fn(),
    } as Window['vcd']['match'],
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
        budgetRemaining: 48,
        recruits: [
          mkRecruit({ recruitId: 'r1', firstName: 'Alice', position: 'OH', stars: 5 }),
          mkRecruit({ recruitId: 'r2', firstName: 'Bob', position: 'MB', stars: 3 }),
          mkRecruit({ recruitId: 'r3', firstName: 'Carol', position: 'OH', stars: 2, hometownRegion: 'EAST' }),
        ],
      }),
      open: vi.fn(),
      action: vi.fn().mockResolvedValue({ ok: true, newInterest: 230, budgetRemaining: 46, week: 3 }),
      advance: vi.fn().mockResolvedValue({ ok: true, week: 3, aiActionsApplied: 10, commitsResolved: 1 }),
      close: vi.fn(),
    } as Window['vcd']['recruiting'],
  };
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
  });
  useSaveSlotsStore.setState({ slots: [], status: 'idle', error: null, openedSlotId: 'slot-1' });
  // Sprint 21: simulate "ready, no userTeam" so the screen falls back to teams[0].
  useUserTeamStore.setState({ userTeamId: null, status: 'ready', error: null });
});

describe('<RecruitingBoard />', () => {
  it('renders the table with recruits when RECRUITING phase', async () => {
    makeVcd();
    render(<RecruitingBoard />);
    await waitFor(() => expect(screen.getByText(/Phase: RECRUITING/)).toBeInTheDocument());
    expect(screen.getByText('Alice Recruit')).toBeInTheDocument();
    expect(screen.getByText('Bob Recruit')).toBeInTheDocument();
  });

  it('position filter narrows visible rows', async () => {
    makeVcd();
    render(<RecruitingBoard />);
    await waitFor(() => expect(screen.getByText('Alice Recruit')).toBeInTheDocument());
    const posSelect = screen.getByLabelText('Filter by position');
    fireEvent.change(posSelect, { target: { value: 'MB' } });
    expect(screen.queryByText('Alice Recruit')).toBeNull();
    expect(screen.getByText('Bob Recruit')).toBeInTheDocument();
  });

  it('region filter narrows visible rows', async () => {
    makeVcd();
    render(<RecruitingBoard />);
    await waitFor(() => expect(screen.getByText('Carol Recruit')).toBeInTheDocument());
    const regionSelect = screen.getByLabelText('Filter by region');
    fireEvent.change(regionSelect, { target: { value: 'EAST' } });
    expect(screen.queryByText('Alice Recruit')).toBeNull();
    expect(screen.getByText('Carol Recruit')).toBeInTheDocument();
  });

  it('clicking Call calls recruiting.action IPC', async () => {
    makeVcd();
    render(<RecruitingBoard />);
    await waitFor(() => expect(screen.getByText('Alice Recruit')).toBeInTheDocument());
    // Find the first "Call" button in Alice's row.
    const callButtons = screen.getAllByRole('button', { name: 'Call' });
    fireEvent.click(callButtons[0]!);
    await waitFor(() =>
      expect(window.vcd.recruiting.action).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CALL', teamId: 'team-1' }),
      ),
    );
  });

  it('axe-clean', async () => {
    makeVcd();
    const { container } = render(<RecruitingBoard />);
    await waitFor(() => expect(screen.getByText('Alice Recruit')).toBeInTheDocument());
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
