// Sprint 24 Task 24.3: pure gating logic for auto-update.
//
// `electron-updater` itself is network- and Electron-runtime-bound, so
// we keep the orchestration (when to call it, what it returned) in a
// pure helper that can be unit-tested without spinning up an Electron
// app instance.

export type UpdateStatus =
  | 'idle' // never checked
  | 'checking' // mid-check
  | 'checked' // checked successfully (no update or update found)
  | 'available' // an update was found and is downloading
  | 'downloaded' // the update is downloaded; ready to install
  | 'dev-only' // app is unpackaged; updater would throw, so we skip
  | 'error'; // last check threw

export type UpdateState = {
  status: UpdateStatus;
  lastChecked: number | null;
  message: string | null;
};

export function defaultUpdateState(): UpdateState {
  return { status: 'idle', lastChecked: null, message: null };
}

/** Auto-check is gated on user opt-in (diagnostics) AND packaged build. */
export function shouldAutoCheck(opts: {
  diagnosticsEnabled: boolean;
  isPackaged: boolean;
}): boolean {
  if (!opts.diagnosticsEnabled) return false;
  if (!opts.isPackaged) return false;
  return true;
}

export type CheckForUpdatesResult =
  | { ok: true; status: 'checked' | 'dev-only' }
  | { ok: false; status: 'error'; message: string };

/**
 * Manual "Check for updates" entry point. Always callable regardless of
 * diagnostics opt-in (manual override). In dev mode (`isPackaged=false`)
 * the call is a no-op that returns `'dev-only'` so the renderer can show
 * a friendly message rather than crashing.
 */
export async function checkForUpdatesGated(opts: {
  isPackaged: boolean;
  runner?: () => Promise<unknown>;
}): Promise<CheckForUpdatesResult> {
  if (!opts.isPackaged) {
    return { ok: true, status: 'dev-only' };
  }
  if (!opts.runner) {
    return { ok: false, status: 'error', message: 'No updater runner provided.' };
  }
  try {
    await opts.runner();
    return { ok: true, status: 'checked' };
  } catch (err) {
    return {
      ok: false,
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
