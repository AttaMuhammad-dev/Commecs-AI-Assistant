const aliases: Record<string, string> = { fees: 'fee', tuition: 'fee', charges: 'fee', admissions: 'admission', dakhla: 'admission', documents: 'document', scholarships: 'scholarship', teachers: 'faculty', 'فیس': 'fee', 'داخلہ': 'admission', 'داخلے': 'admission', 'اہلیت': 'eligibility', 'اسکالرشپ': 'scholarship', 'اسکالرشپس': 'scholarship', 'وظیفہ': 'scholarship', 'پورٹل': 'portal', 'ٹرانسپورٹ': 'transport', 'اساتذہ': 'faculty' };
const ignored = new Set('what how the is are i a do can me about ki ke ka kitni kitna hai hain mujhe batao کیا ہے ہیں کی کا کے کتنی کتنے'.split(' '));
function tokens(value: string) { return value.toLowerCase().normalize('NFKC').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(t => t && !ignored.has(t)).map(t => aliases[t] || t); }
export function matchesGuideSearch(resource: { title: string; category: string; keywords: string; description?: string; question?: string }, query: string) {
  const terms = tokens(query);
  const haystack = tokens([resource.title, resource.category, resource.keywords, resource.description, resource.question].join(' ')).join(' ');
  return terms.every(term => haystack.includes(term));
}
