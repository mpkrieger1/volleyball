// Sprint 34 Task 34.6 — PracticeFocusPicker.
//
// Compact card for the SeasonHub. Two dropdowns (offense, defense),
// each defaulting to the auto-suggestion with a "(suggested)" tag. A
// "Reset to suggestion" button. Below: opponent summary one-liner.
//
// Practice focus is a per-match buff only — no rating mutation
// (CLAUDE.md §Critical rules #4 Sprint 34 invariant).

import type { practiceFocusIpc } from '@vcd/shared';

type WeekState = practiceFocusIpc.GetWeekStateResponse extends infer T
  ? Extract<T, { ok: true }>
  : never;

type Props = {
  state: WeekState;
  onPick: (offense: string, defense: string) => void;
};

const OFFENSE_LABELS: Record<string, string> = {
  POWER_HITTING: 'Power Hitting',
  BALL_CONTROL: 'Ball Control',
  SERVE_AGGRESSION: 'Serve Aggression',
  TRANSITION_OFFENSE: 'Transition Offense',
};

const DEFENSE_LABELS: Record<string, string> = {
  BLOCK_HEAVY: 'Block Heavy',
  DEFEND_TIPS_ROLLS: 'Defend Tips/Rolls',
  DEFEND_POWER_HITTING: 'Defend Power Hitting',
  SERVE_RECEIVE_FOCUS: 'Serve Receive Focus',
};

const OFFENSE_OPTIONS = [
  'POWER_HITTING',
  'BALL_CONTROL',
  'SERVE_AGGRESSION',
  'TRANSITION_OFFENSE',
];
const DEFENSE_OPTIONS = [
  'BLOCK_HEAVY',
  'DEFEND_TIPS_ROLLS',
  'DEFEND_POWER_HITTING',
  'SERVE_RECEIVE_FOCUS',
];

function fmtPct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export function PracticeFocusPicker({ state, onPick }: Props) {
  const offenseLabel = (k: string): string =>
    `${OFFENSE_LABELS[k] ?? k}${k === state.autoOffenseSuggestion ? ' (suggested)' : ''}`;
  const defenseLabel = (k: string): string =>
    `${DEFENSE_LABELS[k] ?? k}${k === state.autoDefenseSuggestion ? ' (suggested)' : ''}`;

  const handleReset = (): void => {
    onPick(state.autoOffenseSuggestion, state.autoDefenseSuggestion);
  };

  return (
    <section
      className="practice-focus-picker"
      aria-labelledby="practice-focus-heading"
      data-testid="practice-focus-picker"
    >
      <header className="practice-focus-picker__header">
        <h3 id="practice-focus-heading" className="practice-focus-picker__heading">
          Practice Focus — Week {state.week}
        </h3>
      </header>

      <div className="practice-focus-picker__controls">
        <label>
          <span>Offense</span>
          <select
            data-testid="practice-focus-offense"
            value={state.offenseFocus}
            onChange={(e) => onPick(e.target.value, state.defenseFocus)}
          >
            {OFFENSE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {offenseLabel(opt)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Defense</span>
          <select
            data-testid="practice-focus-defense"
            value={state.defenseFocus}
            onChange={(e) => onPick(state.offenseFocus, e.target.value)}
          >
            {DEFENSE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {defenseLabel(opt)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleReset}
          data-testid="practice-focus-reset"
          className="practice-focus-picker__reset"
        >
          Reset to suggestion
        </button>
      </div>

      <dl className="practice-focus-picker__summary" data-testid="practice-focus-summary">
        <div>
          <dt>Opp serve aces</dt>
          <dd>{fmtPct(state.opponentSummary.serveAceRate)}</dd>
        </div>
        <div>
          <dt>Opp hitting %</dt>
          <dd>{fmtPct(state.opponentSummary.hittingPct)}</dd>
        </div>
        <div>
          <dt>Opp blocks/set</dt>
          <dd>{state.opponentSummary.blockPerSet.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Opp digs/set</dt>
          <dd>{state.opponentSummary.digPerSet.toFixed(2)}</dd>
        </div>
      </dl>
    </section>
  );
}
