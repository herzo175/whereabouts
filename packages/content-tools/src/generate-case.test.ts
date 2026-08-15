import { describe, expect, it } from 'vitest';
import {
  generateCase,
  modelCaseDraftSchema,
  resolveGenerationConfig,
} from './generate-case.js';

const pois = Array.from({ length: 25 }, (_, index) => ({
  id: `poi-${String(index).padStart(2, '0')}`,
  name: index === 0 ? 'Target Place' : `Place ${index}`,
  city: `City ${index}`,
  country: 'Exampleland',
  latitude: index,
  longitude: index,
  wikipediaTitle: `Place ${index}`,
  image: {
    url: `https://example.test/poi-${String(index).padStart(2, '0')}.jpg`,
    alt: `Photograph of Place ${index}`,
    attribution: 'Fixture photographer · CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
  },
}));
const extracts = pois.map((poi) => ({
  title: poi.wikipediaTitle,
  extract: `Source material for ${poi.name}.`,
  url: `https://example.test/${poi.id}`,
  retrievedAt: '2026-08-14T00:00:00Z',
}));

function makeDraft() {
  return {
    rounds: pois.slice(0, 5).map((target, roundIndex) => ({
      clue: {
        text: `A concrete historical feature identifies this round ${roundIndex + 1} target without naming its destination.`,
        sourceIds: [`source-${String(roundIndex + 1).padStart(2, '0')}`],
      },
      results: pois.map((poi, poiIndex) => ({
        poiId: poi.id,
        similarityScore: poi.id === target.id ? 100 : 100 - poiIndex,
        text:
          poi.id === target.id
            ? 'This candidate is the target identified by the clue.'
            : `This candidate has a sourced relationship to the target in round ${roundIndex + 1}.`,
        sourceIds:
          poi.id === target.id
            ? [`source-${String(roundIndex + 1).padStart(2, '0')}`]
            : [
                `source-${String(roundIndex + 1).padStart(2, '0')}`,
                `source-${String(poiIndex + 1).padStart(2, '0')}`,
              ],
      })),
    })),
  };
}

