import { describe, expect, it } from 'vitest';

import { createGameEngine } from './index.js';

describe('createGameEngine', () => {
  it('creates a ready engine', () => {
    expect(createGameEngine()).toEqual({ status: 'ready' });
  });
});
