import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
for(const dir of ['server','shared']) {
 function walk(folder) {for(const e of fs.readdirSync(folder,{withFileTypes:true})) {const p=path.join(folder,e.name);if(e.isDirectory())walk(p);else if(/\.(ts|json)$/.test(p)){const dest=path.join('work/runtime',p.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(dest),{recursive:true});let out=e.name.endsWith('.ts')?ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText:fs.readFileSync(p,'utf8');out=out.replace(/from (['"][^'"]+\.json['"]);/g,'from $1 with { type: "json" };');fs.writeFileSync(dest,out);}}}walk(dir);
}
const diagnostic=ts.transpileModule(fs.readFileSync('scripts/diagnose-stream.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace('../server/gemini.js','./runtime/server/gemini.js');fs.writeFileSync('work/diagnose-stream.mjs',diagnostic);
