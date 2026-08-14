import { describe, expect, it, vi } from 'vitest';
import { fetchWikipediaExtracts } from './wikipedia.js';

describe('fetchWikipediaExtracts', () => {
  it('requests plaintext extracts with the Wikimedia API policy parameters', async () => {
    const fetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            query: {
              pages: [
                {
                  title: 'Example',
                  extract: 'Text',
                  fullurl: 'https://en.wikipedia.org/wiki/Example',
                },
              ],
            },
          }),
        ),
    );
    const result = await fetchWikipediaExtracts(['Example'], {
      fetch,
      now: () => new Date('2026-08-14T00:00:00Z'),
      userAgent:
        'Whereabouts/1.0 (https://example.test/contact; contact@example.test)',
    });
    const request = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(request.origin + request.pathname).toBe(
      'https://en.wikipedia.org/w/api.php',
    );
    expect(Object.fromEntries(request.searchParams)).toMatchObject({
      action: 'query',
      prop: 'extracts|info',
      explaintext: '1',
      inprop: 'url',
      redirects: '1',
      titles: 'Example',
      format: 'json',
      formatversion: '2',
    });
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      headers: { 'Api-User-Agent': expect.stringContaining('Whereabouts/') },
    });
    expect(result).toEqual([
      {
        title: 'Example',
        extract: 'Text',
        url: 'https://en.wikipedia.org/wiki/Example',
        retrievedAt: '2026-08-14T00:00:00.000Z',
      },
    ]);
  });

  it('honors Retry-After for retryable responses', async () => {
    const fetch = vi
      .fn<
        (_input: RequestInfo | URL, _init?: RequestInit) => Promise<Response>
      >()
      .mockResolvedValueOnce(
        new Response('', { status: 429, headers: { 'Retry-After': '2' } }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            query: {
              pages: [
                {
                  title: 'Example',
                  extract: 'Text',
                  fullurl: 'https://en.wikipedia.org/wiki/Example',
                },
              ],
            },
          }),
        ),
      );
    const sleep = vi.fn(async () => undefined);
    await fetchWikipediaExtracts(['Example'], {
      fetch,
      sleep,
      userAgent: 'Whereabouts/1.0 (contact@example.test)',
    });
    expect(sleep).toHaveBeenCalledWith(2_000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
