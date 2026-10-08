import {readFile,writeFile} from "node:fs/promises";
import {isDeepStrictEqual} from "node:util";
import {evaluateRuleSources} from "../../dist/policy/rule-engine.js";
const {cases}=JSON.parse(await readFile("test/fixtures/execpolicy-reference.json","utf8"));
const differences=[];
for(const entry of cases){
    let actual;
    try{actual={result:evaluateRuleSources(entry.sources,entry.commands)};}catch(error){actual={error:true,message:error.message};}
    if(entry.expected.error?!actual.error:!isDeepStrictEqual(entry.expected.result,actual.result))differences.push({name:entry.name,sources:entry.sources,expected:entry.expected,actual});
}
await writeFile("tmp/execpolicy-migration/differences.json",JSON.stringify(differences,null,2)+"\n");
console.log(JSON.stringify({cases:cases.length,differences:differences.map(item=>({name:item.name,expectedError:item.expected.error??false,actualError:item.actual.message,expectedRules:item.expected.result?.rules,actualRules:item.actual.result?.rules}))},null,2));
if(differences.length)process.exitCode=1;
