import { describe, expect, it } from 'vitest';

// biome-ignore lint/suspicious/noTsIgnore: fixtures are intentionally outside the library source root.
// @ts-ignore -- package typecheck has a narrower root than test compilation.
import { makeFiveRoundCase } from '../test/fixtures.js';
import { dailyCaseSchema } from './schema.js';

describe('dailyCaseSchema', () => {
  it('accepts five distinct rounds over a shared 20-location board', () => {
    const parsed = dailyCaseSchema.parse(makeFiveRoundCase());
    expect(parsed.schemaVersion).toBe(4);
    if (parsed.schemaVersion !== 4) throw new Error('expected version 4');
    expect(parsed.rounds).toHaveLength(5);
    expect(parsed.rounds[0]?.results).toHaveLength(20);
  });

  it('accepts a sourced v4 themed case with authored candidate points', () => {
    const parsed = dailyCaseSchema.parse(makeFiveRoundCase());
    expect(parsed.schemaVersion).toBe(4);
    if (parsed.schemaVersion !== 4) throw new Error('expected version 4');
    expect(parsed.rounds[0]?.results[1]?.points).toBe(92);
    expect(parsed.theme.title).toBe('Railway Hotels');
    expect(parsed.pois[0]?.themeConnection.sourceIds).toEqual(['source-01']);
  });

  it('accepts a candidate without Wikipedia metadata', () => {
    const value = makeFiveRoundCase();
    delete (value.pois[10] as { wikipediaTitle?: string }).wikipediaTitle;

    const parsed = dailyCaseSchema.parse(value);

    expect(parsed.pois[10]?.wikipediaTitle).toBeUndefined();
  });

  it('rejects a player introduction longer than 160 characters', () => {
    const value = makeFiveRoundCase();
    value.theme.introduction = 'A'.repeat(161);
    expect(() => dailyCaseSchema.parse(value)).toThrow(/160|at most/i);
  });

  it('rejects a themed POI without a theme connection', () => {
    const value = makeFiveRoundCase();
    delete value.pois[0].themeConnection;
    expect(() => dailyCaseSchema.parse(value)).toThrow(/themeConnection/i);
  });

  it('rejects a themed POI with an unknown theme source', () => {
    const value = makeFiveRoundCase();
    value.pois[0].themeConnection.sourceIds = ['source-unknown'];
    expect(() => dailyCaseSchema.parse(value)).toThrow(/source/i);
  });

  it('requires explicit source provenance', () => {
    const value = makeFiveRoundCase();
    const source = value.sources[0];
    if (!source) throw new Error('fixture source missing');
    delete (source as { provenance?: unknown }).provenance;
    expect(() => dailyCaseSchema.parse(value)).toThrow(/provenance/i);
  });

  it('rejects a themed target absent from the board', () => {
    const value = makeFiveRoundCase();
    value.rounds[0].targetPoiId = 'missing-poi';
    expect(() => dailyCaseSchema.parse(value)).toThrow(/board/i);
  });

  it('rejects duplicate five-round targets', () => {
    const value = makeFiveRoundCase();
    value.rounds[1].targetPoiId = value.rounds[0].targetPoiId;
    value.rounds[1].results[0].points = 100;
    value.rounds[1].results[1].points = 99;
    expect(() => dailyCaseSchema.parse(value)).toThrow(/target.*unique/i);
  });

  it('rejects incomplete five-round candidate coverage', () => {
    const value = makeFiveRoundCase();
    value.rounds[0].results.pop();
    expect(() => dailyCaseSchema.parse(value)).toThrow(/20|cover/i);
  });

  it('rejects boards above or below twenty candidates', () => {
    const tooFew = makeFiveRoundCase();
    tooFew.pois.pop();
    for (const round of tooFew.rounds) round.results.pop();
    expect(() => dailyCaseSchema.parse(tooFew)).toThrow(/exactly 20/i);

    const tooMany = makeFiveRoundCase();
    const extra = {
      ...tooMany.pois[19],
      id: 'poi-20',
      name: 'Place 20',
      latitude: 20,
      longitude: 20,
    };
    tooMany.pois.push(extra);
    for (const round of tooMany.rounds)
      round.results.push({
        ...round.results[19],
        poiId: extra.id,
        points: 1,
      });
    expect(() => dailyCaseSchema.parse(tooMany)).toThrow(/exactly 20/i);
  });

  it('allows non-target candidates without images while requiring round target images', () => {
    const value = makeFiveRoundCase();
    delete value.pois[10].image;
    expect(() => dailyCaseSchema.parse(value)).not.toThrow();
    delete value.rounds[0].image;
    expect(() => dailyCaseSchema.parse(value)).toThrow(/rounds\[0\].*image/i);
  });

  it('rejects a non-target awarded 100 points', () => {
    const value = makeFiveRoundCase();
    value.rounds[0].results[1].points = 100;
    expect(() => dailyCaseSchema.parse(value)).toThrow(/100|target/i);
  });

  it('rejects fractional and out-of-range candidate points', () => {
    const value = makeFiveRoundCase();
    value.rounds[0].results[1].points = 74.5;
    expect(() => dailyCaseSchema.parse(value)).toThrow(/integer/i);
    value.rounds[0].results[1].points = -1;
    expect(() => dailyCaseSchema.parse(value)).toThrow(/0|100/i);
  });

  it('rejects unsupported schema versions', () => {
    const unsupported = {
      schemaVersion: 5,
      publicationDate: '2026-08-14',
      revision: 1,
      caseNumber: 1,
    };

    expect(() => dailyCaseSchema.parse(unsupported)).toThrow(
      /schemaVersion|unsupported/i,
    );
  });
});
