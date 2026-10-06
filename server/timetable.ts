import schedule from './data/timetable.json' with {type:'json'};
import {load} from 'cheerio';
import {createHash} from 'node:crypto';
import {readPublic} from './publicRead.js';
import {planQuery} from './queryPlan.js';
import {resolveLanguage,type Preferences,type Source} from '../shared/chat.js';
const origin='https://commecscollege.edu.pk';
export const timetableIntent=(text:string)=>/\b(time\s*table|class (?:schedule|timings)|periods?|weekly schedule)\b|ٹائم ٹیبل|کلاسوں? کے اوقات/i.test(text);
export type TimetableStatus={state:'matched'|'changed'|'unavailable';notice:string;pdf?:string;checkedAt?:string};
let cached:{at:number;value:TimetableStatus}|undefined;
export function resetTimetableCacheForTests(){cached=undefined;}
const publicNotice=(url:string)=>{try{const u=new URL(url);return u.origin===origin&&!u.search&&!u.hash&&!u.username&&!u.password&&/^\/news\/[a-z0-9-]*(?:time-table|timetable|class-schedule)[a-z0-9-]*\/$/.test(u.pathname);}catch{return false;}};
export async function checkTimetable(signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<TimetableStatus>{
  if(signal.aborted)return {state:'unavailable',notice:schedule.notice,pdf:schedule.source};
  if(cached&&Date.now()-cached.at<300000)return cached.value;
  const ac=new AbortController(),stop=()=>ac.abort();signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();const timer=setTimeout(stop,8000);
  try{
    const index=load((await readPublic(origin+'/news-and-update/',ac.signal,fetcher)).text);
    index('header,footer,nav,script,style,form,iframe,.elementor-location-header,.elementor-location-footer').remove();
    const notice=index('a').map((_,a)=>({title:index(a).text().trim(),url:index(a).attr('href')||''})).get().find(a=>/time\s*table|class schedule/i.test(a.title)&&publicNotice(a.url));
    if(!notice)throw Error('No public timetable notice');
    const $=load((await readPublic(notice.url,ac.signal,fetcher)).text);
    $('header,footer,nav,script,style,form,iframe,.elementor-location-header,.elementor-location-footer').remove();
    const pdf=$('a').map((_,a)=>$(a).attr('href')||'').get().find(url=>{try{const u=new URL(url),name=u.pathname.split('/').at(-1)||'';return u.origin===origin&&!u.search&&!u.hash&&!u.username&&!u.password&&/^\/wp-content\/uploads\/\d{4}\/\d{2}\/[^/]+\.pdf$/i.test(u.pathname)&&/(?:^|[-_])TT(?:[-_.]|$)|time[-_]?table|class[-_]?schedule/i.test(name);}catch{return false;}});
    if(!pdf)throw Error('No public timetable PDF');
    let state:TimetableStatus['state']='changed';
    if(pdf===schedule.source){const bytes=(await readPublic(pdf,ac.signal,fetcher,5000000)).bytes;state=createHash('sha256').update(bytes).digest('hex')===schedule.sha256?'matched':'changed';}
    const value:TimetableStatus={state,notice:notice.url,pdf,checkedAt:new Date().toISOString()};cached={at:Date.now(),value};return value;
  }catch{return {state:'unavailable',notice:schedule.notice,pdf:schedule.source};}
  finally{clearTimeout(timer);signal.removeEventListener('abort',stop);}
}
const normalize=(s:string)=>s.toUpperCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function getTimetableAnswer(message:string,history:{role:string;text:string}[],preferences:Preferences,status:TimetableStatus={state:'unavailable',notice:schedule.notice,pdf:schedule.source}){
  const context=planQuery(message,history).contextual;
  if(!timetableIntent(context))return null;
  const language=resolveLanguage(message,preferences.language),ur=language==='ur',roman=language==='roman';
  const sources:Source[]=[{title:'Public class timetable notice',url:status.notice,type:status.checkedAt?'live':'page'},...(status.pdf?[{title:'Public class timetable PDF',url:status.pdf,type:status.checkedAt?'live':'pdf'}]:[])];
  const link=`[${ur?'سرکاری ٹائم ٹیبل':roman?'Official time table':'Official class timetable'}](${status.pdf||status.notice})`;
  if(status.state==='changed')return {answer:(ur?'کالج نے مختلف یا تبدیل شدہ ٹائم ٹیبل شائع کیا ہے۔ نئے پیریڈ ابھی اسسٹنٹ میں پڑھے نہیں گئے، اس لیے پرانے اوقات نہیں دکھاؤں گا۔ ':roman?'College ne different ya changed timetable publish kiya hai. Naye periods abhi assistant mein read nahi hue, is liye purane auqat nahi dikhaunga. ':'The college has published a different or changed timetable. Its periods have not yet been extracted, so I will not show the older schedule. ')+link,sources};
  const checkedDate=status.checkedAt?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Karachi'}).format(new Date(status.checkedAt))+' PKT':'';
  const note=status.state==='matched'?(ur?'کالج کی نیوز فہرست اور منسلک PDF چیک کیے گئے؛ محفوظ PDF سے مطابقت ہے۔':roman?'College ki news list aur linked PDF check kiye; saved PDF se match hain.':'Checked the public news list and linked PDF; it matches the saved document.')+` (${checkedDate})`:(ur?'آج کی ویب سائٹ سے مطابقت چیک نہیں ہو سکی؛ یہ محفوظ ٹائم ٹیبل ہے، اسے تازہ ترین ہونے کی ضمانت نہ سمجھیں۔':roman?'Aaj ki website se match check nahi ho saka; yeh saved timetable hai, latest hone ki guarantee nahi.':'The website check is unavailable. This is a saved timetable; I cannot confirm it is the latest today.');
  const intro=`${link} — **${schedule.session}**, [${ur?'نوٹس':roman?'notice':'notice'} ${schedule.published}](${status.notice}).\n\n${note}`;
  const n=normalize(context),word=(s:string)=>` ${n} `.includes(` ${s} `);
  const year=/\b(XII|12|SECOND YEAR|2ND YEAR)\b/.test(n)?'XII':/\b(XI|11|FIRST YEAR|1ST YEAR)\b/.test(n)?'XI':'';
  const program=/PRE MEDICAL|\bPM\b|پری میڈیکل/.test(n)?'PM':/PRE ENGINEERING|\bPE\b|پری انجینئرنگ/.test(n)?'PE':/COMPUTER SCIENCE|\bCS\b|کمپیوٹر/.test(n)?'CS':/COMMERCE|\bCOM\b|کامرس/.test(n)?'COM':'';
  const allSections=[...new Set(schedule.rows.flatMap(r=>[r.section,r.location].filter(Boolean)))];
  const section=allSections.filter(s=>word(normalize(s))).sort((a,b)=>b.length-a.length)[0];
  const days=['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const relative=/\b(today|tomorrow|aaj|kal)\b|آج|کل/i.test(context);
  const requestedDate=new Date(Date.now()+(/\b(tomorrow|kal)\b|کل/i.test(context)?86400000:0));
  const day=relative?new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Karachi',weekday:'long'}).format(requestedDate):days.find(d=>new RegExp('\\b'+d+'\\b','i').test(context))||(['پیر','منگل','بدھ','جمعرات','جمعہ'].map((d,i)=>context.includes(d)?days[i]:'').find(Boolean))||[['peer','pir'],['mangal'],['budh'],['jumerat','jumeraat'],['jumma','juma']].map((terms,i)=>terms.some(t=>new RegExp('\\b'+t+'\\b','i').test(context))?days[i]:'').find(Boolean);
  const rows=schedule.rows.filter(r=>(!year||r.group.startsWith(year+' '))&&(!program||r.group.endsWith(' '+program))&&(!section||r.section===section||r.location===section)&&(!day||r.day===day));
  const options=[...new Set(rows.map(r=>`${r.group}: ${r.section}${r.location?' / '+r.location:''}`))];
  const primaryMatches=new Set(rows.map(r=>`${r.group}|${r.section}`));
  const ask=ur?'آپ کی کلاس، گروپ اور سیکشن کون سا ہے؟':roman?'Aapki class, group aur section kon sa hai?':'Which year, group and section are you in?';
  // Never guess a section, weekday, teacher identity, or a timetable for a new session.
  const unknownSection=/\bsection\s+(?!is\b|and\b|ka\b)([a-z0-9-]+)/i.exec(context)?.[1];
  const wrongSession=/20\d{2}\s*[-/]\s*(?:20)?\d{2}/g.exec(context)?.[0]?.replace(/\s/g,'');
  if((unknownSection&&!section)||(wrongSession&&wrongSession!==schedule.session&&wrongSession!=='2026-27')||(day&&!days.includes(day))||/\b(saturday|sunday)\b|ہفتہ|اتوار/i.test(context))return {answer:intro+'\n\n'+(ur?'درخواست کردہ دن، سیکشن یا سیشن کی درست مطابقت نہیں ملی۔ براہِ کرم PDF میں مخصوص شیڈول دیکھیں۔':roman?'Requested din, section ya session ka exact match nahi mila. Specific schedule PDF mein dekhein.':'I do not have an exact match for that day, section or session. Please check the specific schedule in the PDF.'),sources};
  if(!section||primaryMatches.size!==1)return {answer:intro+'\n\n'+ask+(options.length&&options.length<=8?'\n\n'+options.join(' · '):''),sources};
  if(!rows.length)return {answer:intro+'\n\n'+ask,sources};
  const tables=rows.map(r=>`### ${r.day} — ${r.group}, ${r.section}${r.location?' / '+r.location:''}\n\n| ${ur?'پیریڈ':roman?'Period':'Period'} | ${ur?'وقت':roman?'Waqt':'Time'} | ${ur?'اصل شیڈول':roman?'Asal schedule':'As published'} |\n| --- | --- | --- |\n`+r.periods.map((p,i)=>`| ${i+1} | ${r.times[i]} | ${p.replace(/\n/g,' / ').replace(/\|/g,'\\|')} |`).join('\n')).join('\n\n');
  return {answer:intro+'\n\n'+tables+'\n\n'+(ur?'مضامین، اساتذہ اور کمروں کے کوڈ اصل PDF کے مطابق ہیں؛ اساتذہ کے مکمل نام اندازے سے نہیں دیے گئے۔':roman?'Subject, teacher aur room codes asal PDF ke mutabiq hain; teacher ke full naam guess nahi kiye.':'Subject, teacher and room codes are preserved from the PDF. Teacher initials have not been expanded into guessed names.'),sources};
}
