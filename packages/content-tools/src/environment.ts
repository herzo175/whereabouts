import { loadEnvFile } from 'node:process';

type EnvLoader = (path?: string | URL | Buffer) => void;

export function loadLocalEnvironment(load: EnvLoader = loadEnvFile): void {
  try {
    load(new URL('../../../.env', import.meta.url));
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    )
      return;
    throw error;
  }
}
