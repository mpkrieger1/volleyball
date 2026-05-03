// Sprint 27 Task 27.5: Standings IPC handler.
//
// Returns conference standings, RPI top-25 (if RPISnapshot rows exist),
// and per-category stat leaders in one round-trip.

import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { standings, standingsIpc } from '@vcd/shared';
import { findSlotDbPathById, type SaveSlotServiceDeps } from '../saveSlots/service';

const STAT_CATEGORIES: Array<{
  key: standingsIpc.StatCategory;
  field: 'kills' | 'assists' | 'digs' | 'serviceAces';
  /** For 'blocks', we sum blockSolos + blockAssists in code rather than via Prisma SUM. */
  composite?: 'blocks';
}> = [
  { key: 'kills', field: 'kills' },
  { key: 'assists', field: 'assists' },
  { key: 'digs', field: 'digs' },
  { key: 'aces', field: 'serviceAces' },
];

const TOP_N_LEADERS = 20;

export function registerStandingsHandlers(deps: SaveSlotServiceDeps): void {
  ipcMain.handle(standingsIpc.STANDINGS_IPC_CHANNELS.getOverview, async (_e, raw: unknown) => {
    try {
      const req = standingsIpc.GetStandingsOverviewRequest.parse(raw);
      const dbPath = await findSlotDbPathById(deps, req.slotId);
      if (!dbPath) {
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: `slot ${req.slotId} not found` },
        };
      }
      const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        // ─── Conference standings ───
        const [teams, conferences, playedMatches] = await Promise.all([
          client.team.findMany({
            select: { id: true, schoolName: true, abbr: true, conferenceId: true },
          }),
          client.conference.findMany({ select: { id: true, name: true, abbr: true } }),
          client.match.findMany({
            where: { winnerId: { not: null }, isTournament: false },
            select: {
              homeTeamId: true,
              awayTeamId: true,
              winnerId: true,
              isConference: true,
            },
          }),
        ]);
        const teamById = new Map(teams.map((t) => [t.id, t]));
        const confById = new Map(conferences.map((c) => [c.id, c]));
        const standingsByConf = standings.computeConferenceStandings(
          playedMatches.map((m) => ({
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            winnerId: m.winnerId!,
            isConference: m.isConference,
          })),
          teams.map((t) => ({ id: t.id, conferenceId: t.conferenceId })),
        );
        const conferenceStandings: standingsIpc.ConferenceStandingRow[] = [];
        for (const [confId, rows] of standingsByConf) {
          const conf = confById.get(confId);
          for (const r of rows) {
            const team = teamById.get(r.teamId);
            if (!conf || !team) continue;
            conferenceStandings.push({
              conferenceId: confId,
              conferenceName: conf.name,
              conferenceAbbr: conf.abbr,
              teamId: r.teamId,
              teamSchool: team.schoolName,
              teamAbbr: team.abbr,
              rank: r.rank,
              confWins: r.confWins,
              confLosses: r.confLosses,
              overallWins: r.overallWins,
              overallLosses: r.overallLosses,
            });
          }
        }

        // ─── RPI top 25 (if any snapshot exists) ───
        const latestRpiWeekRow = await client.rPISnapshot.findFirst({
          orderBy: { week: 'desc' },
          select: { week: true },
        });
        let rpiTop25: standingsIpc.RpiTop25Row[] = [];
        if (latestRpiWeekRow) {
          const snapshots = await client.rPISnapshot.findMany({
            where: { week: latestRpiWeekRow.week },
            orderBy: { rpi: 'desc' },
            take: 25,
          });
          rpiTop25 = snapshots.map((s, idx) => {
            const team = teamById.get(s.teamId);
            return {
              rank: idx + 1,
              teamId: s.teamId,
              teamSchool: team?.schoolName ?? '?',
              teamAbbr: team?.abbr ?? '?',
              rpiMilli: s.rpi,
              wins: s.wins,
              losses: s.losses,
            };
          });
        }

        // ─── Stat leaders ───
        // For each category, group PMS rows by playerId, sum the field +
        // setsPlayed (proxy: count of distinct matchIds × 4 sets — conservative
        // approximation. We store rotationMinutes per match so a match the
        // player appeared in counts as ~1 match; v1.0 uses match-count as the
        // setsPlayed denominator approximation).
        // Actual sets played per player isn't stored; PMS aggregates per-match.
        // Use match count × 3 as a reasonable proxy for v1.0.
        const allPms = await client.playerMatchStat.findMany({
          select: {
            playerId: true,
            kills: true,
            assists: true,
            digs: true,
            serviceAces: true,
            blockSolos: true,
            blockAssists: true,
          },
        });
        const players = await client.player.findMany({
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            teamId: true,
          },
        });
        const playerById = new Map(players.map((p) => [p.id, p]));

        type Aggregated = {
          playerId: string;
          kills: number;
          assists: number;
          digs: number;
          aces: number;
          blocks: number;
          matches: number;
        };
        const aggMap = new Map<string, Aggregated>();
        for (const r of allPms) {
          const cur = aggMap.get(r.playerId) ?? {
            playerId: r.playerId,
            kills: 0,
            assists: 0,
            digs: 0,
            aces: 0,
            blocks: 0,
            matches: 0,
          };
          cur.kills += r.kills;
          cur.assists += r.assists;
          cur.digs += r.digs;
          cur.aces += r.serviceAces;
          cur.blocks += r.blockSolos + r.blockAssists;
          cur.matches += 1;
          aggMap.set(r.playerId, cur);
        }
        const allAggregates = [...aggMap.values()];

        const buildLeaders = (
          field: 'kills' | 'assists' | 'digs' | 'aces' | 'blocks',
        ): standingsIpc.StatLeaderRow[] => {
          const sorted = allAggregates
            .slice()
            .sort((a, b) => b[field] - a[field] || a.playerId.localeCompare(b.playerId))
            .slice(0, TOP_N_LEADERS);
          return sorted.map((agg, idx) => {
            const player = playerById.get(agg.playerId);
            const team = player ? teamById.get(player.teamId) : null;
            // Use matches × 3 as a sets-played proxy (real per-match set
            // count varies 3–5; 3 is conservative).
            const setsApprox = Math.max(1, agg.matches * 3);
            const value = agg[field];
            return {
              rank: idx + 1,
              playerId: agg.playerId,
              playerName: player ? `${player.firstName} ${player.lastName}` : '?',
              teamAbbr: team?.abbr ?? '?',
              position: player?.position ?? '?',
              value,
              perSetMilli: Math.round((value / setsApprox) * 1000),
              setsPlayed: setsApprox,
            };
          });
        };

        const statLeaders: Record<standingsIpc.StatCategory, standingsIpc.StatLeaderRow[]> = {
          kills: buildLeaders('kills'),
          assists: buildLeaders('assists'),
          digs: buildLeaders('digs'),
          aces: buildLeaders('aces'),
          blocks: buildLeaders('blocks'),
        };

        return {
          ok: true as const,
          conferenceStandings,
          rpiTop25,
          statLeaders,
        };
      } finally {
        await client.$disconnect();
      }
    } catch (err) {
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: (err as Error).message },
      };
    }
  });
}

// Reference STAT_CATEGORIES so it's not flagged unused (kept exported for
// future extension; the inline `buildLeaders` calls cover v1.0 scope).
export const STAT_CATEGORIES_FOR_REF = STAT_CATEGORIES;
