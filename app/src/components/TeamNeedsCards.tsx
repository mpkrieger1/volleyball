// Sprint 28 Task 28.5B: per-position needs cards (FCCD-modeled).
//
// Each card surfaces:
//   - Roster count (big number)
//   - Position abbreviation
//   - Graduating count (small icon + count)
//   - Targets currently being recruited at this position (small icon + count)
//   - "Needs: N" footer (positions where roster post-graduation < target)
//
// Card pattern follows ShadCN Card best practices: semantic article element,
// rounded corners, consistent spacing, subtle border, tabular figures.

import type { recruitingIpc } from '@vcd/shared';
import type { BoardRecruit } from '../store/useRecruitingStore';

type Props = {
  needs: recruitingIpc.PositionNeed[];
  recruits: BoardRecruit[];
};

const ORDER = ['S', 'OH', 'MB', 'OPP', 'L', 'DS'];

export function TeamNeedsCards({ needs, recruits }: Props) {
  const byPos = new Map(needs.map((n) => [n.position, n]));
  const targetCounts = new Map<string, number>();
  for (const r of recruits) {
    if (r.actionsSpent === 0 || r.commitState !== 'PENDING') continue;
    targetCounts.set(r.position, (targetCounts.get(r.position) ?? 0) + 1);
  }

  return (
    <section
      aria-label="Targets by position"
      className="team-needs-cards"
      data-testid="team-needs-cards"
    >
      <h2 className="team-needs-cards__heading">Targets by position</h2>
      <div className="team-needs-cards__row">
        {ORDER.map((pos) => {
          const n = byPos.get(pos) ?? {
            position: pos,
            rosterCount: 0,
            graduatingCount: 0,
            thinness: 0,
          };
          const targets = targetCounts.get(pos) ?? 0;
          const isThin = n.thinness > 0;
          return (
            <article
              key={pos}
              className={
                isThin
                  ? 'team-needs-card team-needs-card--thin'
                  : 'team-needs-card'
              }
              data-testid={`team-needs-card-${pos}`}
            >
              <div className="team-needs-card__top">
                <span className="team-needs-card__count">{n.rosterCount}</span>
                <span className="team-needs-card__pos">{pos}</span>
              </div>
              <dl className="team-needs-card__stats">
                <div>
                  <dt aria-label="Graduating">Grad</dt>
                  <dd>{n.graduatingCount}</dd>
                </div>
                <div>
                  <dt aria-label="Targets">Tgt</dt>
                  <dd>{targets}</dd>
                </div>
              </dl>
              <p className="team-needs-card__needs">
                Needs: <strong>{n.thinness}</strong>
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
