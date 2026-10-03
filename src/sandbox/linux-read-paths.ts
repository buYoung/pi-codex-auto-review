import { readdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { GuardError } from '../contracts.js';
import { isWithin } from '../policy/paths.js';

/**
 * SRT 0.0.78 restores write mounts before read mounts below a denyRead tmpfs.
 * An enclosing read mount would therefore hide a narrower write mount.
 * Partition only those enclosing directories, retaining readable siblings
 * without making any additional path writable or following an escaping link.
 */
export async function linuxReadPaths(reads: readonly string[], writes: readonly string[]): Promise<string[]> {
  if (process.platform !== 'linux' || reads.includes('/')) return [...reads];
  const result = new Set<string>();
  let entries = 0;
  async function visit(path: string, root: string): Promise<void> {
    // SRT skips a redundant read mount when a write mount already covers it,
    // but still needs the read declaration to keep deny-write placeholders readable.
    if (writes.some(write => isWithin(path, write))) { result.add(path); return; }
    if (!writes.some(write => write !== path && isWithin(write, path))) { result.add(path); return; }
    const children = await readdir(path, {withFileTypes:true});
    entries += children.length;
    if (entries > 10000) throw new GuardError('READ_SCOPE_TOO_LARGE', 'Cannot safely partition this read scope for the requested Linux write grant');
    for (const child of children) {
      const childPath = join(path, child.name);
      if (child.isSymbolicLink()) {
        let target: string;
        try { target = await realpath(childPath); } catch { continue; }
        if (!isWithin(target, root)) continue;
      }
      await visit(childPath, root);
    }
  }
  for (const path of new Set(reads)) await visit(path, path);
  return [...result];
}
