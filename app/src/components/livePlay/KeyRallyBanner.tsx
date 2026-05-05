// Sprint 31 Task 31.4 + Retro fix #9: dedicated key-rally banner.
//
// Replaces the generic pausedFor banner when the smart-pause reason is
// 'key_rally'. Shows set/match-point copy + inline Continue + Call timeout
// buttons. Auto-dismisses after 8 seconds if the user takes no action
// (calls onContinue automatically).

import { useEffect, useRef } from 'react';
import { sim } from '@vcd/shared';

const AUTO_DISMISS_MS = 8000;

export type KeyRallyBannerProps = {
  open: boolean;
  /** Snapshot of the current set/match state for the copy. */
  state: sim.LiveMatchState;
  homeName: string;
  awayName: string;
  /** Continue: dismiss banner and let the next rally play. */
  onContinue: () => void;
  /** Call timeout: dismiss banner and open the timeout modal. */
  onCallTimeout: () => void;
};

export function KeyRallyBanner({
  open,
  state,
  homeName,
  awayName,
  onContinue,
  onCallTimeout,
}: KeyRallyBannerProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    timerRef.current = setTimeout(() => {
      onContinue();
    }, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [open, onContinue]);

  if (!open) return null;

  const kr = sim.isKeyRally(state);
  if (!kr.setPoint) return null;

  const leaderName = kr.leader === 'home' ? homeName : awayName;
  const trailerName = kr.leader === 'home' ? awayName : homeName;
  const leaderScore = kr.leader === 'home' ? state.currentSet.home : state.currentSet.away;
  const trailerScore = kr.leader === 'home' ? state.currentSet.away : state.currentSet.home;

  const headline = kr.matchPoint ? 'Match point' : 'Set point';
  const detail = `${leaderName} leads ${trailerName} ${leaderScore}-${trailerScore} in set ${state.currentSet.index + 1}.`;

  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-labelledby="key-rally-headline"
      className="key-rally-banner"
    >
      <div className="key-rally-banner__copy">
        <strong id="key-rally-headline">{headline}</strong>
        <span> — {detail}</span>
      </div>
      <div className="key-rally-banner__actions">
        <button type="button" onClick={onCallTimeout}>Call timeout</button>
        <button type="button" onClick={onContinue}>Continue</button>
      </div>
    </div>
  );
}
