export type RelationshipTier = 'cold' | 'warm' | 'hot';
export type RoundTier = RelationshipTier | 'correct';

export type Poi = {
  id: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  wikipediaTitle: string;
  blurb?: string;
  image?: {
    url: string;
    alt: string;
    attribution: string;
    licenseUrl: string;
  };
};

export type Source = {
  id: string;
  title: string;
  url: string;
  retrievedAt: string;
};

export type LegacyDailyCase = {
  schemaVersion: 1;
  publicationDate: string;
  revision: number;
  caseNumber: number;
  target: { poiId: string; destinationName: string };
  pois: Poi[];
  clues: Array<{ id: string; text: string; sourceIds: string[] }>;
  contextualResponses: Array<{
    poiId: string;
    tier: RelationshipTier;
    text: string;
    sourceIds: string[];
  }>;
  reveal: {
    title: string;
    summary: string;
    clueExplanation: string;
    sourceIds: string[];
  };
  sources: Source[];
};

export type RoundResult = {
  poiId: string;
  tier: RoundTier;
  text: string;
  sourceIds: string[];
};

export type DailyRound = {
  id: string;
  targetPoiId: string;
  image: NonNullable<Poi['image']>;
  clue: { text: string; sourceIds: string[] };
  results: RoundResult[];
};

export type FiveRoundDailyCase = {
  schemaVersion: 2;
  publicationDate: string;
  revision: number;
  caseNumber: number;
  pois: Poi[];
  rounds: DailyRound[];
  sources: Source[];
};

export type DailyCase = LegacyDailyCase | FiveRoundDailyCase;

export type Schema<T> = { parse(value: unknown): T };

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const isoDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string, minimum = 1): string {
  if (typeof value !== 'string' || value.length < minimum) {
    fail(path, `must be a string with at least ${minimum} character(s)`);
  }
  return value;
}

function id(value: unknown, path: string): string {
  const parsed = string(value, path);
  if (!idPattern.test(parsed)) fail(path, 'must be lowercase kebab-case');
  return parsed;
}

function url(value: unknown, path: string): string {
  const parsed = string(value, path);
  try {
    new URL(parsed);
  } catch {
    fail(path, 'must be a valid URL');
  }
  return parsed;
}

function numberInRange(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    fail(path, `must be a number between ${minimum} and ${maximum}`);
  }
  return value;
}

function positiveInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0)
    fail(path, 'must be a positive integer');
  return value as number;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array');
  return value;
}

function unique(values: string[], path: string, label: string): void {
  if (new Set(values).size !== values.length)
    fail(path, `${label} must be unique`);
}

function parseSourceIds(value: unknown, path: string): string[] {
  const values = array(value, path);
  if (values.length === 0) fail(path, 'must contain at least one source id');
  return values.map((sourceId, index) => id(sourceId, `${path}[${index}]`));
}

function parsePoi(value: unknown, path: string): Poi {
  const parsed = record(value, path);
  const imageValue = parsed.image;
  let image: Poi['image'];
  if (imageValue !== undefined) {
    const parsedImage = record(imageValue, `${path}.image`);
    image = {
      url: url(parsedImage.url, `${path}.image.url`),
      alt: string(parsedImage.alt, `${path}.image.alt`, 5),
      attribution: string(
        parsedImage.attribution,
        `${path}.image.attribution`,
        3,
      ),
      licenseUrl: url(parsedImage.licenseUrl, `${path}.image.licenseUrl`),
    };
  }
  return {
    id: id(parsed.id, `${path}.id`),
    name: string(parsed.name, `${path}.name`, 2),
    city: string(parsed.city, `${path}.city`),
    country: string(parsed.country, `${path}.country`, 2),
    latitude: numberInRange(parsed.latitude, `${path}.latitude`, -90, 90),
    longitude: numberInRange(parsed.longitude, `${path}.longitude`, -180, 180),
    wikipediaTitle: string(parsed.wikipediaTitle, `${path}.wikipediaTitle`),
    ...(parsed.blurb === undefined
      ? {}
      : { blurb: string(parsed.blurb, `${path}.blurb`, 20) }),
    ...(image === undefined ? {} : { image }),
  };
}

export const poiSchema: Schema<Poi> = {
  parse: (value) => parsePoi(value, 'poi'),
};

export const sourceSchema: Schema<Source> = {
  parse(value) {
    const parsed = record(value, 'source');
    const retrievedAt = string(parsed.retrievedAt, 'source.retrievedAt');
    if (!isoDateTimePattern.test(retrievedAt))
      fail('source.retrievedAt', 'must be an ISO datetime');
    return {
      id: id(parsed.id, 'source.id'),
      title: string(parsed.title, 'source.title'),
      url: url(parsed.url, 'source.url'),
      retrievedAt,
    };
  },
};

