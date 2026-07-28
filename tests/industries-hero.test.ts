import { describe, expect, it } from 'vitest';
import { getNextIndustryIndex, INDUSTRY_DISPLAY_INTERVAL } from '../src/components/IndustriesHeroTyping';
import { INDUSTRY_CONTENT } from '../src/components/industryContent';

describe('Industries hero rotation', () => {
  it('uses complete sector names at a stable interval', () => {
    expect(INDUSTRY_DISPLAY_INTERVAL).toBe(4000);
    expect(INDUSTRY_CONTENT).toHaveLength(12);
    expect(INDUSTRY_CONTENT.every(({ title }) => title.length > 0)).toBe(true);
  });

  it('shows every industry and loops twice without skipping or mismatching entries', () => {
    let index = 0;
    const displayed = [INDUSTRY_CONTENT[index]];

    for (let change = 0; change < INDUSTRY_CONTENT.length * 2; change += 1) {
      index = getNextIndustryIndex(index);
      displayed.push(INDUSTRY_CONTENT[index]);
    }

    expect(displayed.slice(0, INDUSTRY_CONTENT.length)).toEqual(INDUSTRY_CONTENT);
    expect(displayed.slice(INDUSTRY_CONTENT.length, INDUSTRY_CONTENT.length * 2)).toEqual(INDUSTRY_CONTENT);
    expect(displayed.at(-1)).toEqual(INDUSTRY_CONTENT[0]);
  });
});
