import { retrieveEvidence, type Evidence } from './knowledge.js';
import { getFacultyAnswer } from './faculty.js';
import { resolveLanguage, type Preferences } from '../shared/chat.js';

export function getSavedEvidence(message: string, history: { role: string; text: string }[], preferences: Preferences, supplied?: Evidence[]) {
  // Do not substitute public policies for a request to disclose personal records.
  if (/\b(cnic|password|salary)\b|\b(my|his|her)\s+(admission\s+)?(result|attendance|record)\b/i.test(message)) return null;
  const faculty = getFacultyAnswer(message, history, preferences, true);
  const language = resolveLanguage(message, preferences.language);
  const urdu = language === 'ur';
  const live = supplied?.some(e => e.source.type === 'live');
  const intro = live ? urdu ? 'AI کا جواب دستیاب نہیں۔ اس سوال کے لیے سرکاری ویب سائٹ سے حاصل کیے گئے اقتباسات نیچے ہیں۔ یہ سوال کے کچھ حصے کا جواب دے سکتے ہیں۔' : language === 'roman' ? 'AI ka jawab abhi available nahi. Is sawal ke liye official website se hasil kiye gaye excerpts neeche hain; yeh sawal ke kuch hisson ka jawab de sakte hain.' : 'The AI answer is temporarily unavailable. Below are official page extracts retrieved for this question; they may cover only part of it.'
    : urdu ? 'لائیو AI دستیاب نہیں۔ یہ محفوظ سرکاری ذرائع کے اقتباسات ہیں۔ معلومات کی تاریخ دیکھیں؛ یہ آپ کے سوال کے صرف کچھ حصے کا جواب دے سکتے ہیں۔'
    : language === 'roman' ? 'Live AI abhi available nahi. Yeh saved official sources ke excerpts hain. Source ki date dekhein; yeh sawal ke sirf kuch hisson ka jawab de sakte hain.'
    : 'Live AI is temporarily unavailable. This fallback uses saved official-source extracts and reviewed college information. Check the source date; they may cover only part of your question.';
  if (faculty) return { ...faculty, answer: intro + '\n\n' + faculty.answer };
  const candidates = supplied?.length ? supplied : retrieveEvidence(message, history, preferences.responseStyle === 'concise' ? 2200 : 4500);
  const distinct = new Map<string, typeof candidates[number]>();
  for (const candidate of candidates) {
    const existing = distinct.get(candidate.source.url);
    if (!existing || (existing.kind === 'page' && candidate.kind === 'reviewed')) distinct.set(candidate.source.url, candidate);
  }
  const evidence = [...distinct.values()].slice(0, 2);
  if (!evidence.length) return null;
  return { answer: intro + '\n\n' + evidence.map(e => `### ${e.source.title}\nSource date: ${e.source.modified?.slice(0, 10) || 'not recorded'}.${e.reviewedAt ? ` Review date: ${e.reviewedAt.slice(0, 10)}.` : ''} ${e.kind === 'reviewed' ? 'Previously reviewed answer' : e.partial ? 'Selected extract' : 'Saved text'} in the source language:\n\n${e.text}\n\n[Read the official source](${e.source.url})`).join('\n\n---\n\n'),
    sources: [...new Map(evidence.flatMap(e => e.sources).map(s => [s.url, s])).values()] };
}
