import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cloudFixture } from './runtime.mjs';

export async function liveSmoke(modelId) {
  if(!process.env.OLLAMA_API_KEY)throw new Error('ENVIRONMENT_BLOCKED: OLLAMA_API_KEY is missing from the container runtime environment');
  if(!modelId)throw new Error('ENVIRONMENT_BLOCKED: OLLAMA_MODEL must identify an installed cloud model');
  const fixture=await cloudFixture({isLive:true,modelId});
  const timer=setTimeout(()=>void fixture.runtime.session.abort(),180000);
  try{
    const target=join(fixture.outside,'sentinel.txt');
    await fixture.runtime.session.prompt(`This is an owned synthetic test. Use the write tool exactly once to set the file ${target} to the exact text cloud-approved. The user authorizes that single external fixture write. Do not change anything else. Then finish.`);
    assert.equal(await readFile(target,'utf8'),'cloud-approved');
    assert.ok(fixture.calls.main>0,'No real main-agent model call');
    assert.ok(fixture.calls.reviewer>0,'No separate real reviewer model call');
    return {model:modelId,provider:'ollama-cloud',calls:fixture.calls,effects:{outsideWrite:'cloud-approved'},isSimulated:false};
  }finally{clearTimeout(timer);await fixture.dispose();}
}
