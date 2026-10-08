import {mkdtemp,mkdir,writeFile,readFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {NativeExecutor} from '../../dist/sandbox/executor.js';
import {createProfile,EMPTY_DELTA} from '../../dist/contracts.js';
import {shellQuote} from '../../dist/sandbox/config.js';
const root=await realpath(await mkdtemp(join(tmpdir(),'pi-scratch-probe-'))),workspace=join(root,'workspace');
await mkdir(workspace);await mkdir('/tmp/claude',{recursive:true});
const scratch=await realpath(await mkdtemp('/tmp/claude/pi-owned-probe-')),target=join(scratch,'sentinel.txt');
await writeFile(target,'unchanged');
const executor=new NativeExecutor(),profile=createProfile({mode:'read-only',readRoots:['/'],writeRoots:[],denyRead:[],denyWrite:[],allowedDomains:[],deniedDomains:[]});
try{
 const result=await executor.execute({kind:'shell',command:`printf changed > ${shellQuote(target)}`,cwd:workspace},profile,EMPTY_DELTA);
 console.log(JSON.stringify({exitCode:result.exitCode,isOutsideOwnedSentinelChanged:await readFile(target,'utf8')!=='unchanged',declaredWriteRoots:profile.writeRoots}));
}finally{await executor.close();await rm(root,{recursive:true,force:true});await rm(scratch,{recursive:true,force:true});}
