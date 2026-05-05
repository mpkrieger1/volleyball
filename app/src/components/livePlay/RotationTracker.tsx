// Sprint 31 Task 31.2: visual rotation tracker.
//
// 6-cell grid showing the user team's current on-court rotation in
// volleyball court orientation:
//
//     [P4  P3  P2]   ← net
//     [P5  P6  P1]
//
// Front-row cells (P2, P3, P4) get a subtle highlight. Libero cell
// (when on court) gets an "L" badge.

import { sim } from '@vcd/shared';

const FRONT_ORDER: readonly sim.Position[] = ['P4', 'P3', 'P2'];
const BACK_ORDER: readonly sim.Position[] = ['P5', 'P6', 'P1'];

export type RotationTrackerProps = {
  rotation: sim.RotationState;
  libero: sim.LiberoState | null;
  /** Slot index → display name lookup. Defaults to "Slot N" if missing. */
  nameForSlot: (slotIdx: number) => string;
  /** Optional team label shown above the grid. */
  teamLabel?: string;
};

export function RotationTracker({ rotation, libero, nameForSlot, teamLabel }: RotationTrackerProps) {
  return (
    <div className="rotation-tracker" aria-label={teamLabel ? `${teamLabel} rotation` : 'rotation tracker'}>
      {teamLabel && <div className="rotation-tracker__label">{teamLabel}</div>}
      <div className="rotation-tracker__grid" role="grid">
        {[FRONT_ORDER, BACK_ORDER].map((row, rowIdx) => (
          <div key={rowIdx} role="row" className="rotation-tracker__row">
            {row.map((pos) => {
              const slotIdx = sim.playerAt(rotation, pos);
              const isFront = sim.isFrontRow(pos);
              const liberoOnCourt =
                libero !== null
                && libero.pairedBackRowIndex !== null
                && libero.pairedBackRowIndex === slotIdx;
              const cellClass = `rotation-tracker__cell ${
                isFront ? 'rotation-tracker__cell--front' : 'rotation-tracker__cell--back'
              }`;
              const ariaLabel = `${pos}: ${nameForSlot(slotIdx)}${isFront ? ', front row' : ', back row'}${liberoOnCourt ? ', libero in' : ''}`;
              return (
                <div key={pos} role="gridcell" className={cellClass} aria-label={ariaLabel}>
                  <span className="rotation-tracker__pos">{pos}</span>
                  <span className="rotation-tracker__name">{nameForSlot(slotIdx)}</span>
                  {liberoOnCourt && (
                    <span className="rotation-tracker__libero" aria-label="libero">L</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
