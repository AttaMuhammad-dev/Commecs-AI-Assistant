// DOM Elements
const chatThread = document.getElementById('chat-thread');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const errorBanner = document.getElementById('error-banner');
const retryBtn = document.getElementById('retry-btn');

let messageHistory = [];
let pendingMessage = "";

// Mock dataset grounded in the September 2026 prompt constraints
const mockData = [
  {
    keywords: ["program", "programs", "subjects", "disciplines", "offer"],
    text: "Commecs offers four main disciplines at the intermediate level: Commerce, Pre-Engineering, Pre-Medical, and Computer Science. (Placeholder - Phase 2 will confirm the current full list.)",
    source: "Academics"
  },
  {
    keywords: ["when", "established", "founded", "history"],
    text: "Commecs College was founded in 1993 by the Commecs Educational Trust, a non-profit set up by the alumni association of Government College of Commerce & Economics.",
    source: "About"
  },
  {
    keywords: ["apply", "admission process", "how to apply", "join"],
    text: "Admissions run once a year, with an Admission Process page, Eligibility criteria, and the Commecs Admission Test (CAT). (Placeholder - exact current dates come in Phase 2.)",
    source: "Admissions"
  },
  {
    keywords: ["scholarship", "financial aid", "discount"],
    text: "Commecs offers merit-based, need-based, and mid-term scholarships, plus a sibling discount. (Placeholder - exact amounts in Phase 2.)",
    source: "Admissions - Scholarships"
  },
  {
    keywords: ["fee", "fees", "cost", "tuition"],
    text: "Fee details are published each session on the Fee Payment Policy page - I'll pull the live figure once connected to the real site.",
    source: "Admissions - Fees"
  },
  {
    keywords: ["board", "affiliat", "biek", "recognised"],
    text: "The intermediate programs are affiliated with the Board of Intermediate Education Karachi (BIEK), based on the college's own site. (Worth double-checking before this goes live.)",
    source: "About"
  },
  {
    keywords: ["contact", "phone", "email", "address", "whatsapp"],
    text: "You can reach Commecs via the Contact Us page or their official WhatsApp channel and social pages. (Placeholder - real details in Phase 2.)",
    source: "Contact Us"
  }
];

// --- PHASE 2 SWAP POINT ---
// Replace the contents of this function with real fetch() to backend proxy
async function getBotResponse(userMessage, history) {
  // Simulate network latency (600ms - 1200ms)
  const delayMs = 600 + Math.random() * 600;
  await new Promise(resolve => setTimeout(resolve, delayMs));

  // Simulate arbitrary connection error (5% chance)
  if (Math.random() < 0.05) {
    throw new Error("Connection failed");
  }

  const query = userMessage.toLowerCase();
  let bestMatch = mockData.find(entry => 
    entry.keywords.some(kw => query.includes(kw))
  );

  if (bestMatch) {
    return {
      text: bestMatch.text,
      source: bestMatch.source,
      mode: "fast"
    };
  }

  return {
    text: "I don't have a confident answer for that in this preview - the real version will check the live site and point you to admissions if it's unsure.",
    source: null,
    mode: "fast"
  };
}
// --- END PHASE 2 SWAP POINT ---

// UI Logic
function appendMessage(text, isUser, source = null) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
  msgDiv.textContent = text;
  
  if (!isUser) {
    const sourceDiv = document.createElement('div');
    sourceDiv.className = `source-slot ${source ? '' : 'hidden'}`;
    sourceDiv.textContent = source ? `Source: ${source}` : '';
    msgDiv.appendChild(sourceDiv);
  }

  chatThread.appendChild(msgDiv);
  chatThread.scrollTop = chatThread.scrollHeight;
}

function showTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'message bot-message typing-indicator';
  indicator.id = 'typing-indicator';
  indicator.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  chatThread.appendChild(indicator);
  chatThread.scrollTop = chatThread.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.remove();
}

async function handleSend(text) {
  if (!text.trim()) return;
  
  errorBanner.classList.add('hidden');
  appendMessage(text, true);
  userInput.value = '';
  userInput.style.height = 'auto';
  pendingMessage = text;
  
  showTypingIndicator();

  try {
    const response = await getBotResponse(text, messageHistory);
    removeTypingIndicator();
    appendMessage(response.text, false, response.source);
    messageHistory.push({ role: 'user', content: text });
    messageHistory.push({ role: 'assistant', content: response.text });
    pendingMessage = ""; 
  } catch (err) {
    removeTypingIndicator();
    errorBanner.classList.remove('hidden');
  }
}

// Event Listeners
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleSend(userInput.value);
});

retryBtn.addEventListener('click', () => {
  handleSend(pendingMessage);
});

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend(userInput.value);
  }
});

// Auto-growing textarea
userInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight) + 'px';
});

// Quick Replies
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', (e) => {
    handleSend(e.target.textContent);
  });
});