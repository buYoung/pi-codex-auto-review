import { run } from 'node:test';
import { access, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { suites } from './suites.mjs';
import { validateEvidence } from '../dist/reports.js';
import { createRun, writeImmutable } from './evidence-store.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function sourceDigest() {
  const hash = createHash('sha256');
  async function add(dir) {
    for (const item of (await readdir(join(root, dir), { withFileTypes: true })).sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const path = `${dir}/${item.name}`;
      if (item.isDirectory()) await add(path);
      else { hash.update(path); hash.update(await readFile(join(root, path))); }
    }
  }
  for (const dir of ['src', 'test', 'scripts', 'vendor', 'native', '.github']) await add(dir);
  for (const path of ['package.json', 'package-lock.json', 'tsconfig.json', 'README.md']) hash.update(await readFile(join(root, path)));
  return hash.digest('hex');
}
export async function contractDigest() {
  return createHash('sha256').update(await readFile(join(root, 'src/contracts.ts'))).update(await readFile(join(root, 'src/reports.ts'))).digest('hex');
}
export async function runtimeVersions() {
  const versions = { node: process.version };
  for (const name of ['@earendil-works/pi-coding-agent', '@earendil-works/pi-ai']) {
    if (name === '@earendil-works/pi-ai') {
      let dir = fileURLToPath(new URL('.', import.meta.resolve('@earendil-works/pi-coding-agent')));
      for (let i = 0; i < 8; i++) {
        try { const pkg = JSON.parse(await readFile(join(dir, 'node_modules', name, 'package.json'), 'utf8')); versions[name] = pkg.version; break; } catch {}
        dir = resolve(dir, '..');
      }
      if (!versions[name]) throw new Error('Host Pi AI package version could not be resolved');
      continue;
    }
    const entry = import.meta.resolve(name);
    let dir = fileURLToPath(new URL('.', entry));
    for (let i = 0; i < 7; i++) {
      try { const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')); if (pkg.name === name) { versions[name] = pkg.version; break; } } catch {}
      dir = resolve(dir, '..');
    }
  }
  return versions;
}
export async function runSuite(name, selectedRun) {
  const suite = suites[name];
  if (!suite) throw new Error(`Unknown suite: ${name}`);
  const source = await sourceDigest(), contract = await contractDigest();
  const currentRun = selectedRun ?? await createRun({ sourceDigest: source, contractDigest: contract });
  const startedAt = new Date().toISOString();
  for (const file of suite.files) await access(join(root, file));
  const tests = [], blockedReasons = [], nativeControls=[];
  const runEnvironment = `data:text/javascript,${encodeURIComponent(`process.env.PI_GUARD_RUN_DIR=${JSON.stringify(currentRun.directory)};`)}`;
  const runner = run({ files: suite.files.map(file => join(root, file)), execArgv:['--import',runEnvironment,'--import',new URL('../test/harness/environment.mjs',import.meta.url).href], concurrency: 1, timeout: 120_000 });
  for await (const event of runner) {
    const { data, type } = event;
    if(type==='test:diagnostic' && data.message.startsWith('NATIVE_OBSERVATION:'))nativeControls.push(JSON.parse(data.message.slice('NATIVE_OBSERVATION:'.length)));
    if (type === 'test:stdout' || type === 'test:stderr') process.stdout.write(data.message);
    if (type === 'test:pass' || type === 'test:fail') {
      const error = data.details?.error;
      const isBlocked = String(error?.cause?.message ?? error?.message).includes('ENVIRONMENT_BLOCKED');
      const status = data.skip || data.todo ? 'not-run' : type === 'test:pass' ? 'pass' : isBlocked ? 'environment-blocked' : 'fail';
      tests.push({ name: data.name, status, ...(data.skip || data.todo ? { isSkipped: true } : {}) });
      process.stdout.write(`${status.toUpperCase()} ${data.name}\n`);
      if (error) process.stdout.write(`${String(error.stack ?? error)}\n${String(error.cause?.stack ?? '')}\n`);
      if (isBlocked) blockedReasons.push(String(error.cause?.message ?? error.message));
    }
  }
  const isSourceStable = source === await sourceDigest() && contract === await contractDigest();
  const status = !isSourceStable ? 'fail' : tests.length && tests.every(t => t.status === 'pass') ? 'pass' : tests.some(t=>t.status==='fail') ? 'fail' : blockedReasons.length ? 'environment-blocked' : 'fail';
  const evidence = {
    schemaVersion: 2, runId: currentRun.runId, artifactPath: `${currentRun.artifactPath}/${name}.json`, startedAt,
    ...(currentRun.imageDigest ? {imageDigest:currentRun.imageDigest} : {}),
    ...(currentRun.pluginArtifactDigest ? {pluginArtifactDigest:currentRun.pluginArtifactDigest} : {}),
    ...(currentRun.provider ? {provider:currentRun.provider} : {}),
    provenance: 'executed', suite: name, status, command: `npm run test:${name}`, testFiles: suite.files,
    coveredBehavior: suite.behavior.filter(b => tests.some(t => t.status === 'pass' && t.name.includes(`[${b}]`))),
    tests, platform: `${process.platform}-${process.arch}`, sourceDigest: source, contractDigest: contract,
    runtimeVersions: await runtimeVersions(), evidenceKind: suite.kind, ...(name==='native'?{nativeControls}:{}), blockedReasons, recordedAt: new Date().toISOString(),
  };
  if (!isSourceStable) evidence.blockedReasons.push('Source changed during execution; rerun this suite against a stable checkout');
  await writeImmutable(join(currentRun.directory, `${name}.json`), evidence);
  console.log(`Evidence: ${evidence.artifactPath}`);
  validateEvidence(evidence, suite.behavior, { sourceDigest: source, contractDigest: contract, platform: currentRun.platform, requireRun: true });
  if (status !== 'pass') process.exitCode = 1;
  return evidence;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await runSuite(process.argv[2]); } catch (error) { console.error(error); process.exitCode = 1; }
}
