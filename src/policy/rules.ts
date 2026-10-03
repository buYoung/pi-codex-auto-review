import { basename } from 'node:path';
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
/** Only literal prefix_rule declarations are accepted; this never evaluates Starlark or JavaScript. */
export function parseRules(source: string): readonly PrefixRule[] {
  if (source.length > 1000000) throw new GuardError('INVALID_RULES', 'Rule file exceeds the supported size');
  let position = 0;
  const fail = (): never => { throw new GuardError('INVALID_RULES', `Unsupported or invalid prefix_rule syntax at offset ${position}`); };
  const skip = () => { for (;;) { const match = /^(?:\s+|#[^\n]*(?:\n|$))/.exec(source.slice(position)); if (!match) break; position += match[0].length; } };
  const take = (token: string) => { skip(); if (!source.startsWith(token, position)) fail(); position += token.length; };
  const identifier = () => { skip(); const match = /^[A-Za-z_][A-Za-z_0-9]*/.exec(source.slice(position)); if (!match) return fail(); position += match[0].length; return match[0]; };
  const string = (): string => {
    skip(); const quote = source[position++]; if (quote !== '"' && quote !== "'") return fail();
    let value = '';
    while (position < source.length) {
      const ch = source[position++];
      if (ch === quote) return value;
      if (ch === '\n' || ch === '\r') return fail();
      if (ch !== '\\') { value += ch; continue; }
      const escaped = source[position++];
      const escapes: Record<string, string> = {n: '\n', r: '\r', t: '\t', '\\': '\\', '"': '"', "'": "'"};
      if (escaped === undefined || !Object.hasOwn(escapes, escaped)) return fail();
      value += escapes[escaped];
    }
    return fail();
  };
  const list = (depth = 0): (string | string[])[] => {
    if (depth > 1) return fail();
    take('['); const values: (string | string[])[] = [];
    for (;;) {
      skip(); if (source[position] === ']') { position++; return values; }
      values.push(source[position] === '[' ? list(depth + 1) as string[] : string());
      skip(); if (source[position] === ']') { position++; return values; }
      take(',');
    }
  };
  const rules: PrefixRule[] = [];
  for (;;) {
    skip(); if (position === source.length) return immutable(rules);
    if (identifier() !== 'prefix_rule') fail();
    take('('); const values: Record<string, unknown> = {};
    for (;;) {
      skip(); if (source[position] === ')') { position++; break; }
      const key = identifier(); if (!['pattern', 'decision', 'justification', 'match', 'not_match'].includes(key) || Object.hasOwn(values, key)) fail();
      take('='); values[key] = ['pattern', 'match', 'not_match'].includes(key) ? list() : string();
      skip(); if (source[position] === ')') { position++; break; }
      take(',');
    }
    const pattern = values.pattern;
    const validString = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && !/[\0\r\n]/.test(value);
    if (!Array.isArray(pattern) || !pattern.length || !pattern.every(part => validString(part) || Array.isArray(part) && part.length > 0 && part.every(validString))) fail();
    const result = values.decision ?? 'allow';
    if (!['allow', 'prompt', 'forbidden'].includes(String(result)) || values.justification !== undefined && !validString(values.justification)) fail();
    const rule = {pattern, decision: result, ...(values.justification ? {justification: values.justification} : {})} as PrefixRule;
    for (const key of ['match', 'not_match']) {
      const examples = values[key] ?? [];
      if (!Array.isArray(examples) || !examples.every(validString)) fail();
      for (const example of examples as string[]) {
        const parsed = analyzeShell(example);
        if (!parsed.isSupported || parsed.commands.length !== 1 || parsed.commands[0]!.reads.length || parsed.commands[0]!.writes.length || matchesRule(parsed.commands[0]!.argv, rule) !== (key === 'match')) throw new GuardError('INVALID_RULES', `prefix_rule ${key} example failed`);
      }
    }
    rules.push(rule);
  }
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