const legacyDailyCaseSchema: Schema<LegacyDailyCase> = {
  parse(value) {
    const parsed = record(value, 'daily case');
    if (parsed.schemaVersion !== 1) fail('schemaVersion', 'must equal 1');
    const publicationDate = string(parsed.publicationDate, 'publicationDate');
    if (!datePattern.test(publicationDate))
      fail('publicationDate', 'must be an ISO date');
    const target = record(parsed.target, 'target');
    const pois = array(parsed.pois, 'pois').map((poi, index) =>
      parsePoi(poi, `pois[${index}]`),
    );
    const clues = array(parsed.clues, 'clues').map((clue, index) => {
      const entry = record(clue, `clues[${index}]`);
      return {
        id: id(entry.id, `clues[${index}].id`),
        text: string(entry.text, `clues[${index}].text`, 20),
        sourceIds: parseSourceIds(entry.sourceIds, `clues[${index}].sourceIds`),
      };
    });
    const contextualResponses = array(
      parsed.contextualResponses,
      'contextualResponses',
    ).map((response, index) => {
      const entry = record(response, `contextualResponses[${index}]`);
      const tier = entry.tier as RelationshipTier;
      if (tier !== 'cold' && tier !== 'warm' && tier !== 'hot')
        fail(
          `contextualResponses[${index}].tier`,
          'must be cold, warm, or hot',
        );
      return {
        poiId: id(entry.poiId, `contextualResponses[${index}].poiId`),
        tier,
        text: string(entry.text, `contextualResponses[${index}].text`, 30),
        sourceIds: parseSourceIds(
          entry.sourceIds,
          `contextualResponses[${index}].sourceIds`,
        ),
      };
    });
    const reveal = record(parsed.reveal, 'reveal');
    const sources = array(parsed.sources, 'sources').map((source) =>
      sourceSchema.parse(source),
    );

    if (pois.length !== 25) fail('pois', 'must contain exactly 25 POIs');
    if (clues.length !== 6) fail('clues', 'must contain exactly six clues');
    if (contextualResponses.length !== 24)
      fail('contextualResponses', 'must contain exactly 24 responses');
    const poiIds = pois.map((poi) => poi.id);
    unique(poiIds, 'pois', 'POI ids');
    const targetPoiId = id(target.poiId, 'target.poiId');
    if (!poiIds.includes(targetPoiId))
      fail('target', 'Target POI must be included in POIs');
    unique(
      clues.map((clue) => clue.id),
      'clues',
      'Clue ids',
    );
    unique(
      sources.map((source) => source.id),
      'sources',
      'Source ids',
    );
    const responseIds = contextualResponses.map((response) => response.poiId);
    unique(responseIds, 'contextualResponses', 'Response POI ids');
    if (responseIds.includes(targetPoiId))
      fail(
        'contextualResponses',
        'Responses must be for distractors, never the target',
      );
    const distractors = poiIds.filter((poiId) => poiId !== targetPoiId);
    if (distractors.some((poiId) => !responseIds.includes(poiId)))
      fail(
        'contextualResponses',
        'Responses must cover every distractor exactly once',
      );
    const knownSourceIds = new Set(sources.map((source) => source.id));
    const references = [
      ...clues.flatMap((clue) => clue.sourceIds),
      ...contextualResponses.flatMap((response) => response.sourceIds),
      ...parseSourceIds(reveal.sourceIds, 'reveal.sourceIds'),
    ];
    if (references.some((sourceId) => !knownSourceIds.has(sourceId)))
      fail('sources', 'Every source reference must resolve');

    return {
      schemaVersion: 1,
      publicationDate,
      revision: positiveInteger(parsed.revision, 'revision'),
      caseNumber: positiveInteger(parsed.caseNumber, 'caseNumber'),
      target: {
        poiId: targetPoiId,
        destinationName: string(
          target.destinationName,
          'target.destinationName',
          2,
        ),
      },
      pois,
      clues,
      contextualResponses,
      reveal: {
        title: string(reveal.title, 'reveal.title', 2),
        summary: string(reveal.summary, 'reveal.summary', 50),
        clueExplanation: string(
          reveal.clueExplanation,
          'reveal.clueExplanation',
          50,
        ),
        sourceIds: parseSourceIds(reveal.sourceIds, 'reveal.sourceIds'),
      },
      sources,
    };
  },
};

function parseRoundImage(
  value: unknown,
  path: string,
): NonNullable<Poi['image']> {
  const parsed = record(value, path);
  return {
    url: url(parsed.url, `${path}.url`),
    alt: string(parsed.alt, `${path}.alt`, 5),
    attribution: string(parsed.attribution, `${path}.attribution`, 3),
    licenseUrl: url(parsed.licenseUrl, `${path}.licenseUrl`),
  };
}

