type Turn = { role: string; text: string };
// Search concepts expand natural phrasing; they never assert that a facility exists.
const concepts = [
  { id: 'activities', match: /\b(club|clubs|society|societies|extracurricular|co.?curricular|student life|campus life|introvert|shy|confidence|socialise|socialize|debate\w*|declamation\w*|essay|public speaking)\b|سوسائٹ|کلب|غیر نصابی/i, terms: ['club', 'society', 'activity', 'development'], search: 'clubs' },
  { id: 'sports', match: /\b(sport|sports|games|athletics|basketball|cricket|football|khel|khelon)\b|کھیل/i, terms: ['sport'], search: 'sports' },
  { id: 'facilities', match: /\b(facilit\w*|library|libraries|lab|labs|computer access|internet|wifi|wi.fi|campus environment)\b|لائبریری|لیب|سہولت|انٹرنیٹ/i, terms: ['facility'], search: 'facilities' },
  { id: 'transport', match: /\b(transport|bus|buses|commut\w*|pick.?up|van|shuttle)\b|ٹرانسپورٹ|بس/i, terms: ['transport'], search: 'transport' },
  { id: 'fees', match: /\b(fee|fees|tuition|cost|costs|charges|payment|payments|penalt\w*|readmission|afford\w*)\b|فیس|جرمانہ/i, terms: ['fee'], search: 'fee' },
  { id: 'scholarships', match: /\b(scholarship\w*|discount\w*|financial (?:aid|assistance|help)|need.based|merit.based|sibling)\b|وظیفہ|اسکالرشپ|رعایت/i, terms: ['scholarship', 'discount'], search: 'scholarship' },
  { id: 'admissions', match: /\b(admission\w*|appl\w*|enrol\w*|dakhla|dakhle|eligib\w*|qualif\w*|percentage|marks|documents|paperwork|entry test)\b|داخل|اہلیت|دستاویز|نمبر|فیصد/i, terms: ['admission', 'eligible'], search: 'admission' },
  { id: 'programs', match: /\b(program\w*|course\w*|subject\w*|discipline\w*|commerce|pre.?medical|pre.?engineering|computer science|career|future|degree)\b|مضمون|مضامین|شعب|پروگرام/i, terms: ['program'], search: 'program' },
  { id: 'counselling', match: /\b(counsel\w*|mental|stress\w*|anxious|anxiety|well.?being|support|guidance)\b|مشاورت|ذہنی|پریشان/i, terms: ['counselling'], search: 'counselling' },
  { id: 'contact', match: /\b(contact|phone|email|address|location|where is|rabta)\b|رابطہ|پتہ/i, terms: ['contact'], search: 'contact' },
] as const;
const filler = new Set('the a an and or to of for in on at with there any some have has is are was were me tell please about what how do does can could would should college commecs explain also published official detail details detailed information i my we our you your it its they their them this that those which who such really available beneficial benefits benefit students student use useful help helps want need know like not no specific exact list listed exist exists beyond classroom studies develop grow play happens pay paid hai hain ka ki ke ko kya mujhe mein se aur par ye yeh batao bata dein kitna kitni kitne کیا ہے ہیں کتنی کتنے مجھے بتائیں کی کا کے میں'.split(' '));
const aliases: Record<string, string> = {
  fees: 'fee', charges: 'fee', tuition: 'fee', cost: 'fee', costs: 'fee', scholarships: 'scholarship', documents: 'document', payments: 'payment', admissions: 'admission', apply: 'admission', applying: 'admission', dakhla: 'admission', dakhle: 'admission', eligibility: 'eligible', marks: 'percentage', percentages: 'percentage', late: 'penalty', penalties: 'penalty', fines: 'penalty', fine: 'penalty', subjects: 'subject', courses: 'program', programmes: 'program', programs: 'program', course: 'program', programme: 'program', bus: 'transport', buses: 'transport', uniforms: 'uniform', phone: 'contact', number: 'contact', rules: 'policy', policies: 'policy', clubs: 'club', societies: 'society', activities: 'activity', facilities: 'facility', teachers: 'teacher', books: 'book', sports: 'sport', counselling: 'counselling', counseling: 'counselling', counselors: 'counselling', counselor: 'counselling', confidence: 'development', confident: 'development', coeducational: 'coeducation', girls: 'coeducation', boys: 'coeducation', 'فیکلٹی': 'faculty', 'اساتذہ': 'teacher', 'استاد': 'teacher', 'فیس': 'fee', 'داخلہ': 'admission', 'داخلے': 'admission', 'اہلیت': 'eligible', 'نمبر': 'percentage', 'فیصد': 'percentage', 'وظیفہ': 'scholarship', 'اسکالرشپ': 'scholarship', 'وردی': 'uniform', 'ٹرانسپورٹ': 'transport', 'جرمانہ': 'penalty', 'کتاب': 'book', 'کتابیں': 'book', 'کتابوں': 'book', 'رابطہ': 'contact', 'شکایت': 'grievance', 'کلب': 'club', 'کھیل': 'sport', 'سوسائٹیز': 'society', 'لائبریری': 'library', 'لیب': 'lab', 'سہولیات': 'facility', 'اعتماد': 'development', 'نصابی': 'activity',
};
export function searchTokens(text: string): string[] {
  return [...new Set(text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).map(t => aliases[t] || t).filter(t => t.length > 2 && !filler.has(t) && !/^\d+$/.test(t)))];
}
export function planQuery(message: string, history: Turn[] = []) {
  const previous = history.filter(h => h.role === 'user').at(-1)?.text || '';
  const current = concepts.filter(c => c.match.test(message));
  const prior = concepts.filter(c => c.match.test(previous));
  const changed = current.some(c => !prior.some(p => p.id === c.id));
  const followup = message.length < 180 && /\b(it|that|those|them|this|more|what about|and|iska|uska|aur|yeh|these)\b|اس کی|اس کا|مزید/i.test(message);
  const contextual = followup && !changed ? previous + ' ' + message : message;
  const topics = concepts.filter(c => c.match.test(contextual));
  const tokens = searchTokens(contextual);
  const expanded = [...new Set([...tokens, ...topics.flatMap(c => c.terms)])];
  return { contextual, tokens, expanded, topics, specific: /\b(does|is there|do (?:you|they|commecs)|specific|exact|named|deadline|hours|timings|when|where)\b|کب|اوقات|خاص/i.test(message) || /\b\w+\s+(?:club|lab|society)\b/i.test(message), fresh: /\b(latest|today|current|currently|now|new|upcoming|this year|this session|check (?:the )?(?:official )?website)\b|تازہ|ابھی|آج/i.test(message),
    reasoning: /\b(why|how.*(?:benefit|help|improve)|beneficial|recommend|suggest|compare|better|choose|plan|advic\w*|should i|what if|faid\w*|fayd\w*|madad|behtar)\b|کیوں|فائد|مشور|بہتر/i.test(message) };
}
