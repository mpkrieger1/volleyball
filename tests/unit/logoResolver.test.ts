import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveLogo, readLogoSvg } from '../../main/src/assets/logoResolver';

let logosDir: string;

beforeAll(() => {
  logosDir = mkdtempSync(join(tmpdir(), 'vcd-logos-'));
  writeFileSync(join(logosDir, 'WIS.svg'), '<svg>real wisconsin</svg>');
});

afterAll(() => {
  rmSync(logosDir, { recursive: true, force: true });
});

const env = () => ({ logosDir });

describe('resolveLogo', () => {
  it('returns the on-disk SVG when present', () => {
    const res = resolveLogo(env(), {
      abbr: 'WIS',
      primaryColor: '#C5050C',
      logoPath: 'placeholder:WIS',
    });
    expect(res.kind).toBe('file');
    expect(res.fallback).toBe(false);
    expect(readLogoSvg(res)).toContain('real wisconsin');
  });

  it('falls back to a generated placeholder when no file exists', () => {
    const res = resolveLogo(env(), {
      abbr: 'NEB',
      primaryColor: '#D00000',
      logoPath: 'placeholder:NEB',
    });
    expect(res.kind).toBe('placeholder');
    expect(res.fallback).toBe(true);
    expect(readLogoSvg(res)).toContain('>NEB<');
  });

  it('treats logoPath without the sentinel as a direct relative path attempt', () => {
    // nonexistent direct path should still fall through to placeholder
    const res = resolveLogo(env(), {
      abbr: 'XYZ',
      primaryColor: '#123456',
      logoPath: 'does-not-exist.svg',
    });
    expect(res.kind).toBe('placeholder');
  });
});
