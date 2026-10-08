import {createProfile,EMPTY_DELTA} from './dist/contracts.js';
import {shellQuote} from './dist/sandbox/config.js';
import {mkdtemp,rm,access,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
let code=await readFile('./dist/sandbox/executor.js','utf8');
for(const [from,to] of [
 ["const lifetime = new AbortController();","const tracedAt=Date.now();const trace=label=>console.log(JSON.stringify({label,elapsedMs:Date.now()-tracedAt}));const lifetime = new AbortController();"],
 ["const child = fork(","trace('fork-before');const child = fork("],
 ["const seenNetworkRequests = new Set();","trace('fork-after');const seenNetworkRequests = new Set();"],
 ["const terminate = (cause) => {","const terminate = (cause) => {trace(cause.code);"],
 ["setTimeout(() => { killOwnedGroup(); child.kill('SIGKILL'); }, 4000)","setTimeout(() => {trace('force-kill');killOwnedGroup(); child.kill('SIGKILL'); }, 4000)"],
 ["const control = raw;","const control = raw;trace('message:'+control.type);"],
 ["child.once('close', () => {","child.once('close', () => {trace('broker-close');"],
]){if(!code.includes(from))throw new Error('Missing diagnostic insertion');code=code.replace(from,to);}
await writeFile('./dist/sandbox/executor.js',code);
const {NativeExecutor}=await import('./dist/sandbox/executor.js');
const cwd=await mkdtemp('/tmp/pi-timeout-probe-'),executor=new NativeExecutor();
const profile=createProfile({mode:'workspace-write',readRoots:[cwd],writeRoots:[cwd],denyRead:[],denyWrite:[],allowedDomains:[],deniedDomains:[]});
try{
 await executor.qualify(profile,cwd);
 for(let index=0;index<3;index++){
  const marker=join(cwd,`late-${index}`),start=Date.now(),events=[];
  const checks=[1300,5500].map(ms=>new Promise(resolve=>setTimeout(async()=>{let exists=true;try{await access(marker);}catch{exists=false;}events.push({atMs:Date.now()-start,markerExists:exists});resolve();},ms)));
  try{await executor.execute({kind:'shell',command:`printf timer-ready; sleep 5; printf late > ${shellQuote(marker)}`,cwd},profile,EMPTY_DELTA,{timeoutSeconds:index===2?2:0.8,onData:chunk=>events.push({atMs:Date.now()-start,output:chunk.toString()})});events.push({atMs:Date.now()-start,result:'unexpected-success'});}
  catch(error){events.push({atMs:Date.now()-start,errorCode:error.code});}
  await Promise.all(checks);
  console.log(JSON.stringify({case:index,events}));
 }
}finally{await executor.close();await rm(cwd,{recursive:true,force:true});}
