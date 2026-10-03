import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';

/** Observe the real CLI/provider boundary without replacing responses or planned actions. */
export default function observeCli(pi) {
  const observed=new WeakSet();
  let calls=0;
  pi.on('before_agent_start',(_event,context)=>{
    // Pi 0.99.1's compatibility facade delegates to this backing ModelRuntime.
    // This version-pinned test observer must wrap it to see main-agent calls too.
    const registry=context.modelRegistry.runtime;
    assert.equal(typeof registry?.streamSimple,'function','Pinned Pi model runtime is unavailable to the CLI observer');
    if(observed.has(registry))return;
    observed.add(registry);
    const stream=registry.streamSimple.bind(registry);
    registry.streamSimple=(model,request,options={})=>{
      assert.equal(model.provider,'ollama-cloud');assert.equal(model.id,process.env.OLLAMA_MODEL);
      assert.ok(++calls<=24,'Live CLI model request budget exceeded');
      assert.ok(!JSON.stringify(request).includes(process.env.OLLAMA_API_KEY),'Credential entered a CLI model request');
      const isReview=request.systemPrompt?.includes('# Outcome Policy')===true || request.messages.some(message=>message.role==='system'&&JSON.stringify(message).includes('# Outcome Policy'));
      appendFileSync(process.env.PI_GUARD_CLI_TRACE,JSON.stringify({provider:model.provider,model:model.id,isReview})+'\n');
      return stream(model,request,{...options,maxTokens:Math.min(options.maxTokens??2048,4096),reasoning:'low',timeoutMs:Math.min(options.timeoutMs??60000,60000),maxRetries:0});
    };
  });
}
