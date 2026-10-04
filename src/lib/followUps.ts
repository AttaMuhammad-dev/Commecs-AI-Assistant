import { resolveLanguage, type Language, type Source } from '../../shared/chat';
type Suggestion = { label: string; question: string };
const suggestions = {
  admissions: [ ['Required documents', 'What documents do I need for admission?'], ['Admission test', 'What should I prepare for the admission test?'] ],
  fees: [ ['Scholarships', 'What scholarships are available and what are their conditions?'], ['Payment rules', 'What happens if I pay the college fee late?'] ],
  scholarships: [ ['Fee structure', 'What is the first-year fee structure for each program?'], ['Application steps', 'How do I apply for admission?'] ],
  programs: [ ['Compare programs', 'Compare Computer Science and Pre-Engineering for a student interested in computing.'], ['Eligibility', 'What are the eligibility requirements for the different programs?'] ],
  faculty: [ ['Computer Science faculty', 'Who are the Computer Science teachers?'], ['Physics faculty', 'Who are the Physics teachers?'] ],
  general: [ ['Explore programs', 'Programs offered'], ['Contact admissions', 'How can I contact the admissions office?'] ],
} as const;
const translations: Record<string, [string, string, string, string]> = {
  'Required documents': ['ضروری کاغذات', 'داخلے کے لیے کون سے کاغذات ضروری ہیں؟', 'Zaroori documents', 'Admission ke liye kon se documents chahiye?'],
  'Admission test': ['داخلہ ٹیسٹ', 'داخلہ ٹیسٹ کی تیاری کیسے کروں؟', 'Admission test', 'Admission test ki tayyari kaise karun?'],
  'Scholarships': ['اسکالرشپس', 'کون سی اسکالرشپس دستیاب ہیں اور ان کی شرائط کیا ہیں؟', 'Scholarships', 'Kon si scholarships available hain aur unki shartein kya hain?'],
  'Payment rules': ['فیس کے اصول', 'فیس دیر سے جمع کرانے پر کیا ہوتا ہے؟', 'Fee ke rules', 'Fee der se jama karane par kya hota hai?'],
  'Fee structure': ['فیس کی تفصیل', 'ہر پروگرام کے پہلے سال کی فیس کتنی ہے؟', 'Fee ki tafseel', 'Har program ke pehle saal ki fee kitni hai?'],
  'Application steps': ['داخلے کے مراحل', 'داخلے کے لیے درخواست کیسے دوں؟', 'Admission ke steps', 'Admission ke liye apply kaise karun?'],
  'Compare programs': ['پروگراموں کا موازنہ', 'کمپیوٹنگ میں دلچسپی ہو تو کمپیوٹر سائنس اور پری انجینئرنگ کا موازنہ کریں۔', 'Programs ka muqabla', 'Computing mein dilchaspi ho to Computer Science aur Pre-Engineering ka muqabla karein.'],
  'Eligibility': ['اہلیت', 'مختلف پروگراموں میں داخلے کی اہلیت کیا ہے؟', 'Eligibility', 'Mukhtalif programs mein admission ki eligibility kya hai?'],
  'Computer Science faculty': ['کمپیوٹر سائنس کے اساتذہ', 'کمپیوٹر سائنس کے اساتذہ کون ہیں؟', 'Computer Science teachers', 'Computer Science ke teachers kon hain?'],
  'Physics faculty': ['فزکس کے اساتذہ', 'فزکس کے اساتذہ کون ہیں؟', 'Physics teachers', 'Physics ke teachers kon hain?'],
  'Explore programs': ['پروگرام دیکھیں', 'کالج میں کون سے پروگرام ہیں؟', 'Programs dekhein', 'College mein kon se programs hain?'],
  'Contact admissions': ['داخلہ دفتر سے رابطہ', 'داخلہ دفتر سے رابطہ کیسے کروں؟', 'Admission office se rabta', 'Admission office se rabta kaise karun?'],
};
export function getFollowUps(question: string, sources: Source[] = [], preference: Language = 'auto'): Suggestion[] {
  const detect = (topic: string) => /scholarship|endowment|اسکالرشپ|وظیفہ/.test(topic) ? 'scholarships' : /fees?|payment|tuition|فیس/.test(topic) ? 'fees' : /faculty|teachers?|اساتذہ|استاد/.test(topic) ? 'faculty' : /admission|eligible|eligibility|داخلہ|اہلیت/.test(topic) ? 'admissions' : /program|engineering|computer|commerce|medical|پروگرام|سائنس/.test(topic) ? 'programs' : null;
  const key = detect(question.toLowerCase()) || detect(sources.map(s => s.url).join(' ').toLowerCase()) || 'general';
  const language = resolveLanguage(question, preference);
  return suggestions[key].map(([label, next]) => {
    const translation = translations[label];
    return language === 'en' ? { label, question: next } : language === 'ur' ? { label: translation[0], question: translation[1] } : { label: translation[2], question: translation[3] };
  }).filter(s => s.question.toLowerCase().trim() !== question.toLowerCase().trim());
}
