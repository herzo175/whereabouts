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
  it('requires an intentionally vague first clue and a measured narrowing ladder', () => {
    const prompt = buildCasePrompt(pois, extracts);

    expect(PROMPT_VERSION).toBe(2);
    expect(prompt).toContain('at least 8 of the 25 candidates');
    expect(prompt).toContain('Clue 2: 6–10 plausible candidates');
    expect(prompt).toContain('Clue 6: 1–2 plausible candidates');
    expect(prompt).toContain('Do not combine individually broad facts');
  });

  it('forbids early fingerprint facts that make a famous location obvious', () => {
    const prompt = buildCasePrompt(pois, extracts);

    expect(prompt).toContain('continents, borders, straits, rivers, seas');
    expect(prompt).toContain('proper nouns, named people, named empires');
    expect(prompt).toContain('exact century, year, dynasty, religion');
    expect(prompt).toContain('signature architectural feature');
  });

  it('makes wrong-guess responses explain a sourced relationship', () => {
    const prompt = buildCasePrompt(pois, extracts);

    expect(prompt).toContain(
      'relationship between the guessed POI and the target',
    );
    expect(prompt).toContain('not merely say that the guess is elsewhere');
  });
});
