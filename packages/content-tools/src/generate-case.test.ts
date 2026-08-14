import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/model-output.json' with { type: 'json' };
import { generateCase, resolveGenerationConfig } from './generate-case.js';

const pois = Array.from({ length: 25 }, (_, index) => ({
  id: `poi-${String(index).padStart(2, '0')}`,
  name: index === 0 ? 'Target Place' : `Place ${index}`,
  city: `City ${index}`,
  country: 'Exampleland',
  latitude: index,
  longitude: index,
  wikipediaTitle: `Place ${index}`,
}));
const extracts = pois.map((poi) => ({
  title: poi.wikipediaTitle,
  extract: `Source material for ${poi.name}.`,
  url: `https://example.test/${poi.id}`,
  retrievedAt: '2026-08-14T00:00:00Z',
}));

describe('generateCase', () => {
  it('uses an OpenRouter model identifier and requires its API key', () => {
    expect(
      resolveGenerationConfig({ OPENROUTER_API_KEY: 'openrouter-test-key' }),
    ).toEqual({
      apiKey: 'openrouter-test-key',
      model: 'deepseek/deepseek-v4-flash-0731',
    });
    expect(() => resolveGenerationConfig({})).toThrow('OPENROUTER_API_KEY');
  });

  it('allows the OpenRouter model to be selected through the environment', () => {
    expect(
      resolveGenerationConfig({
        OPENROUTER_API_KEY: 'openrouter-test-key',
        WHEREABOUTS_MODEL: 'anthropic/claude-sonnet-4',
      }),
    ).toEqual({
      apiKey: 'openrouter-test-key',
      model: 'anthropic/claude-sonnet-4',
    });
  });

  it('converts a recorded structured draft using only fetched source IDs', async () => {
    const result = await generateCase({
      date: '2026-08-15',
      revision: 1,
      caseNumber: 2,
      pois,
      extracts,
      generate: async () => fixture,
      write: false,
    });
    expect(result.caseData.clues).toHaveLength(6);
    expect(result.caseData.contextualResponses).toHaveLength(24);
    expect(result.caseData.sources).toHaveLength(25);
  });

  it('does not expose the private target-first prompt order to players', async () => {
    const first = await generateCase({
      date: '2026-08-14',
      revision: 2,
      caseNumber: 1,
      pois,
      extracts,
      generate: async () => fixture,
      write: false,
    });
    const repeated = await generateCase({
      date: '2026-08-14',
      revision: 2,
      caseNumber: 1,
      pois,
      extracts,
      generate: async () => fixture,
      write: false,
    });

    expect(first.caseData.target.poiId).toBe('poi-00');
    expect(first.caseData.pois[0]?.id).not.toBe('poi-00');
    expect(first.caseData.pois.map((poi) => poi.id)).toEqual(
      repeated.caseData.pois.map((poi) => poi.id),
    );
    expect(first.caseData.pois.map((poi) => poi.id).sort()).toEqual(
      pois.map((poi) => poi.id).sort(),
    );
  });

  it('fails closed when the model uses an unsupported source ID', async () => {
    const bad = structuredClone(fixture);
    bad.clues[0].sourceIds = ['source-99'];
    await expect(
      generateCase({
        date: '2026-08-15',
        revision: 1,
        caseNumber: 2,
        pois,
        extracts,
        generate: async () => bad,
        write: false,
      }),
    ).rejects.toThrow('unsupported source ID');
  });

  it('does not write when publication validation rejects the draft', async () => {
    let writes = 0;
    const bad = structuredClone(fixture);
    bad.clues[0].text =
      'Target Place appears here, leaking the answer in this text.';
    await expect(
      generateCase({
        date: '2026-08-15',
        revision: 1,
        caseNumber: 2,
        pois,
        extracts,
        generate: async () => bad,
        writeFile: async () => {
          writes++;
        },
        exists: async () => false,
      }),
    ).rejects.toThrow('publication validation');
    expect(writes).toBe(0);
  });
});
