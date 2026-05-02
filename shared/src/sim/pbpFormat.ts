// Sprint 19: format a RallyEvent as a human-readable ticker line.
//
// Inputs: the event + slot→player-name maps for both teams + team display
// names (e.g., "Nebraska", "Wisconsin"). Returns a short string suitable
// for the live ticker.
//
// Note: rotation moves players between slots within a set. Sprint 19 uses
// the STARTING-lineup mapping (deterministic via `pickStartersForTeam`),
// so the player name is correct at rally start but may be cosmetically
// off after rotation. Documented in CLAUDE.md "From Sprint 19".

import type { RallyEvent } from './rallyEvents';

export type FormatLineup = {
  /** Display names by slot index 0..5 for each side. */
  home: readonly string[];
  away: readonly string[];
  homeTeamName: string;
  awayTeamName: string;
};

export function formatRallyEvent(event: RallyEvent, lineup: FormatLineup): string {
  switch (event.kind) {
    case 'serve': {
      const name = playerName(event.team, event.server, lineup);
      const team = teamLabel(event.team, lineup);
      if (event.quality === 'ace') return `${name} (${team}) serves an ACE`;
      if (event.quality === 'error') return `${name} (${team}) service error`;
      return `${name} (${team}) serves`;
    }
    case 'reception': {
      const name = playerName(event.team, event.receiver, lineup);
      if (event.grade === 0) return `${name} reception error`;
      if (event.grade === 3) return `${name} perfect pass`;
      return `${name} pass`;
    }
    case 'set': {
      const name = playerName(event.team, event.setter, lineup);
      if (event.quality === 'bad') return `${name} bad set`;
      if (event.quality === 'perfect') return `${name} perfect set`;
      return `${name} sets`;
    }
    case 'attack': {
      const name = playerName(event.team, event.attacker, lineup);
      const team = teamLabel(event.team, lineup);
      if (event.outcome === 'kill') return `${name} (${team}) — KILL`;
      if (event.outcome === 'error') return `${name} (${team}) attack error`;
      if (event.outcome === 'blocked') return `${name} (${team}) attack blocked`;
      return `${name} (${team}) attack dug`;
    }
    case 'dig': {
      const name = playerName(event.team, event.digger, lineup);
      if (event.grade === 0) return `${name} ball off court`;
      return `${name} digs`;
    }
    case 'point': {
      const winner = teamLabel(event.winner, lineup);
      const reason = pointReasonLabel(event.reason);
      return `Point — ${winner} (${reason})`;
    }
  }
}

function playerName(team: 'home' | 'away', slot: number, lineup: FormatLineup): string {
  const arr = team === 'home' ? lineup.home : lineup.away;
  return arr[slot] ?? `#${slot}`;
}

function teamLabel(team: 'home' | 'away', lineup: FormatLineup): string {
  return team === 'home' ? lineup.homeTeamName : lineup.awayTeamName;
}

function pointReasonLabel(reason: string): string {
  switch (reason) {
    case 'kill': return 'kill';
    case 'attack_error': return 'attack error';
    case 'block': return 'block';
    case 'service_ace': return 'ace';
    case 'service_error': return 'service error';
    case 'contact_cap': return 'rally limit';
    case 'rotation_violation': return 'rotation violation';
    default: return reason;
  }
}
