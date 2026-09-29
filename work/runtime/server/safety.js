const DISTRESS = [
    /\bsuicid(e|al)\b/i,
    /\b(kill|hurt|harm)\s+my\s?self\b/i,
    /\b(want|wanna|going)\s+to\s+die\b/i,
    /\bend\s+(my\s+life|it\s+all)\b/i,
    /\bgiv(e|ing)\s+up\s+on\s+(everything|life|living)\b/i,
    /\bno\s+(point|reason)\s+(in\s+)?(living|life|going\s+on)\b/i,
    /\b(can'?t|cannot)\s+go\s+on\b/i,
    /\bkhudkushi\b/i,
    /\bmar\s*(na|jana)\s+chahta\b/i,
    /\bzindagi\s+khatam\b/i,
    /خودکشی/, /مرنا چاہتا/, /مر جانا چاہتا/, /زندگی ختم/,
];
const EN = "I'm really sorry you're feeling this way. I'm just a college information assistant, so I can't give you the support you deserve, but please don't keep this to yourself. Talk to someone you trust today: a family member, a close friend, or a teacher. If you feel you might act on these thoughts or are in immediate danger, please contact your local emergency services right now.";
const UR = "مجھے افسوس ہے کہ آپ ایسا محسوس کر رہے ہیں۔ میں صرف کالج کی معلومات کا اسسٹنٹ ہوں اور آپ کو وہ سہارا نہیں دے سکتا جس کے آپ حق دار ہیں، لیکن براہِ کرم یہ بات اپنے تک نہ رکھیں۔ آج ہی کسی قابلِ اعتماد شخص سے بات کریں: گھر والوں، قریبی دوست یا استاد سے۔ اگر آپ کو لگتا ہے کہ آپ خود کو نقصان پہنچا سکتے ہیں یا فوری خطرے میں ہیں تو ابھی مقامی ایمرجنسی سروسز سے رابطہ کریں۔";
export function distressReply(message) {
    if (!DISTRESS.some(r => r.test(message)))
        return null;
    return /[\u0600-\u06FF]/.test(message) ? UR : EN;
}
