export type ReplaySpeed = '1x' | '2x' | '4x' | 'instant';
export declare const REPLAY_INTERVALS_MS: Record<ReplaySpeed, number>;
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
export declare function createReplayScheduler<E>(input: CreateReplaySchedulerInput<E>): ReplayController;
//# sourceMappingURL=replayScheduler.d.ts.map