import {resolveLanguage,type Preferences} from '../shared/chat.js';
import {planQuery} from './queryPlan.js';
import {isKnownChanged} from './sourceFreshness.js';
export const activePrograms=['Commerce','Pre-Engineering','Pre-Medical','Computer Science'] as const;
export function getProgramAnswer(message:string,preferences:Preferences){
  const asksList=/\b(?:what|which|list|available|offer\w*|provide|streams?|groups?|disciplines|programs?|courses?)\b|کون|پروگرام|شعب|کورس/i.test(message);
  const humanities=/\bhumanities\b|ہیومینٹیز/i.test(message);
  const specific=/\b(eligib\w*|marks|percentage|fee\w*|scholarship\w*|teacher\w*|faculty|subject\w*|syllabus|test|exam\w*|deadline|documents?|apply|appl\w*|compare|choose|best|better|why|career|history|histor\w*)\b|فیس|اہلیت|اساتذہ|مضامین|مشور/i.test(message);
  if(!humanities&&(specific||!asksList||!planQuery(message).topics.some(t=>t.id==='programs')))return null;
  if(humanities&&/\b(history|histor\w*|2021|used to)\b/i.test(message))return null;
  const lang=resolveLanguage(message,preferences.language),ur=lang==='ur',roman=lang==='roman';
  const intro=ur?'موجودہ داخلہ معلومات میں چار انٹرمیڈیٹ گروپس درج ہیں:':roman?'Current admission maloomat mein chaar Intermediate groups listed hain:':'Current admissions information lists four Intermediate groups:';
  const correction=humanities?'\n\n'+(ur?'ہیومینٹیز موجودہ داخلہ گروپس میں درج نہیں۔ پرانے About یا پروگرام آرکائیو کو موجودہ پیشکش کی تصدیق نہ سمجھیں۔':roman?'Humanities current admission groups mein listed nahi. Purane About ya program archive ko current offering ki tasdeeq na samjhein.':'Humanities is not listed among the current admission groups. Older About and program archive pages do not establish a current offering.') : '';
  const sources=[{title:'Instructions for Admission',url:'https://commecscollege.edu.pk/instructions-for-admission/',type:'page'},{title:'Eligibility',url:'https://commecscollege.edu.pk/eligibility/',type:'page'}].filter(s=>!isKnownChanged(s.url));
  if(!sources.length)return null;
  return {answer:intro+'\n\n'+activePrograms.map(p=>'- **'+p+'**').join('\n')+correction+'\n\n'+sources.map(s=>`[${s.title}](${s.url})`).join(' · '),sources};
}
