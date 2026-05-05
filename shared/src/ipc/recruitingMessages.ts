import { z } from 'zod';

// Sprint 28 Task 28.5B: action catalog rewritten.
export const RECRUITING_ACTION_TYPES = [
  'SCOUT',
  'PHONE_CALL',
  'HOME_VISIT',
  'OFFER_SCHOLARSHIP',
  'CAMP_INVITE',
] as const;
export const RecruitingActionType = z.enum(RECRUITING_ACTION_TYPES);
export type RecruitingActionType = z.infer<typeof RecruitingActionType>;

const ErrCode = z.enum(['NOT_FOUND', 'INVALID_INPUT', 'NOT_RECRUITING', 'INSUFFICIENT_BUDGET', 'RECRUIT_NOT_PENDING', 'INTERNAL']);
const Err = z.object({
  ok: z.literal(false),
  error: z.object({ code: ErrCode, message: z.string() }),
});

// --- open ---
export const OpenCycleRequest = z.object({
  slotId: z.string().min(1),
  seasonYear: z.number().int(),
  classSize: z.number().int().positive().optional(),
});
export type OpenCycleRequest = z.infer<typeof OpenCycleRequest>;
export const OpenCycleOk = z.object({
  ok: z.literal(true),
  recruitsCreated: z.number().int().nonnegative(),
  interestsSeeded: z.number().int().nonnegative(),
});
export const OpenCycleResponse = z.discriminatedUnion('ok', [OpenCycleOk, Err]);
export type OpenCycleResponse = z.infer<typeof OpenCycleResponse>;

// --- action ---
export const ActionRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
  recruitId: z.string().min(1),
  action: RecruitingActionType,
});
export type ActionRequest = z.infer<typeof ActionRequest>;
export const ActionOk = z.object({
  ok: z.literal(true),
  newInterest: z.number().int(),
  budgetRemaining: z.number().int(),
  week: z.number().int(),
});
export const ActionResponse = z.discriminatedUnion('ok', [ActionOk, Err]);
export type ActionResponse = z.infer<typeof ActionResponse>;

// --- advance ---
export const AdvanceRequest = z.object({
  slotId: z.string().min(1),
  userTeamId: z.string().nullable().optional(),
});
export type AdvanceRequest = z.infer<typeof AdvanceRequest>;
export const AdvanceOk = z.object({
  ok: z.literal(true),
  week: z.number().int(),
  aiActionsApplied: z.number().int(),
  commitsResolved: z.number().int(),
});
export const AdvanceResponse = z.discriminatedUnion('ok', [AdvanceOk, Err]);
export type AdvanceResponse = z.infer<typeof AdvanceResponse>;

// --- close ---
export const CloseRequest = z.object({ slotId: z.string().min(1) });
export type CloseRequest = z.infer<typeof CloseRequest>;
export const CloseOk = z.object({
  ok: z.literal(true),
  uncommittedCount: z.number().int(),
});
export const CloseResponse = z.discriminatedUnion('ok', [CloseOk, Err]);
export type CloseResponse = z.infer<typeof CloseResponse>;

// --- state (board snapshot) ---
export const StateRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
});
export type StateRequest = z.infer<typeof StateRequest>;

export const BoardRecruitView = z.object({
  recruitId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  position: z.string(),
  stars: z.number().int(),
  height: z.number().int().nullable(),
  hometownCity: z.string().nullable(),
  hometownState: z.string().nullable(),
  hometownRegion: z.string().nullable(),
  commitState: z.string(),
  commitTeamId: z.string().nullable(),
  interest: z.number().int(),
  /** Sprint 28: the user team's action count on this recruit (for "my targets" filter). */
  actionsSpent: z.number().int().nonnegative().default(0),
  /** Sprint 28: top-line leader (team abbr) deduced from interest values. Null = no leader yet. */
  leaderAbbr: z.string().nullable().default(null),
});
export type BoardRecruitView = z.infer<typeof BoardRecruitView>;

export const StateOk = z.object({
  ok: z.literal(true),
  phase: z.string(),
  week: z.number().int(),
  budgetRemaining: z.number().int(),
  recruits: z.array(BoardRecruitView),
});
export const StateResponse = z.discriminatedUnion('ok', [StateOk, Err]);
export type StateResponse = z.infer<typeof StateResponse>;

// Sprint 28 Task 28.5B: budget snapshot.
export const BudgetRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
});
export type BudgetRequest = z.infer<typeof BudgetRequest>;
export const BudgetOk = z.object({
  ok: z.literal(true),
  total: z.number().int().nonnegative(),
  spent: z.number().int().nonnegative(),
  remaining: z.number().int(),
  breakdown: z.object({
    base: z.number().int(),
    hc: z.number().int(),
    ahc: z.number().int(),
    ac: z.number().int(),
  }),
  week: z.number().int(),
});
export const BudgetResponse = z.discriminatedUnion('ok', [BudgetOk, Err]);
export type BudgetResponse = z.infer<typeof BudgetResponse>;

// Sprint 28 Task 28.5B: roster gap signal.
export const TeamNeedsRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
});
export type TeamNeedsRequest = z.infer<typeof TeamNeedsRequest>;
export const PositionNeed = z.object({
  position: z.string(),
  rosterCount: z.number().int().nonnegative(),
  graduatingCount: z.number().int().nonnegative(),
  thinness: z.number().int(), // higher = bigger gap
});
export type PositionNeed = z.infer<typeof PositionNeed>;
export const TeamNeedsOk = z.object({
  ok: z.literal(true),
  needs: z.array(PositionNeed),
});
export const TeamNeedsResponse = z.discriminatedUnion('ok', [TeamNeedsOk, Err]);
export type TeamNeedsResponse = z.infer<typeof TeamNeedsResponse>;

