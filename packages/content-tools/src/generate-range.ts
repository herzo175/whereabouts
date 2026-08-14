import { generateCase } from './generate-case.js';
import {
  fetchWikipediaExtracts,
  requireProductionUserAgent,
} from './wikipedia.js';

type CatalogPoi = Parameters<typeof generateCase>[0]['pois'][number] & {
  region: string;
};

function usage(): never {
  throw new Error(
    'Usage: content:generate-range -- --from YYYY-MM-DD --days N',
  );
}
function parse(arguments_: string[]): { from: string; days: number } {
  const from = arguments_[arguments_.indexOf('--from') + 1];
  const daysText = arguments_[arguments_.indexOf('--days') + 1];
  if (
    !from ||
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !daysText ||
    !/^\d+$/.test(daysText) ||
    Number(daysText) < 1
  )
    usage();
  return { from, days: Number(daysText) };
}
function dateAfter(from: string, offset: number): string {
  const date = new Date(`${from}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export async function generateRange(arguments_: string[]): Promise<void> {
  const { from, days } = parse(arguments_);
  requireProductionUserAgent();
  const catalog = (
    await import('../catalog/pois.json', { with: { type: 'json' } })
  ).default as CatalogPoi[];
  if (catalog.length < 25)
    throw new Error('catalog must contain at least 25 POIs');
  for (let offset = 0; offset < days; offset++) {
    const date = dateAfter(from, offset);
    const start =
      ((Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000) %
        catalog.length) +
        catalog.length) %
      catalog.length;
    const pois = Array.from(
      { length: 25 },
      (_, index) => catalog[(start + index) % catalog.length],
    ).filter((poi): poi is CatalogPoi => Boolean(poi));
    const extracts = await fetchWikipediaExtracts(
      pois.map((poi) => poi.wikipediaTitle),
    );
    await generateCase({
      date,
      revision: 1,
      caseNumber: Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000),
      pois,
      extracts,
    });
  }
}

if (
  process.argv[1] &&
  new URL(`file://${process.argv[1]}`).href === import.meta.url
)
  generateRange(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
