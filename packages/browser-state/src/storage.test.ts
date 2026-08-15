import { createFiveRoundProgress } from '@whereabouts/game-engine';
import { describe, expect, it } from 'vitest';

import { makeFiveRoundCase } from '../../case-content/test/fixtures.js';

import { clearProgress, loadProgress, saveProgress } from './storage.js';

function makeStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

describe('browser progress storage', () => {
  it('resumes matching saved five-round progress', () => {
    const caseData = makeFiveRoundCase();
    const storage = makeStorage();
    const progress = createFiveRoundProgress(caseData);

    saveProgress(progress, storage);

    expect(loadProgress(caseData, storage)).toEqual(progress);
  });

  it('starts fresh for malformed saved data', () => {
    const caseData = makeFiveRoundCase();
    const storage = makeStorage();
    storage.setItem('whereabouts:case:2026-08-14', '{');

    expect(loadProgress(caseData, storage)).toEqual(
      createFiveRoundProgress(caseData),
    );
  });

  it('starts fresh when saved progress does not match the authored case', () => {
    const caseData = makeFiveRoundCase();
    const storage = makeStorage();
    storage.setItem(
      'whereabouts:case:2026-08-14',
      JSON.stringify({
        ...createFiveRoundProgress(caseData),
        guesses: [
          {
            roundId: 'round-1',
            poiId: 'poi-10',
            tier: 'hot',
            points: 75,
          },
        ],
        acknowledgedRoundCount: 1,
      }),
    );

    expect(loadProgress(caseData, storage)).toEqual(
      createFiveRoundProgress(caseData),
    );
  });

  it('restores whether the latest round reveal needs acknowledgement', () => {
    const caseData = makeFiveRoundCase();
    const storage = makeStorage();
    const progress = {
      ...createFiveRoundProgress(caseData),
      guesses: [
        {
          roundId: 'round-1',
          poiId: 'poi-10',
          tier: 'warm' as const,
          points: 50 as const,
        },
      ],
      acknowledgedRoundCount: 0,
    };

    saveProgress(progress, storage);

    expect(loadProgress(caseData, storage)).toEqual(progress);
  });

  it('handles inaccessible storage without throwing', () => {
    const caseData = makeFiveRoundCase();
    const progress = createFiveRoundProgress(caseData);
    const storage = {
      ...makeStorage(),
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
      removeItem() {
        throw new Error('blocked');
      },
    };

    expect(() => saveProgress(progress, storage)).not.toThrow();
    expect(() =>
      clearProgress(caseData.publicationDate, storage),
    ).not.toThrow();
    expect(loadProgress(caseData, storage)).toEqual(progress);
  });

  it('saves and clears only the requested dated progress key', () => {
    const caseData = makeFiveRoundCase();
    const storage = makeStorage();
    const progress = createFiveRoundProgress(caseData);
    storage.setItem('whereabouts:case:2026-08-15', 'other case');

    saveProgress(progress, storage);
    clearProgress(caseData.publicationDate, storage);

    expect(storage.getItem('whereabouts:case:2026-08-14')).toBeNull();
    expect(storage.getItem('whereabouts:case:2026-08-15')).toBe('other case');
  });
});
