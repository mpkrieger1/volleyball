// Sprint 28 Task 28.5B: Recruiting screen rewrite (FCCD-modeled).
//
// Layout (top → bottom):
//   - RecruitingHeader (4 stat tiles + roster gaps).
//   - Tab bar: All Recruits | My Targets | My Commits.
//   - Filter row (position / stars / region) + recruiting actions row.
//   - Sortable table of recruits.
//   - Click row → RecruitDetailModal.
//
// Deferred to v1.2 (per design doc §9.2): Outstanding Offers / Roster tabs,
// Targets-by-position panel, Recruit Priorities matrix, Visits scheduling.

import { useEffect, useMemo, useState } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import {
  useRecruitingStore,
  type BoardRecruit,
  type RecruitingTab,
} from '../store/useRecruitingStore';
import { useUserTeamStore } from '../store/useUserTeamStore';
import { useTableState } from '../hooks/useTableState';
import { useScheduleStore } from '../store/useScheduleStore';
import { RecruitingHeader } from '../components/RecruitingHeader';
import { RecruitDetailModal } from '../components/RecruitDetailModal';
import { TeamNeedsCards } from '../components/TeamNeedsCards';

const POSITIONS = ['OH', 'MB', 'OPP', 'S', 'L', 'DS'] as const;
const REGIONS = ['EAST', 'CENTRAL', 'MOUNTAIN', 'PACIFIC'] as const;
const STARS = [1, 2, 3, 4, 5] as const;

const TABS: Array<{ id: RecruitingTab; label: string }> = [
  { id: 'all', label: 'All Recruits' },
  { id: 'targets', label: 'My Targets' },
  { id: 'commits', label: 'My Commits' },
];

