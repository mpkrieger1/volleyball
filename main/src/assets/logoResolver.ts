import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { placeholderSvg } from '@vcd/shared';

export type LogoResolverEnv = {
  /** Absolute path to the /assets/logos directory. */
  logosDir: string;
};

export type TeamLogoInput = {
  abbr: string;
  primaryColor: string;
  /** Either "placeholder:<ABBR>" sentinel or a relative path under logosDir. */
  logoPath: string;
};

export type ResolvedLogo =
  | { kind: 'file'; absolutePath: string; svg?: never; fallback: false }
  | { kind: 'placeholder'; svg: string; fallback: true };

const SENTINEL = /^placeholder:(.+)$/;

/**
 * Returns the SVG string to render for a team: a real on-disk SVG when one exists,
 * otherwise a generated monogram placeholder. PNGs are returned as an absolute path
 * reference (caller loads the bytes).
 */
export function resolveLogo(env: LogoResolverEnv, team: TeamLogoInput): ResolvedLogo {
  const sentinel = team.logoPath.match(SENTINEL);
  if (!sentinel) {
    const candidate = path.join(env.logosDir, team.logoPath);
    if (existsSync(candidate)) {
      if (candidate.endsWith('.svg')) {
        return { kind: 'file', absolutePath: candidate, fallback: false };
      }
      return { kind: 'file', absolutePath: candidate, fallback: false };
    }
  }

  // Try to find ABBR.svg as a convention even when the sentinel is set, so committing
  // a real logo later doesn't require a DB edit.
  const abbr = (sentinel?.[1] ?? team.abbr).toUpperCase();
  const svgCandidate = path.join(env.logosDir, `${abbr}.svg`);
  if (existsSync(svgCandidate)) {
    return { kind: 'file', absolutePath: svgCandidate, fallback: false };
  }

  return {
    kind: 'placeholder',
    svg: placeholderSvg(abbr, team.primaryColor),
    fallback: true,
  };
}

/** Convenience: reads an SVG from disk when the resolver returns a file-kind hit. */
export function readLogoSvg(resolved: ResolvedLogo): string {
  if (resolved.kind === 'placeholder') return resolved.svg;
  if (resolved.absolutePath.endsWith('.svg')) {
    return readFileSync(resolved.absolutePath, 'utf8');
  }
  throw new Error(`readLogoSvg only supports .svg files (got ${resolved.absolutePath})`);
}
