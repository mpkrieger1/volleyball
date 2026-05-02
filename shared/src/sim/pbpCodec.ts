// Sprint 23: PBP encode/decode layer. Compresses Match.pbpJson with gzip
// (base64-wrapped so the column stays TEXT) on write; decodes both legacy
// `'json'` rows and new `'gzip-base64'` rows transparently.
//
// Rationale: PBP is ~100 MB/season uncompressed; the PRD save-file budget
// is <25 MB after 10 seasons. Gzip on PBP brings it under budget (typically
// ~5× compression on this JSON shape).
//
// Forward-compatibility contract:
//   - Reading an existing 'json' row: decode via JSON.parse + zod.
//   - Reading a new 'gzip-base64' row: gunzip the base64 payload, then
//     JSON.parse + zod.
//   - Reading a 'pruned' row: throw PbpUnavailableError. Box-score still
//     readable; replay is unavailable for that match.

import { gzipSync, gunzipSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import { MatchPbpSchema, type MatchPbp } from './pbp';

export const PBP_ENCODING_JSON = 'json';
export const PBP_ENCODING_GZIP_BASE64 = 'gzip-base64';
export const PBP_ENCODING_PRUNED = 'pruned';

export type PbpEncoding =
  | typeof PBP_ENCODING_JSON
  | typeof PBP_ENCODING_GZIP_BASE64
  | typeof PBP_ENCODING_PRUNED;

export class PbpUnavailableError extends Error {
  constructor(public readonly reason: 'pruned' = 'pruned') {
    super(`PBP unavailable for this match (reason: ${reason}).`);
    this.name = 'PbpUnavailableError';
  }
}

export type EncodedPbp = {
  /** Serialized payload to store in `Match.pbpJson`. */
  payload: string;
  /** Discriminator to store in `Match.pbpEncoding`. */
  encoding: typeof PBP_ENCODING_GZIP_BASE64;
};

/** Encode a parsed PBP for persistence. New rows always use gzip-base64. */
export function encodePbp(pbp: MatchPbp): EncodedPbp {
  // Validate before encoding so a corrupted PBP is caught here, not on read.
  MatchPbpSchema.parse(pbp);
  return encodePbpJsonString(JSON.stringify(pbp));
}

/**
 * Encode an already-serialized PBP JSON string. Used at the worker→main
 * boundary in `advanceWeek` where the worker has already produced the JSON
 * via `serializeMatchPbp`. Trusts the caller to have validated.
 */
export function encodePbpJsonString(json: string): EncodedPbp {
  const gz = gzipSync(Buffer.from(json, 'utf8'));
  return { payload: gz.toString('base64'), encoding: PBP_ENCODING_GZIP_BASE64 };
}

/**
 * Decode a stored PBP given its encoding tag. Handles all three:
 *   - 'json' (legacy rows from Sprints 1-22)
 *   - 'gzip-base64' (Sprint 23+)
 *   - 'pruned' (Sprint 23 retention utility output)
 */
export function decodePbp(payload: string, encoding: string): MatchPbp {
  if (encoding === PBP_ENCODING_PRUNED) {
    throw new PbpUnavailableError('pruned');
  }
  if (encoding === PBP_ENCODING_JSON) {
    return MatchPbpSchema.parse(JSON.parse(payload));
  }
  if (encoding === PBP_ENCODING_GZIP_BASE64) {
    const gz = Buffer.from(payload, 'base64');
    if (gz.length === 0 && payload.length > 0) {
      throw new Error('Invalid gzip-base64 payload (empty after decode)');
    }
    const json = gunzipSync(gz).toString('utf8');
    return MatchPbpSchema.parse(JSON.parse(json));
  }
  throw new Error(`Unknown PBP encoding: ${encoding}`);
}

/**
 * For callers that want to opportunistically decode using the stored
 * encoding column or fall back to JSON for legacy rows.
 */
export function decodePbpWithFallback(
  payload: string,
  encoding: string | null | undefined,
): MatchPbp {
  return decodePbp(payload, encoding ?? PBP_ENCODING_JSON);
}
