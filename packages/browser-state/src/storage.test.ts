import { createProgress } from '@whereabouts/game-engine';
import { describe, expect, it } from 'vitest';

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

function makeCase(): Parameters<typeof createProgress>[0] {
  return {
    publicationDate: '2026-08-14',
    revision: 1,
    target: { poiId: 'poi-00' },
    pois: [{ id: 'poi-00' }, { id: 'poi-01' }],
    clues: [],
    contextualResponses: [],
  };
}

describe('browser progress storage', () => {
  it('resumes matching saved progress for a case', () => {
    const caseData = makeCase();
    const storage = makeStorage();
    const progress = {
      ...createProgress(caseData),
      guessedPoiIds: ['poi-01'],
    };

    saveProgress(progress, storage);

    expect(loadProgress(caseData, storage)).toEqual(progress);
  });

  it.each([
    '{',
    JSON.stringify({ schemaVersion: 1 }),
  ])('starts a new progress for malformed or schema-invalid saved data', (savedValue) => {
    const caseData = makeCase();
    const storage = makeStorage();
    storage.setItem('whereabouts:case:2026-08-14', savedValue);

    expect(loadProgress(caseData, storage)).toEqual(createProgress(caseData));
  });

  it('starts a new progress when a saved revision differs', () => {
    const caseData = makeCase();
    const storage = makeStorage();
    storage.setItem(
      'whereabouts:case:2026-08-14',
      JSON.stringify({ ...createProgress(caseData), caseRevision: 2 }),
    );

    expect(loadProgress(caseData, storage)).toEqual(createProgress(caseData));
  });

  it('handles inaccessible storage without throwing', () => {
    const caseData = makeCase();
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

    expect(() => saveProgress(createProgress(caseData), storage)).not.toThrow();
    expect(() =>
      clearProgress(caseData.publicationDate, storage),
    ).not.toThrow();
    expect(loadProgress(caseData, storage)).toEqual(createProgress(caseData));
  });

  it('saves and clears only the requested dated progress key', () => {
    const caseData = makeCase();
    const storage = makeStorage();
    const progress = createProgress(caseData);
    storage.setItem('whereabouts:case:2026-08-15', 'other case');

    saveProgress(progress, storage);
    clearProgress(caseData.publicationDate, storage);

    expect(storage.getItem('whereabouts:case:2026-08-14')).toBeNull();
    expect(storage.getItem('whereabouts:case:2026-08-15')).toBe('other case');
  });
});
