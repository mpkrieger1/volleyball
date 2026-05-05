// Sprint 30 Task 30.2 + 30.5: skill-talk picker modal.
//
// Opens after the user clicks "Call Timeout" in the Coaching Strategy pane.
// User picks a skill to talk about (gives that skill a +5% boost for the
// next ~7-15 points) OR "Skip" to call the timeout without a skill boost.

import { useEffect, useRef } from 'react';
import type { liveMatchIpc } from '@vcd/shared';

type SkillKey = liveMatchIpc.SkillKey;

const SKILLS: { key: SkillKey; label: string; description: string }[] = [
  { key: 'attack', label: 'Attack', description: 'Higher kill rate' },
  { key: 'block', label: 'Block', description: 'More stuff blocks' },
  { key: 'serve', label: 'Serve', description: 'More aces, fewer errors' },
  { key: 'pass', label: 'Pass', description: 'Cleaner serve receive' },
  { key: 'set', label: 'Set', description: 'Better hitter chances' },
  { key: 'dig', label: 'Dig', description: 'Keep more rallies alive' },
];

export type SkillTalkModalProps = {
  open: boolean;
  onConfirm: (skill: SkillKey) => void;
  onSkip: () => void;
  onCancel: () => void;
};

export function SkillTalkModal({ open, onConfirm, onSkip, onCancel }: SkillTalkModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    // Move focus to the dialog so screen readers announce it.
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-talk-heading"
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <h2 id="skill-talk-heading">Coaching Talk</h2>
        <p>Pick a skill to focus on for the next several points (+5% boost), or skip.</p>
        <ul className="skill-talk__grid">
          {SKILLS.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                className="skill-talk__card"
                onClick={() => onConfirm(s.key)}
                aria-label={`Talk about ${s.label}: ${s.description}`}
              >
                <strong>{s.label}</strong>
                <span>{s.description}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="skill-talk__actions">
          <button type="button" onClick={onSkip}>Skip the talk</button>
          <button type="button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
