import { describe, expect, it } from 'vitest';

// biome-ignore lint/suspicious/noTsIgnore: fixtures are intentionally outside the library source root.
// @ts-ignore -- package typecheck has a narrower root than test compilation.
import { makeCase } from '../test/fixtures.js';
import { CaseContentError, createCaseLoader } from './loader.server.js';

const publishedDate = '2026-08-14';
const artifactPath = '../content/cases/2026-08-14/v1.json';

function makeManifest(
  overrides: Partial<{
    caseNumber: number;
    revision: number;
    file: string;
  }> = {},
) {
  return {
    schemaVersion: 1,
    cases: {
      [publishedDate]: {
        caseNumber: 1,
        revision: 1,
        file: './cases/2026-08-14/v1.json',
        ...overrides,
      },
    },
  };
}

function makeModules(caseArtifact: unknown = makeCase()) {
  return { [artifactPath]: caseArtifact };
}

describe('createCaseLoader', () => {
  it('loads and validates the manifest-selected revision', () => {
    const loader = createCaseLoader(makeManifest(), makeModules());

    expect(loader.loadPublishedCase(publishedDate)).toMatchObject({
      publicationDate: publishedDate,
      revision: 1,
      caseNumber: 1,
    });
    expect(loader.listPublishedCases()).toEqual([
      { date: publishedDate, caseNumber: 1 },
    ]);
  });

  it('returns null for a syntactically valid unpublished date', () => {
    const loader = createCaseLoader(makeManifest(), makeModules());

    expect(loader.loadPublishedCase('2026-08-15')).toBeNull();
  });

  it('rejects malformed dates with a typed content error', () => {
    const loader = createCaseLoader(makeManifest(), makeModules());

    expect(() => loader.loadPublishedCase('August 14, 2026')).toThrow(
      CaseContentError,
    );
  });

  it.each([
    ['date', makeCase({ publicationDate: '2026-08-13' })],
    ['revision', makeCase({ revision: 2 })],
    ['case number', makeCase({ caseNumber: 2 })],
  ])('rejects a manifest entry whose artifact %s differs', (_, artifact) => {
    const loader = createCaseLoader(makeManifest(), makeModules(artifact));

    expect(() => loader.loadPublishedCase(publishedDate)).toThrow(
      CaseContentError,
    );
  });

  it('rejects corrupt manifest, artifact, and source data with a typed error', () => {
    const corruptArtifact = createCaseLoader(
      makeManifest(),
      makeModules({ schemaVersion: 1 }),
    );
    const corruptSource = createCaseLoader(
      makeManifest(),
      makeModules(makeCase({ sources: [] })),
    );

    expect(() =>
      createCaseLoader(
        { schemaVersion: 1, cases: { [publishedDate]: { revision: 1 } } },
        makeModules(),
      ),
    ).toThrow(CaseContentError);
    expect(() => corruptArtifact.loadPublishedCase(publishedDate)).toThrow(
      CaseContentError,
    );
    expect(() => corruptSource.loadPublishedCase(publishedDate)).toThrow(
      CaseContentError,
    );
  });

  it('does not expose unmanifested artifacts', () => {
    const loader = createCaseLoader(makeManifest(), {
      ...makeModules(),
      '../content/cases/2026-08-15/v1.json': makeCase({
        publicationDate: '2026-08-15',
        caseNumber: 2,
      }),
    });

    expect(loader.loadPublishedCase('2026-08-15')).toBeNull();
    expect(loader.listPublishedCases()).toEqual([
      { date: publishedDate, caseNumber: 1 },
    ]);
  });
});
