import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { GuardError, immutable } from '../contracts.js';
import { analyzeShell } from './shell.js';

export interface PrefixRule {
  readonly pattern: readonly (string | readonly string[])[];
  readonly decision: 'allow' | 'prompt' | 'forbidden';
  readonly justification?: string;
}
export function matchesRule(argv: readonly string[], rule: PrefixRule): boolean {
  return rule.pattern.length <= argv.length && rule.pattern.every((part, index) => typeof part === 'string' ? part === argv[index] : part.includes(argv[index]!));
}
export const CODEX_EXECPOLICY_REVISION = 'a956835d020762cb2b570053af06f643a11c0ecc';
export interface RuleSource { readonly name: string; readonly source: string }
export interface RuleMatch { readonly decision: PrefixRule['decision']; readonly justification?: string | null; readonly matchedPrefix: readonly string[]; readonly resolvedProgram?: string | null }
export interface CompiledRules {
  readonly revision: string;
  readonly rules: readonly PrefixRule[];
  readonly matches: readonly (readonly RuleMatch[])[];
  readonly allowedDomains: readonly string[];
  readonly deniedDomains: readonly string[];
  readonly networkRules: readonly {host: string; protocol: string; decision: PrefixRule['decision']; justification?: string | null}[];
  readonly hostExecutables: Readonly<Record<string, readonly string[]>>;
}
const MAX_BYTES = 8 * 1024 * 1024;
const helper = fileURLToPath(new URL(`../native/${process.platform}-${process.arch}/pi-guard-execpolicy${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url));
const helperEnvironment = process.platform === 'win32' ? {SystemRoot: process.env.SystemRoot} : {};
const execute = promisify(execFile);
function request(sources: readonly RuleSource[], commands: readonly (readonly string[])[]): string {
  const input = JSON.stringify({sources, commands});
  if (Buffer.byteLength(input) > MAX_BYTES) throw new GuardError('INVALID_RULES', 'Rule request exceeds the supported size');
  return input;
}
function decode(stdout: string): CompiledRules {
  const result = JSON.parse(stdout) as CompiledRules;
  if (result.revision !== CODEX_EXECPOLICY_REVISION || !Array.isArray(result.rules) || !Array.isArray(result.matches) || !Array.isArray(result.allowedDomains) || !Array.isArray(result.deniedDomains)) throw new GuardError('INVALID_RULES', 'Unexpected Codex rule engine response');
  return immutable(result);
}
/** Compatibility reader; parsing and example validation run in Codex's actual Starlark engine. */
export function parseRules(source: string): readonly PrefixRule[] {
  const result = spawnSync(helper, [], {input: request([{name: 'inline.rules', source}], []), encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL', maxBuffer: MAX_BYTES, env: helperEnvironment});
  if (result.error || result.status !== 0) throw new GuardError('INVALID_RULES', `Codex rule engine failed: ${result.stderr?.slice(0, 4000) || result.error?.message || result.signal}`, {cause: result.error});
  return decode(result.stdout).rules;
}
export async function evaluateRules(sources: readonly RuleSource[], commands: readonly (readonly string[])[] = [], signal?: AbortSignal): Promise<CompiledRules> {
  const input = request(sources, commands);
  try {
    const running = execute(helper, [], {encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL', maxBuffer: MAX_BYTES, env: helperEnvironment, signal});
    running.child.stdin?.end(input);
    // A failed spawn can close stdin before its queued input has been delivered.
    running.child.stdin?.on('error', () => {});
    return decode((await running).stdout);
  } catch (error) { throw new GuardError('INVALID_RULES', 'Codex rule engine could not evaluate the trusted rules', {cause: error}); }
}
/** Advanced scripts are matched as the real outer shell invocation, never as a safe inner prefix. */
export function ruleCommands(command: string, shellPath = '/bin/bash', depth = 0): readonly (readonly string[])[] {
  const parsed = analyzeShell(command);
  if (!parsed.isSupported || parsed.commands.some(item => item.reads.length || item.writes.length) || depth > 4) return [[shellPath, '-c', command]];
  return parsed.commands.flatMap(item => {
    if (['bash', 'sh', 'zsh', 'dash'].includes(basename(item.argv[0]!)) && item.argv.length === 3 && ['-c', '-lc'].includes(item.argv[1]!)) {
      const inner = analyzeShell(item.argv[2]!);
      if (inner.isSupported && inner.commands.every(part => !part.reads.length && !part.writes.length)) return ruleCommands(item.argv[2]!, item.argv[0]!, depth + 1);
    }
    return [item.argv];
  });
}
