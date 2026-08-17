import { describe, expect, it } from 'vitest';

// biome-ignore lint/suspicious/noTsIgnore: fixtures are intentionally outside the library source root.
// @ts-ignore -- package typecheck has a narrower root than test compilation.
import { makeFiveRoundCase } from '../test/fixtures.js';
import { dailyCaseSchema } from './schema.js';

describe('dailyCaseSchema', () => {
  it('accepts five distinct rounds over a shared 25-location board', () => {
    const parsed = dailyCaseSchema.parse(makeFiveRoundCase());
    expect(parsed.schemaVersion).toBe(3);
    if (parsed.schemaVersion !== 3) throw new Error('expected version 3');
    expect(parsed.rounds).toHaveLength(5);
    expect(parsed.rounds[0]?.results).toHaveLength(25);
  });

  it('accepts a sourced v3 themed case', () => {
    const parsed = dailyCaseSchema.parse(makeFiveRoundCase());
    expect(parsed.schemaVersion).toBe(3);
    if (parsed.schemaVersion !== 3) throw new Error('expected version 3');
    expect(parsed.theme.title).toBe('Railway Hotels');
    expect(parsed.pois[0]?.themeConnection.sourceIds).toEqual(['source-01']);
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
    value.rounds[1].results[0].tier = 'correct';
    value.rounds[1].results[1].tier = 'hot';
    expect(() => dailyCaseSchema.parse(value)).toThrow(/target.*unique/i);
  });

  it('rejects incomplete five-round candidate coverage', () => {
    const value = makeFiveRoundCase();
    value.rounds[0].results.pop();
    expect(() => dailyCaseSchema.parse(value)).toThrow(/25|cover/i);
  });

  it('allows non-target candidates without images while requiring round target images', () => {
    const value = makeFiveRoundCase();
    delete value.pois[10].image;
    expect(() => dailyCaseSchema.parse(value)).not.toThrow();
    delete value.rounds[0].image;
    expect(() => dailyCaseSchema.parse(value)).toThrow(/rounds\[0\].*image/i);
  });

  it('rejects a non-target marked correct', () => {
    const value = makeFiveRoundCase();
    value.rounds[0].results[1].tier = 'correct';
    expect(() => dailyCaseSchema.parse(value)).toThrow(/correct/i);
  });

  it('rejects unsupported schema versions', () => {
    const unsupported = {
      schemaVersion: 4,
      publicationDate: '2026-08-14',
      revision: 1,
      caseNumber: 1,
    };

    expect(() => dailyCaseSchema.parse(unsupported)).toThrow(
      /schemaVersion|unsupported/i,
    );
  });
});
