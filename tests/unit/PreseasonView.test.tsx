import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { PreseasonView } from '../../app/src/screens/PreseasonView';
import { useOffseasonStore } from '../../app/src/store/useOffseasonStore';
import { useSaveSlotsStore } from '../../app/src/store/useSaveSlotsStore';

const mkRow = (over: Partial<{
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  classYear: string;
  overall: number;
  redshirtUsed: boolean;
  redshirtLocked: boolean;
}> = {}) => ({
  playerId: `p${crypto.randomUUID().slice(0, 7)}`,
  firstName: 'Test',
  lastName: 'Player',
  position: 'OH',
  classYear: 'JR',
  overall: 72,
  redshirtUsed: false,
  redshirtLocked: false,
  ...over,
});

function makeVcd(phase = 'PRESEASON') {
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
    nil: {} as Window['vcd']['nil'],
    offseason: {
      run: vi
        .fn()
        .mockResolvedValue({ ok: true, playersGraduated: 540, playersCut: 120, teamsUpdated: 360, newSeasonYear: 2027 }),
      toggleRedshirt: vi.fn().mockResolvedValue({ ok: true, redshirtUsed: true }),
      preseasonState: vi.fn().mockResolvedValue({
        ok: true,
        phase,
        year: 2027,
        roster: [
          mkRow({ firstName: 'Alice', classYear: 'FR' }),
          mkRow({ firstName: 'Bob', classYear: 'SR', redshirtLocked: true }),
        ],
      }),
      startRegular: vi.fn().mockResolvedValue({ ok: true, phase: 'REGULAR', year: 2027 }),
    } as Window['vcd']['offseason'],
  };
}

beforeEach(() => {
  useOffseasonStore.setState({
    phase: 'OFFSEASON',
    year: 2026,
    roster: [],
    status: 'idle',
    error: null,
  });
  useSaveSlotsStore.setState({ slots: [], status: 'idle', error: null, openedSlotId: 'slot-1' });
});

describe('<PreseasonView />', () => {
  it('PRESEASON: renders roster and toggle checkboxes', async () => {
    makeVcd('PRESEASON');
    render(<PreseasonView />);
    await waitFor(() => expect(screen.getByText(/Phase: PRESEASON/)).toBeInTheDocument());
    expect(screen.getByText('Alice Player')).toBeInTheDocument();
    expect(screen.getByText('Bob Player')).toBeInTheDocument();
  });

  it('PRESEASON: redshirt-locked player\'s checkbox is disabled', async () => {
    makeVcd('PRESEASON');
    render(<PreseasonView />);
    await waitFor(() => expect(screen.getByText('Bob Player')).toBeInTheDocument());
    const checkboxes = screen.getAllByRole('checkbox');
    // Bob is redshirtLocked=true → disabled; Alice is enabled.
    expect(checkboxes[0]).not.toBeDisabled();
    expect(checkboxes[1]).toBeDisabled();
  });

  it('PRESEASON: clicking checkbox calls toggleRedshirt IPC', async () => {
    makeVcd('PRESEASON');
    render(<PreseasonView />);
    await waitFor(() => expect(screen.getByText('Alice Player')).toBeInTheDocument());
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);
    await waitFor(() =>
      expect(window.vcd.offseason.toggleRedshirt).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: 'team-1', redshirtUsed: true }),
      ),
    );
  });

  it('PRESEASON: Start Season button fires startRegular', async () => {
    makeVcd('PRESEASON');
    render(<PreseasonView />);
    await waitFor(() => expect(screen.getByText(/Phase: PRESEASON/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Start Season' }));
    await waitFor(() => expect(window.vcd.offseason.startRegular).toHaveBeenCalledWith('slot-1'));
  });

  it('OFFSEASON: Run Offseason button fires run IPC', async () => {
    makeVcd('OFFSEASON');
    render(<PreseasonView />);
    await waitFor(() => expect(screen.getByText(/Phase: OFFSEASON/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Run Offseason' }));
    await waitFor(() => expect(window.vcd.offseason.run).toHaveBeenCalledWith('slot-1'));
  });

  it('axe-clean', async () => {
    makeVcd('PRESEASON');
    const { container } = render(<PreseasonView />);
    await waitFor(() => expect(screen.getByText('Alice Player')).toBeInTheDocument());
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
