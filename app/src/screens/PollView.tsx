import { useEffect } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { usePollStore } from '../store/usePollStore';

export function PollView() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const { week, rows, status, error } = usePollStore();
  const load = usePollStore((s) => s.load);

  useEffect(() => {
    if (openedSlotId) void load(openedSlotId);
  }, [openedSlotId, load]);

  if (!openedSlotId) return null;

  return (
    <section aria-labelledby="poll-heading" className="poll-view">
      <header className="match-hub__header">
        <h1 id="poll-heading">AVCA Top 25</h1>
        <p className="match-hub__sub">
          {rows.length > 0
            ? `Week ${week} · ${rows.length} ranked teams`
            : 'No poll yet — advance a week to generate.'}
        </p>
      </header>

      <div className="poll-view__controls">
        <button type="button" onClick={() => openedSlotId && void load(openedSlotId)}>
          Refresh
        </button>
      </div>

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      {rows.length > 0 && (
        <table className="poll-view__table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Team</th>
              <th scope="col">Record</th>
              <th scope="col">1st</th>
              <th scope="col">Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamId}>
                <td>{r.rank}</td>
                <td>
                  <span className="poll-view__abbr">{r.teamAbbr}</span>{' '}
                  <span className="poll-view__school">{r.teamSchool}</span>
                </td>
                <td>{r.record}</td>
                <td>{r.firstPlaceVotes || ''}</td>
                <td className={deltaClass(r.delta)}>{r.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {status === 'loading' && <p>Loading…</p>}
    </section>
  );
}

function deltaClass(delta: string): string {
  if (delta.startsWith('↑')) return 'poll-view__delta poll-view__delta--up';
  if (delta.startsWith('↓')) return 'poll-view__delta poll-view__delta--down';
  return 'poll-view__delta';
}
