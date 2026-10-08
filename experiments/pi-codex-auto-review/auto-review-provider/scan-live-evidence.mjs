import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const key=process.env.OLLAMA_API_KEY;
if(!key)throw new Error('Runtime key is unavailable for the evidence check');
const roots=process.argv.slice(2);
if(roots.length===0)throw new Error('Explicit owned evidence directories are required');
let filesScanned=0,bytesScanned=0;
async function inspect(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,entry.name);
    if(entry.isDirectory())await inspect(path);
    else if(entry.isFile()){
      const data=await readFile(path);filesScanned++;bytesScanned+=data.length;
      if(data.includes(Buffer.from(key)))throw new Error('Credential was found in owned live evidence');
    }
  }
}
for(const root of roots)await inspect(root);
if(filesScanned===0||bytesScanned===0)throw new Error('Evidence population is empty');
console.log(JSON.stringify({status:'pass',filesScanned,bytesScanned,containsCredential:false}));
