// Retro fix #1: 3-way quit-mid-match dialog.
//
// Triggered when the user navigates away from LivePlayHub mid-match.
// Three options:
//   - Return:   close dialog; user stays in Live Play.
//   - Pause:    serialize state to Match.liveStateJson; navigate away.
//                (Resume CTA on Match Hub picks it up later.)
//   - Sim Rest: drive remaining rallies through the live engine without
//                further coach inputs; persist final box score; navigate.

import { useEffect, useRef } from 'react';

export type QuitMatchDialogProps = {
  open: boolean;
  onReturn: () => void;
  onPause: () => void;
  onSimRest: () => void;
};

export function QuitMatchDialog({ open, onReturn, onPause, onSimRest }: QuitMatchDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onReturn();
      }
    }
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onReturn]);

  if (!open) return null;
  return (
    <div className="modal-overlay" role="presentation" onClick={onReturn}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quit-match-heading"
        className="modal-card quit-match"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <h2 id="quit-match-heading">Leave the match?</h2>
        <p>Your match is in progress. Choose how to handle it:</p>
        <div className="quit-match__options">
          <button type="button" onClick={onReturn} autoFocus>
            <strong>Return to match</strong>
            <span>Stay here and keep playing</span>
          </button>
          <button type="button" onClick={onPause}>
            <strong>Pause</strong>
            <span>Save and resume later from the Match Hub</span>
          </button>
          <button type="button" onClick={onSimRest}>
            <strong>Simulate rest</strong>
            <span>Skip to the final score; final stats persist</span>
          </button>
        </div>
      </div>
    </div>
  );
}
