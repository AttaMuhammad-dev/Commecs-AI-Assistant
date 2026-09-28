export interface MockEntry {
  keywords: string[];
  answer: string;
  source: string | null;
}

export const mockResponses: MockEntry[] = [
  {
    keywords: ["program", "programs", "subjects", "disciplines", "courses", "streams"],
    answer: "Commecs offers four main disciplines at the intermediate level: Commerce, Pre-Engineering, Pre-Medical, and Computer Science. *(Placeholder — Phase 2 will confirm the current full list.)*",
    source: "Academics"
  },
  {
    keywords: ["established", "founded", "history", "since"],
    answer: "Commecs College was founded in 1993 by the Commecs Educational Trust, a non-profit set up by the alumni association of Government College of Commerce & Economics.",
    source: "About"
  },
  {
    keywords: ["apply", "admission", "admissions", "how to apply", "join", "dakhla", "daakhla"],
    answer: "Admissions run once a year, with an Admission Process page, Eligibility criteria, and the Commecs Admission Test (CAT). *(Placeholder — exact current dates come in Phase 2.)*",
    source: "Admissions"
  },
  {
    keywords: ["fee", "fees", "cost", "tuition", "scholarship", "scholarships", "financial aid", "discount", "sibling"],
    answer: "Fee details are published each session on the Fee Payment Policy page — I'll pull the live figure once connected to the real site. Commecs also offers merit-based, need-based, and mid-term scholarships, plus a sibling discount. *(Placeholder — exact amounts come in Phase 2.)*",
    source: "Admissions — Fees & scholarships"
  },
  {
    keywords: ["board", "affiliat*", "biek", "recognised", "recognized"],
    answer: "The intermediate programs are affiliated with the Board of Intermediate Education Karachi (BIEK), based on the college's own site. *(Worth double-checking before this goes live.)*",
    source: "About"
  },
  {
    keywords: ["contact", "phone", "email", "address", "whatsapp", "rabta"],
    answer: "You can reach Commecs via the Contact Us page or their official WhatsApp channel and social pages. *(Placeholder — real details in Phase 2.)*",
    source: "Contact Us"
  }
];

export const defaultFallback: MockEntry = {
  keywords: [],
  answer: "I don't have a confident answer for that in this preview — the real version will check the live site and point you to admissions if it's unsure.",
  source: null
};

export function findBestMockMatch(input: string): MockEntry {
  // Lowercase and strip punctuation except spaces
  const normalizedInput = input.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const inputWords = normalizedInput.split(' ');
  
  let bestMatch = defaultFallback;
  let maxHits = 0;

  for (const entry of mockResponses) {
    let hits = 0;
    
    for (const kw of entry.keywords) {
      if (kw.endsWith('*')) {
        // Prefix match logic (e.g. affiliat*)
        const prefix = kw.slice(0, -1).toLowerCase();
        if (inputWords.some(w => w.startsWith(prefix))) {
          hits++;
        }
      } else {
        // Exact whole word or whole phrase match via RegExp boundary
        const escapedKw = kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedKw}\\b`, 'g');
        if (regex.test(normalizedInput)) {
          hits++;
        }
      }
    }

    if (hits > maxHits) {
      maxHits = hits;
      bestMatch = entry;
    }
  }

  return maxHits > 0 ? bestMatch : defaultFallback;
}