import { describe, it, expect } from 'vitest';
import { offseason } from '@vcd/shared';

describe('advanceClass', () => {
  it('FR → SO (no graduation)', () => {
    expect(offseason.advanceClass({ classYear: 'FR' })).toEqual({ nextClassYear: 'SO', graduates: false });
  });
  it('SO → JR', () => {
    expect(offseason.advanceClass({ classYear: 'SO' })).toEqual({ nextClassYear: 'JR', graduates: false });
  });
  it('JR → SR', () => {
    expect(offseason.advanceClass({ classYear: 'JR' })).toEqual({ nextClassYear: 'SR', graduates: false });
  });
  it('SR → graduates', () => {
    expect(offseason.advanceClass({ classYear: 'SR' })).toEqual({ nextClassYear: null, graduates: true });
  });
  it('GR → graduates', () => {
    expect(offseason.advanceClass({ classYear: 'GR' })).toEqual({ nextClassYear: null, graduates: true });
  });
  it('deterministic', () => {
    const a = offseason.advanceClass({ classYear: 'SO' });
    const b = offseason.advanceClass({ classYear: 'SO' });
    expect(a).toEqual(b);
  });
});
