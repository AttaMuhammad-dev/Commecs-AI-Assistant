import { retrieveEvidence } from './knowledge.js';
import { getFacultyAnswer } from './faculty.js';
import type { Preferences } from '../shared/chat.js';

export function getSavedEvidence(message: string, history: { role: string; text: string }[], preferences: Preferences) {
  // Do not substitute public policies for a request to disclose personal records.
  if (/\b(cnic|password|salary)\b|\b(my|his|her)\s+(admission\s+)?(result|attendance|record)\b/i.test(message)) return null;
  const faculty = getFacultyAnswer(message, history, preferences, true);
  const urdu = preferences.language === 'ur' || preferences.language === 'auto' && /[\u0600-\u06ff]/.test(message);
  const intro = urdu ? 'لائیو AI دستیاب نہیں۔ یہ محفوظ سرکاری ذرائع کے اقتباسات ہیں۔ معلومات کی تاریخ دیکھیں؛ یہ آپ کے سوال کے صرف کچھ حصے کا جواب دے سکتے ہیں۔'
    : preferences.language === 'roman' ? 'Live AI abhi available nahi. Yeh saved official sources ke excerpts hain. Source ki date dekhein; yeh sawal ke sirf kuch hisson ka jawab de sakte hain.'
    : 'Live AI is temporarily unavailable. This fallback uses saved official-source extracts and reviewed college information. Check the source date; they may cover only part of your question.';
  if (faculty) return { ...faculty, answer: intro + '\n\n' + faculty.answer };
  const evidence = retrieveEvidence(message, history).slice(0, 2);
  if (!evidence.length) return null;
  return { answer: intro + '\n\n' + evidence.map(e => `### ${e.source.title}\n${e.source.type === 'reviewed' ? 'Review date' : 'Source date'}: ${e.source.modified || 'not recorded'}. ${e.source.type === 'reviewed' ? 'Previously reviewed answer' : e.partial ? 'Selected extract' : 'Saved text'} in the source language:\n\n${e.text}\n\n[Read the official source](${e.source.url})`).join('\n\n---\n\n'),
    sources: evidence.map(e => e.source) };
}
