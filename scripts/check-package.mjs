import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, chmod, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repository, releasePlatforms, nativeSourceDigest, sha256 } from './native-artifact.mjs';

const sourceDigest = await nativeSourceDigest();
for (const platform of releasePlatforms) {
  const directory = join(repository, 'dist/native', platform);
  const binaryPath = join(directory, 'pi-guard-execpolicy');
  let binary, artifact;
  try {
    [binary, artifact] = await Promise.all([
      readFile(binaryPath),
      readFile(join(directory, 'artifact.json'), 'utf8').then(JSON.parse),
    ]);
  } catch (cause) {
    throw new Error(`${platform} 배포 실행 파일이 없습니다. docs/publishing.md의 플랫폼 빌드 절차를 따라 주세요.`, {cause});
  }
  assert.equal(artifact.platform, platform, `${platform}: 플랫폼 기록 불일치`);
  assert.equal(artifact.sourceDigest, sourceDigest, `${platform}: 현재 소스로 다시 빌드해야 합니다`);
  assert.equal(artifact.sha256, sha256(binary), `${platform}: 실행 파일 해시 불일치`);
  const isCorrectBinary = platform === 'darwin-arm64'
    ? binary.length >= 8 && binary.readUInt32LE(0) === 0xfeedfacf && binary.readUInt32LE(4) === 0x0100000c
    : binary.length >= 20 && binary.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) && binary[4] === 2 && binary[5] === 1 && binary.readUInt16LE(18) === 62;
  assert.ok(isCorrectBinary, `${platform}: 실행 파일 형식 또는 CPU 불일치`);
  // GitHub artifact downloads do not retain executable permissions.
  await chmod(binaryPath, 0o755);
  await access(binaryPath, constants.X_OK);
}

const packed = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: repository, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, shell: process.platform === 'win32',
});
if (packed.error) throw packed.error;
assert.equal(packed.status, 0, packed.stderr);
const [packageInfo] = JSON.parse(packed.stdout);
const files = new Set(packageInfo.files.map(file => file.path));
for (const path of [
  'dist/index.js', 'dist/startup.js', 'dist/cli.js', 'dist/tools/executor.js', 'dist/approval-commands.js',
  'LICENSE', 'NOTICE', 'native/execpolicy/LICENSE', 'native/execpolicy/NOTICE',
  'docs/usage.md', 'docs/publishing.md',
  ...releasePlatforms.flatMap(platform => [`dist/native/${platform}/pi-guard-execpolicy`, `dist/native/${platform}/artifact.json`]),
]) assert.ok(files.has(path), `배포 파일 누락: ${path}`);
assert.ok(![...files].some(path => path.startsWith('dist/sandbox/') || path.startsWith('node_modules/')), '제거한 샌드박스 또는 런타임 의존성이 포함됐습니다');
assert.ok(![...files].some(path => /^(src|test|tmp|vendor)\//.test(path) || /^node_modules\/@earendil-works\//.test(path)), '개발 파일 또는 Pi 호스트가 배포 패키지에 포함됐습니다');
const currentPlatform = `${process.platform}-${process.arch}`;
if (releasePlatforms.includes(currentPlatform)) {
  const { evaluateRules } = await import(pathToFileURL(join(repository, 'dist/policy/rules.js')).href);
  await evaluateRules([]);
}
console.log(`배포 준비 확인: ${releasePlatforms.join(', ')}; 승인 검토 확장과 규칙 엔진 포함`);