export function RecruitingBoard() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const userTeamId = useUserTeamStore((s) => s.userTeamId);
  const userTeamStatus = useUserTeamStore((s) => s.status);
  const [fallbackTeamId, setFallbackTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!openedSlotId) return;
    if (userTeamStatus !== 'ready') return;
    if (userTeamId) return;
    let cancelled = false;
    void (async () => {
      const res = await window.vcd.match.listTeams(openedSlotId);
      if (cancelled || !res.ok) return;
      if (res.teams.length > 0) setFallbackTeamId(res.teams[0]!.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [openedSlotId, userTeamId, userTeamStatus]);

  const teamId = userTeamId ?? fallbackTeamId;
  if (!openedSlotId || !teamId) return null;
  return <RecruitingBoardInner teamId={teamId} />;
}

function RecruitingBoardInner({ teamId }: { teamId: string }) {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId)!;
  const teams = useScheduleStore((s) => s.teams);
  const userTeam = teams.find((t) => t.id === teamId) ?? null;
  const [interestedOnly, setInterestedOnly] = useState(false);
  const {
    phase,
    week,
    recruits,
    status,
    error,
    filter,
    tab,
    detailOpen,
    detail,
    detailStatus,
    budget,
    teamNeeds,
    load,
    setFilter,
    setTab,
    openCycle,
    performAction,
    advanceWeek,
    closeCycle,
    openDetail,
    closeDetail,
    setNilOffer,
  } = useRecruitingStore();

  useEffect(() => {
    void load(openedSlotId, teamId);
  }, [openedSlotId, teamId, load]);

  // Sprint 37 (post-launch UAT): auto-open the recruiting cycle if it
  // isn't open yet. The user shouldn't have to press a button — the
  // cycle should be live the moment they visit the screen. Guarded by
  // status==='ready' so the open fires once after the initial load
  // resolves (instead of racing with the load call).
  useEffect(() => {
    if (
      status === 'ready' &&
      phase !== 'RECRUITING' &&
      recruits.length === 0
    ) {
      void openCycle(openedSlotId, 2026);
    }
  }, [status, phase, recruits.length, openCycle, openedSlotId]);

  // Filter pipeline: filter → tab → useTableState (for sort).
  const visible = useMemo(() => {
    let rows = recruits.filter((r) => {
      if (filter.position && r.position !== filter.position) return false;
      if (filter.region && r.hometownRegion !== filter.region) return false;
      if (filter.minStars && r.stars < filter.minStars) return false;
      return true;
    });
    if (tab === 'targets') {
      rows = rows.filter((r) => r.actionsSpent > 0 && r.commitState === 'PENDING');
    } else if (tab === 'commits') {
      rows = rows.filter(
        (r) =>
          (r.commitState === 'COMMITTED' || r.commitState === 'SIGNED') &&
          r.commitTeamId === teamId,
      );
    }
    if (interestedOnly) {
      rows = rows.filter((r) => r.interest > 0);
    }
    return rows;
  }, [recruits, filter, tab, teamId, interestedOnly]);

  const tbl = useTableState<BoardRecruit>({
    rows: visible,
    getId: (r) => r.recruitId,
    defaultSort: { key: 'interest', dir: 'desc' },
  });

  const canAct = phase === 'RECRUITING' && status !== 'advancing';
  const budgetRemaining = budget?.remaining ?? 0;

  return (
    <section aria-labelledby="rec-heading" className="recruiting-board">
      <header className="match-hub__header">
        <h1 id="rec-heading">Recruiting</h1>
        <p className="match-hub__sub">
          Phase: {phase}
          {phase === 'RECRUITING' ? ` · Week ${week}` : ''}
        </p>
      </header>

      <RecruitingHeader budget={budget} recruits={recruits} teamNeeds={teamNeeds} />

      <TeamNeedsCards needs={teamNeeds} recruits={recruits} />

      <nav className="recruiting-board__tabs" role="tablist" aria-label="Recruit list tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? 'recruiting-board__tab recruiting-board__tab--active'
                : 'recruiting-board__tab'
            }
            data-testid={`tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="recruiting-board__toolbar" role="group" aria-label="Recruiting toolbar">
        <div className="recruiting-board__toolbar-actions">
          {phase !== 'RECRUITING' && status === 'loading' && (
            <span className="recruiting-board__loading">Opening cycle…</span>
          )}
          {phase === 'RECRUITING' && (
            <>
              <button
                type="button"
                className="ui-btn ui-btn--primary"
                disabled={!canAct}
                onClick={() => void advanceWeek(openedSlotId, teamId)}
              >
                Advance Week
              </button>
              <button
                type="button"
                className="ui-btn"
                disabled={!canAct}
                onClick={() => void closeCycle(openedSlotId)}
              >
                Close Cycle (Signing Day)
              </button>
            </>
          )}
        </div>

        <div className="recruiting-board__toolbar-filters">
          <div className="ui-field">
            <label htmlFor="filter-pos" className="ui-label">Position</label>
            <select
              id="filter-pos"
              className="ui-select"
              value={filter.position ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                const { position: _p, ...rest } = filter;
                setFilter(v ? { ...rest, position: v } : rest);
              }}
            >
              <option value="">All</option>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="ui-field">
            <label htmlFor="filter-region" className="ui-label">Region</label>
            <select
              id="filter-region"
              className="ui-select"
              value={filter.region ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                const { region: _r, ...rest } = filter;
                setFilter(v ? { ...rest, region: v } : rest);
              }}
            >
              <option value="">All</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="ui-field">
            <label htmlFor="filter-stars" className="ui-label">Min stars</label>
            <select
              id="filter-stars"
              className="ui-select"
              value={filter.minStars ?? 0}
              onChange={(e) => {
                const n = Number(e.target.value);
                const { minStars: _m, ...rest } = filter;
                setFilter(n > 0 ? { ...rest, minStars: n } : rest);
              }}
            >
              <option value="0">Any</option>
              {STARS.map((s) => (
                <option key={s} value={s}>
                  {s}+
                </option>
              ))}
            </select>
          </div>

          <label className="ui-checkbox">
            <input
              type="checkbox"
              checked={interestedOnly}
              onChange={(e) => setInterestedOnly(e.target.checked)}
              data-testid="filter-interested"
            />
            <span>
              Interested in {userTeam?.abbr ?? 'my school'}
            </span>
          </label>
        </div>
      </div>

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      {status === 'loading' && <p data-testid="recruiting-loading">Loading…</p>}

      {status === 'ready' && tbl.visibleRows.length === 0 && (
        <p className="match-hub__sub" data-testid="recruiting-empty">
          {tab === 'all'
            ? 'No recruits available. Open a recruiting cycle to begin.'
            : tab === 'targets'
              ? 'You have no targets yet. Spend an action on a recruit from "All Recruits" to add them.'
              : 'No commitments yet.'}
        </p>
      )}

      {tbl.visibleRows.length > 0 && (
        <div className="ui-table-wrap">
          <table
            className="ui-table recruiting-board__table"
            aria-label="Recruiting board"
            data-testid="recruiting-table"
          >
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col" className="t-num">Pos</th>
                <th scope="col" className="t-num">Stars</th>
                <th scope="col">Region</th>
                <th scope="col">Leader</th>
                <th scope="col" className="t-num">Interest</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
            {tbl.visibleRows.map((r) => (
              <tr
                key={r.recruitId}
                tabIndex={0}
                onClick={() => void openDetail(openedSlotId, teamId, r.recruitId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void openDetail(openedSlotId, teamId, r.recruitId);
                  }
                }}
                data-testid={`recruit-row-${r.recruitId}`}
                className="recruiting-board__row"
              >
                <td>
                  <strong>{r.firstName} {r.lastName}</strong>
                  {r.hometownCity && (
                    <span className="recruiting-board__home"> — {r.hometownCity}, {r.hometownState}</span>
                  )}
                </td>
                <td className="t-num">{r.position}</td>
                <td className="t-num" aria-label={`${r.stars} stars`}>
                  <span className="recruiting-board__stars">{'★'.repeat(r.stars)}<span className="recruiting-board__stars-empty">{'★'.repeat(5 - r.stars)}</span></span>
                </td>
                <td>{r.hometownRegion ?? '—'}</td>
                <td>{r.leaderAbbr ?? '—'}</td>
                <td className="t-num">{r.interest}</td>
                <td>
                  {r.commitState === 'PENDING' && r.actionsSpent > 0 && (
                    <span className="ui-badge ui-badge--accent">
                      Target ({r.actionsSpent})
                    </span>
                  )}
                  {r.commitState === 'PENDING' && r.actionsSpent === 0 && (
                    <span className="ui-badge ui-badge--muted">—</span>
                  )}
                  {(r.commitState === 'COMMITTED' || r.commitState === 'SIGNED') && (
                    <span className="ui-badge ui-badge--success">
                      {r.commitState}
                    </span>
                  )}
                  {r.commitState === 'UNCOMMITTED' && (
                    <span className="ui-badge ui-badge--danger">Lost</span>
                  )}
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}

      {detailOpen && (
        <RecruitDetailModal
          detail={detail}
          loading={detailStatus === 'loading'}
          errorMessage={detailStatus === 'error' ? error : null}
          budgetRemaining={budgetRemaining}
          onAction={(action) => {
            if (!detail) return;
            void performAction(openedSlotId, teamId, detail.recruitId, action);
          }}
          onClose={closeDetail}
          onSetNilOffer={(offerCents) => {
            if (!detail) return;
            void setNilOffer(openedSlotId, teamId, detail.recruitId, offerCents);
          }}
        />
      )}
    </section>
  );
}
