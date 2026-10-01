#!/usr/bin/env node
import { homedir } from 'node:os';
import { join } from 'node:path';
import { InteractiveMode, runPrintMode, runRpcMode } from '@earendil-works/pi-coding-agent';
import { createGuardedRuntime } from './startup.js';

export async function main(argv: string[]): Promise<void> {
  let mode = 'tui', cwd = process.cwd(), agentDir = join(homedir(),'.pi','agent'), settingsPath: string | undefined;
  const prompts: string[] = [];
  for (let i=0;i<argv.length;i++) {
    const item=argv[i]!;
    if (item === '--help' || item === '-h') {console.log('사용법: pi-guard [--cwd 경로] [--agent-dir 경로] [--policy 파일] [--mode tui|print|json|rpc] [프롬프트]');return;}
    if (['--mode','--cwd','--agent-dir','--policy'].includes(item)) {
      const value=argv[++i]; if (!value) throw new Error(`${item}: 값이 필요합니다`);
      if(item==='--mode')mode=value; if(item==='--cwd')cwd=value; if(item==='--agent-dir')agentDir=value;if(item==='--policy')settingsPath=value;
    } else if(item==='-p')mode='print'; else if(item.startsWith('-'))throw new Error(`지원하지 않는 옵션: ${item}`); else prompts.push(item);
  }
  if (!['tui','print','json','rpc'].includes(mode))throw new Error(`지원하지 않는 실행 모드: ${mode}`);
  const runtime=await createGuardedRuntime({cwd,agentDir,settingsPath});
  if(mode==='rpc')await runRpcMode(runtime);
  else if(mode==='tui')await new InteractiveMode(runtime,{initialMessage:prompts.join(' ') || undefined}).run();
  else process.exitCode=await runPrintMode(runtime,{mode:mode==='json'?'json':'text',initialMessage:prompts.join(' ') || undefined});
}
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) main(process.argv.slice(2)).catch(error=>{console.error(`pi-guard: ${(error as Error).message}`);process.exitCode=1;});
