// Sprint 36 Task 36.5 — ScoutTierIndicator.
//
// 3-step progress dots reflecting RecruitInterest.scoutLevel mapped to
// LOCKED/PARTIAL/FULL tiers (Sprint 35). Plus a "Run Scout (3 pts)" button
// gated when at the highest tier.

type Props = {
  scoutLevel: number; // 0..3 (Sprint 28 column; capped at 3)
  budgetRemaining: number;
  onScout?: () => void;
};

function tierFromScoutLevel(scoutLevel: number): 0 | 1 | 2 {
  if (scoutLevel <= 0) return 0;
  if (scoutLevel === 1) return 1;
  return 2;
}

const TIER_LABELS: Record<0 | 1 | 2, string> = {
  0: 'Locked',
  1: 'Partial',
  2: 'Full',
};

export function ScoutTierIndicator({ scoutLevel, budgetRemaining, onScout }: Props) {
  const tier = tierFromScoutLevel(scoutLevel);
  const cost = 3;
  const canScout = tier < 2 && budgetRemaining >= cost;
  return (
    <section
      className="scout-tier-indicator"
      aria-labelledby="scout-tier-heading"
      data-testid="scout-tier-indicator"
    >
      <h4 id="scout-tier-heading" className="scout-tier-indicator__heading">
        Scouting
      </h4>
      <ul className="scout-tier-indicator__dots" aria-label="Scout progress">
        {([0, 1, 2] as const).map((t) => (
          <li
            key={t}
            className={
              tier >= t
                ? 'scout-tier-indicator__dot scout-tier-indicator__dot--filled'
                : 'scout-tier-indicator__dot'
            }
            data-testid={`scout-dot-${t}`}
            aria-current={tier === t ? 'step' : undefined}
          >
            <span className="scout-tier-indicator__dot-label">{TIER_LABELS[t]}</span>
          </li>
        ))}
      </ul>
      {onScout && (
        <button
          type="button"
          onClick={onScout}
          disabled={!canScout}
          data-testid="scout-tier-run"
          className="scout-tier-indicator__cta"
        >
          {tier >= 2 ? 'Fully Scouted' : `Run Scout (${cost} pts)`}
        </button>
      )}
    </section>
  );
}
