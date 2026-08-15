import { describe, expect, it } from 'vitest';

// biome-ignore lint/suspicious/noTsIgnore: fixtures are intentionally outside the library source root.
// @ts-ignore -- package typecheck has a narrower root than test compilation.
import { makeFiveRoundCase } from '../test/fixtures.js';
import { dailyCaseSchema } from './schema.js';

describe('dailyCaseSchema', () => {
  it('accepts five distinct rounds over a shared 25-location board', () => {
    const parsed = dailyCaseSchema.parse(makeFiveRoundCase());
    expect(parsed.schemaVersion).toBe(2);
    if (parsed.schemaVersion !== 2) throw new Error('expected version 2');
    expect(parsed.rounds).toHaveLength(5);
    expect(parsed.rounds[0]?.results).toHaveLength(25);
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

  it('requires an attributed image for every five-round candidate', () => {
    const value = makeFiveRoundCase();
    delete value.pois[10].image;
    expect(() => dailyCaseSchema.parse(value)).toThrow(/every.*image/i);
  });

  it('rejects a non-target marked correct', () => {
    const value = makeFiveRoundCase();
    value.rounds[0].results[1].tier = 'correct';
    expect(() => dailyCaseSchema.parse(value)).toThrow(/correct/i);
  });

  it('rejects unsupported schema versions', () => {
    const unsupported = {
      schemaVersion: 3,
      publicationDate: '2026-08-14',
      revision: 1,
      caseNumber: 1,
    };

    expect(() => dailyCaseSchema.parse(unsupported)).toThrow(/must equal 2/i);
  });
});
