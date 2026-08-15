import { describe, expect, it } from 'vitest';
import { buildCasePrompt, PROMPT_VERSION } from './prompt.js';

const pois = Array.from({ length: 25 }, (_, index) => ({
  id: `poi-${index}`,
  name: index === 0 ? 'Target Place' : `Candidate ${index}`,
  city: `City ${index}`,
  country: `Country ${index}`,
  latitude: index,
  longitude: index,
  wikipediaTitle: `Candidate ${index}`,
}));

const extracts = pois.map((poi) => ({
  title: poi.wikipediaTitle,
  extract: `Grounded history for ${poi.name}.`,
  url: `https://example.test/${poi.id}`,
  retrievedAt: '2026-08-14T00:00:00Z',
}));

describe('buildCasePrompt', () => {
  it('requests five concrete, one-shot round clues without leaking answers', () => {
    const prompt = buildCasePrompt(pois, extracts);

    expect(PROMPT_VERSION).toBe(8);
    expect(prompt).toContain('exactly five rounds');
    expect(prompt).toContain('first five catalog records');
    expect(prompt).toContain('one concrete, useful clue');
    expect(prompt).toContain('target POI name, city, or country');
    expect(prompt).toContain('Geographic labels are answer markers');
  });

  it('requires sourced numeric similarity scores for deterministic tier bucketing', () => {
    const prompt = buildCasePrompt(pois, extracts);

    expect(prompt).toContain('exactly 25 results');
    expect(prompt).toContain('similarityScore');
    expect(prompt).toContain('0–100');
    expect(prompt).toContain('deterministically buckets');
    expect(prompt).toContain(
      'source IDs for both the guessed POI and the target',
    );
  });

  it('redacts target answer markers from the model context', () => {
    const prompt = buildCasePrompt(pois, extracts);

    expect(prompt).not.toContain('Target Place');
    expect(prompt).not.toContain('City 0');
    expect(prompt).not.toContain('Country 0');
    expect(prompt).toContain('"id":"poi-0"');
  });

  it('bounds cached corpus context before sending the daily model request', () => {
    const largeExtracts = extracts.map((extract, index) => ({
      ...extract,
      extract: `${String(index).repeat(50_000)}TAIL-${index}`,
    }));

    const prompt = buildCasePrompt(pois, largeExtracts);

    expect(prompt.length).toBeLessThan(140_000);
    expect(prompt).toContain('TAIL-0');
    expect(prompt).toContain('TAIL-24');
  });
});
