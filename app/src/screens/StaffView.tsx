import { useEffect, useState } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useUserTeamStore } from '../store/useUserTeamStore';
import { useScheduleStore } from '../store/useScheduleStore';
import { useCoachingStore, type PoolRow } from '../store/useCoachingStore';

type Role = 'HC' | 'AHC' | 'AC';

function fmtMoney(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

const ROLE_LABEL: Record<string, string> = {
  HC: 'Head Coach',
  AHC: 'Associate HC',
  AC: 'Assistant',
};

export function StaffView() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const userTeamId = useUserTeamStore((s) => s.userTeamId);

  if (!openedSlotId) return null;
  if (!userTeamId) {
    return (
      <section aria-labelledby="staff-heading" className="staff-view">
        <header className="match-hub__header">
          <h1 id="staff-heading">Coaching Staff</h1>
          <p className="match-hub__sub">
            Pick your team from the Hub to manage your staff.
          </p>
        </header>
      </section>
    );
  }
  return <StaffViewInner teamId={userTeamId} />;
}

function StaffViewInner({ teamId }: { teamId: string }) {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const teams = useScheduleStore((s) => s.teams);
  const { staff, pool, budgetCents, status, error, load, fire, hire } = useCoachingStore();
  const [hireCandidate, setHireCandidate] = useState<PoolRow | null>(null);
  const [contractYears, setContractYears] = useState(3);

  useEffect(() => {
    if (openedSlotId) void load(openedSlotId, teamId);
  }, [openedSlotId, teamId, load]);

  if (!openedSlotId) return null;
  const userTeam = teams.find((t) => t.id === teamId) ?? null;

  return (
    <section aria-labelledby="staff-heading" className="staff-view">
      <header className="match-hub__header">
        <h1 id="staff-heading">
          {userTeam ? `${userTeam.schoolName} Coaching Staff` : 'Coaching Staff'}
        </h1>
        <p className="match-hub__sub">
          Operating budget: <strong>{fmtMoney(budgetCents)}</strong>
        </p>
      </header>

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      <h2 className="staff-view__h2">Current Staff</h2>
      {staff.length === 0 && status !== 'loading' ? (
        <p className="save-slots__empty">No coaches assigned to this team yet.</p>
      ) : (
        <table className="staff-view__table" data-testid="staff-current-table">
          <caption className="visually-hidden">Current coaching staff</caption>
          <thead>
            <tr>
              <th scope="col">Role</th>
              <th scope="col">Name</th>
              <th scope="col" className="t-num">Recruit</th>
              <th scope="col" className="t-num">Develop</th>
              <th scope="col" className="t-num">Strategy</th>
              <th scope="col" className="t-num">Salary</th>
              <th scope="col" className="t-num">Yrs</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((c) => (
              <tr key={c.coachId}>
                <td>
                  <span className={`staff-view__role-pill staff-view__role-pill--${c.role.toLowerCase()}`}>
                    {c.role}
                  </span>
                  <span className="staff-view__role-label">{ROLE_LABEL[c.role] ?? c.role}</span>
                </td>
                <td>
                  <strong>{c.lastName}</strong>
                  <span className="staff-view__first-name">{c.firstName}</span>
                </td>
                <td className="t-num">{c.ratingRecruit}</td>
                <td className="t-num">{c.ratingDevelop}</td>
                <td className="t-num">{c.ratingStrategy}</td>
                <td className="t-num">{fmtMoney(c.salaryCents)}</td>
                <td className="t-num">{c.contractYears}</td>
                <td>
                  <button
                    type="button"
                    disabled={status === 'working'}
                    onClick={() => void fire(openedSlotId, teamId, c.coachId)}
                    className="staff-view__danger-btn"
                  >
                    Fire
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="staff-view__h2">Hiring Pool</h2>
      {pool.length === 0 && status !== 'loading' ? (
        <p className="save-slots__empty">
          The hiring pool is empty. It refreshes at the start of each season.
        </p>
      ) : (
        <table className="staff-view__table" data-testid="staff-pool-table">
          <caption className="visually-hidden">Available coaches</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
              <th scope="col" className="t-num">Recruit</th>
              <th scope="col" className="t-num">Develop</th>
              <th scope="col" className="t-num">Strategy</th>
              <th scope="col" className="t-num">Asking</th>
              <th scope="col" className="t-num">Age</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {pool.slice(0, 30).map((p) => (
              <tr key={p.poolId}>
                <td>
                  <strong>{p.lastName}</strong>
                  <span className="staff-view__first-name">{p.firstName}</span>
                </td>
                <td>
                  <span className={`staff-view__role-pill staff-view__role-pill--${p.preferredRole.toLowerCase()}`}>
                    {p.preferredRole}
                  </span>
                </td>
                <td className="t-num">{p.ratingRecruit}</td>
                <td className="t-num">{p.ratingDevelop}</td>
                <td className="t-num">{p.ratingStrategy}</td>
                <td className="t-num">{fmtMoney(p.askingSalaryCents)}</td>
                <td className="t-num">{p.ageYears}</td>
                <td>
                  <button
                    type="button"
                    disabled={status === 'working'}
                    onClick={() => setHireCandidate(p)}
                  >
                    Hire
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {hireCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hire-dialog-heading"
          className="staff-view__dialog-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHireCandidate(null);
          }}
        >
          <div className="staff-view__dialog">
            <h3 id="hire-dialog-heading">
              Hire {hireCandidate.firstName} {hireCandidate.lastName}?
            </h3>
            <p className="staff-view__dialog-sub">
              {ROLE_LABEL[hireCandidate.preferredRole] ?? hireCandidate.preferredRole}
            </p>
            <dl className="staff-view__dialog-vitals">
              <div>
                <dt>Recruit</dt>
                <dd>{hireCandidate.ratingRecruit}</dd>
              </div>
              <div>
                <dt>Develop</dt>
                <dd>{hireCandidate.ratingDevelop}</dd>
              </div>
              <div>
                <dt>Strategy</dt>
                <dd>{hireCandidate.ratingStrategy}</dd>
              </div>
              <div>
                <dt>Salary</dt>
                <dd>{fmtMoney(hireCandidate.askingSalaryCents)}</dd>
              </div>
            </dl>
            <label className="staff-view__dialog-field">
              <span>Contract years</span>
              <input
                type="number"
                min={1}
                max={8}
                step={1}
                value={contractYears}
                onChange={(e) => setContractYears(Number(e.target.value))}
              />
            </label>
            <div className="staff-view__dialog-actions">
              <button type="button" onClick={() => setHireCandidate(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="staff-view__primary-btn"
                onClick={() => {
                  void hire({
                    slotId: openedSlotId,
                    teamId,
                    poolId: hireCandidate.poolId,
                    role: hireCandidate.preferredRole as Role,
                    contractYears,
                    salaryCents: hireCandidate.askingSalaryCents,
                  });
                  setHireCandidate(null);
                }}
              >
                Confirm hire
              </button>
            </div>
          </div>
        </div>
      )}

      {status === 'loading' && <p>Loading…</p>}
    </section>
  );
}
