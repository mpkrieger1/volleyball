import { describe, expect, it } from 'vitest';
import { awards } from '@vcd/shared';

describe('AA composition', () => {
  it('locks composition: 2 OH / 2 MB / 1 OPP / 1 S / 1 L', () => {
    expect(awards.AA_COMPOSITION).toEqual({
      OH: 2,
      MB: 2,
      OPP: 1,
      S: 1,
      L: 1,
    });
  });

  it('AA_TEAM_SIZE is 7', () => {
    expect(awards.AA_TEAM_SIZE).toBe(7);
  });

  it('has 4 teams: first / second / third / hm', () => {
    expect(awards.AA_TEAMS).toEqual(['first', 'second', 'third', 'hm']);
  });

  it('total selections per season = 28', () => {
    expect(awards.AA_TOTAL_SELECTIONS).toBe(28);
  });

  it('AA_CATEGORY maps team → AA_FIRST/SECOND/THIRD/HM', () => {
    expect(awards.AA_CATEGORY.first).toBe('AA_FIRST');
    expect(awards.AA_CATEGORY.second).toBe('AA_SECOND');
    expect(awards.AA_CATEGORY.third).toBe('AA_THIRD');
    expect(awards.AA_CATEGORY.hm).toBe('AA_HM');
  });
});
