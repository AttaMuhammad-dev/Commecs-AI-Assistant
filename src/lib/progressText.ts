import type { RequestProgress } from '../types/chat';
type Language = RequestProgress['language'];
const labels: Record<Language, Record<RequestProgress['phase'] | 'retryTimeout', string>> = {
  en: {
    sending: 'Sending your question…', retrieving: 'Finding relevant college information…',
    website: 'Looking up relevant pages on the official college website…',
    websiteSaved: 'The website lookup was unavailable. Using saved college information…',
    preparing: 'Preparing your answer…', retrying: 'The attempt was unsuccessful. Trying again…',
    retryTimeout: 'The previous attempt took too long. Trying again…',
    checking: 'Checking answer completion and available source links…',
    saved: 'Preparing saved college information…', cached: 'Loading a saved answer…', reviewed: 'Preparing a reviewed answer…',
    fallback: 'Live AI is unavailable. Preparing saved college information…', service: 'Preparing a service update…',
  },
  ur: {
    sending: 'آپ کا سوال بھیجا جا رہا ہے…', retrieving: 'کالج کی متعلقہ معلومات تلاش کی جا رہی ہیں…',
    website: 'کالج کی سرکاری ویب سائٹ پر متعلقہ صفحات دیکھے جا رہے ہیں…',
    websiteSaved: 'ویب سائٹ سے معلومات نہیں مل سکیں۔ کالج کی محفوظ معلومات استعمال کی جا رہی ہیں…',
    preparing: 'آپ کا جواب تیار کیا جا رہا ہے…', retrying: 'کوشش کامیاب نہیں ہوئی۔ دوبارہ کوشش کی جا رہی ہے…',
    retryTimeout: 'پچھلی کوشش میں زیادہ وقت لگا۔ دوبارہ کوشش کی جا رہی ہے…',
    checking: 'جواب کی تکمیل اور دستیاب ماخذ کے لنکس دیکھے جا رہے ہیں…',
    saved: 'کالج کی محفوظ معلومات تیار کی جا رہی ہیں…', cached: 'محفوظ جواب کھولا جا رہا ہے…', reviewed: 'جائزہ شدہ جواب تیار کیا جا رہا ہے…',
    fallback: 'لائیو AI دستیاب نہیں۔ کالج کی محفوظ معلومات تیار کی جا رہی ہیں…', service: 'سروس کی صورتِ حال کا پیغام تیار کیا جا رہا ہے…',
  },
  roman: {
    sending: 'Aap ka sawal bheja ja raha hai…', retrieving: 'College ki mutaliqa maloomat talash ki ja rahi hain…',
    website: 'College ki official website par mutaliqa pages dekhe ja rahe hain…',
    websiteSaved: 'Website lookup dastiyab nahi. College ki mehfooz maloomat istemal ki ja rahi hain…',
    preparing: 'Aap ka jawab tayyar kiya ja raha hai…', retrying: 'Koshish kamyab nahi hui. Dobara koshish ki ja rahi hai…',
    retryTimeout: 'Pichli koshish mein zyada waqt laga. Dobara koshish ki ja rahi hai…',
    checking: 'Jawab ki takmeel aur dastiyab source links dekhe ja rahe hain…',
    saved: 'College ki mehfooz maloomat tayyar ki ja rahi hain…', cached: 'Mehfooz jawab khola ja raha hai…', reviewed: 'Review kiya hua jawab tayyar kiya ja raha hai…',
    fallback: 'Live AI dastiyab nahi. College ki mehfooz maloomat tayyar ki ja rahi hain…', service: 'Service ki surat-e-haal ka paigham tayyar kiya ja raha hai…',
  },
};
export function progressLabel(phase: RequestProgress['phase'], language: Language, reason?: 'timeout') {
  return labels[language][phase === 'retrying' && reason === 'timeout' ? 'retryTimeout' : phase];
}
export function waitingLabel(language: Language, seconds: number) {
  return language === 'ur' ? `ابھی کام جاری ہے… ${seconds} سیکنڈ گزر چکے ہیں` : language === 'roman' ? `Abhi kaam jaari hai… ${seconds} seconds guzar chuke hain` : `Still working… ${seconds}s elapsed`;
}
