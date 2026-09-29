import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getFacultyAnswer, selectFaculty, facultyEvidence } from '../dist-server/server/faculty.js';
import { parseFaculty } from './lib/faculty.mjs';
import { app } from '../dist-server/server/app.js';
const directory=JSON.parse(fs.readFileSync('server/data/faculty-directory.json','utf8'));
const prefs={language:'auto',responseStyle:'concise'};
let checks=0;
for(const department of new Set(directory.records.map(r=>r.department))){
 const answer=getFacultyAnswer(`List all ${department} faculty`,[],prefs);
 assert(answer,department);
 const expected=directory.records.filter(r=>r.department===department);
 assert.equal(answer.answer.split('\n').filter(line=>line.startsWith('| ')&&!line.startsWith('| Name')&&!line.startsWith('| ---')).length,expected.length,department);
 for(const row of expected)assert(answer.answer.includes(`| ${row.name} |`),`${department}: ${row.name}`);
 checks++;
}
assert.equal(selectFaculty('Compare Ammar Bin Ahsan and Hiba Kafeel').records.length,2);
const physics=getFacultyAnswer('tell me about faculty members teaching physics',[],prefs);
assert(physics.answer.includes('| Ammar Bin Ahsan |'));
assert(physics.answer.includes('| Mudassir Mehmood |'));
assert(!physics.answer.includes('Rehan Ahmed'));
const history=[{role:'user',text:'List Physics faculty'},{role:'model',text:physics.answer}];
assert(getFacultyAnswer('What about Sir Ammar?',history,prefs).answer.includes('| Ammar Bin Ahsan |'));
assert.equal(selectFaculty('Who is Muhammad Muzaffar?').records.every(r=>r.name==='Muhammad Muzaffar'),true);
assert.equal(getFacultyAnswer('What are Physics admission fees?',history,prefs),null);
assert.equal(getFacultyAnswer('What is sir Ammar phone number?',history,prefs),null);
assert.equal(getFacultyAnswer('What about sir Nonexistent?',[],prefs),null);
assert(getFacultyAnswer('And Urdu?',history,prefs).answer.includes('Urdu'));
assert.equal(getFacultyAnswer('Compare Physics faculty qualifications',[],prefs),null);
assert(facultyEvidence('Compare Physics faculty qualifications',[]).includes('Ammar Bin Ahsan'));
assert.throws(()=>parseFaculty('<h4>Incomplete faculty</h4>'));
const res=await app.request('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'List all Physics teachers',history:[],preferences:prefs})});
const stream=await res.text();assert.equal(res.status,200);assert(stream.includes('Ammar Bin Ahsan'));assert(stream.includes('"local":true'));assert(stream.includes('event: sources'));assert(!stream.includes('"fallback":true'));
console.log(`PASS: all ${checks} categories / ${directory.records.length} appointments, exact names, Ammar follow-up, department boundaries, filters, extraction failure and real chat route.`);

