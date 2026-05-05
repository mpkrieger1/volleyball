// Sprint 28 redesign: college-athletics-style player profile modal.
//
// Layout (top to bottom):
//   - Hero band: jersey number + name (large) + team chip
//   - Vitals strip: Position | Class | Height | Hometown | NIL | Status
//   - Big Overall / Potential cards
//   - Career numbers (current + career stat rows)
//   - Skill ratings grid with bar visualization
//
// Read-only this sprint. ESC closes; click-outside dialog also closes.
// Focus is restored to the trigger row on close (handled by caller via
// the `onClose` callback). Volume-weighted hitting % per CLAUDE.md
// "From Sprint 22". NIL displayed in whole dollars per Sprint 28
// money convention.

import { useEffect, useRef } from 'react';
import { offseason, type rosterIpc } from '@vcd/shared';

type Props = {
  profile: rosterIpc.PlayerProfile | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

function fmtHittingPct(milli: number): string {
  const v = milli / 1000;
  return v >= 0 ? `.${String(Math.round(milli)).padStart(3, '0')}` : `-${fmtHittingPct(-milli)}`;
}

function fmtHeight(cm: number): string {
  if (!cm) return '—';
  const inches = Math.round(cm / 2.54);
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return `${ft}'${inch}"`;
}

function fmtHometown(city: string | null, state: string | null): string {
  if (!city && !state) return '—';
  if (!state) return city ?? '—';
  if (!city) return state;
  return `${city}, ${state}`;
}

function fmtMoney(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function expandClassYear(cy: string): string {
  switch (cy) {
    case 'FR': return 'Freshman';
    case 'SO': return 'Sophomore';
    case 'JR': return 'Junior';
    case 'SR': return 'Senior';
    case 'GR': return 'Graduate';
    default: return cy;
  }
}

const RATING_LABELS: Array<{ key: keyof rosterIpc.PlayerRatings; label: string }> = [
  { key: 'attack', label: 'Attack' },
  { key: 'block', label: 'Block' },
  { key: 'serve', label: 'Serve' },
  { key: 'pass', label: 'Pass' },
  { key: 'set', label: 'Set' },
  { key: 'dig', label: 'Dig' },
  { key: 'athleticism', label: 'Athleticism' },
  { key: 'iq', label: 'IQ' },
  { key: 'stamina', label: 'Stamina' },
];

// Sprint 32: per-skill headroom indicator using the FCCD gain curve.
// Color-blind safe — icon + text label, not color alone.
const HEADROOM_CURVE = offseason.lineFunc(40, 1.5, 100, 0.25);
function headroomFor(rating: number): { label: string; icon: string } {
  const curve = Math.max(0, Math.min(2, HEADROOM_CURVE(rating)));
  if (curve > 1.0) return { label: 'Wide open', icon: '▲' };
  if (curve > 0.5) return { label: 'Some room', icon: '◆' };
  return { label: 'Capped', icon: '■' };
}

export function PlayerProfileModal({ profile, loading, error, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      className="player-profile-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="player-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-profile-title"
        data-testid="player-profile-modal"
        tabIndex={-1}
      >
        {loading && <p data-testid="player-profile-loading">Loading…</p>}
        {error && (
          <p role="alert" data-testid="player-profile-error">
            {error}
          </p>
        )}
        {profile && (
          <>
            <button
              type="button"
              className="player-profile-modal__close"
              aria-label="Close player profile"
              data-testid="player-profile-close"
              onClick={onClose}
            >
              ×
            </button>

            {/* Hero band — large jersey + name + team chip. */}
            <header className="player-profile-modal__hero">
              <span className="player-profile-modal__jersey" aria-hidden="true">
                #{profile.jersey}
              </span>
              <div className="player-profile-modal__hero-text">
                <p className="player-profile-modal__team-chip">
                  {profile.teamAbbr} · {profile.teamSchool}
                </p>
                <h2 id="player-profile-title" className="player-profile-modal__name">
                  {profile.firstName} {profile.lastName}
                </h2>
                <p className="player-profile-modal__hero-sub">
                  {profile.position}
                  {profile.isLibero ? ' · Libero' : ''}
                  {profile.isCaptain ? ' · Captain' : ''}
                </p>
              </div>
            </header>

            {/* Vitals strip. */}
            <dl className="player-profile-modal__vitals" data-testid="player-vitals">
              <div>
                <dt>Pos</dt>
                <dd>{profile.position}</dd>
              </div>
              <div>
                <dt>Class</dt>
                <dd>{expandClassYear(profile.classYear)}</dd>
              </div>
              <div>
                <dt>Height</dt>
                <dd>{fmtHeight(profile.height)}</dd>
              </div>
              <div>
                <dt>Hometown</dt>
                <dd>{fmtHometown(profile.hometownCity, profile.hometownState)}</dd>
              </div>
              <div>
                <dt>NIL</dt>
                <dd data-testid="player-nil">{fmtMoney(profile.nilCents)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{profile.redshirtUsed ? 'Redshirt used' : 'Healthy'}</dd>
              </div>
            </dl>

            {/* Big OVR / POT cards. */}
            <div className="player-profile-modal__numbers">
              <div className="player-profile-modal__number-card">
                <span className="player-profile-modal__number-label">Overall</span>
                <span
                  className="player-profile-modal__number-value"
                  data-testid="player-profile-ovr"
                >
                  {profile.overall}
                </span>
              </div>
              <div className="player-profile-modal__number-card">
                <span className="player-profile-modal__number-label">Potential</span>
                <span className="player-profile-modal__number-value">
                  {profile.potential}
                </span>
              </div>
            </div>

            {/* Career numbers — current + career rows. */}
            <section aria-labelledby="player-profile-stats">
              <h3 id="player-profile-stats" className="player-profile-modal__h3">
                Career Numbers
              </h3>
              <table className="player-profile-modal__stats">
                <caption className="visually-hidden">Player season + career stats</caption>
                <thead>
                  <tr>
                    <th scope="col">Period</th>
                    <th scope="col" className="t-num">M</th>
                    <th scope="col" className="t-num">K</th>
                    <th scope="col" className="t-num">E</th>
                    <th scope="col" className="t-num">TA</th>
                    <th scope="col" className="t-num">Pct</th>
                    <th scope="col" className="t-num">D</th>
                    <th scope="col" className="t-num">B</th>
                    <th scope="col" className="t-num">A</th>
                    <th scope="col" className="t-num">As</th>
                  </tr>
                </thead>
                <tbody>
                  <StatsRow label="Current" stats={profile.currentSeasonStats} />
                  <StatsRow label="Career" stats={profile.careerStats} />
                </tbody>
              </table>
            </section>

            {/* Ratings grid. */}
            <section aria-labelledby="player-profile-ratings">
              <h3 id="player-profile-ratings" className="player-profile-modal__h3">
                Skill Ratings
              </h3>
              <ul className="player-profile-modal__ratings-grid" aria-label="Skill ratings">
                {RATING_LABELS.map((r) => {
                  const value = profile.ratings[r.key];
                  const headroom = headroomFor(value);
                  return (
                    <li key={r.key} className="player-profile-modal__rating-item">
                      <span className="player-profile-modal__rating-label">{r.label}</span>
                      <span
                        className="player-profile-modal__rating-value"
                        data-testid={`rating-${r.key}`}
                      >
                        {value}
                      </span>
                      <span
                        className="player-profile-modal__rating-bar"
                        aria-hidden="true"
                      >
                        <span
                          className="player-profile-modal__rating-bar-fill"
                          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                        />
                      </span>
                      <span
                        className="player-profile-modal__rating-headroom"
                        data-testid={`headroom-${r.key}`}
                      >
                        <span aria-hidden="true">{headroom.icon}</span>
                        <span> {headroom.label}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function StatsRow({ label, stats }: { label: string; stats: rosterIpc.PlayerSeasonStats }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td className="t-num">{stats.matchesPlayed}</td>
      <td className="t-num">{stats.kills}</td>
      <td className="t-num">{stats.errors}</td>
      <td className="t-num">{stats.totalAttacks}</td>
      <td className="t-num">{fmtHittingPct(stats.hittingPctMilli)}</td>
      <td className="t-num">{stats.digs}</td>
      <td className="t-num">{stats.blocks}</td>
      <td className="t-num">{stats.aces}</td>
      <td className="t-num">{stats.assists}</td>
    </tr>
  );
}
