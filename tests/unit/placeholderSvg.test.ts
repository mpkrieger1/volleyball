import { describe, expect, it } from 'vitest';
import { placeholderSvg, placeholderDataUri } from '@vcd/shared';

describe('placeholderSvg', () => {
  it('produces a deterministic SVG for a given abbr + color', () => {
    const a = placeholderSvg('WIS', '#C5050C');
    const b = placeholderSvg('WIS', '#C5050C');
    expect(a).toBe(b);
  });

  it('includes the uppercased abbreviation and the fill color', () => {
    const svg = placeholderSvg('neb', '#D00000');
    expect(svg).toContain('>NEB<');
    expect(svg).toContain('fill="#D00000"');
  });

  it('truncates abbreviations to 4 chars', () => {
    const svg = placeholderSvg('LONGLABEL', '#000000');
    expect(svg).toContain('>LONG<');
  });

  it('rejects malformed colors', () => {
    expect(() => placeholderSvg('XX', 'red')).toThrow();
    expect(() => placeholderSvg('XX', '#FFF')).toThrow();
  });

  it('rejects empty abbreviations', () => {
    expect(() => placeholderSvg('   ', '#000000')).toThrow();
  });

  it('placeholderDataUri wraps the SVG as a data URI', () => {
    const uri = placeholderDataUri('PSU', '#041E42');
    expect(uri.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    expect(decodeURIComponent(uri)).toContain('>PSU<');
  });
});
