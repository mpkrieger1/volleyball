import { describe, it, expect } from 'vitest';
import { coaching } from '@vcd/shared';

const { pickCoachRating, DEFAULT_RATING } = coaching;

describe('pickCoachRating (Sprint 17)', () => {
  const hc = { role: 'HC', ratingRecruit: 60, ratingDevelop: 80, ratingStrategy: 75 };
  const ahc = { role: 'AHC', ratingRecruit: 90, ratingDevelop: 55, ratingStrategy: 50 };
  const ac = { role: 'AC', ratingRecruit: 40, ratingDevelop: 40, ratingStrategy: 40 };

  it('recruiting prefers AHC over HC', () => {
    expect(pickCoachRating([hc, ahc, ac], 'recruiting')).toBe(90);
  });

  it('recruiting falls back to HC when AHC absent', () => {
    expect(pickCoachRating([hc, ac], 'recruiting')).toBe(60);
  });

  it('development prefers HC over AHC', () => {
    expect(pickCoachRating([hc, ahc, ac], 'development')).toBe(80);
  });

  it('strategy prefers HC over AHC', () => {
    expect(pickCoachRating([hc, ahc, ac], 'strategy')).toBe(75);
  });

  it('returns DEFAULT_RATING when no coach found', () => {
    expect(pickCoachRating([], 'recruiting')).toBe(DEFAULT_RATING);
  });

  it('falls back through all roles before defaulting', () => {
    expect(pickCoachRating([ac], 'development')).toBe(40);
  });
});
