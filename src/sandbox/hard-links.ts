import { access, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SandboxRuntimeConfig } from '@anthropic-ai/sandbox-runtime';
import { GuardError, type PermissionProfile, type PermissionDelta } from '../contracts.js';
import { isWithin } from '../policy/paths.js';

const MAX_SCAN_MS = 30000;
const runScan = promisify(execFile);
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
  const directoryScans = new Map<string, string[]>();
  const opaqueDirectories = async (paths: readonly string[], exclusions: readonly string[]) => {
    const denied = await existingRoots(exclusions);
    const roots = (await existingRoots(paths)).filter(root => root !== parse(root).root && !denied.some(path => isWithin(root,path)));
    if (!roots.length) return [];
    const prune = denied.filter(path => roots.some(root => isWithin(path,root)));
    const key = JSON.stringify([roots.toSorted(),prune.toSorted()]);
    if (directoryScans.has(key)) return directoryScans.get(key)!;
    check();
    // Synchronous directory I/O avoids a promise per directory. Keep it in an
    // owned process so the shared deadline and caller cancellation stay effective.
    const scan = runScan(process.execPath,[fileURLToPath(new URL('./directory-scan.js',import.meta.url))],{encoding:'utf8',maxBuffer:16*1024*1024,timeout:Math.max(1,deadlineMs-Date.now()),killSignal:'SIGKILL',signal,env:{}});
    scan.child.stdin!.on('error',()=>{});
    scan.child.stdin!.end(JSON.stringify({roots,denied:prune}));
    const {stdout} = await scan;
    const unlistable: unknown = JSON.parse(stdout);
    if (!Array.isArray(unlistable) || unlistable.some(path => typeof path !== 'string' || path.includes('\0') || !roots.some(root => isWithin(path,root)))) throw new GuardError('HARD_LINK_SCAN_FAILED','Invalid directory scan output');
    const result: string[] = [];
    for (const path of unlistable as string[]) {
      check();
      const isSearchable = await access(path,constants.X_OK).then(()=>true,error=>{
        if (['EACCES','EPERM'].includes((error as NodeJS.ErrnoException).code??'')) return false;
        throw error;
      });
      // An unlistable but searchable directory can still expose known filenames.
      if (isSearchable) throw new GuardError('HARD_LINK_SCAN_FAILED','A searchable directory could not be inspected safely');
      if (/[?*[\]{}]/.test(path)) throw new GuardError('NATIVE_SCOPE_UNSUPPORTED','An opaque directory cannot be represented safely in the native profile');
      result.push(path);
    }
    directoryScans.set(key,result);
    return result;
  };
  const inspect = async (paths: readonly string[], exclusions: readonly string[] = []) => {
    const roots = await existingRoots(paths), denied = await existingRoots(exclusions);
    // Every name is already in scope when the filesystem root is admitted (or denied).
    if (roots.some(root => root === parse(root).root) && denied.length === 0) return;
    const admitted = roots.filter(path => !denied.some(root => isWithin(path,root)));
    if (!admitted.length) return;
    const prune = denied.filter(path => admitted.some(root => isWithin(path,root)));
    // Read/write passes with the same effective subtree share one qualification.
    const key = JSON.stringify([admitted.toSorted(),prune.toSorted()]);
    if (scanned.has(key)) return scanned.get(key);
    const scan = async () => {
      // Native find performs the metadata traversal without one JS promise/stat per ordinary file.
      // Arguments are passed directly (no shell); NUL framing preserves spaces/newlines in names.
      const escapePattern = (path: string) => path.replace(/[?*\[\]\\]/g, '\\$&');
      const terms = prune.flatMap((path,index) => [...(index ? ['-o'] : []), '-path', escapePattern(path)]);
      const args = [...admitted, ...(terms.length ? ['(',...terms,')','-prune','-o'] : []), '-type','f','-links','+1','-print0'];
      check();
      const {stdout} = await runScan('/usr/bin/find',args,{encoding:'buffer',maxBuffer:16*1024*1024,timeout:Math.max(1,deadlineMs-Date.now()),killSignal:'SIGKILL',signal,env:{}});
      const names: Buffer[] = [];
      for (let start = 0, end = stdout.indexOf(0); end >= 0; start = end + 1, end = stdout.indexOf(0,start)) names.push(stdout.subarray(start,end));
      if (stdout.length && stdout.at(-1) !== 0) throw new GuardError('HARD_LINK_SCAN_FAILED','Incomplete hard-link scan output');
      const links = new Map<string,{count:number; nlink:number; path:Buffer}>();
      for (let start = 0; start < names.length; start += 64) {
        check();
        const batch = names.slice(start,start+64);
        const metadata = await Promise.all(batch.map(path => lstat(path)));
        for (const [index,info] of metadata.entries()) {
          if (!info.isFile() || info.nlink < 2) throw new GuardError('HARD_LINK_CHANGED','Hard-link topology changed during qualification');
          const inode = `${info.dev}:${info.ino}`, prior = links.get(inode);
          if (prior && prior.nlink !== info.nlink) throw new GuardError('HARD_LINK_CHANGED','Hard-link topology changed during qualification');
          links.set(inode,{count:(prior?.count ?? 0)+1,nlink:info.nlink,path:batch[index]!});
        }
      }
      const values = [...links.values()];
      for (let start = 0; start < values.length; start += 64) {
        check();
        const batch = values.slice(start,start+64);
        const metadata = await Promise.all(batch.map(value => lstat(value.path)));
        for (const [index,info] of metadata.entries()) {
          const value = batch[index]!;
          if (value.count !== value.nlink || info.nlink !== value.nlink) throw new GuardError('HARD_LINK_BOUNDARY', 'A pre-existing hard link crosses the admitted filesystem boundary');
        }
      }
    };
    const pending = scan(); scanned.set(key,pending); await pending;
  };
  try {
    // A protected inode with another name outside these denies must never be read.
    await inspect(profile.denyRead);
    const reads = [...profile.readRoots,...delta.readPaths,...delta.writePaths];
    const hasFullRead=!config.filesystem.denyRead.includes('/') || (config.filesystem.allowRead??[]).some(root=>root===parse(root).root);
    const writes = config.filesystem.allowWrite ?? [], writeDenies = config.filesystem.denyWrite ?? [];
    const opaque=[...new Set([...(hasFullRead?[]:await opaqueDirectories(reads,profile.denyRead)),...await opaqueDirectories(writes,writeDenies)])];
    // Keep opaque subtrees inaccessible in the workload, including chmod and ancestor moves.
    // Never silently ignore a failed scan of a protected or searchable directory.
    config.filesystem.denyRead=[...(config.filesystem.denyRead??[]),...opaque];
    config.filesystem.denyWrite=[...writeDenies,...opaque];
    if (!hasFullRead) await inspect(reads,[...profile.denyRead,...opaque]);
    if (writes.length) {
      if ((await existingRoots(writes)).some(root => root === parse(root).root)) await inspect(writeDenies);
      else await inspect(writes,[...writeDenies,...opaque]);
    }
    check();
  } catch (error) {
    if (error instanceof GuardError || signal.aborted) throw error;
    throw new GuardError('HARD_LINK_SCAN_FAILED', 'Hard-link boundaries could not be qualified; no workload was launched', {cause:error});
  }
}
