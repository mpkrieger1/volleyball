// Sprint 33 Task 33.5 — TrainingFocusPicker.
//
// 3 coach panels (HC, AHC, AC). Each panel: 3 dropdowns (slot 0/1/2),
// each scoped to the role's pool of trainable skills. Default selection:
// AI heuristic's top-3 attributes for that role + roster.
//
// Color-blind safe: dropdowns are text-based; labels are visible.
// Keyboard-friendly: native <select> + <button>.

import { useMemo } from 'react';
import type { offseasonIpc } from '@vcd/shared';

type Props = {
  coaches: offseasonIpc.CoachSlotInfo[];
  onPick: (coachId: string, slotIndex: number, attribute: string) => void;
  onAdvance: () => void;
  isAdvancing?: boolean;
};

function attrLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function TrainingFocusPicker({
  coaches,
  onPick,
  onAdvance,
  isAdvancing,
}: Props) {
  const allFilled = useMemo(
    () =>
      coaches.length === 3 &&
      coaches.every((c) =>
        [0, 1, 2].every((i) => c.currentPicks[i] !== null && c.currentPicks[i] !== undefined),
      ),
    [coaches],
  );

  return (
    <section
      className="training-focus-picker"
      aria-labelledby="training-focus-picker-heading"
      data-testid="training-focus-picker"
    >
      <header className="training-focus-picker__header">
        <h3 id="training-focus-picker-heading" className="offseason-panel__h2">
          Training Focus
        </h3>
        <p className="training-focus-picker__intro">
          Each coach picks three attributes to drill this preseason. Repeating an
          attribute across slots lowers gains (1×/0.6×/0.4× per pick).
        </p>
      </header>

      <div className="training-focus-picker__panels">
        {coaches.map((c) => (
          <div
            key={c.coachId}
            className="training-focus-picker__panel"
            data-testid={`coach-panel-${c.role}`}
          >
            <div className="training-focus-picker__coach">
              <strong>{c.role}</strong> {c.firstName} {c.lastName}{' '}
              <span className="training-focus-picker__rating">DEV {c.ratingDevelop}</span>
            </div>
            <ul className="training-focus-picker__slots">
              {[0, 1, 2].map((slotIndex) => {
                const value = c.currentPicks[slotIndex] ?? c.defaultPicks[slotIndex] ?? '';
                return (
                  <li key={slotIndex} className="training-focus-picker__slot">
                    <label>
                      <span className="training-focus-picker__slot-label">
                        Slot {slotIndex + 1}
                      </span>
                      <select
                        data-testid={`slot-${c.role}-${slotIndex}`}
                        value={value}
                        onChange={(e) => onPick(c.coachId, slotIndex, e.target.value)}
                      >
                        {c.validFocuses.map((f) => (
                          <option key={f} value={f}>
                            {attrLabel(f)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="training-focus-picker__advance">
        <button
          type="button"
          className="offseason-panel__primary"
          onClick={onAdvance}
          disabled={!allFilled || isAdvancing}
          data-testid="training-focus-advance"
        >
          {isAdvancing ? 'Applying…' : 'Advance to Training Results'}
        </button>
      </div>
    </section>
  );
}