// Sprint 28 Task 28.5B: full per-recruit detail for the modal.
export const DetailRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
  recruitId: z.string().min(1),
});
export type DetailRequest = z.infer<typeof DetailRequest>;
export const InterestMeterRow = z.object({
  teamId: z.string(),
  teamAbbr: z.string(),
  interest: z.number().int(),
  isUserTeam: z.boolean(),
});
export type InterestMeterRow = z.infer<typeof InterestMeterRow>;
export const ScoutGrade = z.enum(['A', 'B', 'C', 'D', 'F', '?']);
export const ScoutReportRow = z.object({
  skill: z.string(),
  grade: ScoutGrade,
});
export type ScoutReportRow = z.infer<typeof ScoutReportRow>;
// Sprint 37 Task 37.4: extend the modal payload with the Sprint 35/36
// data Sprint 36 components consume (PrioritiesReadout, PitchReasonsCard,
// ScoutTierIndicator, NilOfferSlider).
export const RecruitPrioritiesView = z.object({
  playingTime: z.number().int().min(0).max(10),
  proximityToHome: z.number().int().min(0).max(10),
  prestige: z.number().int().min(0).max(10),
  facilities: z.number().int().min(0).max(10),
  nilDeal: z.number().int().min(0).max(10),
});
export type RecruitPrioritiesView = z.infer<typeof RecruitPrioritiesView>;

export const PitchReasonView = z.object({
  type: z.enum(['COACH_PEDIGREE', 'COACH_CONNECTION']),
  active: z.boolean(),
  points: z.number().int().nonnegative(),
  flavorText: z.string(),
});
export type PitchReasonView = z.infer<typeof PitchReasonView>;

export const RecruiterQualityView = z.object({
  coachId: z.string(),
  role: z.enum(['HC', 'AHC', 'AC']),
  quality: z.enum(['ACE', 'GREAT', 'GOOD', 'MEDIOCRE']),
});
export type RecruiterQualityView = z.infer<typeof RecruiterQualityView>;

export const RecruitDetailView = z.object({
  recruitId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  position: z.string(),
  stars: z.number().int(),
  height: z.number().int().nullable(),
  hometownCity: z.string().nullable(),
  hometownState: z.string().nullable(),
  hometownRegion: z.string().nullable(),
  commitState: z.string(),
  commitTeamId: z.string().nullable(),
  scoutLevel: z.number().int().nonnegative(),
  scoutReport: z.array(ScoutReportRow),
  interestMeter: z.array(InterestMeterRow),
  /** This team's spend pattern: total actions across all action types. */
  actionsSpent: z.number().int().nonnegative(),
  // ── Sprint 37 additions ──
  /** Sprint 35: per-recruit priorities (0..10 each). */
  priorities: RecruitPrioritiesView,
  /** Sprint 35: 15% of recruits flip proximity polarity. */
  wantsToLeaveHome: z.boolean(),
  /** Sprint 36: PEDIGREE + CONNECTION pitch reasons (active flags + points). */
  pitchReasons: z.array(PitchReasonView),
  /** Sprint 36: recruiter-quality tier per coaching slot (HC/AHC/AC). */
  recruiterQualityByCoach: z.array(RecruiterQualityView),
  /** Sprint 36: this team's NIL pool size in cents. */
  nilBudgetCents: z.number().int().nonnegative(),
  /** Sprint 36: NIL spent across the team this cycle (cents). */
  nilBudgetUsedCents: z.number().int().nonnegative(),
  /** Sprint 36: this (team, recruit) NIL offer (cents). */
  nilOfferCents: z.number().int().nonnegative(),
});
export type RecruitDetailView = z.infer<typeof RecruitDetailView>;
export const DetailOk = z.object({ ok: z.literal(true), detail: RecruitDetailView });
export const DetailResponse = z.discriminatedUnion('ok', [DetailOk, Err]);
export type DetailResponse = z.infer<typeof DetailResponse>;

// Sprint 36: setNilOffer — user adjusts NIL allocation for a recruit.
export const SetNilOfferRequest = z.object({
  slotId: z.string().min(1),
  teamId: z.string().min(1),
  recruitId: z.string().min(1),
  offerCents: z.number().int().nonnegative(),
});
export type SetNilOfferRequest = z.infer<typeof SetNilOfferRequest>;
export const SetNilOfferOk = z.object({
  ok: z.literal(true),
  nilOfferCents: z.number().int(),
  nilBudgetUsedCents: z.number().int(),
});
export const SetNilOfferResponse = z.discriminatedUnion('ok', [SetNilOfferOk, Err]);
export type SetNilOfferResponse = z.infer<typeof SetNilOfferResponse>;

export const RECRUITING_IPC_CHANNELS = {
  open: 'recruiting:open',
  action: 'recruiting:action',
  advance: 'recruiting:advance',
  close: 'recruiting:close',
  state: 'recruiting:state',
  budget: 'recruiting:budget',
  teamNeeds: 'recruiting:teamNeeds',
  detail: 'recruiting:detail',
  setNilOffer: 'recruiting:setNilOffer',
} as const;
