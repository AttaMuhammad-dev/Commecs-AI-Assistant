import { resolveLanguage, type Language, type Source } from '../../shared/chat';
import { planQuery } from '../../shared/queryPlan';
type Suggestion = { label: string; question: string };
const suggestions = {
  timetable: [ ['Class timetable', 'Show the latest class timetable and available sections.'], ['Academic planner', 'Where can I find the academic planner and macro plans?'] ],
  devices: [ ['Contacting parents', 'How can students contact their parents if phones are not allowed on campus?'], ['Campus rules', 'What other rules should students follow on campus?'] ],
  campusRules: [ ['Attendance rules', 'What are the attendance and punctuality rules?'], ['Dress code', 'What is the student dress code?'] ],
  activities: [ ['Joining a club', 'How can students join clubs and societies at Commecs?'], ['Club activities', 'What activities and competitions can students take part in?'] ],
  sports: [ ['Sports facilities', 'What sports facilities are available on campus?'], ['Sports participation', 'What sports competitions can Commecs students participate in?'] ],
  facilities: [ ['Library access', 'When can students use the library and its computers?'], ['Computer facilities', 'What computer and internet facilities are available to students?'] ],
  transport: [ ['Transport arrangements', 'How is college transport arranged for students?'], ['Pickup information', 'Where can I confirm transport routes and pickup details?'] ],
  counselling: [ ['Student support', 'What counselling support can students use at Commecs?'], ['Career guidance', 'How does the college help students with career guidance?'] ],
  contact: [ ['Campus location', 'Where is Commecs College located?'], ['Office hours', 'When can I contact the college office?'] ],
  admissions: [ ['Required documents', 'What documents do I need for admission?'], ['Admission test', 'What should I prepare for the admission test?'] ],
  fees: [ ['Scholarships', 'What scholarships are available and what are their conditions?'], ['Payment rules', 'What happens if I pay the college fee late?'] ],
  scholarships: [ ['Fee structure', 'What is the first-year fee structure for each program?'], ['Application steps', 'How do I apply for admission?'] ],
  programs: [ ['Compare programs', 'Compare Computer Science and Pre-Engineering for a student interested in computing.'], ['Eligibility', 'What are the eligibility requirements for the different programs?'] ],
  faculty: [ ['Computer Science faculty', 'Who are the Computer Science teachers?'], ['Physics faculty', 'Who are the Physics teachers?'] ],
} as const;
const translations: Record<string, [string, string, string, string]> = {
  'Class timetable': ['کلاس ٹائم ٹیبل', 'تازہ کلاس ٹائم ٹیبل اور دستیاب سیکشن دکھائیں۔', 'Class time table', 'Latest class timetable aur available sections batao.'],
  'Academic planner': ['تعلیمی منصوبہ', 'تعلیمی منصوبہ اور میکرو پلان کہاں ملیں گے؟', 'Academic planner', 'Academic planner aur macro plans kahan milenge?'],
  'Contacting parents': ['والدین سے رابطہ', 'اگر کیمپس میں فون کی اجازت نہیں تو طلبہ والدین سے کیسے رابطہ کریں؟', 'Parents se rabta', 'Agar campus mein phones allowed nahi to students parents se kaise rabta karein?'],
  'Campus rules': ['کیمپس کے اصول', 'طلبہ کو کیمپس میں اور کون سے اصول اپنانے چاہئیں؟', 'Campus ke rules', 'Students ko campus mein aur kon se rules follow karne chahiye?'],
  'Attendance rules': ['حاضری کے اصول', 'حاضری اور وقت کی پابندی کے کیا اصول ہیں؟', 'Hazri ke rules', 'Hazri aur waqt ki pabandi ke kya rules hain?'],
  'Dress code': ['وردی کے اصول', 'طلبہ کی وردی کے کیا اصول ہیں؟', 'Uniform ke rules', 'Students ki uniform ke kya rules hain?'],
  'Joining a club': ['کلب میں شمولیت', 'طلبہ کامیکس کے کلب اور سوسائٹیز میں کیسے شامل ہوں؟', 'Club join karna', 'Students Commecs ke clubs aur societies kaise join karein?'],
  'Club activities': ['کلب کی سرگرمیاں', 'طلبہ کون سی سرگرمیوں اور مقابلوں میں حصہ لے سکتے ہیں؟', 'Club activities', 'Students kon si activities aur competitions mein hissa le sakte hain?'],
  'Sports facilities': ['کھیلوں کی سہولیات', 'کیمپس میں کھیلوں کی کون سی سہولیات ہیں؟', 'Khelon ki facilities', 'Campus mein khelon ki kon si facilities hain?'],
  'Sports participation': ['کھیلوں میں شرکت', 'کامیکس کے طلبہ کھیلوں کے کون سے مقابلوں میں حصہ لے سکتے ہیں؟', 'Khelon mein hissa', 'Commecs ke students khelon ke kon se muqablon mein hissa le sakte hain?'],
  'Library access': ['لائبریری کا استعمال', 'طلبہ لائبریری اور اس کے کمپیوٹر کب استعمال کر سکتے ہیں؟', 'Library ka istemal', 'Students library aur uske computers kab use kar sakte hain?'],
  'Computer facilities': ['کمپیوٹر کی سہولیات', 'طلبہ کے لیے کمپیوٹر اور انٹرنیٹ کی کون سی سہولیات ہیں؟', 'Computer facilities', 'Students ke liye computer aur internet ki kon si facilities hain?'],
  'Transport arrangements': ['ٹرانسپورٹ کا انتظام', 'طلبہ کے لیے کالج ٹرانسپورٹ کا انتظام کیسے ہوتا ہے؟', 'Transport ka intizam', 'Students ke liye college transport ka intizam kaise hota hai?'],
  'Pickup information': ['پک اپ کی معلومات', 'ٹرانسپورٹ کے راستوں اور پک اپ کی تفصیل کہاں سے معلوم کروں؟', 'Pickup maloomat', 'Transport routes aur pickup ki tafseel kahan se confirm karun?'],
  'Student support': ['طلبہ کی معاونت', 'کامیکس میں طلبہ کے لیے مشاورت کی کون سی سہولت ہے؟', 'Students ki madad', 'Commecs mein students ke liye counselling ki kon si sahulat hai?'],
  'Career guidance': ['کیریئر کی رہنمائی', 'کالج طلبہ کی کیریئر کے لیے کیسے رہنمائی کرتا ہے؟', 'Career ki rehnumai', 'College students ki career ke liye kaise rehnumai karta hai?'],
  'Campus location': ['کالج کا مقام', 'کامیکس کالج کہاں واقع ہے؟', 'College ki location', 'Commecs College kahan hai?'],
  'Office hours': ['دفتر کے اوقات', 'کالج کے دفتر سے کب رابطہ کر سکتا ہوں؟', 'Office ke auqat', 'College office se kab rabta kar sakta hun?'],
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
export function getFollowUps(question: string, sources: Source[] = [], preference: Language = 'auto', history: { role: string; text: string }[] = []): Suggestion[] {
  type Key = keyof typeof suggestions;
  let keys: Key[] = /faculty|teachers?|اساتذہ|استاد/i.test(question) ? ['faculty'] : planQuery(question, history).topics.map(t => t.id).filter(id => id in suggestions);
  if(keys.includes('timetable'))keys=['timetable'];
  // Only a single specific source can resolve an otherwise unknown topic.
  // Broad documents or mixed search results must not invent relevance.
  if (!keys.length && sources.length === 1 && /^(tell me more|more|what about that|aur batao|مزید بتائیں)[?.؟!\s]*$/i.test(question.trim())) {
    let path = ''; try { path = new URL(sources[0].url).pathname; } catch { /* Ignore malformed metadata. */ }
    const key: Key | undefined = /students-code-of-conduct|discipline-policy/.test(path) ? 'campusRules' : /scholarship|endowment/.test(path) ? 'scholarships' : /fee-payment-policy|Approved-Fee-Structure/.test(path) ? 'fees' : /eligibility|instructions-for-admission/.test(path) ? 'admissions' : /contact-us/.test(path) ? 'contact' : undefined;
    if (key) keys = [key];
  }
  const language = resolveLanguage(question, preference);
  const localize = ([label, next]: readonly [string, string]) => {
    const translation = translations[label];
    return language === 'en' ? { label, question: next } : language === 'ur' ? { label: translation[0], question: translation[1] } : { label: translation[2], question: translation[3] };
  };
  const groups = keys.map(key => suggestions[key].map(localize).filter(s => s.question.toLowerCase().trim() !== question.toLowerCase().trim()));
  const candidates = groups.length > 1 ? groups.map(group => group[0]).filter((s): s is Suggestion => !!s) : groups.flat();
  return [...new Map(candidates.map(s => [s.question, s])).values()].slice(0, 2);
}
