// Sprint 28 Task 28.5B: top stats strip for the Recruiting screen.
//
// Mirrors the FCCD pattern: 4 resource pools surfaced inline so the user
// always knows what they have to spend this week and what's left for the
// season. The "Targets" / "Commits" / "Offers" caps come from the existing
// recruiting model; for v1.0 we don't track Offers separately yet (any
// scholarship offer = a row in RecruitInterest with a high interest), so
// "Offers Used" is approximated from actionsSpent ≥ 1 across all recruits.

import type { recruitingIpc } from '@vcd/shared';
import type { BoardRecruit } from '../store/useRecruitingStore';

type Props = {
  budget: {
    total: number;
    spent: number;
    remaining: number;
    breakdown: { base: number; hc: number; ahc: number; ac: number };
  } | null;
  recruits: BoardRecruit[];
  teamNeeds: recruitingIpc.PositionNeed[];
};

// Sprint 28 (post-screenshot review): user-set caps for v1.0.
const TARGET_CAP = 20;
const COMMIT_CAP = 7;
const OFFER_CAP = 15;

export function RecruitingHeader({ budget, recruits, teamNeeds }: Props) {
  const targets = recruits.filter((r) => r.actionsSpent > 0).length;
  const commits = recruits.filter((r) => r.commitState === 'COMMITTED' || r.commitState === 'SIGNED').length;
  const offersUsed = recruits.filter((r) => r.actionsSpent >= 3).length; // proxy
  const totalThinness = teamNeeds.reduce((s, n) => s + n.thinness, 0);

  return (
    <section
      className="recruiting-header"
      aria-label="Recruiting summary"
      data-testid="recruiting-header"
    >
      <div className="recruiting-header__cap">
        <span className="recruiting-header__cap-label">Recruit Targets</span>
        <span className="recruiting-header__cap-value">
          {targets}<span className="recruiting-header__cap-of"> / {TARGET_CAP}</span>
        </span>
      </div>
      <div className="recruiting-header__cap">
        <span className="recruiting-header__cap-label">Commitments</span>
        <span className="recruiting-header__cap-value">
          {commits}<span className="recruiting-header__cap-of"> / {COMMIT_CAP}</span>
        </span>
      </div>
      <div className="recruiting-header__cap">
        <span className="recruiting-header__cap-label">Offers Used</span>
        <span className="recruiting-header__cap-value">
          {offersUsed}<span className="recruiting-header__cap-of"> / {OFFER_CAP}</span>
        </span>
      </div>
      <div className="recruiting-header__cap" data-testid="recruiting-header-budget">
        <span className="recruiting-header__cap-label">
          Actions remaining (week)
        </span>
        <span className="recruiting-header__cap-value">
          {budget?.remaining ?? 0}
          <span className="recruiting-header__cap-of"> / {budget?.total ?? 0}</span>
        </span>
        {budget && (
          <span className="recruiting-header__breakdown">
            Base {budget.breakdown.base}
            {budget.breakdown.hc > 0 && ` + HC ${budget.breakdown.hc}`}
            {budget.breakdown.ahc > 0 && ` + AHC ${budget.breakdown.ahc}`}
            {budget.breakdown.ac > 0 && ` + AC ${budget.breakdown.ac}`}
          </span>
        )}
      </div>
      <div className="recruiting-header__cap">
        <span className="recruiting-header__cap-label">Roster gaps</span>
        <span className="recruiting-header__cap-value">{totalThinness}</span>
        <span className="recruiting-header__breakdown">
          {teamNeeds
            .filter((n) => n.thinness > 0)
            .map((n) => `${n.position}×${n.thinness}`)
            .join(' · ') || 'None'}
        </span>
      </div>
    </section>
  );
}
