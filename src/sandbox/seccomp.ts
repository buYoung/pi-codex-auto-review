import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GuardError } from '../contracts.js';

/** Trusted launcher metadata; never sourced from a tool's caller environment. */
export function seccompRuntime() {
  if (process.platform !== 'linux') return undefined;
  const architecture = process.env.PI_GUARD_KERNEL_ARCH ?? process.arch;
  if (architecture !== 'x64' && architecture !== 'arm64') throw new GuardError('ENVIRONMENT_BLOCKED', 'ENVIRONMENT_BLOCKED: unsupported kernel architecture for native seccomp');
  // The process can be emulated while seccomp is enforced by a different-ISA
  // kernel. Use that kernel's pinned native helper, retaining the same filter.
  const entry = fileURLToPath(import.meta.resolve('@anthropic-ai/sandbox-runtime'));
  return { architecture, applyPath: resolve(dirname(entry), '../vendor/seccomp', architecture, 'apply-seccomp') };
}
