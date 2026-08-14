import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/model-output.json' with { type: 'json' };
import { generateCase } from './generate-case.js';

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
