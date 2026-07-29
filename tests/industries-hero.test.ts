import { describe, expect, it } from 'vitest';
import {
  getNextIndustryIndex,
  getNextTypingState,
  INDUSTRY_DELETE_INTERVAL,
  INDUSTRY_PAUSE_INTERVAL,
  INDUSTRY_TYPING_INTERVAL,
  type TypingState,
} from '../src/components/IndustriesHeroTyping';
import type { TypingState } from '../src/components/IndustriesHeroTyping';
import { INDUSTRY_CONTENT } from '../src/components/industryContent';

describe('Industries hero typing', () => {
  it('uses the requested typing, deletion, and pause timing', () => {
    expect(INDUSTRY_TYPING_INTERVAL).toBe(50);
    expect(INDUSTRY_DELETE_INTERVAL).toBe(35);
    expect(INDUSTRY_PAUSE_INTERVAL).toBe(2200);
  });

  it('types, pauses, deletes, and advances to the next sector', () => {
    let state: TypingState = { currentIndex: 0, phase: 'typing', text: '' };

    for (const character of INDUSTRY_CONTENT[0].title) {
      state = getNextTypingState(state);
      expect(state.text.endsWith(character)).toBe(true);
    }

    expect(state).toEqual({ currentIndex: 0, phase: 'pause', text: INDUSTRY_CONTENT[0].title });
    state = getNextTypingState(state);
    expect(state.phase).toBe('deleting');

    while (state.text) state = getNextTypingState(state);
    expect(state).toEqual({ currentIndex: 1, phase: 'typing', text: '' });
  });

  it('loops the sector index without skipping entries', () => {
    let index = 0;
    for (let change = 1; change <= INDUSTRY_CONTENT.length; change += 1) {
      index = getNextIndustryIndex(index);
      expect(index).toBe(change % INDUSTRY_CONTENT.length);
    }
  });
});
