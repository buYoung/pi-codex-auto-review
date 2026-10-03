import { getDefaultWritePaths } from '@anthropic-ai/sandbox-runtime';
import { canonicalPath } from '../policy/paths.js';

/** File destinations implicitly writable in the pinned runtime, excluding device I/O. */
export async function runtimeWritePaths(cwd: string): Promise<string[]> {
  const paths = getDefaultWritePaths().filter(path => !path.startsWith('/dev/'));
  return [...new Set(await Promise.all(paths.map(path => canonicalPath(path, cwd))))];
}
