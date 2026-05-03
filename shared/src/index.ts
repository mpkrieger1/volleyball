export { createRng, hashSeed, type Rng } from './rng';
export * as ipc from './ipc/workerMessages';
export * as saveSlotIpc from './ipc/saveSlotMessages';
export * as simIpc from './ipc/simMessages';
export * as matchIpc from './ipc/matchMessages';
export { getPrismaClient, disposePrismaClients } from './db/client';
// NOTE: `seedLeagueInto`, `loadConferencesFrom`, `loadTeamsFrom` live in
// `./seed/leagueSeed` and depend on `node:fs` / `node:path`. They MUST NOT
// be re-exported from this top-level barrel — Vite reads `shared/src/index.ts`
// for the renderer bundle and cannot resolve Node-only modules in the
// browser sandbox (Electron renderer). Consumers in main / prisma scripts
// import directly from `@vcd/shared/seed` (see `shared/package.json` exports
// + `app/vite.config.ts` aliases).
export { TEAM_REGION_OVERRIDES, type TeamRegion } from './seed/teamRegions';
export { TeamSchema, ConferenceSchema, type TeamInput, type ConferenceInput } from './domain/team';
export { placeholderSvg, placeholderDataUri } from './assets/placeholderSvg';
export * as sim from './sim';
export * as schedule from './schedule';
export * as poll from './poll';
export * as scheduleIpc from './ipc/scheduleMessages';
export * as seasonIpc from './ipc/seasonMessages';
export * as pollIpc from './ipc/pollMessages';
export * as bracket from './bracket';
export * as bracketIpc from './ipc/bracketMessages';
export * as standings from './standings';
export * as standingsIpc from './ipc/standingsMessages';
export * as tournament from './tournament';
export * as postseasonIpc from './ipc/postseasonMessages';
export * as recruiting from './recruiting';
export * as recruitingIpc from './ipc/recruitingMessages';
export * as roster from './roster';
export * as portal from './portal';
export * as portalIpc from './ipc/portalMessages';
export * as nil from './nil';
export * as nilIpc from './ipc/nilMessages';
export * as offseason from './offseason';
export * as offseasonIpc from './ipc/offseasonMessages';
export * as coaching from './coaching';
export * as coachingIpc from './ipc/coachingMessages';
export * as awards from './awards';
export * as awardsIpc from './ipc/awardsMessages';
export * as scoutIpc from './ipc/scoutMessages';
export * as analytics from './analytics';
export * as calibration from './calibration';
export * as perf from './perf';
export * as crash from './crash';
