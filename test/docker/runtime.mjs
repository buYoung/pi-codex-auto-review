import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** All runtime data is owned synthetic data; no host homes, credentials or socket mounts. */
export async function cloudFixture({isLive, modelId, policy, onReview} = {}) {
  const root=await mkdtemp(join(tmpdir(),'pi-cloud-')), workspace=join(root,'workspace'), outside=join(root,'outside'), control=join(root,'control'),agentDir=join(control,'agent');
  await Promise.all([workspace,outside,agentDir].map(path=>mkdir(path,{recursive:true})));
  process.env.PI_CODING_AGENT_DIR=agentDir;process.env.PI_OLLAMA_WEB_TOOLS='0';
  await writeFile(join(agentDir,'ollama-cloud.json'),JSON.stringify({webTools:false,usageStatus:false}));
  await writeFile(join(outside,'sentinel.txt'),'unchanged');await writeFile(join(control,'protected.txt'),'owned-protected-fixture');
  const startupPath=process.env.PI_GUARD_PACKAGED_STARTUP??'/opt/installed/package/dist/startup.js';
  const pi=await import('@earendil-works/pi-coding-agent'),ai=await import('@earendil-works/pi-ai');
  const {createGuardedRuntime}=await import(pathToFileURL(startupPath).href);
  const {createProfile}=await import(pathToFileURL(resolve(startupPath,'../contracts.js')).href);
  const modelRuntime=await pi.ModelRuntime.create({credentials:new ai.InMemoryCredentialStore(),authPath:join(agentDir,'auth.json'),modelsPath:null,modelsStorePath:join(agentDir,'models.json'),allowModelNetwork:false,refreshOnCreate:false});
  const refresh=modelRuntime.refresh.bind(modelRuntime);
  modelRuntime.refresh=options=>refresh({...options,providers:['ollama-cloud'],allowNetwork:isLive===true && options?.allowNetwork!==false,signal:AbortSignal.any([AbortSignal.timeout(30000),...(options?.signal?[options.signal]:[])])});
  const calls={main:0,reviewer:0};
  const streamSimple=modelRuntime.streamSimple.bind(modelRuntime);
  modelRuntime.streamSimple=(model,context,options={})=>{
    assert.equal(isLive,true,'Offline fixture attempted a model request');
    assert.equal(model.provider,'ollama-cloud');assert.equal(model.id,modelId);
    assert.ok(!process.env.OLLAMA_API_KEY||!JSON.stringify(context).includes(process.env.OLLAMA_API_KEY),'Credential entered a model prompt');
    const isReview=context.systemPrompt?.includes('# Outcome Policy')===true;
    calls[isReview?'reviewer':'main']++;
    if(calls.main+calls.reviewer>24)throw new Error('Live model request budget exceeded');
    if(isReview)onReview?.(context);
    return streamSimple(model,context,{...options,maxTokens:Math.min(options.maxTokens??2048,4096),reasoning:'low',timeoutMs:Math.min(options.timeoutMs??60000,60000),maxRetries:0});
  };
  const profile=createProfile({mode:'workspace-write',readRoots:[workspace],writeRoots:[workspace],denyRead:[control],denyWrite:[control],allowedDomains:[],deniedDomains:[]});
  let runtime;
  try {
    runtime=await createGuardedRuntime({cwd:workspace,agentDir,modelRuntime,
      settingsManager:pi.SettingsManager.inMemory({cacheWarming:'off',compaction:{enabled:false},retry:{enabled:false,provider:{maxRetries:0}},quietStartup:true,defaultProvider:'ollama-cloud',defaultModel:modelId??'glm-5.3',defaultThinkingLevel:'low'}),
      sessionManager:pi.SessionManager.inMemory(workspace),profile,
      settings:{reviewTimeoutMs:60000,reviewMaxOutputTokens:2048,...(policy?{reviewPolicy:policy}:{})},
      trustedExtensionPaths:[resolve('node_modules/pi-ollama-cloud/index.ts')],
    });
    assert.ok(modelRuntime.getModel('ollama-cloud',modelId??'glm-5.3'),'Requested provider/model was not registered');
    assert.ok(!runtime.session.getAllTools().some(tool=>tool.name.startsWith('ollama_web_')));
    if(isLive){
      const refreshed=await modelRuntime.refresh({providers:['ollama-cloud'],allowNetwork:true});
      if(refreshed.aborted||refreshed.errors.size)throw new Error('ENVIRONMENT_BLOCKED: live provider catalog refresh did not complete');
      await runtime.session.setModel(modelRuntime.getModel('ollama-cloud',modelId));
    }
    return {root,workspace,outside,control,agentDir,runtime,modelRuntime,calls,profile,async dispose(){
      await runtime.dispose();
      // Verify the actual runtime key was never persisted into owned fixture files.
      const key=process.env.OLLAMA_API_KEY;
      async function inspect(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())await inspect(path);else if(entry.isFile()&&key)assert.ok(!(await readFile(path)).includes(Buffer.from(key)),'Credential persisted into a fixture file');}}
      try{await inspect(root);}finally{await rm(root,{recursive:true,force:true});}
    }};
  } catch(error) {await runtime?.dispose().catch(()=>{});await rm(root,{recursive:true,force:true});throw error;}
}
