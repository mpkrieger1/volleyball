import { useEffect, useState } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useCoachingStore, type PoolRow } from '../store/useCoachingStore';

type Role = 'HC' | 'AHC' | 'AC';

function fmtMoney(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export function StaffView() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!openedSlotId) return;
    let cancelled = false;
    void (async () => {
      const res = await window.vcd.match.listTeams(openedSlotId);
      if (cancelled || !res.ok) return;
      if (res.teams.length > 0) setTeamId(res.teams[0]!.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [openedSlotId]);

  if (!openedSlotId || !teamId) return null;
  return <StaffViewInner teamId={teamId} />;
}

function StaffViewInner({ teamId }: { teamId: string }) {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const { staff, pool, budgetCents, status, error, load, fire, hire } = useCoachingStore();
  const [hireCandidate, setHireCandidate] = useState<PoolRow | null>(null);
  const [contractYears, setContractYears] = useState(3);

  useEffect(() => {
    if (openedSlotId) void load(openedSlotId, teamId);
  }, [openedSlotId, teamId, load]);

  if (!openedSlotId) return null;

  return (
    <section aria-labelledby="staff-heading" className="staff-view">
      <header className="match-hub__header">
        <h1 id="staff-heading">Coaching Staff</h1>
        <p className="match-hub__sub">Operating budget: {fmtMoney(budgetCents)}</p>
      </header>

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      <table className="poll-view__table staff-view__table">
        <caption>Current staff</caption>
        <thead>
          <tr>
            <th scope="col">Role</th>
            <th scope="col">Name</th>
            <th scope="col">Recruit</th>
            <th scope="col">Develop</th>
            <th scope="col">Strategy</th>
            <th scope="col">Salary</th>
            <th scope="col">Years</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((c) => (
            <tr key={c.coachId}>
              <td>{c.role}</td>
              <td>
                {c.firstName} {c.lastName}
              </td>
              <td>{c.ratingRecruit}</td>
              <td>{c.ratingDevelop}</td>
              <td>{c.ratingStrategy}</td>
              <td>{fmtMoney(c.salaryCents)}</td>
              <td>{c.contractYears}</td>
              <td>
                <button
                  type="button"
                  disabled={status === 'working'}
                  onClick={() => void fire(openedSlotId, teamId, c.coachId)}
                >
                  Fire
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Hiring pool</h2>
      <table className="poll-view__table staff-view__pool">
        <caption>Available coaches</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Role</th>
            <th scope="col">Recruit</th>
            <th scope="col">Develop</th>
            <th scope="col">Strategy</th>
            <th scope="col">Asking</th>
            <th scope="col">Age</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {pool.slice(0, 30).map((p) => (
            <tr key={p.poolId}>
              <td>
                {p.firstName} {p.lastName}
              </td>
              <td>{p.preferredRole}</td>
              <td>{p.ratingRecruit}</td>
              <td>{p.ratingDevelop}</td>
              <td>{p.ratingStrategy}</td>
              <td>{fmtMoney(p.askingSalaryCents)}</td>
              <td>{p.ageYears}</td>
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

      {hireCandidate && (
        <div role="dialog" aria-labelledby="hire-dialog-heading" className="staff-view__dialog">
          <h3 id="hire-dialog-heading">
            Hire {hireCandidate.firstName} {hireCandidate.lastName} as {hireCandidate.preferredRole}?
          </h3>
          <label>
            Contract years:{' '}
            <input
              type="number"
              min={1}
              max={8}
              value={contractYears}
              onChange={(e) => setContractYears(Number(e.target.value))}
            />
          </label>
          <p>Salary: {fmtMoney(hireCandidate.askingSalaryCents)}</p>
          <button
            type="button"
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
          <button type="button" onClick={() => setHireCandidate(null)}>
            Cancel
          </button>
        </div>
      )}

      {status === 'loading' && <p>Loading…</p>}
    </section>
  );
}
