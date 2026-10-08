import {spawnSync} from "node:child_process";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
const helper=new URL("./codex-execpolicy-reference",import.meta.url).pathname;
const cases=[];
const add=(name,source,options={})=>cases.push({name,sources:Array.isArray(source)?source.map((source,index)=>({name:`${name}-${index}.rules`,source})):[{name:`${name}.rules`,source}],commands:options.commands??[],...(options.posix?{platform:"posix"}:{})});
const expressions=[
    '"status"','"sta" + "tus"','"ab" * 3','3 * "ab"','str(12)','str(-7 // 3)','str(-7 % 3)','str(7 % -3)','str(2.0)','str(3 / 2)',
    '"GIT".lower()','"git".upper()','"ß".upper()','"é".upper()','" x ".strip()','"/path/".strip("/")','"path///".rstrip("/")','"///path".lstrip("/")',
    '"::".join(["git","status"])','"a:b:c".split(":")[1]','"a:b:c".rsplit(":",1)[0]','" a  b c ".split(None,1)[1]','" a  b c ".rsplit(None,1)[0]',
    '"abcdef"[1:5:2]','"abc"[::-1]','"abcd"[-2]','"a-b-a".replace("a","x",1)','"a".replace("","x")',
    '"{}".format("status")','"{0}-{name}".format("git",name="show")','"%s-%02d" % ("git",3)','"%(name)s" % {"name":"git"}',
    '["show","status"]','["x"] + ["y"]','list(("show","status"))','sorted(["status","show"])','list(reversed(["show","status"]))',
    '[x for x in ["show","status"] if x != "show"]','[x + y for x in ["a","b"] for y in ["c","d"]]',
    'str(len([1,2]))','str(len("🐶"))','str(int("ff",16))','str(int("-0x10",0))','str(abs(-2))','str(bool([]))',
    'str(all([True,False]))','str(any([False,True]))','str(min([3,1,2]))','str(max(3,1,2))','str(2 < 3 < 4)',
    '"ok" if 1 in [1,2] else "bad"','"ok" if 1 not in [2,3] else "bad"','str(1 == True)','str(1 == 1.0)','str(3 << 2)',
    '{"x":"show"}.get("x")','dict(x="show")["x"]','[v for k,v in {"a":"show","b":"status"}.items()]','str(tuple([1,2]))',
    'str([i for i in range(3)])','str(type(range(3)))','str(type("x"))','str(type(1.0))','str(type(None))',
    'str(enumerate(["x","y"]))','str(zip(["x"],["y"]))','str({x:x.upper() for x in ["a","b"]})','str(1 or 2)','str(0 and 2)',
    'str((2 < 3) == True)','str(range(3))','str(range(1,5,2))','str(range(3)[::-1])','str(range(0) == range(1,1))',
    'str(sum([1,2]))','str(hash("hello"))','str(hash("🐶"))','str(ord("é"))','chr(0x1f436)',
    'getattr("git","upper")()','str(hasattr("git","upper"))','str("upper" in dir("git"))','getattr("git","missing","fallback")',
    '"a\\nb\\r\\nc".splitlines()','"abc".partition("b")[0]','"abc".rpartition("b")[2]','"hello world".title()',
    'str("abc12".isalnum())','str("é".isalpha())','str("123".isdigit())','str("abc".islower())','str("ABC".isupper())','str(" \\t".isspace())','str("Hello World".istitle())',
    '"prefix".removeprefix("pre")','"prefix".removesuffix("fix")','str("abc".elems())','str("é".codepoints())','str("é".codepoint_ords())',
    'str("abc".find("z"))','str("abc".index("z"))','str("abcabc".count("a"))','str("abc".startswith(("x","a")))',
    'str([1,2,1].count(1))','str([1,2,3].index(3,-2))','"%s-%d" % ("git",3)','"%r" % "git"','"{{{name}}}".format(name="git")','"{!r}".format("git")','"{:02}".format(3)',
    'str(float("nan"))','str(float("inf"))','str(float("-inf"))','str(float(True))',
    'str(list("abc"))','str(len({"a":1}))','str({1:"a"}.get(1.0))','str(sorted(["a","BB"],key=len,reverse=True))',
    'str(tuple(range(3)))','str(tuple([1,2])[::-1])','str({1:2} | {1:3,4:5})',
    'str(list("é".elems()))','str(list("é".codepoints()))','str(type("x".elems()))','str(dir("x"))','str(dir([]))','str(dir({}))',
    'str(["é","Ā","🐶","\\x01","\\x7f"])',
    '"\\u0085git\\u0085".strip()','"\\ufeffgit\\ufeff".strip()',
    'str("\\u0085".isspace())','str("\\ufeff".isspace())',
    '"git\\u0085show".split()','"git\\ufeffshow".split()',
    'str(int("\\u00851\\u0085"))','str(int("\\ufeff1\\ufeff"))',
    'str(float("\\u00851\\u0085"))','str(float("\\ufeff1\\ufeff"))',
    'str(int(" 1 "))','str(float(" 1 "))','str(int("\\t1\\n"))','str(float("\\t1\\n"))',
];
expressions.forEach((expression,index)=>add(`expression-${index}`,`prefix_rule(pattern=["probe",${expression}])`));
const programs=[
    'def rule(p, action="show"):\n    prefix_rule([p,action])\nrule("git")',
    'def rule(*items, **options):\n    prefix_rule(list(items), **options)\nrule("git","status",decision="prompt")',
    'def rule(p, *, action="show"):\n    prefix_rule([p,action])\nrule("git",action="status")',
    'def rule(p):\n    if p == "git":\n        return ["git","show"]\n    else:\n        return ["echo"]\nprefix_rule(rule("git"))',
    'for p in ["git","echo"]:\n    prefix_rule([p])',
    'for p in ["a","b","c"]:\n    if p == "a":\n        continue\n    prefix_rule([p])\n    break',
    'patterns=["show"]\npatterns.append("status")\nprefix_rule(["git",patterns])',
    'patterns=["show"]\npatterns += ["status"]\nprefix_rule(["git",patterns])',
    'patterns=["show","push"]\npatterns[1]="status"\nprefix_rule(["git",patterns])',
    'd={}\nd["x"]="show"\nd.update(y="status")\nprefix_rule(["git",d.values()])',
    'actions=["show","status"]\nprefix_rule(["git",[actions for actions in actions]])',
    'p="git"\ndef rule():\n    prefix_rule([p])\n    p="echo"\nrule()',
    'def recurse():\n    recurse()\nrecurse()',
    'xs=["a"]\nfor x in xs:\n    xs.append("b")',
    'def make():\n    value="git"\n    return lambda action: [value,action]\nprefix_rule(make()("show"))',
    'prefix_rule(pattern=(["git"]))',
    'prefix_rule(pattern=("git","show"))',
    'prefix_rule(["git"], decision=None, match=None, not_match=None, justification=None)',
    'prefix_rule(["git"], match=["git --flag"], not_match=["other"])',
    'prefix_rule(["git","hello world"], match=[\'git "hello world"\'])',
    'prefix_rule(["git","a#b"], match=["git a#b"])',
    'prefix_rule(["git"],match=["git # comment"])',
    'prefix_rule(["git","a;b"],match=["git a;b"])',
    'prefix_rule(["git","x"],match=["git \\\\x"])',
    'prefix_rule(["git"], match=[["git"], ("git",)])',
    'prefix_rule(["git"], justification="  because  ")',
    'prefix_rule(["git"], justification=" ")',
    'prefix_rule(["git"], bad=True)',
    'prefix_rule(["git"], pattern=["other"])',
    'prefix_rule([["git","echo"],["show","status"]], decision="prompt")',
    'prefix_rule([["git"],["show"]])',
    'prefix_rule([""])',
    'prefix_rule([[]])',
    'prefix_rule([])',
    'prefix_rule(["git",None])',
    'prefix_rule(["git",["show",1]])',
    'prefix_rule(["git"], decision="deny")',
    'prefix_rule(["git"], match=["other"])',
    'prefix_rule(["git"], not_match=["git"])',
    'prefix_rule(["git"], match=[""])',
    'prefix_rule(["git"], match=[[]])',
    'prefix_rule(["git"], match=["\'"])',
    'prefix_rule(["git"], match=[1])',
    'prefix_rule(["git"], match="git")',
    'load("other.star","rule")\nrule()',
    'prefix_rule(["git"])\nunknown_function()',
    'if True:\n    prefix_rule(["git"])\nelse:\n    prefix_rule(["other"])',
    'if False:\n    prefix_rule(["git"])\nelif True:\n    prefix_rule(["echo"])',
    'name="git"; prefix_rule([name])',
    'def annotated(name: str) -> list:\n    return [name]\nprefix_rule(annotated("git"))',
    'prefix_rule(["git", f"{1 + 2}"])',
    'name="git"\nprefix_rule([f"{{{name}}}"])',
    'prefix_rule(["git", r"foo\\bar"])',
    'prefix_rule(["git", """multi\nline"""])',
    'prefix_rule(["git", "\\u0061\\x62\\143"])',
    'prefix_rule(["git", "\\q"])',
    'def annotated(name: str):\n    prefix_rule([str(name)])\nannotated(1)',
    'def annotated(name: str) -> str:\n    return [name]\nprefix_rule(annotated("git"))',
    'def typed(items: list[str]):\n    prefix_rule(items)\ntyped(["git"])',
    'def typed(items: list[str]):\n    prefix_rule([str(items[0])])\ntyped([1])',
    'f=lambda p="git": [p]\nprefix_rule(f())',
    'items=["git"]\nalias=items\nitems += ["show"]\nprefix_rule(alias)',
    'left=right="git"\nprefix_rule([left,right])',
    'prefix_rule([str(00)])',
    'prefix_rule([str(1_000)])',
    'if False:\n    unknown()\nprefix_rule(["git"])',
    'if False:\n    return\nprefix_rule(["git"])',
    'if False:\n    break\nprefix_rule(["git"])',
    'if False:\n    continue\nprefix_rule(["git"])',
    'def f(x: Unknown):\n    pass\nprefix_rule(["git"])',
    'def f(x: list[Unknown]):\n    pass\nprefix_rule(["git"])',
    'def unused():\n    unknown()\nprefix_rule(["git"])',
    'for value in []:\n    def f():\n        break\nprefix_rule(["git"])',
    'p="git"\nitems=[p for p in ["show"]]\nprefix_rule([p,items])',
    'def f():\n    return lambda value: missing\nprefix_rule(["git"])',
    'prefix_rule(["git"],justification="\\u0085")',
    'prefix_rule(["git"],justification="\\ufeff")',
    'prefix_rule(["git","show"],match=["git\\u00a0show"])',
    'prefix_rule(["git","show"],match=["git\\x0bshow"])',
    'prefix_rule(["git","show"],match=["git\\x0cshow"])',
    'prefix_rule(["\\ud800"])',
    'prefix_rule(["\\ud83d\\udc36"])',
];
programs.forEach((source,index)=>add(`program-${index}`,source));
for(const protocol of ["http","https","https_connect","http-connect","socks5_tcp","socks5_udp","smtp"]){
    for(const decision of ["allow","prompt","forbidden","deny"])add(`network-${protocol}-${decision}`,`network_rule(host=" EXAMPLE.com.:443 ",protocol="${protocol}",decision="${decision}")`);
}
for(const [index,host] of ["[::1]:443","[::1]","::1","[::1]:x","x:abc","","a b","https://host","host/path","*.example.com","a?b","a#b","[]","example.com:","EXÄMPLE.com","\u0085api.example\u0085","\ufeffapi.example\ufeff"].entries())
    add(`network-host-${index}`,`network_rule(host=${JSON.stringify(host)},protocol="https",decision="allow")`);
