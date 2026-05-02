// Sprint 24 Task 24.4: First-run welcome modal.
//
// 3 slides + Skip; the final slide includes the Diagnostics opt-in
// checkbox so the PRD's "Telemetry opt-in with clear disclosure" is
// covered in the same flow. Persists `hasCompletedFirstRun=true` on
// either Skip or Get started.
//
// Keyboard: arrow keys advance/retreat slides; Esc dismisses (Skip
// semantics — keeps Diagnostics at default OFF). Tab order respects
// the modal's role="dialog".

import { useEffect, useState } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

type Props = {
  onClose: () => void;
};

const SLIDES = [
  {
    title: 'Welcome to NCAA Volleyball Coach Dynasty',
    body: (
      <>
        VCD is a single-player career-coach dynasty simulation for NCAA
        Division I Women&apos;s indoor volleyball. Build a program, recruit a
        class, work the transfer portal, navigate NIL, and chase the AVCA
        national championship.
      </>
    ),
  },
  {
    title: 'Pick a team and build a program',
    body: (
      <>
        Choose any of the ~360 D-I programs. Manage your roster across the
        regular season, conference tournaments, and recruiting. The transfer
        portal and NIL deals are first-class systems — your decisions
        compound across years.
      </>
    ),
  },
  {
    title: 'Win it all',
    body: (
      <>
        Make the 64-team NCAA bracket, sweep the Final Four, lift the
        trophy. Top players earn AVCA All-American honors that stay in the
        game&apos;s history forever.
      </>
    ),
  },
] as const;

export function FirstRunModal({ onClose }: Props) {
  const [slide, setSlide] = useState(0);
  const [diagnosticsCheckboxValue, setDiagnosticsCheckboxValue] = useState(false);
  const setHasCompletedFirstRun = useSettingsStore((s) => s.setHasCompletedFirstRun);
  const setDiagnosticsEnabled = useSettingsStore((s) => s.setDiagnosticsEnabled);

  const isLast = slide === SLIDES.length - 1;
  const isFirst = slide === 0;

  const handleSkip = (): void => {
    setHasCompletedFirstRun(true);
    onClose();
  };

  const handleGetStarted = (): void => {
    setDiagnosticsEnabled(diagnosticsCheckboxValue);
    setHasCompletedFirstRun(true);
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      } else if (e.key === 'ArrowRight') {
        if (!isLast) setSlide((s) => Math.min(s + 1, SLIDES.length - 1));
      } else if (e.key === 'ArrowLeft') {
        if (!isFirst) setSlide((s) => Math.max(s - 1, 0));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLast, isFirst]);

  const current = SLIDES[slide]!;

  return (
    <div className="first-run-modal-overlay" role="presentation">
      <div
        className="first-run-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-run-title"
      >
        <h2 id="first-run-title">{current.title}</h2>
        <p>{current.body}</p>
        {isLast && (
          <label className="settings-row">
            <input
              type="checkbox"
              checked={diagnosticsCheckboxValue}
              onChange={(e) => setDiagnosticsCheckboxValue(e.target.checked)}
            />
            <span>
              Send anonymous crash reports to help improve VCD. No save data,
              no team or player names, no identifiers — only stack traces.
            </span>
          </label>
        )}
        <div
          className="first-run-modal__dots"
          role="status"
          aria-label={`Slide ${slide + 1} of ${SLIDES.length}`}
        >
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={
                i === slide ? 'first-run-modal__dot first-run-modal__dot--active' : 'first-run-modal__dot'
              }
            />
          ))}
        </div>
        <div className="first-run-modal__nav">
          <button type="button" onClick={handleSkip}>
            Skip
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isFirst && (
              <button type="button" onClick={() => setSlide((s) => s - 1)}>
                Back
              </button>
            )}
            {!isLast && (
              <button type="button" onClick={() => setSlide((s) => s + 1)}>
                Next
              </button>
            )}
            {isLast && (
              <button type="button" onClick={handleGetStarted}>
                Get started
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
