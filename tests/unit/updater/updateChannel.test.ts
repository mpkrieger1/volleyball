// Sprint 24 Task 24.3: gating contract for the auto-updater. The
// updater itself (electron-updater) is real-network-bound and not
// exercised here; we test the gating helper that decides whether
// to call into it.

import { describe, expect, it, vi } from 'vitest';
import { shouldAutoCheck, defaultUpdateState } from '../../../main/src/update/updaterGate';

describe('shouldAutoCheck', () => {
  it('returns false when diagnostics is off', () => {
    expect(shouldAutoCheck({ diagnosticsEnabled: false, isPackaged: true })).toBe(false);
  });

  it('returns false in dev (isPackaged === false), even if diagnostics on', () => {
    expect(shouldAutoCheck({ diagnosticsEnabled: true, isPackaged: false })).toBe(false);
  });

  it('returns true when diagnostics on AND packaged', () => {
    expect(shouldAutoCheck({ diagnosticsEnabled: true, isPackaged: true })).toBe(true);
  });
});

describe('defaultUpdateState', () => {
  it('starts in idle state', () => {
    const s = defaultUpdateState();
    expect(s.status).toBe('idle');
    expect(s.lastChecked).toBe(null);
  });
});

describe('checkForUpdates manual override', () => {
  it('skips network in dev mode and returns dev-only status', async () => {
    // Dynamic import after vi.mock would be needed for true network mocking;
    // here we just exercise the contract that the dev guard short-circuits.
    const { checkForUpdatesGated } = await import('../../../main/src/update/updaterGate');
    const result = await checkForUpdatesGated({ isPackaged: false });
    expect(result.ok).toBe(true);
    expect(result.status).toBe('dev-only');
  });

  it('reports error when packaged but updater unavailable (network/config)', async () => {
    const { checkForUpdatesGated } = await import('../../../main/src/update/updaterGate');
    // Stub a callback that throws — simulating electron-updater failing.
    const result = await checkForUpdatesGated({
      isPackaged: true,
      runner: () => {
        throw new Error('network down');
      },
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('error');
  });

  it('passes through to the runner when packaged + runner provided', async () => {
    const { checkForUpdatesGated } = await import('../../../main/src/update/updaterGate');
    const runner = vi.fn(async () => {
      /* simulate no update available */
    });
    const result = await checkForUpdatesGated({ isPackaged: true, runner });
    expect(runner).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    expect(result.status).toBe('checked');
  });
});
