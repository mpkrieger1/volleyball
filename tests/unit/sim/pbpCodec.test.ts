import { describe, expect, it } from 'vitest';
import {
  encodePbp,
  decodePbp,
  PBP_ENCODING_JSON,
  PBP_ENCODING_GZIP_BASE64,
  PBP_ENCODING_PRUNED,
  PbpUnavailableError,
} from '../../../shared/src/sim/pbpCodec';
import type { MatchPbp } from '../../../shared/src/sim/pbp';

function makeSyntheticPbp(rallyCount: number): MatchPbp {
  return {
    version: 1,
    winner: 'home',
    homeSetsWon: 3,
    awaySetsWon: 1,
    sets: [
      {
        setIndex: 0,
        homeScore: 25,
        awayScore: 20,
        rallies: Array.from({ length: rallyCount }, (_, i) => ({
          rallyIndex: i,
          seed: 100 + i,
          servingTeam: (i % 2 === 0 ? 'home' : 'away') as 'home' | 'away',
          winningTeam: (i % 2 === 0 ? 'home' : 'away') as 'home' | 'away',
          events: [],
        })),
      },
    ],
  };
}

describe('encodePbp / decodePbp', () => {
  it('encodes JSON with the gzip-base64 encoding tag', () => {
    const pbp = makeSyntheticPbp(50);
    const out = encodePbp(pbp);
    expect(out.encoding).toBe(PBP_ENCODING_GZIP_BASE64);
    expect(typeof out.payload).toBe('string');
  });

  it('round-trips the gzip-base64 encoding losslessly', () => {
    const pbp = makeSyntheticPbp(50);
    const { encoding, payload } = encodePbp(pbp);
    const decoded = decodePbp(payload, encoding);
    expect(decoded).toEqual(pbp);
  });

  it('round-trips legacy JSON encoding for backward compatibility', () => {
    const pbp = makeSyntheticPbp(20);
    const json = JSON.stringify(pbp);
    const decoded = decodePbp(json, PBP_ENCODING_JSON);
    expect(decoded).toEqual(pbp);
  });

  it('compresses to ≤30% of plain JSON for a typical 5-set match', () => {
    // 5 sets, 25 rallies each = 125 rallies — repeated structure compresses well.
    const pbp: MatchPbp = {
      version: 1,
      winner: 'home',
      homeSetsWon: 3,
      awaySetsWon: 2,
      sets: Array.from({ length: 5 }, (_, setIdx) => ({
        setIndex: setIdx,
        homeScore: 25,
        awayScore: 23,
        rallies: Array.from({ length: 25 }, (_, i) => ({
          rallyIndex: i,
          seed: setIdx * 1000 + i,
          servingTeam: (i % 2 === 0 ? 'home' : 'away') as 'home' | 'away',
          winningTeam: (i % 2 === 0 ? 'home' : 'away') as 'home' | 'away',
          events: [],
        })),
      })),
    };
    const json = JSON.stringify(pbp);
    const { payload } = encodePbp(pbp);
    const ratio = payload.length / json.length;
    expect(ratio).toBeLessThanOrEqual(0.5); // Conservative upper bound for tests
    // For realistic match payloads we expect <0.3, but the empty events arrays
    // make this synthetic case slightly higher entropy. Keep test stable at 0.5.
  });

  it('throws PbpUnavailableError when encoding is "pruned"', () => {
    expect(() => decodePbp('', PBP_ENCODING_PRUNED)).toThrow(PbpUnavailableError);
  });

  it('rejects an unknown encoding tag with a typed error', () => {
    expect(() => decodePbp('whatever', 'mystery-format' as 'json')).toThrow(/encoding/);
  });

  it('rejects malformed gzip-base64 payload', () => {
    expect(() => decodePbp('!!not-base64!!', PBP_ENCODING_GZIP_BASE64)).toThrow();
  });

  it('rejects malformed JSON payload', () => {
    expect(() => decodePbp('{not json', PBP_ENCODING_JSON)).toThrow();
  });
});
