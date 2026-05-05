// Sprint 31 Task 31.2: visual rotation tracker tests.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { sim } from '@vcd/shared';
import { RotationTracker } from '../../app/src/components/livePlay/RotationTracker';

const NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
const nameForSlot = (i: number) => NAMES[i] ?? `Slot ${i + 1}`;

describe('RotationTracker', () => {
  it('renders all 6 cells with names from the lookup', () => {
    render(
      <RotationTracker
        rotation={sim.initialRotation()}
        libero={null}
        nameForSlot={nameForSlot}
      />
    );
    for (const name of NAMES) {
      expect(screen.getByText(name)).toBeTruthy();
    }
  });

  it('marks front-row cells (P2/P3/P4) with aria-label containing "front row"', () => {
    render(
      <RotationTracker
        rotation={sim.initialRotation()}
        libero={null}
        nameForSlot={nameForSlot}
      />
    );
    // initialRotation: slots [0,1,2,3,4,5] at positions [P1,P2,P3,P4,P5,P6]
    // → P2/P3/P4 hold names index 1/2/3
    const p2 = screen.getByLabelText(/P2:.*front row/);
    const p3 = screen.getByLabelText(/P3:.*front row/);
    const p4 = screen.getByLabelText(/P4:.*front row/);
    expect(p2).toBeTruthy();
    expect(p3).toBeTruthy();
    expect(p4).toBeTruthy();
  });

  it('marks back-row cells (P1/P5/P6) with aria-label containing "back row"', () => {
    render(
      <RotationTracker
        rotation={sim.initialRotation()}
        libero={null}
        nameForSlot={nameForSlot}
      />
    );
    expect(screen.getByLabelText(/P1:.*back row/)).toBeTruthy();
    expect(screen.getByLabelText(/P5:.*back row/)).toBeTruthy();
    expect(screen.getByLabelText(/P6:.*back row/)).toBeTruthy();
  });

  it('renders libero "L" badge when libero is on court', () => {
    // Libero (slot 5) replaces back-row player at slot 0 (paired index = 0).
    const liberoOn: sim.LiberoState = {
      liberoIndex: 5,
      pairedBackRowIndex: 0,
      exceptionUsed: false,
    };
    render(
      <RotationTracker
        rotation={sim.initialRotation()}
        libero={liberoOn}
        nameForSlot={nameForSlot}
      />
    );
    // Badge specifically — exact aria-label
    const badge = screen.getByLabelText('libero');
    expect(badge.textContent).toBe('L');
  });

  it('does not render "L" badge when libero off court', () => {
    const liberoOff = sim.liberoOff(5);
    render(
      <RotationTracker
        rotation={sim.initialRotation()}
        libero={liberoOff}
        nameForSlot={nameForSlot}
      />
    );
    expect(screen.queryByLabelText('libero')).toBeNull();
  });

  it('reflects rotation prop changes (cells re-render in shifted order)', () => {
    const { rerender } = render(
      <RotationTracker
        rotation={sim.initialRotation()}
        libero={null}
        nameForSlot={nameForSlot}
      />
    );
    // Initial: P1 holds slot 0 = Alpha
    expect(screen.getByLabelText(/P1: Alpha/)).toBeTruthy();
    // After rotation: P1 holds slot 1 = Bravo
    rerender(
      <RotationTracker
        rotation={sim.rotate(sim.initialRotation())}
        libero={null}
        nameForSlot={nameForSlot}
      />
    );
    expect(screen.getByLabelText(/P1: Bravo/)).toBeTruthy();
  });
});
