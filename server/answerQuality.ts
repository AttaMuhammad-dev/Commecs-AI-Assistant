// These checks catch unsupported numeric claims; they do not verify prose or
// establish that a cited number was applied to the correct policy/program.
const normalize = (text: string) => text.replace(/[۰-۹٠-٩]/g, c => String(c.charCodeAt(0) >= 0x6f0 ? c.charCodeAt(0) - 0x6f0 : c.charCodeAt(0) - 0x660)).replace(/[,،٬]/g, '').replace(/٫/g, '.').replace(/\*\*/g, '');
const values = (text: string) => new Set((normalize(text).match(/\d+(?:\.\d+)?/g) || []).map(Number));
export function unsupportedNumericClaims(answer: string, evidence: string, question = '') {
  const supported = values(evidence), inputs = new Set([...supported, ...values(question)]);
  const text = normalize(answer);
  // Accept a displayed binary calculation only when both inputs were supplied.
  // The constant 100 is permitted for converting a percentage to a fraction.
  const calculations = new Set<number>();
  const expression = /(\d+(?:\.\d+)?)\s*([×x*+−\-/])\s*(\d+(?:\.\d+)?)\s*=\s*(?:Rs\.?|PKR)?\s*(\d+(?:\.\d+)?)/gi;
  for (const m of text.matchAll(expression)) {
    const a = Number(m[1]), b = Number(m[3]), result = Number(m[4]);
    const known = (n: number) => inputs.has(n) || calculations.has(n);
    if (!known(a) || (!known(b) && !(m[2] === '/' && b === 100))) continue;
    const computed = m[2] === '+' ? a + b : ['-', '−'].includes(m[2]) ? a - b : m[2] === '/' ? a / b : a * b;
    if (Number.isFinite(computed) && Math.abs(computed - result) < 0.011) calculations.add(result);
  }
  const claims = new Set<number>();
  for (const regex of [/(?:Rs\.?|PKR|rupees)\s*(-?\d+(?:\.\d+)?)/gi, /(-?\d+(?:\.\d+)?)\s*(?:%|per\s*cent\b|percentage\b|فیصد|روپے|rupees\b|rupay\b|rupey\b|PKR\b|Rs\b)/gi]) {
    for (const m of text.matchAll(regex)) claims.add(Number(m[1]));
  }
  return [...claims].filter(n => !supported.has(n) && !values(question).has(n) && !calculations.has(n));
}

// Narrow completeness check for an inherited late-payment question. The amount
// comes from an original supplied policy, not a hardcoded answer-bank value.
export function missingLatePenalty(answer: string, contextualQuestion: string, originalPolicies: string[]) {
  if (!(/\b(fees?|payment)\b|فیس/i.test(contextualQuestion) && /\b(late|overdue)\b|دیر|تاخیر|der se/i.test(contextualQuestion))) return false;
  const penalties = new Set(originalPolicies.flatMap(text => [...normalize(text).matchAll(/penalty of\s*(?:Rs\.?|PKR)\s*(\d+(?:\.\d+)?)/gi)].map(m => Number(m[1]))));
  // Conflicting/unknown source amounts require reasoning, not this narrow guard.
  return penalties.size === 1 && ![...penalties].some(n => values(answer).has(n));
}
