import { resolveLanguage, type Preferences } from '../shared/chat.js';
export function boundaryResponse(message: string, preferences: Preferences) {
  const security = /\b(show|reveal|print|give|send|share|expose|display)\b[\s\S]{0,100}\b(api\s*keys?|system\s*prompts?|hidden\s*instructions?|credentials)\b|\b(api key|system prompt)\b.{0,40}\b(dikhao|batao)\b|(?:API|سسٹم).{0,30}(?:کلید|پرومپٹ).{0,20}(?:دکھا|بتا)/i.test(message);
  const providedCriteria = /[0-9۰-۹٠-٩]/.test(message) && /\b(eligib\w*|qualify|apply|scholarship\w*|exam\w*)\b|اہل|داخل|اسکالرشپ/i.test(message);
  const disclosure = /\b(show|fetch|retrieve|reveal|disclose|access)\b|دکھا|\bdikhao\b/i.test(message);
  const privacy = (!providedCriteria || disclosure) && (/\b(my|his|her|someone(?:'s)?|student(?:'s)?)\s+(?:admission\s+)?(?:result|attendance|record|password|cnic|salary)s?\b|\b(?:did|has)\b.{1,80}\b(?:pass(?:ed)?|get selected|been admitted)\b.{0,40}\badmission (?:test|interview)\b|\bwho\b.{0,30}\bpassed\b.{0,30}\badmission test\b|\b(mera|meri|uska|uski)\b.{0,30}\b(result|attendance|record|password|cnic)\b|(?:میرا|میری|اس کا|اس کی).{0,25}(?:نتیجہ|حاضری|ریکارڈ|پاس ورڈ)/i.test(message));
  if (!security && !privacy) return null;
  const notice = security ? 'security' as const : 'privacy' as const;
  const language = resolveLanguage(message, preferences.language);
  const text = security ? {
    en: 'I can’t share API keys or private instructions. I can help with college admissions, programs, fees and student life.',
    ur: 'میں API کی کلیدیں یا نجی ہدایات شیئر نہیں کر سکتا۔ میں کالج کے داخلے، پروگرام، فیس اور طلبہ کی سرگرمیوں میں مدد کر سکتا ہوں۔',
    roman: 'Main API keys ya private instructions share nahi kar sakta. College ke admissions, programs, fees aur student life mein madad kar sakta hoon.',
  } : {
    en: 'I can’t access or disclose individual students’ admission results, attendance or other private records. For your own record, use the [official student portal](https://commecscollege.edu.pk/student-portal/) or contact admissions. Don’t share passwords here.',
    ur: 'میں کسی طالب علم کے داخلے کے نتیجے، حاضری یا دوسرے نجی ریکارڈ تک رسائی یا انہیں شیئر نہیں کر سکتا۔ اپنے ریکارڈ کے لیے [سرکاری اسٹوڈنٹ پورٹل](https://commecscollege.edu.pk/student-portal/) استعمال کریں یا داخلہ دفتر سے رابطہ کریں۔ پاس ورڈ یہاں شیئر نہ کریں۔',
    roman: 'Main kisi student ka admission result, attendance ya private record access ya share nahi kar sakta. Apne record ke liye [official student portal](https://commecscollege.edu.pk/student-portal/) istemal karein ya admission office se rabta karein. Password yahan share na karein.',
  };
  return { notice, text: text[language] };
}
