import { useEffect } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useSeasonStore } from '../store/useSeasonStore';

export function SeasonPanel() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const { currentWeek, phase, status, error, progress, lastAdvanceElapsedMs } = useSeasonStore();
  const loadCurrentWeek = useSeasonStore((s) => s.loadCurrentWeek);
  const advance = useSeasonStore((s) => s.advance);
  const cancel = useSeasonStore((s) => s.cancel);

  useEffect(() => {
    if (openedSlotId) void loadCurrentWeek(openedSlotId);
  }, [openedSlotId, loadCurrentWeek]);

  if (!openedSlotId) return null;
  const advancing = status === 'advancing';
  const pct =
    progress && progress.totalMatches > 0
      ? Math.round((progress.completedMatches / progress.totalMatches) * 100)
      : 0;

  return (
    <section aria-labelledby="season-panel-heading" className="season-panel">
      <h2 id="season-panel-heading" className="season-panel__heading">
        Season {currentWeek === 0 ? 'pre-season' : `week ${currentWeek}`}{' '}
        <span className="season-panel__phase">· {phase}</span>
      </h2>
      <div className="season-panel__controls">
        <button
          type="button"
          onClick={() => void advance(openedSlotId)}
          disabled={advancing}
        >
          {advancing ? 'Advancing…' : `Advance week ${currentWeek}`}
        </button>
        {advancing && (
          <button type="button" onClick={() => void cancel()} className="season-panel__cancel">
            Cancel
          </button>
        )}
        {progress && (
          <div className="season-panel__progress" aria-live="polite">
            <progress
              value={progress.completedMatches}
              max={progress.totalMatches}
              aria-label="Week advance progress"
            />
            <span className="season-panel__progress-text">
              {progress.completedMatches} / {progress.totalMatches} matches ({pct}% · {progress.phase})
            </span>
          </div>
        )}
        {lastAdvanceElapsedMs !== null && !advancing && (
          <span className="season-panel__elapsed">
            Last advance: {lastAdvanceElapsedMs} ms
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}
    </section>
  );
}
