import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAgentSessionRuntime, createAgentSessionServices, createAgentSessionFromServices, createCodemodeExtension, SessionManager, SettingsManager, type ModelRuntime, type InlineExtension, type CreateAgentSessionOptions } from '@earendil-works/pi-coding-agent';
import { GuardError } from './contracts.js';
import { createGuardExtension, type GuardOptions } from './index.js';

export async function assertSupportedPi(): Promise<string> {
  let path = dirname(fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent')));
  for (let i = 0; i < 8; i++) {
    try {
      const pkg = JSON.parse(await readFile(join(path,'package.json'),'utf8'));
      if (pkg.name === '@earendil-works/pi-coding-agent') {
        if (pkg.version !== '0.99.1') throw new GuardError('UNSUPPORTED_PI','Pi APIs are not qualified for this version');
        return pkg.version as string;
      }
    } catch (error) { if (error instanceof GuardError) throw error; }
    path = dirname(path);
  }
  throw new GuardError('UNSUPPORTED_PI','Host Pi version could not be verified');
}
export interface GuardedRuntimeOptions extends GuardOptions {
  cwd: string;
  agentDir: string;
  modelRuntime?: ModelRuntime;
  settingsManager?: SettingsManager;
  model?: CreateAgentSessionOptions['model'];
  sessionManager?: SessionManager;
  trustedExtensions?: InlineExtension[];
  /** Explicit trusted provider/controller entrypoints; automatic discovery remains disabled. */
  trustedExtensionPaths?: readonly string[];
}
export async function createGuardedRuntime(options: GuardedRuntimeOptions) {
  await assertSupportedPi();
  const initialCwd = resolve(options.cwd), agentDir = resolve(options.agentDir);
  const trustedExtensionPaths = (options.trustedExtensionPaths ?? []).map(path => resolve(initialCwd, path));
  const createRuntime = async (input: {cwd:string;agentDir:string;sessionManager:SessionManager;sessionStartEvent?:CreateAgentSessionOptions['sessionStartEvent']}) => {
    const settingsManager=options.settingsManager ?? SettingsManager.create(input.cwd,input.agentDir);
    const guard = createGuardExtension({...options,cwd:input.cwd,agentDir:input.agentDir,bashOptions:{commandPrefix:settingsManager.getShellCommandPrefix(),shellPath:settingsManager.getShellPath(),...options.bashOptions},readOptions:{autoResizeImages:settingsManager.getImageAutoResize(),...options.readOptions}});
    try {
      const services = await createAgentSessionServices({cwd:input.cwd,agentDir:input.agentDir,modelRuntime:options.modelRuntime,settingsManager,
        resourceLoaderOptions:{additionalExtensionPaths:trustedExtensionPaths,extensionFactories:[{name:'pi-codex-auto-review',factory:guard.factory},createCodemodeExtension({models:false}),...(options.trustedExtensions ?? [])],noExtensions:true,noSkills:true,noPromptTemplates:true,noThemes:true,noContextFiles:true}});
      const loaded=services.resourceLoader.getExtensions();
      if (loaded.errors.length || services.diagnostics.some(item=>item.type==='error')) throw new GuardError('GUARDED_STARTUP_FAILED','An extension or runtime service failed to load');
      guard.assertReady();
      const result=await createAgentSessionFromServices({services,sessionManager:input.sessionManager,model:options.model,sessionStartEvent:input.sessionStartEvent,tools:['read','bash','edit','write','grep','find','ls','codemode',...(options.settings?.trustedTools ?? [])]});
      await result.session.bindExtensions({mode:'print'});
      guard.assertReady();
      const session=result.session;
      const prompt=session.prompt.bind(session);
      session.prompt=async (...args)=>{guard.assertReady();return prompt(...args);};
      const reload=session.reload.bind(session);
      session.reload=async(...args)=>{
        await reload(...args);
        const controller=guard.assertReady();
        // Pi omits session_start after reload when print/SDK mode has no UI or command bindings.
        if(!controller.isBoundToSession(session.sessionManager.getSessionId())){
          await args[0]?.beforeSessionStart?.();
          await session.extensionRunner.emit({type:'session_start',reason:'reload'});
        }
        guard.assertReady();
      };
      const executeBash=session.executeBash.bind(session);
      session.executeBash=async(command,onChunk,options)=>{
        const controller=guard.assertReady();
        const handled=options?.operations ? {operations:options.operations} : await session.extensionRunner.emitUserBash({type:'user_bash',command,cwd:session.sessionManager.getCwd(),excludeFromContext:options?.excludeFromContext ?? false});
        if(!handled?.operations || !controller.isGuardedOperations(handled.operations))throw new GuardError('UNGUARDED_OPERATIONS','Protected sessions require guarded shell operations');
        return executeBash(command,onChunk,{...options,operations:handled.operations});
      };
      return {...result,services,diagnostics:services.diagnostics};
    } catch(error) { try {await guard.assertReady().close();} catch {} throw error; }
  };
  return createAgentSessionRuntime(createRuntime,{cwd:initialCwd,agentDir,sessionManager:options.sessionManager ?? SessionManager.create(initialCwd,join(agentDir,'sessions'))});
}
