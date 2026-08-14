import type { Poi } from '@whereabouts/case-content';
import { Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { cn } from '../../lib/utils';

type PoiSearchProps = {
  pois: Poi[];
  disabledPoiIds: Set<string>;
  onSelect: (poi: Poi) => void;
};

function matchesQuery(poi: Poi, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return true;

  return [poi.name, poi.city, poi.country].some((value) =>
    value.toLocaleLowerCase().includes(normalizedQuery),
  );
}

export function PoiSearch({ pois, disabledPoiIds, onSelect }: PoiSearchProps) {
  const [query, setQuery] = useState('');
  const listId = useId();
  const filteredPois = useMemo(
    () => pois.filter((poi) => matchesQuery(poi, query)),
    [pois, query],
  );

  return (
    <section aria-label="Find a location" className="space-y-3">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <label className="sr-only" htmlFor={listId}>
          Search locations
        </label>
        <input
          aria-controls={`${listId}-results`}
          className="h-12 w-full rounded-md border border-foreground/15 bg-background py-2 pr-4 pl-11 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-foreground/45 focus-visible:ring-2 focus-visible:ring-foreground/25"
          id={listId}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a place, city, or country"
          type="search"
          value={query}
        />
      </div>

      <ul
        aria-label="Matching locations"
        className="max-h-80 space-y-2 overflow-y-auto pr-1"
        id={`${listId}-results`}
      >
        {filteredPois.map((poi) => {
          const isDisabled = disabledPoiIds.has(poi.id);

          return (
            <li key={poi.id}>
              <button
                className={cn(
                  'flex min-h-14 w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-left transition-colors',
                  isDisabled
                    ? 'cursor-not-allowed border-foreground/10 bg-foreground/[0.03] text-muted-foreground'
                    : 'border-foreground/15 bg-background hover:border-foreground/35 hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30',
                )}
                disabled={isDisabled}
                onClick={() => onSelect(poi)}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{poi.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {poi.city}, {poi.country}
                  </span>
                </span>
                {isDisabled ? (
                  <span className="shrink-0 text-xs font-medium tracking-[0.12em] uppercase">
                    Already eliminated
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="text-sm text-muted-foreground"
                  >
                    Review
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {filteredPois.length === 0 ? (
        <output className="block rounded-md border border-dashed border-foreground/15 px-4 py-5 text-sm text-muted-foreground">
          No locations match that lead.
        </output>
      ) : null}
    </section>
  );
}
