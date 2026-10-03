import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repository = fileURLToPath(new URL('../', import.meta.url));
export const releasePlatforms = ['darwin-arm64', 'linux-x64'];

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export async function nativeSourceDigest() {
  const paths = ['Cargo.toml', 'Cargo.lock', 'src/main.rs'];
  const contents = await Promise.all(paths.map(path => readFile(join(repository, 'native/execpolicy', path))));
  const digest = createHash('sha256');
  for (let i = 0; i < paths.length; i++) digest.update(paths[i]).update('\0').update(contents[i]).update('\0');
  return digest.digest('hex');
}

export async function stageNativeArtifact(binaryPath, sourceDigest = undefined) {
  const platform = `${process.platform}-${process.arch}`;
  const directory = join(repository, 'dist/native', platform);
  await mkdir(directory, {recursive: true});
  const destination = join(directory, `pi-guard-execpolicy${process.platform === 'win32' ? '.exe' : ''}`);
  await copyFile(binaryPath, destination);
  await chmod(destination, 0o755);
  await writeFile(join(directory, 'artifact.json'), JSON.stringify({
    platform, sourceDigest: sourceDigest ?? await nativeSourceDigest(), sha256: sha256(await readFile(destination)),
  }, null, 2) + '\n');
}
