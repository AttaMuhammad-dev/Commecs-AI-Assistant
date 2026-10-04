import { planQuery } from './queryPlan.js';
export function routeQuestion(message: string, history: { role: string; text: string }[]): { lane: 'fast' | 'deep'; reason: string } {
  const text = message.toLowerCase();
  const comparison = /\b(compare|vs|versus|difference|farq|better|behtar|best|kaun sa|suggest|recommend)\b|موازنہ|فرق|بہتر|کون سا/i;
  const eligibility = /\b(eligible|eligibility|qualify|can i apply|kya main|apply kar sakt[ai]|mil sakta|marks|percentage)\b|اہل|اہلیت|داخلہ لے|نمبر|فیصد/i;
  const calculation = /\b(total|calculate|after discount|after scholarship|kitna banega|kitna lagega)\b|کل فیس|حساب|رعایت کے بعد/i;
  const fees = /\b(fee|fees|cost|discount|scholarship)\b|فیس|وظیفہ|رعایت/i;
  if (comparison.test(text)) return { lane: 'deep', reason: 'comparison' };
  if (message.length > 240 && (message.match(/[?؟]/g) || []).length >= 2) return { lane: 'deep', reason: 'multi-part' };
  const hasNumber = /[0-9۰-۹٠-٩]/.test(text);
  const previous = history.filter(h => h.role === 'user').at(-1)?.text || '';
  if (hasNumber && (eligibility.test(text) || calculation.test(text) || (text.length < 70 && eligibility.test(previous)))) return { lane: 'deep', reason: 'personal-criteria-or-calculation' };
  if (fees.test(text) && eligibility.test(text)) return { lane: 'deep', reason: 'fees-and-eligibility' };
  if (planQuery(message, history).reasoning) return { lane: 'deep', reason: 'explanation-or-guidance' };
  if (planQuery(message, history).fresh) return { lane: 'deep', reason: 'fresh-source-lookup' };
  return { lane: 'fast', reason: 'lookup' };
}
