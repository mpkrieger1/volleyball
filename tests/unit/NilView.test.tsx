import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { NilView } from '../../app/src/screens/NilView';
import { useNilStore } from '../../app/src/store/useNilStore';
import { useSaveSlotsStore } from '../../app/src/store/useSaveSlotsStore';
import { useUserTeamStore } from '../../app/src/store/useUserTeamStore';

const mkRow = (over: Partial<{
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  classYear: string;
  overall: number;
  valueCents: number;
  currentNilCents: number;
}> = {}) => ({
  playerId: `p${crypto.randomUUID().slice(0, 7)}`,
  firstName: 'Test',
  lastName: 'Player',
  position: 'OH',
  classYear: 'JR',
  overall: 75,
  valueCents: 25_000_00,
  currentNilCents: 0,
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
    recruiting: {} as Window['vcd']['recruiting'],
    portal: {} as Window['vcd']['portal'],
    nil: {
      state: vi.fn().mockResolvedValue({
        ok: true,
        collectiveBudget: 400_000_00,
        totalSpent: 100_000_00,
        remaining: 300_000_00,
        enthusiasm: 50,
        // Sprint 28: NIL window-open gate — Save/Revoke buttons are disabled
        // when isOpen is false. Tests need both flags set.
        phase: 'RECRUITING',
        isOpen: true,
        roster: [
          mkRow({ firstName: 'Alice', position: 'OH', overall: 88, currentNilCents: 50_000_00 }),
          mkRow({ firstName: 'Bob', position: 'MB', overall: 75, currentNilCents: 0 }),
        ],
      }),
      assign: vi
        .fn()
        .mockResolvedValue({ ok: true, newTotalSpent: 120_000_00, remaining: 280_000_00, playerValueCents: 20_000_00 }),
      revoke: vi.fn().mockResolvedValue({ ok: true, removed: true }),
      autoDistribute: vi.fn().mockResolvedValue({ ok: true, dealsCreated: 12, totalSpent: 350_000_00 }),
    } as Window['vcd']['nil'],
  };
}

beforeEach(() => {
  useNilStore.setState({
    collectiveBudget: 0,
    totalSpent: 0,
    remaining: 0,
    enthusiasm: 50,
    roster: [],
    status: 'idle',
    error: null,
  });
  useSaveSlotsStore.setState({ slots: [], status: 'idle', error: null, openedSlotId: 'slot-1' });
  // Sprint 28: NilView early-returns a placeholder when userTeamId is null.
  // Tests that exercise actions need a non-null user team.
  useUserTeamStore.setState({ userTeamId: 'team-1', status: 'ready', error: null });
});

describe('<NilView />', () => {
  it('renders budget + spent + remaining', async () => {
    makeVcd();
    render(<NilView />);
    await waitFor(() => expect(screen.getByText(/Budget: \$400,000/)).toBeInTheDocument());
    expect(screen.getByText(/Spent: \$100,000/)).toBeInTheDocument();
    expect(screen.getByText(/Remaining: \$300,000/)).toBeInTheDocument();
  });

  it('renders roster rows with player, position, class, overall, value, current NIL', async () => {
    makeVcd();
    render(<NilView />);
    await waitFor(() => expect(screen.getByText('Alice Player')).toBeInTheDocument());
    expect(screen.getByText('Bob Player')).toBeInTheDocument();
  });

  it('clicking Save calls assign IPC with correct cents', async () => {
    makeVcd();
    render(<NilView />);
    await waitFor(() => expect(screen.getByText('Alice Player')).toBeInTheDocument());
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0]!, { target: { value: '10000' } });
    const saveButtons = screen.getAllByRole('button', { name: 'Save' });
    fireEvent.click(saveButtons[0]!);
    await waitFor(() =>
      expect(window.vcd.nil.assign).toHaveBeenCalledWith(
        expect.objectContaining({ amountCents: 10000 * 100 }),
      ),
    );
  });

  it('Revoke button disabled when currentNilCents === 0', async () => {
    makeVcd();
    render(<NilView />);
    await waitFor(() => expect(screen.getByText('Alice Player')).toBeInTheDocument());
    const revokeButtons = screen.getAllByRole('button', { name: 'Revoke' });
    // Alice has $50k NIL (enabled); Bob has $0 (disabled).
    expect(revokeButtons[0]).not.toBeDisabled();
    expect(revokeButtons[1]).toBeDisabled();
  });

  it('Auto-distribute button calls IPC', async () => {
    makeVcd();
    render(<NilView />);
    await waitFor(() => expect(screen.getByText('Alice Player')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Auto-distribute' }));
    await waitFor(() =>
      expect(window.vcd.nil.autoDistribute).toHaveBeenCalledWith('slot-1', 'team-1'),
    );
  });

  it('axe-clean', async () => {
    makeVcd();
    const { container } = render(<NilView />);
    await waitFor(() => expect(screen.getByText('Alice Player')).toBeInTheDocument());
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
