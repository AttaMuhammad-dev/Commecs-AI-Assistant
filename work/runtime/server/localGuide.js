import guides from './data/local-guide.json' with { type: "json" };
import { normalizeForBank } from './bank.js';
const portalAliases = new Set([
    'student portal', 'portal', 'student portal link', 'where is the student portal',
    'where is the official student portal', 'how do i access the student portal',
    'where can i check my attendance', 'portal ka link', 'student portal ka link',
].map(normalizeForBank));
export function getLocalGuideAnswer(message, preferences) {
    const normalized = normalizeForBank(message);
    const guide = guides.find(g => normalizeForBank(g.question) === normalized || (g.title === 'Student Portal' && portalAliases.has(normalized)));
    if (!guide)
        return null;
    const urdu = preferences.language === 'ur' || (preferences.language === 'auto' && /[\u0600-\u06ff]/.test(message));
    const roman = preferences.language === 'roman';
    const intro = urdu ? 'کالج کے محفوظ صفحے سے اقتباس (اصل زبان میں)۔ تازہ معلومات کے لیے اصل صفحہ کھولیں۔' : roman ? 'College ke saved page se iqtibas (asal zaban mein). Latest maloomat ke liye official page kholen.' : 'From the saved college page. Open the official source to confirm the latest information.';
    const portal = guide.title === 'Student Portal';
    const answer = portal
        ? (urdu ? 'اپنے بیچ کا پورٹل منتخب کرنے کے لیے [کالج کا Student Portal صفحہ](' : roman ? 'Apne batch ka portal chunne ke liye [official Student Portal page](' : 'Open the [official Student Portal page](') + guide.url + (urdu ? ') کھولیں۔ اپنا پاس ورڈ یہاں شیئر نہ کریں۔' : roman ? ') kholen. Apna password yahan share na karein.' : ') and select your batch. Do not share your password here.')
        : `${intro}\n\n**${guide.title}**\n\n${guide.excerpt}\n\n[Read the full official page](${guide.url})`;
    return { answer, sources: [{ title: guide.title, url: guide.url, modified: guide.modified, type: 'page' }] };
}
