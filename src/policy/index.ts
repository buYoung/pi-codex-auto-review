import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createProfile, decision, digest, immutable, GuardError, EMPTY_DELTA, TOOL_NAMES, type GuardAction, type PermissionDelta, type PermissionProfile, type PolicyDecision } from '../contracts.js';
import { canonicalPath, isWithin, resolveToolPath } from './paths.js';
import { analyzeShell, matchesPrefix, INTERPRETERS } from './shell.js';
export { canonicalPath, isWithin, analyzeShell, matchesPrefix, resolveToolPath };

export interface CommandRule { readonly prefix: readonly string[]; readonly decision: 'allow' | 'ask' | 'deny' }
export interface GuardSettings {
  readonly mode: 'read-only' | 'workspace-write';
  readonly commandRules: readonly CommandRule[];
  readonly allowedDomains: readonly string[];
  readonly reviewTimeoutMs: number;
  readonly approvalTimeoutMs: number;
  readonly executionTimeoutSeconds: number;
  readonly trustedTools: readonly string[];
}
export const DEFAULT_SETTINGS: GuardSettings = immutable({ mode: 'workspace-write', commandRules: [], allowedDomains: [], reviewTimeoutMs: 20_000, approvalTimeoutMs: 60_000, executionTimeoutSeconds: 120, trustedTools: [] });
export function validateSettings(value: unknown): GuardSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GuardError('INVALID_SETTINGS', 'Settings must be an object');
  const raw = value as Record<string, unknown>;
  for (const key of Object.keys(raw)) if (!Object.hasOwn(DEFAULT_SETTINGS, key)) throw new GuardError('INVALID_SETTINGS', `Unknown setting: ${key}`);
  const settings = { ...DEFAULT_SETTINGS, ...raw } as GuardSettings;
  if (!['read-only', 'workspace-write'].includes(settings.mode)) throw new GuardError('INVALID_SETTINGS', 'Unknown mode');
  for (const key of ['reviewTimeoutMs', 'approvalTimeoutMs', 'executionTimeoutSeconds'] as const) if (!Number.isFinite(settings[key]) || settings[key] <= 0) throw new GuardError('INVALID_SETTINGS', `Invalid ${key}`);
  if (!Array.isArray(settings.allowedDomains) || settings.allowedDomains.some(x => typeof x !== 'string' || !/^(\*\.)?[a-z0-9][a-z0-9.-]*$/i.test(x))) throw new GuardError('INVALID_SETTINGS', 'Invalid domains');
  if (!Array.isArray(settings.trustedTools) || settings.trustedTools.some(x => typeof x !== 'string' || !x)) throw new GuardError('INVALID_SETTINGS', 'Invalid trusted tools');
  if (!Array.isArray(settings.commandRules)) throw new GuardError('INVALID_SETTINGS', 'Invalid command rules');
  for (const rule of settings.commandRules) {
    if (!rule || !['allow', 'ask', 'deny'].includes(rule.decision) || !Array.isArray(rule.prefix) || !rule.prefix.length || rule.prefix.some((x: unknown) => typeof x !== 'string' || !x || /[\0\n]/.test(x))) throw new GuardError('INVALID_SETTINGS', 'Invalid command rule');
    if (Object.keys(rule).some(k => !['prefix', 'decision'].includes(k))) throw new GuardError('INVALID_SETTINGS', 'Unknown command rule field');
  }
  return immutable(JSON.parse(JSON.stringify(settings)));
}
export async function loadSettings(path: string): Promise<GuardSettings> {
  try { return validateSettings(JSON.parse(await readFile(path, 'utf8'))); }
  catch (error) { throw new GuardError('INVALID_SETTINGS', 'Permission settings could not be loaded', { cause: error }); }
}
export async function defaultProfile(cwd: string, settings: GuardSettings, controlPaths: readonly string[] = []): Promise<PermissionProfile> {
  const workspace = await canonicalPath(cwd, cwd), home = homedir();
  const hardRead = [join(home, '.ssh'), join(home, '.aws'), join(home, '.codex'), join(home, '.pi', 'agent'), ...controlPaths];
  const hardWrite = [...hardRead, join(workspace, '.git'), join(workspace, '.pi', 'guard'), fileURLToPath(new URL('../', import.meta.url))];
  return createProfile({ mode: settings.mode, readRoots: [workspace], writeRoots: settings.mode === 'workspace-write' ? [workspace] : [], denyRead: await Promise.all(hardRead.map(p => canonicalPath(p, cwd))), denyWrite: await Promise.all(hardWrite.map(p => canonicalPath(p, cwd))), allowedDomains: [...settings.allowedDomains], deniedDomains: [] });
}
export class PolicyEngine {
  readonly revision: string;
  constructor(readonly settings: GuardSettings, readonly profile: PermissionProfile) {
    this.revision = digest({ settings, profile });
  }
  async evaluate(action: GuardAction): Promise<PolicyDecision> {
    if (action.policyRevision !== this.revision || action.permissionDigest !== digest(this.profile)) return decision(action, 'deny', 'Stale policy or permission profile', EMPTY_DELTA, true);
    if (!TOOL_NAMES.includes(action.tool as never)) return decision(action, 'ask', 'Unknown tool: annotations do not establish permission');
    if (action.tool === 'bash') return this.shellDecision(action);
    const input = action.args.path ?? action.cwd;
    if (typeof input !== 'string') return decision(action, 'deny', 'Invalid path input', EMPTY_DELTA, true);
    const target = await canonicalPath(await resolveToolPath(input,action.cwd,action.tool==='read'), action.cwd);
    const profile = await this.resolvedProfile(action.cwd);
    const isWrite = action.tool === 'write' || action.tool === 'edit';
    if (profile.denyRead.some(p => isWithin(target, p)) || (isWrite && profile.denyWrite.some(p => isWithin(target, p)))) return decision(action, 'deny', 'Protected path', EMPTY_DELTA, true);
    const canRead = profile.readRoots.some(p => isWithin(target, p));
    const canWrite = !isWrite || profile.writeRoots.some(p => isWithin(target, p));
    if (canRead && canWrite) return decision(action, 'allow', 'Within current filesystem permissions');
    return decision(action, 'ask', 'Filesystem permission required', { readPaths: canRead ? [] : [target], writePaths: canWrite ? [] : [target], domains: [] });
  }
  private async shellDecision(action: GuardAction): Promise<PolicyDecision> {
    const profile = await this.resolvedProfile(action.cwd);
    const command = action.args.command;
    if (typeof command !== 'string') return decision(action, 'deny', 'Invalid command input', EMPTY_DELTA, true);
    const analysis = analyzeShell(command);
    let shouldAsk = !analysis.isSupported;
    const delta: { readPaths: string[]; writePaths: string[]; domains: string[] } = { readPaths: [], writePaths: [], domains: [] };
    for (const item of analysis.commands) {
      const executable = basename(item.argv[0]!);
      const matches = this.settings.commandRules.filter(rule => matchesPrefix(item.argv, rule.prefix));
      if (matches.some(rule => rule.decision === 'deny')) return decision(action, 'deny', 'Command denied by trusted rule', EMPTY_DELTA, true);
      if (matches.some(rule => rule.decision === 'ask')) shouldAsk = true;
      const isInterpreter = INTERPRETERS.has(executable);
      if (isInterpreter) shouldAsk = true;
      const isSafeRead = ['pwd', 'echo', 'printf', 'ls', 'cat', 'head', 'tail', 'wc', 'rg', 'grep', 'find', 'stat', 'true', 'false'].includes(executable);
      // Every literal operand is checked; the OS independently covers expansion and symlink races.
      const operands = [...item.reads, ...item.writes, ...item.argv.slice(1).filter(arg => !arg.startsWith('-') && (arg.includes('/') || arg.startsWith('.')))];
      for (const operand of operands) {
        const target = await canonicalPath(operand, action.cwd);
        if (profile.denyRead.some(p => isWithin(target, p)) || profile.denyWrite.some(p => isWithin(target, p))) return decision(action, 'deny', 'Command references a protected path', EMPTY_DELTA, true);
        if(isSafeRead && !['echo','printf','true','false','pwd'].includes(executable) && !profile.readRoots.some(root=>isWithin(target,root))) {shouldAsk=true;delta.readPaths.push(target);}
      }
      for (const path of item.writes) {
        const target = await canonicalPath(path, action.cwd);
        if (!profile.writeRoots.some(root => isWithin(target, root))) { shouldAsk = true; delta.writePaths.push(target); }
      }
      for (const path of item.reads) {
        const target = await canonicalPath(path, action.cwd);
        if (!profile.readRoots.some(root => isWithin(target, root))) { shouldAsk = true; delta.readPaths.push(target); }
      }
      if (['curl', 'wget'].includes(executable)) {
        const urls = item.argv.slice(1).filter(arg => /^https?:\/\//.test(arg));
        for (const text of urls) {
          const domain = new URL(text).hostname.toLowerCase();
          if (this.profile.deniedDomains.includes(domain)) return decision(action, 'deny', 'Network domain denied', EMPTY_DELTA, true);
          if (!this.profile.allowedDomains.includes(domain)) delta.domains.push(domain);
        }
        shouldAsk = true;
      }
      const canUseRule = analysis.isSupported && !isInterpreter && matches.some(rule => rule.decision === 'allow');
      const isSafeGit = executable === 'git' && ['status', 'diff', 'log', 'show', 'ls-files'].includes(item.argv[1] ?? '') && !item.argv.some(arg => arg.startsWith('--output') || arg.startsWith('--ext-diff'));
      if (!canUseRule && !isSafeRead && !isSafeGit) shouldAsk = true;
      if (item.writes.length && this.profile.mode === 'read-only') shouldAsk = true;
    }
    return decision(action, shouldAsk ? 'ask' : 'allow', shouldAsk ? (analysis.reason ?? 'Command requires review') : 'Literal command within current permissions', { readPaths: [...new Set(delta.readPaths)], writePaths: [...new Set(delta.writePaths)], domains: [...new Set(delta.domains)] });
  }
  private async resolvedProfile(cwd: string): Promise<PermissionProfile> {
    const result = { ...this.profile };
    for (const key of ['readRoots', 'writeRoots', 'denyRead', 'denyWrite'] as const) result[key] = await Promise.all(this.profile[key].map(path => canonicalPath(path, cwd)));
    return result;
  }
}
