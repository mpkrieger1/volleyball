// Sprint 19: paced ticker scheduler for the Match Hub.
//
// Pure utility: given an event sequence and a speed setting, fire a
// callback at paced intervals. Speed map (PRD §5 Sprint 19 exit test 2):
//   1x      → 1500ms / event
//   2x      →  750ms / event
//   4x      →  375ms / event
//   instant →    0ms (all events fire synchronously)
//
// Pause/resume preserves the current event index. setSpeed mid-stream
// reschedules the next tick at the new interval.

export type ReplaySpeed = '1x' | '2x' | '4x' | 'instant';

export const REPLAY_INTERVALS_MS: Record<ReplaySpeed, number> = {
  '1x': 1500,
  '2x': 750,
  '4x': 375,
  instant: 0,
};

export type ReplayController = {
  /** Start (or resume) firing events from the current index. */
  play: () => void;
  /** Halt firing. Index is preserved; resume with play(). */
  pause: () => void;
  /** Change speed; takes effect on the next tick. */
  setSpeed: (s: ReplaySpeed) => void;
  /** Fire all remaining events synchronously, then complete. */
  finishInstantly: () => void;
  /** Halt and clear all pending state. After stop(), play() is a no-op. */
  stop: () => void;
  /** Current event index (read-only convenience). */
  getIndex: () => number;
};

export type CreateReplaySchedulerInput<E> = {
  events: readonly E[];
  initialSpeed?: ReplaySpeed;
  onEvent: (event: E, index: number) => void;
  onComplete?: () => void;
};

export function createReplayScheduler<E>(input: CreateReplaySchedulerInput<E>): ReplayController {
  const events = input.events;
  let speed: ReplaySpeed = input.initialSpeed ?? '1x';
  let index = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let stopped = false;

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function fireNext(): void {
    if (stopped || !running) return;
    if (index >= events.length) {
      running = false;
      input.onComplete?.();
      return;
    }
    const event = events[index]!;
    const idx = index;
    index += 1;
    input.onEvent(event, idx);
    if (speed === 'instant') {
      // Drain remaining events synchronously.
      while (running && !stopped && index < events.length) {
        const e = events[index]!;
        const i = index;
        index += 1;
        input.onEvent(e, i);
      }
      if (!stopped) {
        running = false;
        input.onComplete?.();
      }
      return;
    }
    timer = setTimeout(fireNext, REPLAY_INTERVALS_MS[speed]);
  }

  return {
    play() {
      if (stopped) return;
      if (running) return;
      running = true;
      // First tick fires immediately (no leading delay) so the user sees
      // motion as soon as they hit play.
      fireNext();
    },
    pause() {
      running = false;
      clearTimer();
    },
    setSpeed(s: ReplaySpeed) {
      speed = s;
      if (running && !stopped) {
        clearTimer();
        timer = setTimeout(fireNext, REPLAY_INTERVALS_MS[speed]);
      }
    },
    finishInstantly() {
      if (stopped) return;
      running = true;
      clearTimer();
      while (index < events.length) {
        const e = events[index]!;
        const i = index;
        index += 1;
        input.onEvent(e, i);
      }
      running = false;
      input.onComplete?.();
    },
    stop() {
      stopped = true;
      running = false;
      clearTimer();
    },
    getIndex: () => index,
  };
}
