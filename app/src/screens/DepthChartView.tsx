// Sprint 28: Depth Chart screen.
//
// Shows the user team's roster grouped by position with an explicit ordering
// (the depth chart). Coach can:
//   - Move players up/down within their position using arrow buttons.
//   - Auto-sort a position by overall rating.
//   - Add ANY player to ANY position (cross-position swing — e.g. an OH
//     can be slotted into the MB depth chart). The "Add player" select
//     lists every roster member not already in this position group.
//   - Remove a player from a position (does not delete the player; just
//     drops them from this position's chart).
//
// Persistence: the chart is computed in-memory from the roster's overall
// rating order on first render. Subsequent reordering is held in component
// state. A dedicated DepthChart Prisma table + IPC contract is queued for
// a follow-up commit; for v1 the chart is recomputed on each visit.

import { useEffect, useMemo, useState } from 'react';
import type { rosterIpc } from '@vcd/shared';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useUserTeamStore } from '../store/useUserTeamStore';
import { useScheduleStore } from '../store/useScheduleStore';
import { useRosterStore } from '../store/useRosterStore';

/** Position groups in the order the depth chart presents them. */
const POSITION_GROUPS: Array<{ key: string; label: string }> = [
  { key: 'S', label: 'Setters' },
  { key: 'OH', label: 'Outside Hitters' },
  { key: 'MB', label: 'Middle Blockers' },
  { key: 'OPP', label: 'Opposite' },
  { key: 'L', label: 'Libero' },
  { key: 'DS', label: 'Defensive Specialists' },
];

function depthLabel(idx: number): string {
  return idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `${idx + 1}th`;
}

