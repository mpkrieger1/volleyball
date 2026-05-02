// Sprint 24 Task 24.5: Settings screen.
//
// Sections (in order): Display (font size), Diagnostics (crash reporting
// opt-in), Updates (manual check), About (version + license).

import { useState } from 'react';
import { useSettingsStore, FONT_SIZES, type FontSize } from '../store/useSettingsStore';

const VCD_VERSION = '0.1.0';

type UpdateCheckStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'result'; ok: boolean; status: string; message?: string };

export function SettingsScreen() {
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const diagnosticsEnabled = useSettingsStore((s) => s.diagnosticsEnabled);
  const setDiagnosticsEnabled = useSettingsStore((s) => s.setDiagnosticsEnabled);
  const [updateStatus, setUpdateStatus] = useState<UpdateCheckStatus>({ kind: 'idle' });

  const onCheckForUpdates = async (): Promise<void> => {
    setUpdateStatus({ kind: 'checking' });
    if (!window.vcd?.crash) {
      setUpdateStatus({ kind: 'result', ok: false, status: 'unavailable', message: 'IPC bridge missing' });
      return;
    }
    if (!window.vcd.update?.checkNow) {
      setUpdateStatus({ kind: 'result', ok: false, status: 'unavailable', message: 'Updater not wired' });
      return;
    }
    try {
      const r = await window.vcd.update.checkNow();
      if (r.ok) {
        setUpdateStatus({ kind: 'result', ok: true, status: r.status });
      } else {
        setUpdateStatus({ kind: 'result', ok: false, status: r.status, message: r.message });
      }
    } catch (err) {
      setUpdateStatus({
        kind: 'result',
        ok: false,
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <section className="settings-screen" aria-labelledby="settings-h1">
      <h1 id="settings-h1">Settings</h1>

      <div className="settings-section">
        <h2>Display</h2>
        <div className="settings-row">
          <span id="font-size-label">Font size</span>
          <div role="radiogroup" aria-labelledby="font-size-label" className="settings-radio">
            {FONT_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={fontSize === s}
                onClick={() => setFontSize(s)}
                className={fontSize === s ? 'settings-radio__btn--active' : 'settings-radio__btn'}
              >
                {fontSizeLabel(s)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Diagnostics</h2>
        <p className="settings-desc">
          Send anonymous crash reports to help improve VCD. Only stack traces
          and process info are sent — no save data, no team or player names,
          no identifiers. You can disable this any time.
        </p>
        <label className="settings-row">
          <input
            type="checkbox"
            checked={diagnosticsEnabled}
            onChange={(e) => setDiagnosticsEnabled(e.target.checked)}
          />
          <span>Enable diagnostics</span>
        </label>
      </div>

      <div className="settings-section">
        <h2>Updates</h2>
        <p className="settings-desc">
          Check for new versions of VCD. In dev builds this is a no-op; in
          packaged builds it queries GitHub Releases.
        </p>
        <div className="settings-row">
          <button type="button" onClick={onCheckForUpdates}>
            Check for updates
          </button>
          {updateStatus.kind === 'checking' && <span>Checking…</span>}
          {updateStatus.kind === 'result' && (
            <span>
              {updateStatus.ok ? '✓ ' : '✗ '}
              {humanizeUpdateStatus(updateStatus.status)}
              {updateStatus.message ? ` — ${updateStatus.message}` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h2>About</h2>
        <p className="settings-desc">
          VCD <strong>v{VCD_VERSION}</strong> — NCAA Volleyball Coach
          Dynasty.
          <br />
          Built with Electron, React, TypeScript, Prisma + SQLite.
          <br />
          © Krieger Analytics. UNLICENSED.
        </p>
      </div>
    </section>
  );
}

function fontSizeLabel(s: FontSize): string {
  return s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large';
}

function humanizeUpdateStatus(s: string): string {
  switch (s) {
    case 'checked':
      return 'You are up to date.';
    case 'dev-only':
      return 'Updates are unavailable in dev builds.';
    case 'available':
      return 'Update available — downloading…';
    case 'downloaded':
      return 'Update downloaded — restart to install.';
    case 'error':
      return 'Update check failed';
    case 'unavailable':
      return 'Updater unavailable';
    default:
      return s;
  }
}
