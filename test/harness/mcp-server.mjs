import { createInterface } from 'node:readline';
import { writeFile } from 'node:fs/promises';
const reply = value => process.stdout.write(JSON.stringify(value)+'\n');
const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
for await (const line of lines) {
  if(Buffer.byteLength(line)>1_000_000)throw new Error('Oversized fixture request');
  const request=JSON.parse(line); if(request.id===undefined)continue;
  let result;
  if(request.method==='initialize')result={protocolVersion:request.params.protocolVersion,serverInfo:{name:'owned-stdio',version:'1'},capabilities:{tools:{}}};
  else if(request.method==='tools/list')result={tools:[{name:'write_owned',description:'Write the explicitly owned fixture sentinel',inputSchema:{type:'object',properties:{value:{type:'string'}},required:['value']},annotations:{destructiveHint:true}}]};
  else if(request.method==='tools/call') {
    await writeFile(process.argv[2],request.params.arguments.value);
    result={content:[{type:'text',text:request.params.arguments.value}],structuredContent:{value:request.params.arguments.value}};
  } else {reply({jsonrpc:'2.0',id:request.id,error:{code:-32601,message:'Unsupported owned method'}});continue;}
  reply({jsonrpc:'2.0',id:request.id,result});
}
