import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import { isWithin } from '../policy/paths.js';

// Internal metadata-only child. The parent supplies canonical, disjoint roots
// and owns cancellation, the time budget and the bounded output buffer.
const {roots,denied}: {roots:string[];denied:string[]} = JSON.parse(readFileSync(0,'utf8'));
const unlistable: string[] = [];
for (const root of roots) {
  const exclusions = denied.filter(path => isWithin(path,root));
  const pending = [root];
  while (pending.length) {
    const path = pending.pop()!;
    if (exclusions.some(root => path === root || path.startsWith(root + sep))) continue;
    try {
      for (const entry of readdirSync(path,{withFileTypes:true})) {
        if (entry.isDirectory()) pending.push(join(path,entry.name));
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') continue;
      if (code !== 'EACCES' && code !== 'EPERM') throw error;
      unlistable.push(path);
    }
  }
}
process.stdout.write(JSON.stringify(unlistable));
