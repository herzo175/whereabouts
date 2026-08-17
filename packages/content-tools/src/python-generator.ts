import { spawn as nodeSpawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateCase, type PreparedCase } from './generate-case.js';
import type { GenerationReview } from './generation-review.js';
import type {
  CaseDraft,
  CuratedBoard,
  ThemePlan,
} from './themed-case/contracts.js';

export type PythonGeneratorInput = {
  date: string;
  revision: number;
  caseNumber: number;
  recentThemes: Array<{ title: string; inclusionCriteria: string }>;
  excludedTargetIds: ReadonlySet<string>;
};

type PythonGeneratorOutput = {
  theme: ThemePlan;
  board: CuratedBoard;
  draft: CaseDraft;
  review: GenerationReview;
};

type SpawnResult = { stdout: string; stderr: string };
type SpawnFunction = (options: {
  command: string;
  args: string[];
  cwd: string;
  input: PythonGeneratorInput & { excludedTargetIds: string[] };
  timeoutMs: number;
}) => Promise<SpawnResult>;

function projectRoot(): string {
  return resolve(fileURLToPath(new URL('../../..', import.meta.url)));
}

async function spawnPython(
  options: Parameters<SpawnFunction>[0],
): Promise<SpawnResult> {
  const child = nodeSpawn(options.command, options.args, {
    cwd: options.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });
  child.stdin.write(`${JSON.stringify(options.input)}\n`);
  child.stdin.end();
  const timer = setTimeout(() => child.kill('SIGTERM'), options.timeoutMs);
  try {
    const [result] = (await once(child, 'close')) as [number | null];
    if (result !== 0)
      throw new Error(
        `Python generator exited ${result ?? 'without a code'}: ${stderr.trim()}`,
      );
    return { stdout, stderr };
  } finally {
    clearTimeout(timer);
  }
}

export function createPythonGenerator(
  options: {
    command?: string;
    timeoutMs?: number;
    cwd?: string;
    spawn?: SpawnFunction;
    generateCase?: typeof generateCase;
  } = {},
): (input: PythonGeneratorInput) => Promise<PreparedCase> {
  const spawn = options.spawn ?? spawnPython;
  const command = options.command ?? 'uv';
  const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;
  const cwd = options.cwd ?? projectRoot();
  const assemble = options.generateCase ?? generateCase;
  return async (input) => {
    const request = {
      ...input,
      excludedTargetIds: [...input.excludedTargetIds],
    };
    const { stdout, stderr } = await spawn({
      command,
      args: ['run', '--project', 'agent', 'python', '-m', 'whereabouts_agent'],
      cwd,
      input: request,
      timeoutMs,
    });
    if (stderr.trim()) console.info(`[python-generator] ${stderr.trim()}`);
    let output: PythonGeneratorOutput;
    try {
      output = JSON.parse(stdout) as PythonGeneratorOutput;
    } catch (error) {
      throw new Error(
        `Python generator returned invalid JSON: ${String(error)}`,
      );
    }
    if (
      !output ||
      !output.theme ||
      !output.board ||
      !output.draft ||
      !output.review
    )
      throw new Error(
        'Python generator response must include theme, board, draft, and review',
      );
    return assemble({ ...input, ...output });
  };
}
