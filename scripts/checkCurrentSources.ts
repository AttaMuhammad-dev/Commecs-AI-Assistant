import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {parseRenderedFaculty} from '../server/faculty.js';
import {checkTimetable} from '../server/timetable.js';
import {readPublic} from '../server/publicRead.js';
import {activePrograms} from '../server/programs.js';
import {websiteText} from '../server/officialWebsite.js';
import {load} from 'cheerio';
async function main(){
  const saved=JSON.parse(readFileSync('server/data/faculty-directory.json','utf8'));
  const faculty=async()=>{
    try{
      const records=parseRenderedFaculty((await readPublic(saved.source,AbortSignal.timeout(8000))).text);
      const hash=createHash('sha256').update(JSON.stringify(records)).digest('hex');
      return {state:hash===saved.contentHash?'matched':'changed',appointments:records.length,
        added:records.filter(r=>!saved.records.some((s:{name:string;department:string})=>s.name===r.name&&s.department===r.department)),
        removed:saved.records.filter((s:{name:string;department:string})=>!records.some(r=>s.name===r.name&&s.department===r.department))};
    }catch{return {state:'unavailable'};}
  };
  const programs=async()=>{
    try{
      const url='https://commecscollege.edu.pk/instructions-for-admission/';
      const $=load((await readPublic(url,AbortSignal.timeout(8000))).text),text=websiteText(($('main').length?$('main').html():$('body').html())||'');
      const missing=activePrograms.filter(p=>!text.toLowerCase().includes(p.toLowerCase()));
      return {state:missing.length?'review-required':'matched-known-groups',source:url,missing,
        note:'Checks the four known groups against admissions text. Does not prove no new group exists; offering changes require review, not inference from old archives.'};
    }catch{return {state:'unavailable'};}
  };
  const [roster,timetable,catalog]=await Promise.all([faculty(),checkTimetable(AbortSignal.timeout(8500)),programs()]);
  const report={checkedAt:new Date().toISOString(),faculty:roster,timetable,programs:catalog,humanReviewRequired:true};
  const output=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'eval/results/current-sources.json';
  mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
  if(roster.state!=='matched'||timetable.state!=='matched'||catalog.state!=='matched-known-groups')process.exitCode=1;
}
main().catch(()=>{console.error('Current source check unavailable; no bundled files changed.');process.exitCode=1;});
