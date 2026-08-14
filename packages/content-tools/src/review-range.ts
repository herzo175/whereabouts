import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readCaseForReview, reviewPacket } from './review-case.js';

function parse(arguments_: string[]): {
  from: string;
  days: number;
  out: string;
} {
  const from = arguments_[arguments_.indexOf('--from') + 1];
  const days = Number(arguments_[arguments_.indexOf('--days') + 1]);
  const out = arguments_[arguments_.indexOf('--out') + 1];
  if (
    !from ||
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !Number.isInteger(days) ||
    days < 1 ||
    !out
  )
    throw new Error(
      'Usage: content:review-range -- --from YYYY-MM-DD --days N --out artifacts/review',
    );
  return { from, days, out };
}
export async function reviewRange(arguments_: string[]): Promise<void> {
  const { from, days, out } = parse(arguments_);
  await mkdir(out, { recursive: true });
  const index: string[] = ['# Review checklist', ''];
  for (let offset = 0; offset < days; offset++) {
    const value = new Date(`${from}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    const date = value.toISOString().slice(0, 10);
    const filename = `${date}.md`;
    await writeFile(
      join(out, filename),
      reviewPacket(await readCaseForReview(date)),
    );
    index.push(`- [ ] [${date}](${filename})`);
  }
  await writeFile(join(out, 'index.md'), `${index.join('\n')}\n`);
}
if (
  process.argv[1] &&
  new URL(`file://${process.argv[1]}`).href === import.meta.url
)
  reviewRange(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
