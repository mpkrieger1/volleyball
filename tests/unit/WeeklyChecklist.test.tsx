// Sprint 28: Weekly checklist on Season Hub.

import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { axe } from 'jest-axe';
import {
  WeeklyChecklist,
  buildChecklist,
  type ChecklistInput,
} from '../../app/src/components/WeeklyChecklist';
import type { scheduleIpc } from '@vcd/shared';

const mkRow = (over: Partial<scheduleIpc.TeamScheduleRow> = {}): scheduleIpc.TeamScheduleRow => ({
  matchId: 'm1',
  weekIndex: 5,
  isoDate: '2026-10-02',
  opponentId: 't2',
  opponentSchool: 'Stanford',
  opponentAbbr: 'STAN',
  isHome: true,
  isConference: true,
  isTournament: false,
  isNeutralSite: false,
  winnerId: null,
  homeSetsWon: null,
  awaySetsWon: null,
  tournamentRound: null,
  ...over,
});

const baseInput: ChecklistInput = {
  phase: 'REGULAR',
  currentWeek: 5,
  rows: [mkRow()],
  recruitingPhase: 'OFFSEASON',
  recruitingBudgetRemaining: 0,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('buildChecklist', () => {
  it('shows the user match for the current week as Pending when unplayed', () => {
    const items = buildChecklist(baseInput);
    const match = items.find((i) => i.id === 'match');
    expect(match).toBeDefined();
    expect(match!.status).toBe('pending');
    expect(match!.detail).toMatch(/STAN/);
  });

  it('shows the user match as Done when winnerId is set', () => {
    const items = buildChecklist({
      ...baseInput,
      rows: [mkRow({ winnerId: 't1' })],
    });
    const match = items.find((i) => i.id === 'match');
    expect(match!.status).toBe('done');
    expect(match!.ctaLabel).toMatch(/replay/i);
  });

  it('falls back to Bye week when no row matches the current week', () => {
    const items = buildChecklist({
      ...baseInput,
      rows: [mkRow({ weekIndex: 7 })],
    });
    const match = items.find((i) => i.id === 'match');
    expect(match!.title).toMatch(/Bye/);
    expect(match!.status).toBe('na');
  });

  it('adds a Recruiting actions item when a recruiting cycle is active', () => {
    const items = buildChecklist({
      ...baseInput,
      recruitingPhase: 'RECRUITING',
      recruitingBudgetRemaining: 8,
    });
    const rec = items.find((i) => i.id === 'recruiting');
    expect(rec).toBeDefined();
    expect(rec!.status).toBe('pending');
    expect(rec!.detail).toMatch(/8 action/);
  });

  it('marks recruiting Done when budget exhausted', () => {
    const items = buildChecklist({
      ...baseInput,
      recruitingPhase: 'RECRUITING',
      recruitingBudgetRemaining: 0,
    });
    const rec = items.find((i) => i.id === 'recruiting');
    expect(rec!.status).toBe('done');
  });

  it('adds preseason-specific items when phase is PRESEASON', () => {
    const items = buildChecklist({
      ...baseInput,
      phase: 'PRESEASON',
      currentWeek: 0,
      rows: [],
    });
    const ids = items.map((i) => i.id);
    expect(ids).toContain('preseason-roster');
    expect(ids).toContain('preseason-staff');
  });

  it('adds postseason items during NCAA tournament phase', () => {
    const items = buildChecklist({
      ...baseInput,
      phase: 'NCAA',
      currentWeek: 18,
      rows: [],
    });
    const ids = items.map((i) => i.id);
    expect(ids).toContain('bracket');
  });
});

describe('<WeeklyChecklist />', () => {
  it('renders all items and the progress summary', () => {
    const items = buildChecklist({
      ...baseInput,
      recruitingPhase: 'RECRUITING',
      recruitingBudgetRemaining: 5,
    });
    const onNavigate = vi.fn();
    render(<WeeklyChecklist items={items} onNavigate={onNavigate} />);
    expect(screen.getByTestId('weekly-checklist')).toBeInTheDocument();
    expect(screen.getByTestId('checklist-item-match')).toBeInTheDocument();
    expect(screen.getByTestId('checklist-item-recruiting')).toBeInTheDocument();
    expect(screen.getByText(/2 of 2 required items pending/i)).toBeInTheDocument();
  });

  it('clicking a CTA invokes onNavigate with the target screen', () => {
    const items = buildChecklist(baseInput);
    const onNavigate = vi.fn();
    render(<WeeklyChecklist items={items} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByTestId('checklist-cta-match'));
    expect(onNavigate).toHaveBeenCalledWith('match-hub');
  });

  it('shows "All required actions complete" when nothing pending', () => {
    const items = buildChecklist({
      ...baseInput,
      rows: [mkRow({ winnerId: 't1' })],
    });
    render(<WeeklyChecklist items={items} onNavigate={vi.fn()} />);
    expect(screen.getByText(/All required actions complete/i)).toBeInTheDocument();
  });

  it('axe-clean', async () => {
    const items = buildChecklist(baseInput);
    const { container } = render(<WeeklyChecklist items={items} onNavigate={vi.fn()} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
