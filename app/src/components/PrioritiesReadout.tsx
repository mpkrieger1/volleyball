// Sprint 36 Task 36.5 — PrioritiesReadout.
//
// 5 horizontal bars showing recruit priority weights (0..10). When
// `wantsToLeaveHome` is true, the Proximity bar gets a "wants to leave"
// indicator (text label, not color alone — color-blind safe).

import type { recruiting } from '@vcd/shared';

type Props = {
  priorities: recruiting.RecruitPriorities;
  wantsToLeaveHome: boolean;
};

const ROWS: Array<{ key: keyof recruiting.RecruitPriorities; label: string }> = [
  { key: 'playingTime', label: 'Playing Time' },
  { key: 'proximityToHome', label: 'Proximity' },
  { key: 'prestige', label: 'Prestige' },
  { key: 'facilities', label: 'Facilities' },
  { key: 'nilDeal', label: 'NIL' },
];

export function PrioritiesReadout({ priorities, wantsToLeaveHome }: Props) {
  return (
    <section
      className="priorities-readout"
      aria-labelledby="priorities-readout-heading"
      data-testid="priorities-readout"
    >
      <h4 id="priorities-readout-heading" className="priorities-readout__heading">
        What This Recruit Cares About
      </h4>
      <ul className="priorities-readout__list">
        {ROWS.map((r) => {
          const value = priorities[r.key];
          const pct = Math.round((value / 10) * 100);
          const isProximity = r.key === 'proximityToHome';
          const subLabel =
            isProximity && wantsToLeaveHome
              ? ' (wants to leave home)'
              : '';
          return (
            <li
              key={r.key}
              className="priorities-readout__row"
              data-testid={`priority-${r.key}`}
            >
              <span className="priorities-readout__label">
                {r.label}
                {subLabel}
              </span>
              <span className="priorities-readout__bar" aria-hidden="true">
                <span
                  className="priorities-readout__bar-fill"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="priorities-readout__value">{value}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
