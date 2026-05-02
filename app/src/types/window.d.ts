import type {
  saveSlotIpc,
  matchIpc,
  scheduleIpc,
  seasonIpc,
  pollIpc,
  bracketIpc,
  postseasonIpc,
  recruitingIpc,
  portalIpc,
  nilIpc,
  offseasonIpc,
  coachingIpc,
  awardsIpc,
  scoutIpc,
} from '@vcd/shared';

declare global {
  interface VcdApiSurface {
    version: string;
    saveSlots: {
      list(): Promise<
        | { ok: true; slots: saveSlotIpc.SaveSlotSummary[] }
        | { ok: false; error: { code: string; message: string } }
      >;
      create(
        name: string,
      ): Promise<
        | { ok: true; slot: saveSlotIpc.SaveSlotSummary }
        | { ok: false; error: { code: string; message: string } }
      >;
      open(
        id: string,
      ): Promise<
        | { ok: true; slot: saveSlotIpc.SaveSlotSummary }
        | { ok: false; error: { code: string; message: string } }
      >;
      delete(
        id: string,
      ): Promise<{ ok: true } | { ok: false; error: { code: string; message: string } }>;
    };
    match: {
      listTeams(slotId: string): Promise<matchIpc.ListTeamsResponse>;
      simulate(req: {
        slotId: string;
        homeTeamId: string;
        awayTeamId: string;
        seed: number | string;
      }): Promise<matchIpc.SimulateMatchResponse>;
      getById(slotId: string, matchId: string): Promise<matchIpc.GetMatchByIdResponse>;
      getAnalytics(
        slotId: string,
        matchId: string,
      ): Promise<matchIpc.GetMatchAnalyticsResponse>;
      listRecentMatches(
        slotId: string,
        limit?: number,
      ): Promise<matchIpc.ListRecentMatchesResponse>;
    };
    schedule: {
      generate(req: {
        slotId: string;
        seasonYear: number;
        seed: number | string;
      }): Promise<scheduleIpc.GenerateScheduleResponse>;
      listForTeam(slotId: string, teamId: string): Promise<scheduleIpc.ListTeamScheduleResponse>;
    };
    season: {
      getCurrentWeek(slotId: string): Promise<seasonIpc.GetCurrentWeekResponse>;
      advanceWeek(req: { slotId: string; cancellationId?: string }): Promise<seasonIpc.AdvanceWeekResponse>;
      cancel(
        cancellationId: string,
      ): Promise<
        | { ok: true; cancelled: boolean }
        | { ok: false; error: { code: string; message: string } }
      >;
      onProgress(listener: (evt: seasonIpc.SeasonProgressEvent) => void): () => void;
      getUserTeam(slotId: string): Promise<seasonIpc.GetUserTeamResponse>;
      setUserTeam(slotId: string, teamId: string): Promise<seasonIpc.SetUserTeamResponse>;
    };
    poll: {
      latest(slotId: string): Promise<pollIpc.GetLatestPollResponse>;
    };
    bracket: {
      generate(req: {
        slotId: string;
        seasonYear: number;
        metric?: 'RPI' | 'NET';
      }): Promise<bracketIpc.GenerateBracketResponse>;
      latest(slotId: string, seasonYear: number): Promise<bracketIpc.GenerateBracketResponse>;
    };
    postseason: {
      startCt(slotId: string): Promise<postseasonIpc.StartCtResponse>;
      startNcaa(slotId: string, seasonYear: number): Promise<postseasonIpc.StartNcaaResponse>;
      advanceRound(
        slotId: string,
        round: postseasonIpc.TournamentRound,
      ): Promise<postseasonIpc.AdvanceRoundResponse>;
      getState(slotId: string): Promise<postseasonIpc.GetStateResponse>;
    };
    recruiting: {
      open(
        slotId: string,
        seasonYear: number,
        classSize?: number,
      ): Promise<recruitingIpc.OpenCycleResponse>;
      action(req: {
        slotId: string;
        teamId: string;
        recruitId: string;
        action: recruitingIpc.RecruitingActionType;
      }): Promise<recruitingIpc.ActionResponse>;
      advance(
        slotId: string,
        userTeamId: string | null,
      ): Promise<recruitingIpc.AdvanceResponse>;
      close(slotId: string): Promise<recruitingIpc.CloseResponse>;
      state(slotId: string, teamId: string): Promise<recruitingIpc.StateResponse>;
    };
    portal: {
      open(slotId: string): Promise<portalIpc.OpenResponse>;
      action(req: {
        slotId: string;
        teamId: string;
        transferPortalId: string;
        action: portalIpc.PortalActionType;
        nilAmountCents?: number;
      }): Promise<portalIpc.ActionResponse>;
      advance(slotId: string, userTeamId: string | null): Promise<portalIpc.AdvanceResponse>;
      close(slotId: string): Promise<portalIpc.CloseResponse>;
      state(slotId: string, teamId: string): Promise<portalIpc.StateResponse>;
    };
    nil: {
      state(slotId: string, teamId: string): Promise<nilIpc.StateResponse>;
      assign(req: {
        slotId: string;
        teamId: string;
        playerId: string;
        amountCents: number;
      }): Promise<nilIpc.AssignResponse>;
      revoke(req: {
        slotId: string;
        teamId: string;
        playerId: string;
      }): Promise<nilIpc.RevokeResponse>;
      autoDistribute(slotId: string, teamId: string): Promise<nilIpc.AutoDistributeResponse>;
    };
    offseason: {
      run(slotId: string): Promise<offseasonIpc.RunResponse>;
      toggleRedshirt(req: {
        slotId: string;
        teamId: string;
        playerId: string;
        redshirtUsed: boolean;
      }): Promise<offseasonIpc.ToggleRedshirtResponse>;
      preseasonState(
        slotId: string,
        teamId: string,
      ): Promise<offseasonIpc.PreseasonStateResponse>;
      startRegular(slotId: string): Promise<offseasonIpc.StartRegularResponse>;
    };
    coaching: {
      listStaff(slotId: string, teamId: string): Promise<coachingIpc.ListStaffResponse>;
      listPool(slotId: string): Promise<coachingIpc.ListPoolResponse>;
      hire(req: {
        slotId: string;
        teamId: string;
        poolId: string;
        role: 'HC' | 'AHC' | 'AC';
        contractYears: number;
        salaryCents: number;
      }): Promise<coachingIpc.HireResponse>;
      fire(req: {
        slotId: string;
        teamId: string;
        coachId: string;
      }): Promise<coachingIpc.FireResponse>;
    };
    awards: {
      listForSeason(
        slotId: string,
        seasonYear: number,
      ): Promise<awardsIpc.ListForSeasonResponse>;
      careerForPlayer(
        slotId: string,
        playerId: string,
      ): Promise<awardsIpc.CareerForPlayerResponse>;
    };
    scout: {
      report(
        slotId: string,
        opponentTeamId: string,
        throughDate?: string,
      ): Promise<scoutIpc.ScoutReportResponse>;
    };
    crash: {
      // Sprint 23: report a renderer-side error to the main-process crash log.
      report(payload: {
        name: string;
        message: string;
        stack: string | null;
        componentStack: string | null;
      }): Promise<{ ok: true } | { ok: false; error: { code: string; message: string } }>;
      // Toggle main-side recording (renderer Settings UI calls this on
      // checkbox change and at startup to sync the persisted preference).
      setEnabled(
        enabled: boolean,
      ): Promise<{ ok: true } | { ok: false; error: { code: string; message: string } }>;
    };
  }

  interface Window {
    vcd: VcdApiSurface;
  }
}

export {};
