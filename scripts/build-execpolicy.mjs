import { spawnSync } from 'node:child_process';
import { mkdir, copyFile, chmod } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = resolve(root, 'tmp', 'execpolicy-target');
const suffix = process.platform === 'win32' ? '.exe' : '';
const result = spawnSync('cargo', ['build', '--locked', '--release', '--manifest-path', join(root, 'native/execpolicy/Cargo.toml'), '--target-dir', target], {cwd: root, stdio: 'inherit'});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
await mkdir(join(root, 'dist/native'), {recursive: true});
const destination = join(root, `dist/native/pi-guard-execpolicy${suffix}`);
await copyFile(join(target, `release/pi-guard-execpolicy${suffix}`), destination);
await chmod(destination, 0o755);
