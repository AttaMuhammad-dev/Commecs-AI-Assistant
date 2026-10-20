# Demo reliability and reading position — 20 October 2026

- Exact greetings are answered locally without Gemini or remote retrieval. College questions prefixed with a greeting still follow the normal retrieval path.
- Personal/multi-topic guidance is not replaced by the canned programs list.
- An inaccessible optional File Search store can fall back to the bundled official-source evidence. Generated college claims still require sources and quality validation.
- Transient provider failures use a short jittered delay before another model; three total calls, existing deadlines, quota cooldowns, cancellation and saved-evidence fallbacks remain bounded. A request that already timed out does not incur another backoff delay.
- New answers open at their beginning. Growing text, source cards and completion no longer force scrolling to the bottom. A reader's wheel/touch/pointer/keyboard movement is preserved; Latest reply remains an explicit jump to the end.
- New provider keys belong only in the hosting service's private server environment, never a VITE variable or committed file. `.env.*` and `.vercel/` are ignored.

Regression coverage includes greetings, real questions prefixed with hello, the owner's multipart Roman Urdu guidance question, inaccessible remote stores, and long-answer/reader-intent/conversation-switch scroll behavior. Existing quota, interruption, source, privacy and evidence tests are retained.

Free provider capacity is external: deployment cannot guarantee an uninterrupted upstream API or permanently accurate college facts. Saved evidence is labeled and dates retained; failures must not be described as live verified answers. Knowledge and provider availability still need periodic maintenance.
