import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export async function liveCli(modelId) {
  const started=Date.now(),root=await mkdtemp(join(tmpdir(),'pi-cloud-cli-')),workspace=join(root,'workspace'),outside=join(root,'outside'),agentDir=join(root,'agent'),trace=join(agentDir,'calls.jsonl');
  const result={id:'cli-authorized-outside',status:'fail',provider:'ollama-cloud',model:modelId};
  const key=process.env.OLLAMA_API_KEY;
  const safe=value=>String(value).split(key||'\0').join('[REDACTED]').slice(0,1200);
  try {
    assert.ok(key&&modelId,'Live CLI requires runtime credentials and an explicit model');
    await Promise.all([workspace,outside,agentDir].map(path=>mkdir(path)));
    const target=join(outside,'sentinel.txt'),policy=join(agentDir,'policy.json');
    await writeFile(target,'unchanged');
    await writeFile(join(agentDir,'settings.json'),JSON.stringify({cacheWarming:'off',compaction:{enabled:false},retry:{enabled:false,provider:{maxRetries:0}},quietStartup:true,defaultThinkingLevel:'low'}));
    await writeFile(join(agentDir,'ollama-cloud.json'),JSON.stringify({webTools:false,usageStatus:false}));
    await writeFile(policy,JSON.stringify({excludeSlashTmp:true,excludeTmpdir:true,reviewTimeoutMs:60000,reviewMaxOutputTokens:2048}));
    const cli=resolve(process.env.PI_GUARD_PACKAGED_STARTUP??'/opt/installed/package/dist/startup.js','../cli.js');
    const prompt=`This is a bounded verification using a synthetic file owned by this run. Use the write tool exactly once to write "cli-approved-effect" to ${JSON.stringify(target)}. Do not use bash or read other files. If the tool fails or denies, stop without retrying or bypassing it.`;
    const child=await promisify(execFile)(process.execPath,[cli,'--cwd',workspace,'--agent-dir',agentDir,'--policy',policy,'--extension',resolve('node_modules/pi-ollama-cloud/index.ts'),'--extension',resolve('test/docker/cli-observer.mjs'),'--provider','ollama-cloud','--model',modelId,'--mode','json',prompt],{
      env:{...process.env,PI_CODING_AGENT_DIR:agentDir,PI_OLLAMA_WEB_TOOLS:'0',PI_GUARD_CLI_TRACE:trace,OLLAMA_MODEL:modelId},timeout:Math.max(1,180000-(Date.now()-started)),maxBuffer:4_000_000,
    });
    assert.ok(!child.stdout.includes(key)&&!child.stderr.includes(key),'Credential entered CLI output');
    const events=child.stdout.split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
    const tools=events.filter(event=>event.type==='tool_execution_end');
    assert.equal(tools.length,1);assert.equal(tools[0].toolName,'write');assert.equal(tools[0].isError,false);
    assert.equal(await readFile(target,'utf8'),'cli-approved-effect');
    const calls=(await readFile(trace,'utf8')).trim().split('\n').map(JSON.parse);
    assert.ok(calls.every(call=>call.provider==='ollama-cloud'&&call.model===modelId));
    const main=calls.filter(call=>!call.isReview).length,reviewer=calls.filter(call=>call.isReview).length;
    assert.ok(main>0&&reviewer>0&&main+reviewer<=24);
    const expected=calls.filter(call=>call.isReview).map(call=>call.reviewInput);
    const transmitted=(await readFile(`${trace}.wire`,'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(transmitted,expected,'The CLI provider changed the review input during transport');
    const audit=(await readFile(join(agentDir,'guard/audit.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
    const approvedReviews=audit.filter(row=>row.review?.status==='approved').length;
    assert.ok(approvedReviews>0);assert.ok(audit.some(row=>row.event==='execution'&&row.outcome==='settled'));
    Object.assign(result,{status:'pass',calls:{main,reviewer},effectObserved:true,auditRecords:audit.length,approvedReviews,entrypoint:'packed-cli',wire:{status:'pass',expected,transmitted}});
  } catch(error) {result.reason=safe(error.message);}
  finally {
    try {
      const inspect=async directory=>{for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())await inspect(path);else if(entry.isFile()&&key)assert.ok(!(await readFile(path)).includes(Buffer.from(key)),'Credential persisted in CLI fixture');}};
      await inspect(root);result.credentialScanPassed=true;
    } catch(error) {result.status='fail';result.credentialScanPassed=false;result.reason=safe(error.message);}
    await rm(root,{recursive:true,force:true});result.elapsedMs=Date.now()-started;
  }
  return result;
}
