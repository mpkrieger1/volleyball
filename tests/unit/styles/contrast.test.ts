import { describe, expect, it } from 'vitest';
import { wcagContrast, roundContrast, parseHex } from '../../../app/src/styles/contrast';

// Sprint 21: WCAG 2.1 AA design-token contrast assertions.
// Pull-from-source: these MUST stay in sync with `:root` declarations in
// `app/src/styles.css`. If a token changes there, update here too.
const TOKENS = {
  bg: '#0b0d10',
  fg: '#e6e8eb',
  muted: '#9aa3ad',
  accent: '#ff6b2c',
  accentFg: '#1a0a00',
};

describe('parseHex', () => {
  it('parses 6-digit hex', () => {
    expect(parseHex('#ff6b2c')).toEqual({ r: 255, g: 107, b: 44 });
  });
  it('expands 3-digit hex', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });
  it('throws on invalid', () => {
    expect(() => parseHex('not-a-color')).toThrow();
  });
});

describe('WCAG AA contrast — design tokens', () => {
  it('fg on bg passes AA normal text (>= 4.5:1)', () => {
    expect(wcagContrast(TOKENS.fg, TOKENS.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('muted on bg passes AA normal text (>= 4.5:1)', () => {
    expect(wcagContrast(TOKENS.muted, TOKENS.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('accent on bg passes AA UI/large-text (>= 3:1)', () => {
    // Accent (orange) is used for focus rings and headings; UI bar is 3:1.
    expect(wcagContrast(TOKENS.accent, TOKENS.bg)).toBeGreaterThanOrEqual(3);
  });

  it('accentFg on accent passes AA normal text (>= 4.5:1)', () => {
    // Sprint 21: dark text on orange backgrounds (the original Sprint 20
    // audit found light fg on accent failed at 3.8:1).
    const ratio = wcagContrast(TOKENS.accentFg, TOKENS.accent);
    expect(roundContrast(ratio)).toBeGreaterThanOrEqual(4.5);
  });

  it('all token-on-bg pairs are AT LEAST 3:1 (UI minimum)', () => {
    for (const [name, color] of Object.entries(TOKENS)) {
      if (name === 'bg' || name === 'accentFg') continue;
      const ratio = wcagContrast(color, TOKENS.bg);
      expect(ratio, `${name} on bg`).toBeGreaterThanOrEqual(3);
    }
  });
});
