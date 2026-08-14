import { describe, expect, it, vi } from 'vitest';
import { loadLocalEnvironment } from './environment.js';

describe('loadLocalEnvironment', () => {
  it('loads the repository root env file', () => {
    const load = vi.fn();

    loadLocalEnvironment(load);

    expect(load).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledWith(
      new URL('../../../.env', import.meta.url),
    );
  });

  it('allows CI to omit the local env file', () => {
    expect(() =>
      loadLocalEnvironment(() => {
        throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      }),
    ).not.toThrow();
  });

  it('does not hide malformed or unreadable env failures', () => {
    expect(() =>
      loadLocalEnvironment(() => {
        throw Object.assign(new Error('denied'), { code: 'EACCES' });
      }),
    ).toThrow('denied');
  });
});
