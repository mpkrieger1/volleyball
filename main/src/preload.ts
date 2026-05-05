import { contextBridge, ipcRenderer } from 'electron';
import {
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

const api = Object.freeze({
  version: '0.1.0' as const,
  saveSlots: {
    list: () => ipcRenderer.invoke(saveSlotIpc.IPC_CHANNELS.list),
    create: (name: string) => ipcRenderer.invoke(saveSlotIpc.IPC_CHANNELS.create, { name }),
    open: (id: string) => ipcRenderer.invoke(saveSlotIpc.IPC_CHANNELS.open, { id }),
    delete: (id: string) => ipcRenderer.invoke(saveSlotIpc.IPC_CHANNELS.delete, { id }),
  },
  match: {
    listTeams: (slotId: string) =>
      ipcRenderer.invoke(matchIpc.MATCH_IPC_CHANNELS.listTeams, { slotId }),
    simulate: (req: {
      slotId: string;
      homeTeamId: string;
      awayTeamId: string;
      seed: number | string;
    }) => ipcRenderer.invoke(matchIpc.MATCH_IPC_CHANNELS.simulate, req),
    getById: (slotId: string, matchId: string) =>
      ipcRenderer.invoke(matchIpc.MATCH_IPC_CHANNELS.getById, { slotId, matchId }),
    getAnalytics: (slotId: string, matchId: string) =>
      ipcRenderer.invoke(matchIpc.MATCH_IPC_CHANNELS.getAnalytics, { slotId, matchId }),
    listRecentMatches: (slotId: string, limit?: number) =>
      ipcRenderer.invoke(matchIpc.MATCH_IPC_CHANNELS.listRecentMatches, { slotId, limit }),
    seasonAnalytics: (slotId: string, teamId: string) =>
      ipcRenderer.invoke(matchIpc.MATCH_IPC_CHANNELS.seasonAnalytics, { slotId, teamId }),
    // Sprint 29 Task 29.4: live-mode match IPC.
    live: {
      createAndStart: (req: liveMatchIpc.LiveCreateAndStartRequest) =>
        ipcRenderer.invoke(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.createAndStart, req),
      start: (req: liveMatchIpc.LiveStartRequest) =>
        ipcRenderer.invoke(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.start, req),
      getState: (slotId: string, matchId: string) =>
        ipcRenderer.invoke(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.getState, { slotId, matchId }),
      playRallies: (slotId: string, matchId: string, n: number) =>
        ipcRenderer.invoke(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.playRallies, { slotId, matchId, n }),
      playToSetEnd: (slotId: string, matchId: string) =>
        ipcRenderer.invoke(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.playToSetEnd, { slotId, matchId }),
      playToMatchEnd: (slotId: string, matchId: string) =>
        ipcRenderer.invoke(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.playToMatchEnd, { slotId, matchId }),
      pause: (slotId: string, matchId: string) =>
        ipcRenderer.invoke(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.pause, { slotId, matchId }),
      resume: (slotId: string, matchId: string) =>
        ipcRenderer.invoke(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.resume, { slotId, matchId }),
      simulateRest: (slotId: string, matchId: string) =>
        ipcRenderer.invoke(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.simulateRest, { slotId, matchId }),
      dispose: (slotId: string, matchId: string) =>
        ipcRenderer.invoke(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.dispose, { slotId, matchId }),
      hasPaused: (slotId: string, matchId: string) =>
        ipcRenderer.invoke(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.hasPaused, { slotId, matchId }),
      hasActive: (slotId: string) =>
        ipcRenderer.invoke(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.hasActive, { slotId }),
      callTimeout: (slotId: string, matchId: string, skill?: liveMatchIpc.SkillKey) =>
        ipcRenderer.invoke(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.callTimeout, {
          slotId,
          matchId,
          ...(skill ? { skill } : {}),
        }),
      substitute: (slotId: string, matchId: string, outIdx: number, inPlayerId: string) =>
        ipcRenderer.invoke(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.substitute, {
          slotId, matchId, outIdx, inPlayerId,
        }),
      setRotation: (req: liveMatchIpc.LiveSetRotationRequest) =>
        ipcRenderer.invoke(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.setRotation, req),
      listPaused: (slotId: string) =>
        ipcRenderer.invoke(liveMatchIpc.LIVE_MATCH_IPC_CHANNELS.listPaused, { slotId }),
    },
  },
  schedule: {
    generate: (req: { slotId: string; seasonYear: number; seed: number | string }) =>
      ipcRenderer.invoke(scheduleIpc.SCHEDULE_IPC_CHANNELS.generate, req),
    listForTeam: (slotId: string, teamId: string) =>
      ipcRenderer.invoke(scheduleIpc.SCHEDULE_IPC_CHANNELS.listForTeam, { slotId, teamId }),
  },
  season: {
    getCurrentWeek: (slotId: string) =>
      ipcRenderer.invoke(seasonIpc.SEASON_IPC_CHANNELS.getCurrentWeek, { slotId }),
    advanceWeek: (req: { slotId: string; cancellationId?: string }) =>
      ipcRenderer.invoke(seasonIpc.SEASON_IPC_CHANNELS.advanceWeek, req),
    cancel: (cancellationId: string) =>
      ipcRenderer.invoke(seasonIpc.SEASON_IPC_CHANNELS.cancel, { cancellationId }),
    onProgress: (listener: (evt: seasonIpc.SeasonProgressEvent) => void) => {
      const wrapped = (_: unknown, evt: seasonIpc.SeasonProgressEvent) => listener(evt);
      ipcRenderer.on(seasonIpc.SEASON_IPC_CHANNELS.progress, wrapped);
      return () => ipcRenderer.removeListener(seasonIpc.SEASON_IPC_CHANNELS.progress, wrapped);
    },
    getUserTeam: (slotId: string) =>
      ipcRenderer.invoke(seasonIpc.SEASON_IPC_CHANNELS.getUserTeam, { slotId }),
    setUserTeam: (slotId: string, teamId: string) =>
      ipcRenderer.invoke(seasonIpc.SEASON_IPC_CHANNELS.setUserTeam, { slotId, teamId }),
  },
  poll: {
    latest: (slotId: string) =>
      ipcRenderer.invoke(pollIpc.POLL_IPC_CHANNELS.latest, { slotId }),
  },
  bracket: {
    generate: (req: { slotId: string; seasonYear: number; metric?: 'RPI' | 'NET' }) =>
      ipcRenderer.invoke(bracketIpc.BRACKET_IPC_CHANNELS.generate, {
        slotId: req.slotId,
        seasonYear: req.seasonYear,
        metric: req.metric ?? 'RPI',
      }),
    latest: (slotId: string, seasonYear: number) =>
      ipcRenderer.invoke(bracketIpc.BRACKET_IPC_CHANNELS.latest, { slotId, seasonYear }),
  },
  postseason: {
    startCt: (slotId: string) =>
      ipcRenderer.invoke(postseasonIpc.POSTSEASON_IPC_CHANNELS.startCt, { slotId }),
    startNcaa: (slotId: string, seasonYear: number) =>
      ipcRenderer.invoke(postseasonIpc.POSTSEASON_IPC_CHANNELS.startNcaa, { slotId, seasonYear }),
    advanceRound: (slotId: string, round: postseasonIpc.TournamentRound) =>
      ipcRenderer.invoke(postseasonIpc.POSTSEASON_IPC_CHANNELS.advanceRound, { slotId, round }),
    getState: (slotId: string) =>
      ipcRenderer.invoke(postseasonIpc.POSTSEASON_IPC_CHANNELS.getState, { slotId }),
  },
  recruiting: {
    open: (slotId: string, seasonYear: number, classSize?: number) =>
      ipcRenderer.invoke(recruitingIpc.RECRUITING_IPC_CHANNELS.open, {
        slotId,
        seasonYear,
        ...(classSize ? { classSize } : {}),
      }),
    action: (req: {
      slotId: string;
      teamId: string;
      recruitId: string;
      action: recruitingIpc.RecruitingActionType;
    }) => ipcRenderer.invoke(recruitingIpc.RECRUITING_IPC_CHANNELS.action, req),
    advance: (slotId: string, userTeamId: string | null) =>
      ipcRenderer.invoke(recruitingIpc.RECRUITING_IPC_CHANNELS.advance, {
        slotId,
        userTeamId,
      }),
    close: (slotId: string) =>
      ipcRenderer.invoke(recruitingIpc.RECRUITING_IPC_CHANNELS.close, { slotId }),
    state: (slotId: string, teamId: string) =>
      ipcRenderer.invoke(recruitingIpc.RECRUITING_IPC_CHANNELS.state, { slotId, teamId }),
    budget: (slotId: string, teamId: string) =>
      ipcRenderer.invoke(recruitingIpc.RECRUITING_IPC_CHANNELS.budget, { slotId, teamId }),
    teamNeeds: (slotId: string, teamId: string) =>
      ipcRenderer.invoke(recruitingIpc.RECRUITING_IPC_CHANNELS.teamNeeds, { slotId, teamId }),
    detail: (slotId: string, teamId: string, recruitId: string) =>
      ipcRenderer.invoke(recruitingIpc.RECRUITING_IPC_CHANNELS.detail, {
        slotId,
        teamId,
        recruitId,
      }),
    // Sprint 36 Task 36.4 (wired Sprint 37 Task 37.4): NIL slider confirm.
    setNilOffer: (req: {
      slotId: string;
      teamId: string;
      recruitId: string;
      offerCents: number;
    }) =>
      ipcRenderer.invoke(recruitingIpc.RECRUITING_IPC_CHANNELS.setNilOffer, req),
  },
  portal: {
    open: (slotId: string) =>
      ipcRenderer.invoke(portalIpc.PORTAL_IPC_CHANNELS.open, { slotId }),
    action: (req: {
      slotId: string;
      teamId: string;
      transferPortalId: string;
      action: portalIpc.PortalActionType;
      nilAmountCents?: number;
    }) => ipcRenderer.invoke(portalIpc.PORTAL_IPC_CHANNELS.action, req),
    advance: (slotId: string, userTeamId: string | null) =>
      ipcRenderer.invoke(portalIpc.PORTAL_IPC_CHANNELS.advance, { slotId, userTeamId }),
    close: (slotId: string) =>
      ipcRenderer.invoke(portalIpc.PORTAL_IPC_CHANNELS.close, { slotId }),
    state: (slotId: string, teamId: string) =>
      ipcRenderer.invoke(portalIpc.PORTAL_IPC_CHANNELS.state, { slotId, teamId }),
  },
  nil: {
    state: (slotId: string, teamId: string) =>
      ipcRenderer.invoke(nilIpc.NIL_IPC_CHANNELS.state, { slotId, teamId }),
    assign: (req: { slotId: string; teamId: string; playerId: string; amountCents: number }) =>
      ipcRenderer.invoke(nilIpc.NIL_IPC_CHANNELS.assign, req),
    revoke: (req: { slotId: string; teamId: string; playerId: string }) =>
      ipcRenderer.invoke(nilIpc.NIL_IPC_CHANNELS.revoke, req),
    autoDistribute: (slotId: string, teamId: string) =>
      ipcRenderer.invoke(nilIpc.NIL_IPC_CHANNELS.autoDistribute, { slotId, teamId }),
  },
  offseason: {
    run: (slotId: string) =>
      ipcRenderer.invoke(offseasonIpc.OFFSEASON_IPC_CHANNELS.run, { slotId }),
    toggleRedshirt: (req: {
      slotId: string;
      teamId: string;
      playerId: string;
      redshirtUsed: boolean;
    }) => ipcRenderer.invoke(offseasonIpc.OFFSEASON_IPC_CHANNELS.toggleRedshirt, req),
    preseasonState: (slotId: string, teamId: string) =>
      ipcRenderer.invoke(offseasonIpc.OFFSEASON_IPC_CHANNELS.preseasonState, { slotId, teamId }),
    startRegular: (slotId: string) =>
      ipcRenderer.invoke(offseasonIpc.OFFSEASON_IPC_CHANNELS.startRegular, { slotId }),
    advanceEvent: (req: { slotId: string; teamId?: string | null }) =>
      ipcRenderer.invoke(offseasonIpc.OFFSEASON_IPC_CHANNELS.advanceEvent, req),
    getEventState: (slotId: string, teamId: string) =>
      ipcRenderer.invoke(offseasonIpc.OFFSEASON_IPC_CHANNELS.getEventState, { slotId, teamId }),
    setTrainingFocusPick: (req: {
      slotId: string;
      teamId: string;
      coachId: string;
      slotIndex: number;
      attribute: string;
    }) =>
      ipcRenderer.invoke(offseasonIpc.OFFSEASON_IPC_CHANNELS.setTrainingFocusPick, req),
    listTrainingResults: (req: { slotId: string; teamId: string; seasonYear: number }) =>
      ipcRenderer.invoke(offseasonIpc.OFFSEASON_IPC_CHANNELS.listTrainingResults, req),
  },
  practiceFocus: {
    getWeekState: (req: { slotId: string; teamId: string; week: number }) =>
      ipcRenderer.invoke(practiceFocusIpc.PRACTICE_FOCUS_IPC_CHANNELS.getWeekState, req),
    setPick: (req: {
      slotId: string;
      teamId: string;
      week: number;
      offenseFocus: string;
      defenseFocus: string;
    }) => ipcRenderer.invoke(practiceFocusIpc.PRACTICE_FOCUS_IPC_CHANNELS.setPick, req),
  },
  coaching: {
    listStaff: (slotId: string, teamId: string) =>
      ipcRenderer.invoke(coachingIpc.COACHING_IPC_CHANNELS.listStaff, { slotId, teamId }),
    listPool: (slotId: string) =>
      ipcRenderer.invoke(coachingIpc.COACHING_IPC_CHANNELS.listPool, { slotId }),
    hire: (req: {
      slotId: string;
      teamId: string;
      poolId: string;
      role: 'HC' | 'AHC' | 'AC';
      contractYears: number;
      salaryCents: number;
    }) => ipcRenderer.invoke(coachingIpc.COACHING_IPC_CHANNELS.hire, req),
    fire: (req: { slotId: string; teamId: string; coachId: string }) =>
      ipcRenderer.invoke(coachingIpc.COACHING_IPC_CHANNELS.fire, req),
  },
  awards: {
    listForSeason: (slotId: string, seasonYear: number) =>
      ipcRenderer.invoke(awardsIpc.AWARDS_IPC_CHANNELS.listForSeason, { slotId, seasonYear }),
    careerForPlayer: (slotId: string, playerId: string) =>
      ipcRenderer.invoke(awardsIpc.AWARDS_IPC_CHANNELS.careerForPlayer, { slotId, playerId }),
  },
  scout: {
    report: (slotId: string, opponentTeamId: string, throughDate?: string) =>
      ipcRenderer.invoke(scoutIpc.SCOUT_IPC_CHANNELS.scoutReport, {
        slotId,
        opponentTeamId,
        throughDate,
      }),
  },
  standings: {
    getOverview: (slotId: string) =>
      ipcRenderer.invoke(standingsIpc.STANDINGS_IPC_CHANNELS.getOverview, { slotId }),
  },
  roster: {
    listForTeam: (slotId: string, teamId: string) =>
      ipcRenderer.invoke(rosterIpc.ROSTER_IPC_CHANNELS.listForTeam, { slotId, teamId }),
    getProfile: (slotId: string, playerId: string) =>
      ipcRenderer.invoke(rosterIpc.ROSTER_IPC_CHANNELS.getProfile, { slotId, playerId }),
  },
  crash: {
    report: (payload: {
      name: string;
      message: string;
      stack: string | null;
      componentStack: string | null;
    }) => ipcRenderer.invoke('crash:report', payload),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke('crash:setEnabled', { enabled }),
  },
  update: {
    checkNow: () => ipcRenderer.invoke('update:checkNow'),
  },
});

export type VcdApi = typeof api;

contextBridge.exposeInMainWorld('vcd', api);
