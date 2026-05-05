import type {
  saveSlotIpc,
  matchIpc,
  liveMatchIpc,
  scheduleIpc,
  seasonIpc,
  pollIpc,
  bracketIpc,
  postseasonIpc,
  recruitingIpc,
  portalIpc,
  nilIpc,
  offseasonIpc,
  practiceFocusIpc,
  coachingIpc,
  awardsIpc,
  scoutIpc,
  standingsIpc,
  rosterIpc,
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
      seasonAnalytics(
        slotId: string,
        teamId: string,
      ): Promise<matchIpc.SeasonAnalyticsResponse>;
      // Sprint 29 Task 29.4: live-mode match interface.
      live: {
        createAndStart(req: liveMatchIpc.LiveCreateAndStartRequest): Promise<liveMatchIpc.LiveCreateAndStartResponse>;
        start(req: liveMatchIpc.LiveStartRequest): Promise<liveMatchIpc.LiveStateResponse>;
        getState(slotId: string, matchId: string): Promise<liveMatchIpc.LiveStateResponse>;
        playRallies(slotId: string, matchId: string, n: number): Promise<liveMatchIpc.LivePlayResponse>;
        playToSetEnd(slotId: string, matchId: string): Promise<liveMatchIpc.LivePlayResponse>;
        playToMatchEnd(slotId: string, matchId: string): Promise<liveMatchIpc.LivePlayResponse>;
        pause(slotId: string, matchId: string): Promise<liveMatchIpc.LivePauseResponse>;
        resume(slotId: string, matchId: string): Promise<liveMatchIpc.LiveStateResponse>;
        simulateRest(slotId: string, matchId: string): Promise<liveMatchIpc.LivePauseResponse>;
        dispose(slotId: string, matchId: string): Promise<liveMatchIpc.LivePauseResponse>;
        hasPaused(slotId: string, matchId: string): Promise<liveMatchIpc.LiveHasPausedResponse>;
        hasActive(slotId: string): Promise<liveMatchIpc.LiveHasActiveResponse>;
        callTimeout(slotId: string, matchId: string, skill?: liveMatchIpc.SkillKey): Promise<liveMatchIpc.LiveStateResponse>;
        substitute(slotId: string, matchId: string, outIdx: number, inPlayerId: string): Promise<liveMatchIpc.LiveStateResponse>;
        setRotation(req: liveMatchIpc.LiveSetRotationRequest): Promise<liveMatchIpc.LiveStateResponse>;
        listPaused(slotId: string): Promise<liveMatchIpc.LiveListPausedResponse>;
      };
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
      budget(slotId: string, teamId: string): Promise<recruitingIpc.BudgetResponse>;
      teamNeeds(slotId: string, teamId: string): Promise<recruitingIpc.TeamNeedsResponse>;
      detail(
        slotId: string,
        teamId: string,
        recruitId: string,
      ): Promise<recruitingIpc.DetailResponse>;
      setNilOffer(req: {
        slotId: string;
        teamId: string;
        recruitId: string;
        offerCents: number;
      }): Promise<recruitingIpc.SetNilOfferResponse>;
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
      // Sprint 33 — event-aware offseason calendar.
      advanceEvent(req: {
        slotId: string;
        teamId?: string | null;
      }): Promise<offseasonIpc.AdvanceEventResponse>;
      getEventState(
        slotId: string,
        teamId: string,
      ): Promise<offseasonIpc.EventStateResponse>;
      setTrainingFocusPick(req: {
        slotId: string;
        teamId: string;
        coachId: string;
        slotIndex: number;
        attribute: string;
      }): Promise<offseasonIpc.SetTrainingFocusPickResponse>;
      listTrainingResults(req: {
        slotId: string;
        teamId: string;
        seasonYear: number;
      }): Promise<offseasonIpc.ListTrainingResultsResponse>;
    };
    practiceFocus: {
      // Sprint 34 — weekly practice-focus picks.
      getWeekState(req: {
        slotId: string;
        teamId: string;
        week: number;
      }): Promise<practiceFocusIpc.GetWeekStateResponse>;
      setPick(req: {
        slotId: string;
        teamId: string;
        week: number;
        offenseFocus: string;
        defenseFocus: string;
      }): Promise<practiceFocusIpc.SetPickResponse>;
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
    standings: {
      getOverview(slotId: string): Promise<standingsIpc.StandingsOverviewResponse>;
    };
    roster: {
      listForTeam(slotId: string, teamId: string): Promise<rosterIpc.ListRosterResponse>;
      getProfile(slotId: string, playerId: string): Promise<rosterIpc.GetPlayerProfileResponse>;
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
    update: {
      // Sprint 24: manual "Check for updates" button in Settings.
      checkNow():
        | Promise<{ ok: true; status: 'checked' | 'dev-only' }>
        | Promise<{ ok: false; status: 'error'; message: string }>;
    };
  }

  interface Window {
    vcd: VcdApiSurface;
  }
}

export {};
