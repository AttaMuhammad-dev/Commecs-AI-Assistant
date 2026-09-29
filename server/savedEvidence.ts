import guides from './data/local-guide.json' with { type: 'json' };
import { getFacultyAnswer } from './faculty.js';
import type { Preferences } from '../shared/chat.js';
const stop=new Set('the a an and or to of for in on is are was were me tell please about what how do does can college commecs explain also published policy rules'.split(' '));
const tokens=(text:string)=>[...new Set(text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).map(s=>({fees:'fee',charges:'fee',scholarships:'scholarship',teachers:'faculty',documents:'document',payments:'payment',admissions:'admission'}[s]||s)).filter(s=>s.length>2&&!stop.has(s)))];
export function getSavedEvidence(message:string, history:{role:string;text:string}[], preferences:Preferences) {
  const faculty=getFacultyAnswer(message,history,preferences,true);
  const urdu=preferences.language==='ur'||preferences.language==='auto'&&/[\u0600-\u06ff]/.test(message);
  const intro=urdu?'لائیو AI دستیاب نہیں۔ ذیل میں محفوظ سرکاری ذرائع کے اقتباسات ہیں، یہ نیا AI جواب نہیں ہے۔':preferences.language==='roman'?'Live AI abhi available nahi. Neeche saved official sources ke excerpts hain; yeh naya AI jawab nahi hai.':'Live AI is temporarily unavailable. These are saved official-source extracts, not a newly generated answer. They may cover only part of your question.';
  if(faculty)return {...faculty,answer:intro+'\n\n'+faculty.answer};
  // Do not turn personal-record requests into a misleading general source answer.
  if(/\b(my|his|her|cnic|password|result|salary)\b/i.test(message))return null;
  let query=tokens(message);
  if(query.length<3&&/\b(it|that|those|them|this|more)\b/i.test(message))query=tokens((history.filter(h=>h.role==='user').at(-1)?.text||'')+' '+message);
  const ranked=guides.filter(g=>g.title!=='Faculty').map(g=>{
    const title=new Set(tokens(g.title+' '+g.keywords));
    const body=new Set(tokens(g.excerpt));
    const strong=query.filter(t=>title.has(t)).length;
    const overlap=query.filter(t=>body.has(t)).length;
    return {g,score:strong*4+overlap,strong,overlap};
  }).filter(r=>r.strong>=1&&r.overlap>=2).sort((a,b)=>b.score-a.score).slice(0,2);
  if(!ranked.length)return null;
  return {answer:intro+'\n\n'+ranked.map(({g})=>`### ${g.title}\nSource date: ${g.modified || 'not recorded'}. Excerpt in the source language:\n\n${g.excerpt}\n\n[Read the full official page](${g.url})`).join('\n\n---\n\n'),sources:ranked.map(({g})=>({title:g.title,url:g.url,modified:g.modified,type:'page'}))};
}
