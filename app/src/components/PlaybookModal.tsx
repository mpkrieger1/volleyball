// Sprint 26 Task 26.4: Season-rhythm playbook modal.
//
// One-screen modal mounted after FirstRunModal closes (or when the user
// asks to see it again from Settings). Explains the 5-phase season loop:
// PRESEASON → REGULAR → CONF_TOURNEY → NCAA → OFFSEASON → next year.
//
// Persisted dismiss via `useSettingsStore.hasSeenPlaybook`. The Settings
// screen exposes a "Show playbook again" link that clears the flag.
//
// Keyboard: Esc dismisses; focus trapped via aria-modal=true on the
// dialog (we don't need rolling focus management for a single-CTA
// modal). Pure visual styling reuses FirstRunModal's overlay/dialog
// classes so the look is consistent.

import { useEffect } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

type Props = {
  onClose: () => void;
};

const PHASES: Array<{ name: string; weeks: string; what: string; doNow: string }> = [
  {
    name: 'PRESEASON',
    weeks: 'Week 0',
    what: 'Schedule is generated automatically; rosters lock; nothing has been played yet.',
    doNow: 'Advance to Week 1.',
  },
  {
    name: 'REGULAR',
    weeks: 'Weeks 1–13',
    what: '~23 matches per team across conference + non-conference. Recruiting board is open. Polls update weekly.',
    doNow: 'Advance week to play your matches. Recruit. Manage portal and NIL between weeks.',
  },
  {
    name: 'CONF_TOURNEY',
    weeks: 'Weeks 14–16',
    what: 'Single-elimination conference brackets, seeded by conference record. Win and you punch your conference auto-bid for the NCAA tournament.',
    doNow: 'Advance week. Track your seed.',
  },
  {
    name: 'NCAA',
    weeks: 'Weeks 17–20',
    what: '64-team national bracket: R64 → R32 → S16 → E8 → Final Four → Championship. Recruiting closes; signing day locks recruits to teams.',
    doNow: 'Advance week to play through the bracket. Win it all.',
  },
  {
    name: 'OFFSEASON',
    weeks: 'Week 21',
    what: 'Seniors graduate. Recruits sign and join your roster. Transfer portal opens briefly. AVCA All-American awards are announced.',
    doNow: 'View awards. Manage offseason. Advance to Year N+1.',
  },
];

export function PlaybookModal({ onClose }: Props) {
  const setHasSeenPlaybook = useSettingsStore((s) => s.setHasSeenPlaybook);

  const handleDismiss = (): void => {
    setHasSeenPlaybook(true);
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="first-run-modal-overlay" role="presentation">
      <div
        className="first-run-modal playbook-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="playbook-title"
        data-testid="playbook-modal"
      >
        <h2 id="playbook-title">The Season Rhythm</h2>
        <p>
          Your dynasty cycles through 5 phases. Each phase has a clear next
          action; the Season Hub on your dashboard always tells you what to
          do.
        </p>
        <ol className="playbook-modal__phases" aria-label="Season phases">
          {PHASES.map((phase) => (
            <li key={phase.name} className="playbook-modal__phase">
              <div className="playbook-modal__phase-head">
                <strong className="playbook-modal__phase-name">{phase.name}</strong>
                <span className="playbook-modal__phase-weeks">{phase.weeks}</span>
              </div>
              <p className="playbook-modal__phase-what">{phase.what}</p>
              <p className="playbook-modal__phase-do">
                <em>Do now:</em> {phase.doNow}
              </p>
            </li>
          ))}
        </ol>
        <p className="playbook-modal__footer">
          The loop repeats. Most decisions happen on the Hub screen, where
          your record, your next match, and your recruiting status are all
          one click away.
        </p>
        <div className="first-run-modal__nav">
          <span aria-hidden="true" />
          <button type="button" onClick={handleDismiss} data-testid="playbook-dismiss">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
