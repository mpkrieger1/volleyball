import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  createReplayScheduler,
  REPLAY_INTERVALS_MS,
} from '../../../app/src/match/replayScheduler';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const EVENTS = [1, 2, 3, 4, 5];

describe('createReplayScheduler', () => {
  it('fires first event immediately on play() at any speed', () => {
    const onEvent = vi.fn();
    const scheduler = createReplayScheduler({ events: EVENTS, initialSpeed: '1x', onEvent });
    scheduler.play();
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenLastCalledWith(1, 0);
    scheduler.stop();
  });

  it('1x: events fire at 1500ms intervals', () => {
    const onEvent = vi.fn();
    const scheduler = createReplayScheduler({ events: EVENTS, initialSpeed: '1x', onEvent });
    scheduler.play();
    expect(onEvent).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(REPLAY_INTERVALS_MS['1x']);
    expect(onEvent).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(REPLAY_INTERVALS_MS['1x'] * 3);
    expect(onEvent).toHaveBeenCalledTimes(5);
    scheduler.stop();
  });

  it('2x: events fire at 750ms intervals', () => {
    const onEvent = vi.fn();
    const scheduler = createReplayScheduler({ events: EVENTS, initialSpeed: '2x', onEvent });
    scheduler.play();
    vi.advanceTimersByTime(REPLAY_INTERVALS_MS['2x'] * 4);
    expect(onEvent).toHaveBeenCalledTimes(5);
    scheduler.stop();
  });

  it('4x: events fire at 375ms intervals', () => {
    const onEvent = vi.fn();
    const scheduler = createReplayScheduler({ events: EVENTS, initialSpeed: '4x', onEvent });
    scheduler.play();
    vi.advanceTimersByTime(REPLAY_INTERVALS_MS['4x'] * 4);
    expect(onEvent).toHaveBeenCalledTimes(5);
    scheduler.stop();
  });

  it('instant: all events fire synchronously on play()', () => {
    const onEvent = vi.fn();
    const onComplete = vi.fn();
    const scheduler = createReplayScheduler({
      events: EVENTS,
      initialSpeed: 'instant',
      onEvent,
      onComplete,
    });
    scheduler.play();
    expect(onEvent).toHaveBeenCalledTimes(5);
    expect(onComplete).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('pause halts firing; play() resumes from same index', () => {
    const onEvent = vi.fn();
    const scheduler = createReplayScheduler({ events: EVENTS, initialSpeed: '1x', onEvent });
    scheduler.play();
    expect(onEvent).toHaveBeenCalledTimes(1);
    scheduler.pause();
    vi.advanceTimersByTime(10_000);
    expect(onEvent).toHaveBeenCalledTimes(1); // no more
    scheduler.play();
    expect(onEvent).toHaveBeenCalledTimes(2); // resumes immediately
    scheduler.stop();
  });

  it('setSpeed mid-stream reschedules next tick', () => {
    const onEvent = vi.fn();
    const scheduler = createReplayScheduler({ events: EVENTS, initialSpeed: '1x', onEvent });
    scheduler.play();
    expect(onEvent).toHaveBeenCalledTimes(1);
    scheduler.setSpeed('4x');
    vi.advanceTimersByTime(REPLAY_INTERVALS_MS['4x']);
    expect(onEvent).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('onComplete fires once when all events have been delivered', () => {
    const onEvent = vi.fn();
    const onComplete = vi.fn();
    const scheduler = createReplayScheduler({
      events: EVENTS,
      initialSpeed: '4x',
      onEvent,
      onComplete,
    });
    scheduler.play();
    vi.advanceTimersByTime(REPLAY_INTERVALS_MS['4x'] * 5);
    expect(onComplete).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('finishInstantly fires all remaining events and completes', () => {
    const onEvent = vi.fn();
    const onComplete = vi.fn();
    const scheduler = createReplayScheduler({
      events: EVENTS,
      initialSpeed: '1x',
      onEvent,
      onComplete,
    });
    scheduler.play();
    expect(onEvent).toHaveBeenCalledTimes(1);
    scheduler.finishInstantly();
    expect(onEvent).toHaveBeenCalledTimes(5);
    expect(onComplete).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('stop() halts and prevents further play()', () => {
    const onEvent = vi.fn();
    const scheduler = createReplayScheduler({ events: EVENTS, initialSpeed: '1x', onEvent });
    scheduler.play();
    scheduler.stop();
    scheduler.play();
    vi.advanceTimersByTime(10_000);
    expect(onEvent).toHaveBeenCalledTimes(1); // only the original first fire
  });
});
