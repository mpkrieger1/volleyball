// Sprint 30 Task 30.3 + 30.5: substitution picker modal.
//
// Two-step UX:
//   1. User selects a slot to swap OUT (1..6, libero slot disabled).
//   2. User picks a bench player to swap IN.
//   3. Confirm → IPC call.

import { useEffect, useRef, useState } from 'react';
import type { sim } from '@vcd/shared';

export type SubPickerProps = {
  open: boolean;
  homeTeamName: string;
  team: sim.TeamLiveState;
  /** Slot index of the libero (auto-handled; not subbable). */
  liberoSlot: number;
  subsRemaining: number;
  onConfirm: (outIdx: number, inPlayerId: string) => void;
  onCancel: () => void;
};

export function SubPicker({
  open,
  homeTeamName,
  team,
  liberoSlot,
  subsRemaining,
  onConfirm,
  onCancel,
}: SubPickerProps) {
  const [selectedOut, setSelectedOut] = useState<number | null>(null);
  const [selectedIn, setSelectedIn] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setSelectedOut(null);
      setSelectedIn(null);
      return;
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const canConfirm = selectedOut !== null && selectedIn !== null;

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sub-picker-heading"
        className="modal-card sub-picker"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <header>
          <h2 id="sub-picker-heading">Substitute — {homeTeamName}</h2>
          <p>Subs remaining this set: <strong>{subsRemaining}/15</strong></p>
        </header>

        <div className="sub-picker__cols">
          <section aria-labelledby="sub-out-heading">
            <h3 id="sub-out-heading">On court (pick to remove)</h3>
            <ul>
              {team.playerIdsBySlot.map((pid, i) => {
                const isLibero = i === liberoSlot;
                const isSelected = selectedOut === i;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      className={isSelected ? 'sub-picker__row sub-picker__row--selected' : 'sub-picker__row'}
                      disabled={isLibero}
                      onClick={() => setSelectedOut(i)}
                      aria-pressed={isSelected}
                    >
                      Slot {i + 1}{isLibero ? ' (libero — auto)' : ''} — {pid || '(no player id)'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="sub-in-heading">
            <h3 id="sub-in-heading">Bench (pick to bring in)</h3>
            <ul>
              {team.bench.length === 0 && <li>No bench players available.</li>}
              {team.bench.filter((b) => !b.isLibero).map((b) => {
                const isSelected = selectedIn === b.playerId;
                return (
                  <li key={b.playerId}>
                    <button
                      type="button"
                      className={isSelected ? 'sub-picker__row sub-picker__row--selected' : 'sub-picker__row'}
                      onClick={() => setSelectedIn(b.playerId)}
                      aria-pressed={isSelected}
                    >
                      #{b.jersey} {b.firstName} {b.lastName} ({b.position}) — OVR {Math.round((b.ratings.attack + b.ratings.block + b.ratings.serve + b.ratings.pass + b.ratings.set + b.ratings.dig) / 6)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <footer className="sub-picker__actions">
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              if (selectedOut !== null && selectedIn !== null) {
                onConfirm(selectedOut, selectedIn);
              }
            }}
          >
            Confirm sub
          </button>
          <button type="button" onClick={onCancel}>Cancel</button>
        </footer>
      </div>
    </div>
  );
}
