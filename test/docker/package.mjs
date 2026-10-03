import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { sourceDigest, contractDigest } from '../../scripts/run-tests.mjs';

const exec = promisify(execFile), artifacts = '/opt/guard-artifacts', consumer = '/opt/installed';
await mkdir(artifacts, {recursive: true}); await mkdir(consumer, {recursive: true});
const [packed] = JSON.parse((await exec('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', artifacts])).stdout);
const tarball = join(artifacts, packed.filename);
await exec('tar', ['-xzf', tarball, '-C', consumer]);
await mkdir(join(consumer, 'package/node_modules'), {recursive: true});
await symlink('/opt/pi-guard/node_modules/@earendil-works', join(consumer, 'package/node_modules/@earendil-works'));
const packages = {};
for (const name of ['@earendil-works/pi-coding-agent','pi-ollama-cloud']) {
  const pkg = JSON.parse(await readFile(join('node_modules',name,'package.json'),'utf8')); packages[name] = pkg.version;
}
await writeFile(join(artifacts,'identity.json'), JSON.stringify({
  sourceDigest:await sourceDigest(), contractDigest:await contractDigest(), packages,
  plugin: {name:packed.name,version:packed.version,sha256:createHash('sha256').update(await readFile(tarball)).digest('hex'),integrity:packed.integrity},
  installation:'npm ci with locked provider; npm pack artifact extracted into an isolated SDK consumer with explicitly linked host peers',
},null,2)+'\n');
