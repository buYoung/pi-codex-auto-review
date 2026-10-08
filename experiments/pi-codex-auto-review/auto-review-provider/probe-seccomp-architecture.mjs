import {SandboxManager} from '@anthropic-ai/sandbox-runtime';
import {nativeConfig,shellQuote} from './dist/sandbox/config.js';
import {createProfile,EMPTY_DELTA} from './dist/contracts.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {createServer} from 'node:net';
const cwd=await mkdtemp('/tmp/pi-architecture-probe-');
const profile=createProfile({mode:'workspace-write',readRoots:['/'],writeRoots:[cwd],denyRead:[],denyWrite:[],allowedDomains:[],deniedDomains:[]});
const control=createServer();await new Promise((resolve,reject)=>{control.on('error',reject);control.listen(join(cwd,'control.sock'),resolve);});await new Promise(resolve=>control.close(resolve));
console.log(JSON.stringify({outsideUnixSocketControl:'pass'}));
try{
 for(const architecture of ['x64','arm64']){
  try{
   const config=await nativeConfig(profile,EMPTY_DELTA,cwd);
   config.seccomp={applyPath:`/opt/pi-guard/node_modules/@anthropic-ai/sandbox-runtime/vendor/seccomp/${architecture}/apply-seccomp`};
   await SandboxManager.initialize(config,undefined,false);
   const socketProbe=`const net=require("node:net");const fs=require("node:fs");console.log(fs.readFileSync("/proc/self/status","utf8").split("\\n").filter(line=>line.startsWith("Seccomp")).join("\\n"));const server=net.createServer();server.on("error",error=>{console.log("socket-error:"+error.code);process.exit(error.code==="EPERM"?0:7)});server.listen(${JSON.stringify(join(cwd,'must-not-bind.sock'))},()=>{server.close(()=>process.exit(8))});`;
   const wrapped=await SandboxManager.wrapWithSandboxArgv(`printf native-seccomp-probe; node -e ${shellQuote(socketProbe)}`,'/bin/bash',undefined,AbortSignal.timeout(10000),cwd);
   const result=await new Promise((resolve,reject)=>{
    let output='',errors='';
    const child=spawn(wrapped.argv[0],wrapped.argv.slice(1),{cwd,env:{PATH:process.env.PATH,...wrapped.env},timeout:10000});
    child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>errors+=chunk);
    child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal,output,errors:errors.slice(-2000)}));
   });
   console.log(JSON.stringify({processArchitecture:process.arch,helperArchitecture:architecture,...result}));
  }catch(error){console.log(JSON.stringify({helperArchitecture:architecture,error:error.message}));}
  finally{await SandboxManager.reset();}
 }
}finally{await rm(cwd,{recursive:true,force:true});}