add("network-overlays",['network_rule(host="one",protocol="http",decision="allow")\nnetwork_rule(host="two",protocol="http",decision="allow")','network_rule(host="one",protocol="https",decision="forbidden")\nnetwork_rule(host="two",protocol="http",decision="prompt")\nnetwork_rule(host="one",protocol="http",decision="allow")']);
add("file-globals-isolated",['p="git"\nprefix_rule([p])','prefix_rule([p])']);
add("empty",["",""]);
for(const [index,source] of [
    'host_executable(name="git",paths=["/usr/bin/git"])\nprefix_rule(["git","status"])\nprefix_rule(["/usr/bin/git","push"],decision="forbidden")',
    'prefix_rule(["git","status"],match=["/usr/bin/git status"])\nhost_executable(name="git",paths=["/usr/bin/git"])',
    'host_executable(name="git",paths=["/usr/bin/../bin/git","/usr/bin/git"])\nprefix_rule(["git","status"])',
    'host_executable(name="git",paths=[])\nprefix_rule(["git","status"])',
    'host_executable(name="git",paths=["relative/git"])',
    'host_executable(name="git",paths=["/bin/other"])',
    'host_executable(name="/git",paths=["/bin/git"])',
    'host_executable(name="..",paths=["/bin/git"])',
].entries())add(`host-${index}`,source,{posix:true,commands:[["/usr/bin/git","status"],["/other/git","status"],["/usr/bin/git","push"],["git","status"]]});
function original(item){
    const result=spawnSync(helper,[],{input:JSON.stringify({sources:item.sources,commands:item.commands}),encoding:"utf8",timeout:5000,maxBuffer:16*1024*1024,env:{}});
    if(result.error)throw result.error;
    return result.status===0?{result:JSON.parse(result.stdout)}:{error:true};
}
for(const item of cases){
    const first=original(item);
    if(first.result && !item.commands.length){
        item.commands=[[],["unmatched"],...first.result.rules.flatMap(rule=>{
            const command=rule.pattern.map(part=>Array.isArray(part)?part[0]:part);
            return [command,[...command,"--extra"],[...command.slice(0,-1),"__different__"]];
        })];
    }
    item.expected=original(item);
}
const record={reference:{revision:"a956835d020762cb2b570053af06f643a11c0ecc",platform:process.platform,helperSha256:createHash("sha256").update(await readFile(helper)).digest("hex"),description:"Captured from the previously shipped pinned Codex helper before deleting the Rust build; no native executable is needed to replay these cases."},cases};
await mkdir("test/fixtures",{recursive:true});
await writeFile("test/fixtures/execpolicy-reference.json",JSON.stringify(record,null,2)+"\n");
console.log(JSON.stringify({cases:cases.length,accepted:cases.filter(item=>item.expected.result).length,rejected:cases.filter(item=>item.expected.error).length}));