const fiveRoundDailyCaseSchema: Schema<FiveRoundDailyCase> = {
  parse(value) {
    const parsed = record(value, 'daily case');
    if (parsed.schemaVersion !== 2) fail('schemaVersion', 'must equal 2');
    const publicationDate = string(parsed.publicationDate, 'publicationDate');
    if (!datePattern.test(publicationDate))
      fail('publicationDate', 'must be an ISO date');
    const pois = array(parsed.pois, 'pois').map((poi, index) =>
      parsePoi(poi, `pois[${index}]`),
    );
    if (pois.length !== 25) fail('pois', 'must contain exactly 25 POIs');
    const poiIds = pois.map((poi) => poi.id);
    unique(poiIds, 'pois', 'POI ids');
    const knownPoiIds = new Set(poiIds);
    const sources = array(parsed.sources, 'sources').map((source) =>
      sourceSchema.parse(source),
    );
    unique(
      sources.map((source) => source.id),
      'sources',
      'Source ids',
    );
    const knownSourceIds = new Set(sources.map((source) => source.id));
    const rounds = array(parsed.rounds, 'rounds').map((round, roundIndex) => {
      const path = `rounds[${roundIndex}]`;
      const entry = record(round, path);
      const targetPoiId = id(entry.targetPoiId, `${path}.targetPoiId`);
      if (!knownPoiIds.has(targetPoiId))
        fail(`${path}.targetPoiId`, 'must identify a POI on the board');
      const clue = record(entry.clue, `${path}.clue`);
      const parsedClue = {
        text: string(clue.text, `${path}.clue.text`, 20),
        sourceIds: parseSourceIds(
          clue.sourceIds,
          `${path}.clue.sourceIds`,
        ),
      };
      const results = array(entry.results, `${path}.results`).map(
        (result, resultIndex): RoundResult => {
          const resultPath = `${path}.results[${resultIndex}]`;
          const resultEntry = record(result, resultPath);
          const tier = resultEntry.tier as RoundTier;
          if (
            tier !== 'correct' &&
            tier !== 'hot' &&
            tier !== 'warm' &&
            tier !== 'cold'
          )
            fail(`${resultPath}.tier`, 'must be correct, hot, warm, or cold');
          return {
            poiId: id(resultEntry.poiId, `${resultPath}.poiId`),
            tier,
            text: string(resultEntry.text, `${resultPath}.text`, 10),
            sourceIds: parseSourceIds(
              resultEntry.sourceIds,
              `${resultPath}.sourceIds`,
            ),
          };
        },
      );
      if (results.length !== 25)
        fail(`${path}.results`, 'must contain exactly 25 candidate results');
      const resultPoiIds = results.map((result) => result.poiId);
      unique(resultPoiIds, `${path}.results`, 'Result POI ids');
      if (
        resultPoiIds.some((poiId) => !knownPoiIds.has(poiId)) ||
        poiIds.some((poiId) => !resultPoiIds.includes(poiId))
      )
        fail(`${path}.results`, 'must cover every board POI exactly once');
      const correct = results.filter((result) => result.tier === 'correct');
      if (correct.length !== 1 || correct[0]?.poiId !== targetPoiId)
        fail(`${path}.results`, 'only the target may be marked correct');
      const sourceReferences = [
        ...parsedClue.sourceIds,
        ...results.flatMap((result) => result.sourceIds),
      ];
      if (sourceReferences.some((sourceId) => !knownSourceIds.has(sourceId)))
        fail('sources', 'Every source reference must resolve');
      return {
        id: id(entry.id, `${path}.id`),
        targetPoiId,
        image: parseRoundImage(entry.image, `${path}.image`),
        clue: parsedClue,
        results,
      };
    });
    if (rounds.length !== 5) fail('rounds', 'must contain exactly five rounds');
    unique(
      rounds.map((round) => round.id),
      'rounds',
      'Round ids',
    );
    unique(
      rounds.map((round) => round.targetPoiId),
      'rounds',
      'Round target ids',
    );
    return {
      schemaVersion: 2,
      publicationDate,
      revision: positiveInteger(parsed.revision, 'revision'),
      caseNumber: positiveInteger(parsed.caseNumber, 'caseNumber'),
      pois,
      rounds,
      sources,
    };
  },
};

export const dailyCaseSchema: Schema<DailyCase> = {
  parse(value) {
    const parsed = record(value, 'daily case');
    if (parsed.schemaVersion === 1) return legacyDailyCaseSchema.parse(value);
    if (parsed.schemaVersion === 2)
      return fiveRoundDailyCaseSchema.parse(value);
    fail('schemaVersion', 'must equal 1 or 2');
  },
};
