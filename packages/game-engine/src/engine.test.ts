import { describe, expect, it } from 'vitest';

import { makeCase } from '../../case-content/test/fixtures.js';
import {
  applyGuess,
  createProgress,
  GameRuleError,
  getAttemptsRemaining,
  getLatestFeedback,
  getShareTokens,
  getVisibleClues,
} from './index.js';

describe('Whereabouts game engine', () => {
  it('starts with clue one and six attempts remaining', () => {
    const caseData = makeCase();
    const progress = createProgress(caseData);

    expect(progress).toEqual({
      schemaVersion: 1,
      caseDate: '2026-08-14',
      caseRevision: 1,
      guessedPoiIds: [],
      outcome: 'playing',
    });
    expect(getVisibleClues(caseData, progress)).toEqual(
      caseData.clues.slice(0, 1),
    );
    expect(getAttemptsRemaining(progress)).toBe(6);
  });

  it('adds a unique wrong guess and unlocks the next clue', () => {
    const caseData = makeCase();
    const progress = applyGuess(caseData, createProgress(caseData), 'poi-01');

    expect(progress).toEqual({
      schemaVersion: 1,
      caseDate: '2026-08-14',
      caseRevision: 1,
      guessedPoiIds: ['poi-01'],
      outcome: 'playing',
    });
    expect(getVisibleClues(caseData, progress)).toEqual(
      caseData.clues.slice(0, 2),
    );
    expect(getAttemptsRemaining(progress)).toBe(5);
  });

  it('returns the authored response and relationship tier for a wrong guess', () => {
    const caseData = makeCase();
    const progress = applyGuess(caseData, createProgress(caseData), 'poi-10');

    expect(getLatestFeedback(caseData, progress)).toEqual(
      caseData.contextualResponses[9],
    );
  });

  it('wins immediately when the target POI is guessed', () => {
    const caseData = makeCase();
    const now = new Date('2026-08-14T12:34:56.000Z');

    expect(
      applyGuess(caseData, createProgress(caseData), 'poi-00', now),
    ).toEqual({
      schemaVersion: 1,
      caseDate: '2026-08-14',
      caseRevision: 1,
      guessedPoiIds: ['poi-00'],
      outcome: 'won',
      completedAt: '2026-08-14T12:34:56.000Z',
    });
  });

  it('loses after six wrong guesses', () => {
    const caseData = makeCase();
    let progress = createProgress(caseData);
    for (let index = 1; index <= 6; index += 1) {
      progress = applyGuess(
        caseData,
        progress,
        `poi-${String(index).padStart(2, '0')}`,
        new Date('2026-08-14T12:34:56.000Z'),
      );
    }

    expect(progress).toEqual({
      schemaVersion: 1,
      caseDate: '2026-08-14',
      caseRevision: 1,
      guessedPoiIds: [
        'poi-01',
        'poi-02',
        'poi-03',
        'poi-04',
        'poi-05',
        'poi-06',
      ],
      outcome: 'lost',
      completedAt: '2026-08-14T12:34:56.000Z',
    });
    expect(getVisibleClues(caseData, progress)).toEqual(caseData.clues);
  });

  it('rejects a duplicate guess without mutating progress', () => {
    const caseData = makeCase();
    const progress = applyGuess(caseData, createProgress(caseData), 'poi-01');

    expect(() => applyGuess(caseData, progress, 'poi-01')).toThrow(
      GameRuleError,
    );
    expect(progress).toEqual({
      schemaVersion: 1,
      caseDate: '2026-08-14',
      caseRevision: 1,
      guessedPoiIds: ['poi-01'],
      outcome: 'playing',
    });
  });

  it('rejects a seventh guess after the case ends', () => {
    const caseData = makeCase();
    const progress = applyGuess(caseData, createProgress(caseData), 'poi-00');

    expect(() => applyGuess(caseData, progress, 'poi-01')).toThrow(
      GameRuleError,
    );
  });

  it('builds cold, warm, hot, solved share tokens in guess order', () => {
    const caseData = makeCase();
    let progress = createProgress(caseData);
    for (const poiId of ['poi-01', 'poi-10', 'poi-20', 'poi-00']) {
      progress = applyGuess(caseData, progress, poiId);
    }

    expect(getShareTokens(caseData, progress)).toEqual([
      'cold',
      'warm',
      'hot',
      'solved',
    ]);
  });

  it('rejects an unknown POI without mutating progress', () => {
    const caseData = makeCase();
    const progress = createProgress(caseData);

    expect(() => applyGuess(caseData, progress, 'unknown-poi')).toThrow(
      GameRuleError,
    );
    expect(progress.guessedPoiIds).toEqual([]);
  });
});
