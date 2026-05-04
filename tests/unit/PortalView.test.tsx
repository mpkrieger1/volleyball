import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { PortalView } from '../../app/src/screens/PortalView';
import { usePortalStore } from '../../app/src/store/usePortalStore';
import { useSaveSlotsStore } from '../../app/src/store/useSaveSlotsStore';
import { useUserTeamStore } from '../../app/src/store/useUserTeamStore';

const mkEntry = (over: Partial<{
  transferPortalId: string;
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  classYear: string;
  overall: number;
  originTeamId: string;
  status: string;
  myInterest: number;
  actionsSpent: number;
  lastNilOffer: number;
}> = {}) => ({
  transferPortalId: `tp${crypto.randomUUID().slice(0, 7)}`,
  playerId: `p${crypto.randomUUID().slice(0, 7)}`,
  firstName: 'Test',
  lastName: 'Player',
  position: 'OH',
  classYear: 'SO',
  overall: 70,
  originTeamId: 'other-team',
  status: 'ACTIVE',
  myInterest: 200,
  actionsSpent: 0,
  lastNilOffer: 0,
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
    portal: {
      open: vi.fn(),
      action: vi
        .fn()
        .mockResolvedValue({ ok: true, newInterest: 300, budgetRemaining: 28, week: 1 }),
      advance: vi.fn(),
      close: vi.fn(),
      state: vi.fn().mockResolvedValue({
        ok: true,
        phase: 'PORTAL',
        week: 2,
        budgetRemaining: 28,
        incoming: [
          mkEntry({ firstName: 'Alice', position: 'OH', overall: 82 }),
          mkEntry({ firstName: 'Bob', position: 'MB', overall: 75 }),
        ],
        outgoing: [mkEntry({ firstName: 'Chris', position: 'S', originTeamId: 'team-1' })],
      }),
    } as Window['vcd']['portal'],
  };
}

beforeEach(() => {
  usePortalStore.setState({
    phase: 'OFFSEASON',
    week: 0,
    budgetRemaining: 0,
    incoming: [],
    outgoing: [],
    status: 'idle',
    error: null,
    tab: 'incoming',
    filter: {},
  });
  useSaveSlotsStore.setState({ slots: [], status: 'idle', error: null, openedSlotId: 'slot-1' });
  useUserTeamStore.setState({ userTeamId: null, status: 'ready', error: null });
});

describe('<PortalView />', () => {
  it('renders incoming + outgoing tabs in PORTAL phase', async () => {
    makeVcd();
    render(<PortalView />);
    await waitFor(() => expect(screen.getByTestId('portal-incoming-table')).toBeInTheDocument());
    const tablist = screen.getByRole('tablist', { name: /Portal tabs/ });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(2);
  });

  it('defaults to Incoming tab and shows incoming rows', async () => {
    makeVcd();
    render(<PortalView />);
    const tbl = await screen.findByTestId('portal-incoming-table');
    expect(within(tbl).getByText('Alice')).toBeInTheDocument();
    expect(within(tbl).getByText('Bob')).toBeInTheDocument();
  });

  it('position filter narrows incoming rows', async () => {
    makeVcd();
    render(<PortalView />);
    await screen.findByTestId('portal-incoming-table');
    fireEvent.change(screen.getByLabelText(/Position/i), { target: { value: 'MB' } });
    const tbl = screen.getByTestId('portal-incoming-table');
    expect(within(tbl).queryByText('Alice')).toBeNull();
    expect(within(tbl).getByText('Bob')).toBeInTheDocument();
  });

  it('clicking Call invokes portal.action IPC', async () => {
    makeVcd();
    render(<PortalView />);
    await screen.findByTestId('portal-incoming-table');
    const callButtons = screen.getAllByRole('button', { name: 'Call' });
    fireEvent.click(callButtons[0]!);
    await waitFor(() =>
      expect(window.vcd.portal.action).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CALL', teamId: 'team-1' }),
      ),
    );
  });

  it('switching to Outgoing tab shows outgoing rows', async () => {
    makeVcd();
    render(<PortalView />);
    await screen.findByTestId('portal-incoming-table');
    fireEvent.click(screen.getByRole('tab', { name: /Outgoing/ }));
    const tbl = await screen.findByTestId('portal-outgoing-table');
    expect(within(tbl).getByText('Chris')).toBeInTheDocument();
  });

  it('axe-clean', async () => {
    makeVcd();
    const { container } = render(<PortalView />);
    await screen.findByTestId('portal-incoming-table');
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
