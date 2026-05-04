// Sprint 28 Task 28.5B: per-recruit interest meter.
//
// Stacked horizontal bars per competing team (top 5). User team highlighted
// with the accent color. Interest values clamp to MAX_INTEREST=1000 (per
// existing interestModel).

import type { recruitingIpc } from '@vcd/shared';

const MAX_INTEREST = 1000;

type Props = {
  rows: recruitingIpc.InterestMeterRow[];
};

export function InterestMeter({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="interest-meter__empty" data-testid="interest-meter-empty">
        No teams have scouted this recruit yet.
      </p>
    );
  }
  const leader = rows[0]!;
  return (
    <div className="interest-meter" role="list" aria-label="Competing teams">
      {rows.map((r, i) => {
        const pct = Math.max(2, Math.round((r.interest / MAX_INTEREST) * 100));
        const delta = r.interest - leader.interest;
        return (
          <div
            key={r.teamId}
            role="listitem"
            className={
              r.isUserTeam
                ? 'interest-meter__row interest-meter__row--user'
                : 'interest-meter__row'
            }
            data-testid={`interest-row-${r.teamId}`}
          >
            <span className="interest-meter__rank">#{i + 1}</span>
            <span className="interest-meter__team">{r.teamAbbr}</span>
            <div
              className="interest-meter__bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={MAX_INTEREST}
              aria-valuenow={r.interest}
              aria-label={`${r.teamAbbr} interest`}
            >
              <span
                className="interest-meter__fill"
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="interest-meter__points">
              {r.interest}
              {i > 0 && (
                <span className="interest-meter__delta"> ({delta})</span>
              )}
              {i === 0 && <span className="interest-meter__leader"> Leader</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
