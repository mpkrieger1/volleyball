import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { SaveSlots } from '../../app/src/screens/SaveSlots';
import { useSaveSlotsStore } from '../../app/src/store/useSaveSlotsStore';
import { useUserTeamStore } from '../../app/src/store/useUserTeamStore';

const makeSlot = (over: Partial<{ id: string; name: string }> = {}) => ({
  id: over.id ?? 'slot-1',
  name: over.name ?? 'Alpha Dynasty',
  createdAt: '2026-04-18T12:00:00.000Z',
  lastOpenedAt: '2026-04-18T12:00:00.000Z',
  dynastyYear: 2026,
});

const mockVcd = (over: Partial<Window['vcd']['saveSlots']> = {}) => {
  const defaults: Window['vcd']['saveSlots'] = {
    list: vi.fn().mockResolvedValue({ ok: true, slots: [] }),
    create: vi.fn().mockResolvedValue({ ok: true, slot: makeSlot() }),
    open: vi.fn().mockResolvedValue({ ok: true, slot: makeSlot() }),
    delete: vi.fn().mockResolvedValue({ ok: true }),
  };
  (window as unknown as { vcd: Window['vcd'] }).vcd = {
    version: '0.1.0',
    saveSlots: { ...defaults, ...over },
    // Sprint 21: post-Save-create picker calls these. Provide minimal stubs.
    match: {
      listTeams: vi.fn().mockResolvedValue({
        ok: true,
        teams: [
          {
            id: 't-1',
            schoolName: 'Nebraska',
            abbr: 'NEB',
            conferenceId: 'big-ten',
            primaryColor: '#000',
            secondaryColor: '#fff',
            prestige: 90,
          },
        ],
      }),
    } as Window['vcd']['match'],
    season: {
      setUserTeam: vi.fn().mockResolvedValue({ ok: true, userTeamId: 't-1' }),
      getUserTeam: vi.fn().mockResolvedValue({ ok: true, userTeamId: null }),
    } as unknown as Window['vcd']['season'],
  } as Window['vcd'];
  return (window as unknown as { vcd: Window['vcd'] }).vcd.saveSlots;
};

beforeEach(() => {
  useSaveSlotsStore.setState({
    slots: [],
    status: 'idle',
    error: null,
    openedSlotId: null,
  });
  useUserTeamStore.getState().reset();
});

describe('<SaveSlots />', () => {
  it('renders empty state when list returns no slots', async () => {
    mockVcd();
    render(<SaveSlots />);
    await waitFor(() => {
      expect(screen.getByText(/no saves yet/i)).toBeInTheDocument();
    });
  });

  it('renders a table row for each slot', async () => {
    mockVcd({
      list: vi.fn().mockResolvedValue({
        ok: true,
        slots: [makeSlot({ id: '1', name: 'Badgers' }), makeSlot({ id: '2', name: 'Huskers' })],
      }),
    });
    render(<SaveSlots />);
    await waitFor(() => expect(screen.getByText('Badgers')).toBeInTheDocument());
    expect(screen.getByText('Huskers')).toBeInTheDocument();
  });

  it('create flow: toggle form, submit, calls create', async () => {
    const api = mockVcd();
    const user = userEvent.setup();
    render(<SaveSlots />);
    await user.click(screen.getByRole('button', { name: /new save/i }));
    await user.type(screen.getByLabelText(/dynasty name/i), 'My Dynasty');
    await user.click(screen.getByRole('button', { name: /^create$/i }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith('My Dynasty'));
  });

  it('delete flow: confirm dialog triggers delete', async () => {
    const api = mockVcd({
      list: vi.fn().mockResolvedValue({ ok: true, slots: [makeSlot({ id: 'del-me', name: 'Doomed' })] }),
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<SaveSlots />);
    await waitFor(() => expect(screen.getByText('Doomed')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /delete save doomed/i }));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('del-me'));
  });

  it('shows error alert on failure', async () => {
    mockVcd({
      list: vi
        .fn()
        .mockResolvedValue({ ok: false, error: { code: 'IO_ERROR', message: 'disk is full' } }),
    });
    render(<SaveSlots />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('disk is full'));
  });

  it('has no axe-core accessibility violations', async () => {
    mockVcd({
      list: vi.fn().mockResolvedValue({ ok: true, slots: [makeSlot()] }),
    });
    const { container } = render(<SaveSlots />);
    await waitFor(() => expect(screen.getByText('Alpha Dynasty')).toBeInTheDocument());
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