describe('generateCase', () => {
  it('uses an OpenRouter model identifier and requires its API key', () => {
    expect(
      resolveGenerationConfig({ OPENROUTER_API_KEY: 'openrouter-test-key' }),
    ).toEqual({
      apiKey: 'openrouter-test-key',
      model: 'openai/gpt-5.6-luna',
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

  it('converts a grounded five-round draft using the first five POIs as targets', async () => {
    const result = await generateCase({
      date: '2026-08-15',
      revision: 1,
      caseNumber: 2,
      pois,
      extracts,
      generate: async () => makeDraft(),
      write: false,
    });
    expect(result.caseData.schemaVersion).toBe(2);
    if (result.caseData.schemaVersion !== 2) throw new Error('expected v2');
    expect(result.caseData.rounds.map((round) => round.targetPoiId)).toEqual(
      pois.slice(0, 5).map((poi) => poi.id),
    );
    expect(result.caseData.rounds).toHaveLength(5);
    expect(
      result.caseData.rounds.every((round) => round.results.length === 25),
    ).toBe(true);
    expect(
      result.caseData.rounds.every((round) =>
        round.image.url.startsWith('https://example.test/'),
      ),
    ).toBe(true);
    expect(result.caseData.sources).toHaveLength(25);
    expect(result.caseData.pois.every((poi) => poi.blurb)).toBe(true);
    expect(result.caseData.pois[0]?.blurb).toContain('Source material');
  });

  it('requires exactly 25 results in the model output contract', () => {
    const draft = makeDraft();
    draft.rounds[4].results.pop();

    expect(modelCaseDraftSchema.safeParse(draft).success).toBe(false);
  });

  it('buckets non-targets from authored similarity score ordering', async () => {
    const draft = makeDraft();
    for (const [index, result] of draft.rounds[0].results.entries()) {
      result.similarityScore = index === 0 ? 100 : index;
    }

    const result = await generateCase({
      date: '2026-08-15',
      revision: 1,
      caseNumber: 2,
      pois,
      extracts,
      generate: async () => draft,
      write: false,
    });

    const round = result.caseData.rounds[0];
    expect(
      round?.results
        .filter((entry) => entry.tier === 'hot')
        .map((entry) => entry.poiId),
    ).toEqual(['poi-21', 'poi-22', 'poi-23', 'poi-24']);
    expect(
      round?.results
        .filter((entry) => entry.tier === 'warm')
        .map((entry) => entry.poiId),
    ).toEqual([
      'poi-13',
      'poi-14',
      'poi-15',
      'poi-16',
      'poi-17',
      'poi-18',
      'poi-19',
      'poi-20',
    ]);
  });

  it('breaks equal similarity scores by POI id', async () => {
    const draft = makeDraft();
    for (const result of draft.rounds[0].results) {
      result.similarityScore = result.poiId === 'poi-00' ? 100 : 50;
    }

    const result = await generateCase({
      date: '2026-08-15',
      revision: 1,
      caseNumber: 2,
      pois,
      extracts,
      generate: async () => draft,
      write: false,
    });

    expect(
      result.caseData.rounds[0]?.results
        .filter((entry) => entry.tier === 'hot')
        .map((entry) => entry.poiId),
    ).toEqual(['poi-01', 'poi-02', 'poi-03', 'poi-04']);
  });

  it.each([
    ['missing', undefined],
    ['out of range', -1],
  ])('rejects %s similarity scores', async (_label, score) => {
    const draft = makeDraft();
    if (score === undefined) delete draft.rounds[0].results[1].similarityScore;
    else draft.rounds[0].results[1].similarityScore = score;

    await expect(
      generateCase({
        date: '2026-08-15',
        revision: 1,
        caseNumber: 2,
        pois,
        extracts,
        generate: async () => draft,
        write: false,
      }),
    ).rejects.toThrow(/similarityScore/i);
  });

  it('does not expose the private target-first prompt order to players', async () => {
    const first = await generateCase({
      date: '2026-08-14',
      revision: 2,
      caseNumber: 1,
      pois,
      extracts,
      generate: async () => makeDraft(),
      write: false,
    });
    const repeated = await generateCase({
      date: '2026-08-14',
      revision: 2,
      caseNumber: 1,
      pois,
      extracts,
      generate: async () => makeDraft(),
      write: false,
    });

    if (first.caseData.schemaVersion !== 2) throw new Error('expected v2');
    expect(first.caseData.rounds[0]?.targetPoiId).toBe('poi-00');
    expect(first.caseData.pois[0]?.id).not.toBe('poi-00');
    expect(first.caseData.pois.map((poi) => poi.id)).toEqual(
      repeated.caseData.pois.map((poi) => poi.id),
    );
    expect(first.caseData.pois.map((poi) => poi.id).sort()).toEqual(
      pois.map((poi) => poi.id).sort(),
    );
  });

  it('fails closed when the model uses an unsupported source ID', async () => {
    const bad = makeDraft();
    bad.rounds[0].clue.sourceIds = ['source-99'];
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

  it('adds the known target and guessed-POI citations when the model omits one', async () => {
    const draft = makeDraft();
    draft.rounds[0].results[10].sourceIds = ['source-01'];

    const result = await generateCase({
      date: '2026-08-15',
      revision: 1,
      caseNumber: 2,
      pois,
      extracts,
      generate: async () => draft,
      write: false,
    });

    if (result.caseData.schemaVersion !== 2) throw new Error('expected v2');
    expect(result.caseData.rounds[0].results[10].sourceIds).toEqual([
      'source-01',
      'source-11',
    ]);
  });

  it('repairs an unambiguous punctuation-only POI id variation', async () => {
    const draft = makeDraft();
    draft.rounds[0].results[10].poiId = 'poi10';

    const result = await generateCase({
      date: '2026-08-15',
      revision: 1,
      caseNumber: 2,
      pois,
      extracts,
      generate: async () => draft,
      write: false,
    });

    expect(result.caseData.rounds[0].results[10].poiId).toBe('poi-10');
  });

  it('does not write when publication validation rejects the draft', async () => {
    let writes = 0;
    const bad = makeDraft();
    bad.rounds[0].clue.text =
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
