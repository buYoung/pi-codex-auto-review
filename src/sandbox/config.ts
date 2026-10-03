import { realpath } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SandboxRuntimeConfig } from '@anthropic-ai/sandbox-runtime';
import { GuardError, createProfile, type PermissionDelta, type PermissionProfile, type ExecutionAuthority } from '../contracts.js';
import { canonicalPath, isWithin } from '../policy/paths.js';
import { matchesDomain } from '../policy/domains.js';
import { linuxReadPaths } from './linux-read-paths.js';
import { runtimeWritePaths } from './runtime-write-paths.js';
import { seccompRuntime } from './seccomp.js';

export function shellQuote(text: string): string { return `'${text.replace(/'/g, "'\\''")}'`; }
const AMBIENT_ENV = new Set(['PATH', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', 'TERM']);
const FORBIDDEN_ENV = /(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|AUTH|^AWS_|^AZURE_|^GOOGLE_|^OPENAI_|^ANTHROPIC_|^CODEX_|^SSH_|^GIT_CONFIG|^NODE_|^BASH_ENV$|^ENV$|^DYLD_|^LD_|^JAVA_TOOL_OPTIONS$|^JDK_JAVA_OPTIONS$|^PYTHONPATH$|^PYTHONSTARTUP$|^RUBYOPT$|^PERL5OPT$|PROXY|^NO_PROXY$)/i;
export function workloadEnvironment(caller: NodeJS.ProcessEnv = {}, ambient: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(ambient)) if (AMBIENT_ENV.has(key) && value !== undefined) env[key] = value;
  for (const [key, value] of Object.entries(caller)) {
    if (!FORBIDDEN_ENV.test(key) && !['HOME', 'TMPDIR', 'TMP', 'TEMP', 'NODE_CHANNEL_FD', 'NODE_CHANNEL_SERIALIZATION_MODE', 'PI_GUARD_KERNEL_ARCH'].includes(key) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && typeof value === 'string' && !value.includes('\0')) env[key] = value;
  }
  return env;
}
export async function nativeConfig(profile: PermissionProfile, delta: PermissionDelta, cwd: string, authority?: ExecutionAuthority): Promise<SandboxRuntimeConfig> {
  createProfile(profile);
  for (const key of ['readPaths', 'writePaths', 'domains'] as const) if (!Array.isArray(delta[key]) || delta[key].some(x => typeof x !== 'string')) throw new GuardError('INVALID_DELTA', 'Invalid permission delta');
  const reads = await Promise.all(delta.readPaths.map(path => canonicalPath(path, cwd)));
  const writes = await Promise.all(delta.writePaths.map(path => canonicalPath(path, cwd)));
  if (reads.some(path => profile.denyRead.some(root => isWithin(path, root))) || writes.some(path => [...profile.denyRead, ...profile.denyWrite].some(root => isWithin(path, root)))) throw new GuardError('HARD_DENY', 'Permission delta targets a protected path');
  if (delta.domains.some(domain => !/^[a-z0-9][a-z0-9.-]*$/i.test(domain) || profile.deniedDomains.some(pattern => matchesDomain(domain, pattern)))) throw new GuardError('HARD_DENY', 'Invalid or denied network domain');
  const isCommandAuthority = authority?.kind === 'command-rule' || authority?.kind === 'reviewed-command';
  const baseProtected = await Promise.all((profile.readOnlyPaths ?? []).map(path => canonicalPath(path, cwd)));
  const lifted = baseProtected.filter(root => writes.some(path => isWithin(path, root)));
  // Removing a base metadata deny must not expose its siblings through the original workspace root.
  const writeRoots = isCommandAuthority ? ['/'] : lifted.length ? writes : [...profile.writeRoots, ...writes];
  const unapprovedDefaults = (await runtimeWritePaths(cwd)).filter(root => !writeRoots.some(path => isWithin(root, path)));
  if (unapprovedDefaults.some(root => writeRoots.some(path => isWithin(path, root)))) throw new GuardError('NATIVE_SCOPE_UNSUPPORTED', 'A nested runtime default write path requires its enclosing directory in the reviewed native scope');
  const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
  const nodeRoot = resolve(dirname(await realpath(process.execPath)), '..');
  const dependencyRoots: string[] = [];
  for (const name of ['@earendil-works/pi-coding-agent', '@anthropic-ai/sandbox-runtime']) {
    let current = dirname(await realpath(fileURLToPath(import.meta.resolve(name))));
    let root = current;
    while (dirname(current) !== current) {
      if (basename(current) === 'node_modules' || basename(current) === '.pnpm') root = current;
      current = dirname(current);
    }
    dependencyRoots.push(root);
  }
  const systemRead = ['/usr', '/bin', '/sbin', '/System', '/Library', '/opt/homebrew', '/private/etc', '/etc', '/dev', '/proc', '/sys', nodeRoot, packageRoot, ...dependencyRoots];
  const seccomp = seccompRuntime();
  return {
    ...(seccomp ? {seccomp: {applyPath: seccomp.applyPath}} : {}),
    filesystem: {
      // All user data starts unreadable; runtime/assets and the admitted roots are carve-outs.
      denyRead: ['/', ...profile.denyRead],
      allowRead: await linuxReadPaths([...systemRead, ...(isCommandAuthority ? ['/'] : profile.readRoots), ...reads, ...writes], writeRoots),
      allowWrite: writeRoots,
      denyWrite: [...profile.denyWrite, ...profile.denyRead, ...unapprovedDefaults, ...(isCommandAuthority ? [] : baseProtected.filter(root => !lifted.includes(root))), ...dependencyRoots, resolve(packageRoot, 'dist'), resolve(packageRoot, 'node_modules'), resolve(packageRoot, 'package.json'), resolve(packageRoot, 'package-lock.json')],
      allowGitConfig: isCommandAuthority || writes.some(path => /[/\\]\.git(?:[/\\]config)?$/.test(path)),
    },
    network: { allowedDomains: isCommandAuthority ? ['*'] : [...profile.allowedDomains, ...delta.domains], deniedDomains: [...profile.deniedDomains], strictAllowlist: true, allowAllUnixSockets: false, allowLocalBinding: false },
    credentials: { files: profile.denyRead.map(path => ({ path, mode: 'deny' as const })) },
    enableWeakerNestedSandbox: false,
    enableWeakerNetworkIsolation: false,
    allowAppleEvents: false,
  };
}
