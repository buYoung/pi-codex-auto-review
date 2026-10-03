import { lstat, realpath } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse } from 'node:path';
import type { SandboxRuntimeConfig } from '@anthropic-ai/sandbox-runtime';
import { GuardError, type PermissionProfile, type PermissionDelta } from '../contracts.js';
import { isWithin } from '../policy/paths.js';

const MAX_SCAN_MS = 30000;
const runFind = promisify(execFile);
const isMissing = (error: unknown) => ['ENOENT','ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '');
async function existingRoots(paths: readonly string[]): Promise<string[]> {
  const values: string[] = [];
  for (const path of paths) {
    try { values.push(await realpath(path)); } catch (error) { if (!isMissing(error)) throw error; }
  }
  return [...new Set(values)].filter((path, _, all) => !all.some(parent => parent !== path && isWithin(path,parent)));
}
/** Path-based OS sandboxes cannot distinguish names of an inode linked before launch. */
export async function assertHardLinkBoundaries(profile: PermissionProfile, delta: PermissionDelta, config: SandboxRuntimeConfig, signal: AbortSignal): Promise<void> {
  const deadlineMs = Date.now() + MAX_SCAN_MS;
  const check = () => {
    signal.throwIfAborted();
    if (Date.now() > deadlineMs) throw new GuardError('HARD_LINK_SCAN_LIMIT', 'The filesystem is too large to qualify hard-link boundaries safely');
  };
  const scanned = new Map<string, Promise<void>>();
  const inspect = async (paths: readonly string[], exclusions: readonly string[] = []) => {
    const roots = await existingRoots(paths), denied = await existingRoots(exclusions);
    // Every name is already in scope when the filesystem root is admitted (or denied).
    if (roots.some(root => root === parse(root).root) && denied.length === 0) return;
    const key = JSON.stringify([roots,denied]);
    if (scanned.has(key)) return scanned.get(key);
    const scan = async () => {
      const admitted = roots.filter(path => !denied.some(root => isWithin(path,root)));
      if (!admitted.length) return;
      // Native find performs the metadata traversal without one JS promise/stat per ordinary file.
      // Arguments are passed directly (no shell); NUL framing preserves spaces/newlines in names.
      const prune = denied.filter(path => admitted.some(root => isWithin(path,root)));
      const escapePattern = (path: string) => path.replace(/[?*\[\]\\]/g, '\\$&');
      const terms = prune.flatMap((path,index) => [...(index ? ['-o'] : []), '-path', escapePattern(path)]);
      const args = [...admitted, ...(terms.length ? ['(',...terms,')','-prune','-o'] : []), '-type','f','-links','+1','-print0'];
      check();
      const {stdout} = await runFind('/usr/bin/find',args,{encoding:'buffer',maxBuffer:16*1024*1024,timeout:Math.max(1,deadlineMs-Date.now()),killSignal:'SIGKILL',signal,env:{}});
      const names: Buffer[] = [];
      for (let start = 0, end = stdout.indexOf(0); end >= 0; start = end + 1, end = stdout.indexOf(0,start)) names.push(stdout.subarray(start,end));
      if (stdout.length && stdout.at(-1) !== 0) throw new GuardError('HARD_LINK_SCAN_FAILED','Incomplete hard-link scan output');
      const links = new Map<string,{count:number; nlink:number; path:Buffer}>();
      for (const path of names) {
        check();
        const info = await lstat(path);
        if (!info.isFile() || info.nlink < 2) throw new GuardError('HARD_LINK_CHANGED','Hard-link topology changed during qualification');
        const inode = `${info.dev}:${info.ino}`, prior = links.get(inode);
        if (prior && prior.nlink !== info.nlink) throw new GuardError('HARD_LINK_CHANGED','Hard-link topology changed during qualification');
        links.set(inode,{count:(prior?.count ?? 0)+1,nlink:info.nlink,path});
      }
      for (const value of links.values()) {
        check();
        const info = await lstat(value.path);
        if (value.count !== value.nlink || info.nlink !== value.nlink) throw new GuardError('HARD_LINK_BOUNDARY', 'A pre-existing hard link crosses the admitted filesystem boundary');
      }
    };
    const pending = scan(); scanned.set(key,pending); await pending;
  };
  try {
    // A protected inode with another name outside these denies must never be read.
    await inspect(profile.denyRead);
    const reads = [...profile.readRoots,...delta.readPaths,...delta.writePaths];
    if (!(config.filesystem.allowRead ?? []).some(root => root === parse(root).root)) await inspect(reads,profile.denyRead);
    const writes = config.filesystem.allowWrite ?? [], writeDenies = config.filesystem.denyWrite ?? [];
    if (writes.length) {
      if ((await existingRoots(writes)).some(root => root === parse(root).root)) await inspect(writeDenies);
      else await inspect(writes,writeDenies);
    }
    check();
  } catch (error) {
    if (error instanceof GuardError || signal.aborted) throw error;
    throw new GuardError('HARD_LINK_SCAN_FAILED', 'Hard-link boundaries could not be qualified; no workload was launched', {cause:error});
  }
}