export function DepthChartView() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const userTeamId = useUserTeamStore((s) => s.userTeamId);
  const teams = useScheduleStore((s) => s.teams);
  const players = useRosterStore((s) => s.players);
  const status = useRosterStore((s) => s.status);
  const load = useRosterStore((s) => s.load);

  // Order: per-position arrays of player ids. Initially defaults to roster
  // order by overall desc; the user can rearrange.
  const [orderByPos, setOrderByPos] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (openedSlotId && userTeamId) void load(openedSlotId, userTeamId);
  }, [openedSlotId, userTeamId, load]);

  // Initialize orderByPos when roster arrives and we have no order yet.
  useEffect(() => {
    if (players.length === 0) return;
    setOrderByPos((prev) => {
      // Preserve existing order entries; fill in missing positions.
      const next: Record<string, string[]> = { ...prev };
      const byPos: Record<string, rosterIpc.RosterPlayer[]> = {};
      for (const p of players) {
        const key = p.isLibero ? 'L' : p.position;
        (byPos[key] ??= []).push(p);
      }
      for (const [posKey, list] of Object.entries(byPos)) {
        const sortedIds = list
          .slice()
          .sort((a, b) => b.overall - a.overall)
          .map((p) => p.id);
        // Merge with prior order if present: keep ordering for known ids,
        // append new ones at the end, drop ids no longer on roster.
        const existing = prev[posKey] ?? [];
        const idSet = new Set(sortedIds);
        const kept = existing.filter((id) => idSet.has(id));
        const added = sortedIds.filter((id) => !kept.includes(id));
        next[posKey] = [...kept, ...added];
      }
      return next;
    });
  }, [players]);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const userTeam = userTeamId ? teams.find((t) => t.id === userTeamId) : null;

  if (!openedSlotId) return null;
  if (!userTeamId) {
    return (
      <section aria-labelledby="depth-heading" className="depth-chart-view">
        <header className="match-hub__header">
          <h1 id="depth-heading">Depth Chart</h1>
          <p className="match-hub__sub">Pick your team from the Hub to set your depth chart.</p>
        </header>
      </section>
    );
  }

  function moveUp(posKey: string, playerId: string): void {
    setOrderByPos((prev) => {
      const list = prev[posKey] ?? [];
      const idx = list.indexOf(playerId);
      if (idx <= 0) return prev;
      const next = list.slice();
      [next[idx - 1], next[idx]] = [next[idx]!, next[idx - 1]!];
      return { ...prev, [posKey]: next };
    });
  }

  function moveDown(posKey: string, playerId: string): void {
    setOrderByPos((prev) => {
      const list = prev[posKey] ?? [];
      const idx = list.indexOf(playerId);
      if (idx < 0 || idx >= list.length - 1) return prev;
      const next = list.slice();
      [next[idx], next[idx + 1]] = [next[idx + 1]!, next[idx]!];
      return { ...prev, [posKey]: next };
    });
  }

  function autoSort(posKey: string): void {
    setOrderByPos((prev) => {
      const list = prev[posKey] ?? [];
      const sorted = list
        .slice()
        .sort(
          (a, b) =>
            (playersById.get(b)?.overall ?? 0) - (playersById.get(a)?.overall ?? 0),
        );
      return { ...prev, [posKey]: sorted };
    });
  }

  function addPlayer(posKey: string, playerId: string): void {
    if (!playerId) return;
    setOrderByPos((prev) => {
      const list = prev[posKey] ?? [];
      if (list.includes(playerId)) return prev;
      return { ...prev, [posKey]: [...list, playerId] };
    });
  }

  function removePlayer(posKey: string, playerId: string): void {
    setOrderByPos((prev) => {
      const list = prev[posKey] ?? [];
      if (!list.includes(playerId)) return prev;
      return { ...prev, [posKey]: list.filter((id) => id !== playerId) };
    });
  }

  return (
    <section aria-labelledby="depth-heading" className="depth-chart-view">
      <header className="match-hub__header">
        <h1 id="depth-heading">
          {userTeam ? `${userTeam.schoolName} Depth Chart` : 'Depth Chart'}
        </h1>
        <p className="match-hub__sub">
          Set your starting order at each position. Use the arrows to move
          players up or down, or &ldquo;Auto&rdquo; to re-sort by overall.
        </p>
      </header>

      {status === 'loading' && <p>Loading roster…</p>}
      {status === 'ready' && players.length === 0 && (
        <p className="save-slots__empty">
          No players on this roster yet. Create a fresh save from the Save
          Slots screen if this looks wrong.
        </p>
      )}

      {players.length > 0 && (
        <div className="depth-chart-view__grid">
          {POSITION_GROUPS.map((group) => {
            const ids = orderByPos[group.key] ?? [];
            const idSet = new Set(ids);
            const addable = players
              .filter((p) => !idSet.has(p.id))
              .sort((a, b) => b.overall - a.overall);
            return (
              <section
                key={group.key}
                className="depth-chart-view__group"
                aria-labelledby={`depth-${group.key}`}
              >
                <header className="depth-chart-view__group-header">
                  <h2 id={`depth-${group.key}`}>{group.label}</h2>
                  <span className="depth-chart-view__pos-pill">{group.key}</span>
                  <button
                    type="button"
                    onClick={() => autoSort(group.key)}
                    className="ui-btn"
                    title="Auto-sort by overall"
                    data-testid={`auto-${group.key}`}
                  >
                    Auto
                  </button>
                </header>

                <AddPlayerControl
                  posKey={group.key}
                  posLabel={group.label}
                  addable={addable}
                  onAdd={addPlayer}
                />

                {ids.length === 0 ? (
                  <p
                    className="save-slots__empty"
                    data-testid={`depth-empty-${group.key}`}
                  >
                    No players at this position. Use &ldquo;Add player&rdquo; above
                    to slot anyone from the roster here.
                  </p>
                ) : (
                  <ol className="depth-chart-view__list">
                    {ids.map((playerId, idx) => {
                      const p = playersById.get(playerId);
                      if (!p) return null;
                      const isStarter = idx === 0;
                      const offPosition = (p.isLibero ? 'L' : p.position) !== group.key;
                      return (
                        <li
                          key={p.id}
                          className={
                            isStarter
                              ? 'depth-chart-view__item depth-chart-view__item--starter'
                              : 'depth-chart-view__item'
                          }
                          data-testid={`depth-item-${group.key}-${p.id}`}
                        >
                          <span className="depth-chart-view__rank">{depthLabel(idx)}</span>
                          <span className="depth-chart-view__jersey">#{p.jersey}</span>
                          <span className="depth-chart-view__name">
                            <strong>{p.lastName}</strong>
                            <span className="depth-chart-view__first"> {p.firstName}</span>
                          </span>
                          <span className="depth-chart-view__meta">
                            {p.classYear} · OVR {p.overall}
                            {offPosition && (
                              <span
                                className="ui-badge ui-badge--muted"
                                title={`Primary position: ${p.isLibero ? 'L' : p.position}`}
                              >
                                {p.isLibero ? 'L' : p.position}
                              </span>
                            )}
                          </span>
                          <span className="depth-chart-view__controls">
                            <button
                              type="button"
                              className="ui-btn"
                              disabled={idx === 0}
                              onClick={() => moveUp(group.key, p.id)}
                              aria-label={`Move ${p.lastName} up`}
                              data-testid={`up-${p.id}`}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="ui-btn"
                              disabled={idx === ids.length - 1}
                              onClick={() => moveDown(group.key, p.id)}
                              aria-label={`Move ${p.lastName} down`}
                              data-testid={`down-${p.id}`}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="ui-btn"
                              onClick={() => removePlayer(group.key, p.id)}
                              aria-label={`Remove ${p.lastName} from ${group.label}`}
                              data-testid={`remove-${group.key}-${p.id}`}
                            >
                              ×
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AddPlayerControl({
  posKey,
  posLabel,
  addable,
  onAdd,
}: {
  posKey: string;
  posLabel: string;
  addable: rosterIpc.RosterPlayer[];
  onAdd: (posKey: string, playerId: string) => void;
}) {
  const [pick, setPick] = useState<string>('');
  if (addable.length === 0) {
    return (
      <p className="depth-chart-view__add-empty">
        Every roster member is already in {posLabel}.
      </p>
    );
  }
  return (
    <div
      className="depth-chart-view__add-row"
      role="group"
      aria-label={`Add player to ${posLabel}`}
    >
      <div className="ui-field">
        <label htmlFor={`add-pos-${posKey}`} className="ui-label">
          Add player
        </label>
        <select
          id={`add-pos-${posKey}`}
          className="ui-select"
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          data-testid={`add-select-${posKey}`}
        >
          <option value="">Pick a player…</option>
          {addable.map((p) => (
            <option key={p.id} value={p.id}>
              {p.lastName}, {p.firstName} · {p.isLibero ? 'L' : p.position} · OVR {p.overall}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="ui-btn ui-btn--primary"
        disabled={!pick}
        onClick={() => {
          onAdd(posKey, pick);
          setPick('');
        }}
        data-testid={`add-btn-${posKey}`}
      >
        Add
      </button>
    </div>
  );
}
