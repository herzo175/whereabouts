// @ts-expect-error -- package typecheck intentionally omits Node test-only declarations.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// biome-ignore lint/suspicious/noTsIgnore: fixtures are intentionally outside the library source root.
// @ts-ignore -- package typecheck has a narrower root than test compilation.
import { makeCase } from '../test/fixtures.js';
import { dailyCaseSchema } from './schema.js';

describe('dailyCaseSchema', () => {
  it('accepts one target, 24 distractors, six clues, and 24 responses', () => {
    expect(dailyCaseSchema.parse(makeCase()).pois).toHaveLength(25);
  });

  it('rejects duplicate POI ids', () => {
    const value = makeCase();
    value.pois[1].id = value.pois[0].id;

    expect(() => dailyCaseSchema.parse(value)).toThrow(/unique/i);
  });

  it('rejects a contextual response for the target', () => {
    const value = makeCase();
    value.contextualResponses[0].poiId = value.target.poiId;

    expect(() => dailyCaseSchema.parse(value)).toThrow(/distractor/i);
  });

  it('rejects a target that is absent from the POIs', () => {
    const value = makeCase();
    value.target.poiId = 'missing-poi';

    expect(() => dailyCaseSchema.parse(value)).toThrow(/included/i);
  });

  it('rejects unknown source references', () => {
    const value = makeCase();
    value.clues[0].sourceIds = ['missing-source'];

    expect(() => dailyCaseSchema.parse(value)).toThrow(/resolve/i);
  });

  it('returns an isolated mutable fixture each time', () => {
    const first = makeCase();
    const second = makeCase();
    first.pois[0].name = 'Changed name';
    first.clues[0].sourceIds.push('source-02');

    expect(second.pois[0].name).not.toBe(first.pois[0].name);
    expect(second.clues[0].sourceIds).toEqual(['source-01']);
  });

  it('parses the published development artifact without revealing its answer early', () => {
    const artifact = JSON.parse(
      readFileSync(
        new URL('../content/cases/2026-08-14/v1.json', import.meta.url),
        'utf8',
      ),
    );
    const parsed = dailyCaseSchema.parse(artifact);
    const preReveal = [
      ...parsed.clues.map((clue) => clue.text),
      ...parsed.contextualResponses.map((response) => response.text),
    ].join(' ');

    expect(preReveal).not.toMatch(/istanbul|turkey|hagia sophia/i);
  });
});
