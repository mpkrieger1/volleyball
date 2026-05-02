// Tuning knobs for the rally FSM. Calibrated against the PRD Sprint 3 exit
// test: ~65% side-out rate for balanced (rating-50) lineups, ±3%.
//
// These numbers are intentionally co-located so a calibration sweep is one-file.
// All probabilities are expressed on a 0..1 scale.

export const TUNING = {
  // --- SERVE ------------------------------------------------------------
  // base rates at server rating = 50 vs receiver pass = 50
  SERVE_ACE_BASE: 0.05,
  SERVE_ERROR_BASE: 0.12,
  // sensitivity to server serve rating (each +10 points adjusts these)
  SERVE_ACE_PER_RATING: 0.0012, // +0.0012 per point of server serve above 50
  SERVE_ERROR_PER_RATING: -0.0008, // stronger servers err less
  SERVE_ACE_PASSER_PENALTY: 0.0010, // +0.0010 per point of receiver pass below 50

  // --- RECEPTION ---------------------------------------------------------
  // probability of a "perfect" pass at pass=50 against an in_play_good serve
  RECEPTION_PERFECT_BASE: 0.30,
  RECEPTION_GOOD_BASE: 0.35,
  RECEPTION_OK_BASE: 0.25,
  // `bad` is the remainder
  RECEPTION_PASS_SENSITIVITY: 0.004, // per rating point above 50 → shift toward perfect
  RECEPTION_SERVE_PENALTY: 0.05, // each step worse serve quality shifts right by this much

  // --- SET ---------------------------------------------------------------
  SET_PERFECT_FROM_PERFECT_RECEPTION: 0.60,
  SET_PERFECT_FROM_GOOD_RECEPTION: 0.35,
  SET_PERFECT_FROM_OK_RECEPTION: 0.15,
  SET_PERFECT_FROM_BAD_RECEPTION: 0.02,
  SET_RATING_SENSITIVITY: 0.004, // per point of setter set rating above 50

  // --- ATTACK ------------------------------------------------------------
  // base kill rate at attack=50, block=50, set=good
  ATTACK_KILL_BASE: 0.38,
  ATTACK_ERROR_BASE: 0.15,
  ATTACK_BLOCKED_BASE: 0.09,
  // `dug` (attack in-play) is the remainder
  ATTACK_KILL_PER_ATTACKER: 0.0040,
  ATTACK_KILL_PER_BLOCKER: -0.0025,
  ATTACK_ERROR_PER_ATTACKER: -0.0015,
  ATTACK_BLOCKED_PER_BLOCKER: 0.0020,
  SET_QUALITY_KILL_BONUS: {
    perfect: 0.12,
    good: 0.0,
    ok: -0.08,
    bad: -0.18,
  },

  // --- DIG ---------------------------------------------------------------
  DIG_KEPT_BASE: 0.48,
  DIG_PER_RATING: 0.0035, // per digger dig rating point above 50

  // --- MOMENTUM ----------------------------------------------------------
  MOMENTUM_PER_POINT: 0.05,
  MOMENTUM_RUN_BONUS: 0.15,
  MOMENTUM_SWING_THRESHOLD: 0.3,
  MOMENTUM_ATTACK_BIAS_MAX: 0.03,
  TIMEOUT_MOMENTUM_RESET_FACTOR: 0.5,

  // --- RALLY SAFETY ------------------------------------------------------
  MAX_CONTACTS: 40,
} as const;

export type Tuning = typeof TUNING;
