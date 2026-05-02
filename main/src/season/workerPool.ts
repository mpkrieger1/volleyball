// Long-lived pool of simWorkerThread Workers. Round-robins jobs across
// workers; each worker processes one request at a time in order.
//
// Cancellation: queued-but-not-started jobs are rejected with 'CANCELLED'.
// Jobs already posted to a worker run to completion (cheap — a single match
// takes ~1–5 ms) and their results are discarded by the caller.

import { Worker } from 'node:worker_threads';
import { crash, type seasonIpc } from '@vcd/shared';
import { recordCrash } from '../crash/recorder';

type Pending = {
  req: seasonIpc.WorkerSimRequest;
  resolve: (r: seasonIpc.WorkerSimResponse) => void;
  reject: (err: Error) => void;
};

type WorkerSlot = {
  worker: Worker;
  busy: boolean;
  /** The pending job currently being processed. */
  active: Pending | null;
};

export class PoolCancelledError extends Error {
  constructor() {
    super('CANCELLED');
    this.name = 'PoolCancelledError';
  }
}

export type SimWorkerPoolOptions = {
  scriptPath: string;
  workerCount: number;
};

export class SimWorkerPool {
  private slots: WorkerSlot[] = [];
  private queue: Pending[] = [];
  private shuttingDown = false;

  constructor(private opts: SimWorkerPoolOptions) {
    for (let i = 0; i < opts.workerCount; i++) this.spawnWorker();
  }

  submit(req: seasonIpc.WorkerSimRequest): Promise<seasonIpc.WorkerSimResponse> {
    if (this.shuttingDown) return Promise.reject(new Error('pool shutting down'));
    return new Promise((resolve, reject) => {
      this.queue.push({ req, resolve, reject });
      this.tryDispatch();
    });
  }

  /**
   * Reject all queued (not-yet-started) jobs with PoolCancelledError.
   * In-flight jobs are allowed to complete (their results are the caller's to
   * discard). Does NOT terminate workers.
   */
  cancelQueued(): number {
    const cancelled = this.queue.length;
    for (const p of this.queue) p.reject(new PoolCancelledError());
    this.queue = [];
    return cancelled;
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    this.cancelQueued();
    await Promise.all(this.slots.map((s) => s.worker.terminate()));
    this.slots = [];
  }

  get queueSize(): number {
    return this.queue.length;
  }

  get busyCount(): number {
    return this.slots.filter((s) => s.busy).length;
  }

  private spawnWorker(): void {
    const w = new Worker(this.opts.scriptPath);
    const slot: WorkerSlot = { worker: w, busy: false, active: null };
    w.on('message', (msg: unknown) => {
      const active = slot.active;
      slot.active = null;
      slot.busy = false;
      if (active) active.resolve(msg as seasonIpc.WorkerSimResponse);
      this.tryDispatch();
    });
    w.on('error', (err) => {
      // Sprint 23: capture worker crashes to the structured crash log.
      // No-op when the recorder is disabled (renderer hasn't opted in).
      recordCrash(crash.formatCrashRecord(err, { processName: 'worker', phase: 'simWorker' }));
      const active = slot.active;
      slot.active = null;
      slot.busy = false;
      if (active) active.reject(err);
      // Respawn unless shutting down.
      if (!this.shuttingDown) {
        const idx = this.slots.indexOf(slot);
        if (idx >= 0) {
          this.slots.splice(idx, 1);
          this.spawnWorker();
        }
      }
    });
    this.slots.push(slot);
  }

  private tryDispatch(): void {
    if (this.shuttingDown) return;
    for (const slot of this.slots) {
      if (slot.busy) continue;
      const next = this.queue.shift();
      if (!next) return;
      slot.busy = true;
      slot.active = next;
      slot.worker.postMessage(next.req);
    }
  }
}
