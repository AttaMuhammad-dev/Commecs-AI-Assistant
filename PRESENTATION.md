# Five-minute presentation

## Before leaving home

1. Run `npm run verify`, then `npm start` and open http://localhost:3000.
2. Make sure the API key and existing File Search store are in `.env`.
3. Open the app once while online so the app shell and fonts load.
4. Keep a phone hotspot available. Free-tier model latency and availability vary.
5. Do not reindex the knowledge base or upgrade dependencies before presenting.

## Demonstration

**0:00 — The problem**
“Students and parents need one place to find college admissions, programs, fees and policies. This assistant uses official college documents and shows its sources.”

**0:30 — Quick answer**
Use a new conversation and ask “What programs do you offer?” with Auto language and Concise answers. Expand the college sources. Explain that a fresh reviewed answer avoids spending an AI request.

**1:15 — The college guide**
Open the book icon. Search “fees”. Open the list of official resources and use Ask assistant to place a question into the composer. This catalog works without calling a model.

**2:00 — Reasoning and retrieval**
Start a new conversation. Ask “Compare Commerce and Computer Science for a student who enjoys business and technology.” Explain that comparisons choose a deeper model automatically. Allow up to roughly 55 seconds; a free-tier provider may be busy. Show sources when returned. Do not describe a fallback as a successful AI answer.

**3:00 — Student-friendly controls**
Show language selection, detailed answers, theme switch, source cards, stop/retry, chat history and download. Explain that chat saving is optional for shared computers.

**4:00 — Architecture and honesty**
“The server checks reviewed answers and cache before calling Gemini. File Search retrieves college evidence. Each request has a limited time and number of fallback attempts. Incomplete answers are labeled and excluded from cache.”

**4:30 — Close**
“Next steps are college review of the answer bank, scheduled knowledge maintenance, and shared rate limits before wider public release.”

## If live AI fails

Use the college guide and a new conversation with “Programs offered”. Fresh reviewed answers are still available when the local server is running, even if the provider cannot respond. Explain the contact fallback honestly. The guide links need internet to open; the catalog itself does not.

## Questions you may be asked

- Is it trained on student records? No. It searches the supplied public college knowledge snapshot and does not access private accounts.
- Is every response generated? No. Reviewed answers and cached sourced answers reduce latency and quota use.
- Is it always free? The selected models have free-tier access, subject to account limits. Index creation can have embedding costs. This upgrade reuses the existing index.
- Is it always accurate? No. It shows evidence, distinguishes incomplete answers and asks users to confirm session-sensitive details.
- Is the website searched live? No. File Search uses the indexed snapshot. Official links let the user check the latest page.
