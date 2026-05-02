// Sprint 21: post-Save-create modal that picks the user's program
// (Season.userTeamId). Closes the 11-sprint user-team-picker gap from
// PRD §1. Subsequent screens (RecruitingBoard / PortalView / NilView)
// read userTeamId via useUserTeamStore.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { matchIpc } from '@vcd/shared';

export type TeamPickerModalProps = {
  slotId: string;
  /** All teams loaded once on mount via window.vcd.match.listTeams. */
  onConfirm: (teamId: string) => Promise<void> | void;
  onError?: (msg: string) => void;
};

export function TeamPickerModal(props: TeamPickerModalProps) {
  const [teams, setTeams] = useState<matchIpc.TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await window.vcd.match.listTeams(props.slotId);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error.message);
        props.onError?.(res.error.message);
        return;
      }
      setTeams(res.teams);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [props]);

  // Focus the search input on mount for keyboard-first flow.
  useEffect(() => {
    if (!loading) {
      const el = dialogRef.current?.querySelector<HTMLInputElement>(
        'input[type="search"], input[type="text"]',
      );
      el?.focus();
    }
  }, [loading]);

  const filtered = useMemo(() => {
    if (!search.trim()) return teams;
    const needle = search.trim().toLowerCase();
    return teams.filter(
      (t) => t.schoolName.toLowerCase().includes(needle) || t.abbr.toLowerCase().includes(needle),
    );
  }, [teams, search]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-picker-heading"
      className="team-picker__modal"
    >
      <div className="team-picker__panel">
        <h2 id="team-picker-heading">Pick your program</h2>
        <p className="team-picker__sub">
          You will coach this team for your dynasty. Choose carefully — you can change later from
          settings.
        </p>

        {error && (
          <p role="alert" className="team-picker__error">
            {error}
          </p>
        )}

        {loading && <p>Loading teams…</p>}

        {!loading && (
          <>
            <label className="team-picker__search">
              <span className="visually-hidden">Search teams</span>
              <input
                type="search"
                placeholder="Search by name or abbreviation"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <ul role="listbox" aria-label="Programs" className="team-picker__list">
              {filtered.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedTeamId === t.id}
                    className={
                      selectedTeamId === t.id
                        ? 'team-picker__row team-picker__row--selected'
                        : 'team-picker__row'
                    }
                    onClick={() => setSelectedTeamId(t.id)}
                    onDoubleClick={() => {
                      setSelectedTeamId(t.id);
                      void props.onConfirm(t.id);
                    }}
                  >
                    <span className="team-picker__name">{t.schoolName}</span>
                    <span className="team-picker__abbr">{t.abbr}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li>No teams match &ldquo;{search}&rdquo;.</li>}
            </ul>
            <div className="team-picker__actions">
              <button
                type="button"
                disabled={!selectedTeamId}
                onClick={() => {
                  if (selectedTeamId) void props.onConfirm(selectedTeamId);
                }}
              >
                Start dynasty
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
