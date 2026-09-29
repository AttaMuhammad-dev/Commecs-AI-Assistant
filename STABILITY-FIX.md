# Stability fix — apply this before the presentation

The student portal question and all 12 exact College Guide prompts now work without Gemini. The server uses the existing saved college pages, shows official links and labels these replies "Saved college page". Portal directions support English, Urdu and Roman Urdu. Other saved-page excerpts retain their original language and explicitly say so when Urdu/Roman Urdu is selected.

These standalone guide questions also work after earlier messages and with Detailed answers selected. Local and cached responses do not consume the live-request rate limit. Arbitrary questions still use Gemini and can be affected by provider failures; this patch does not pretend otherwise.

## Apply to the folder you are running

1. Stop the running server with Ctrl+C.
2. Extract `commecs-stability-fix.zip` and copy its contents into your running project folder, replacing the matching files. Keep your existing `.env` and `node_modules`.
3. Double-click `START-PRESENTATION.cmd` again. It rebuilds the frontend and starts the server.
4. Reload http://localhost:3000. If you still see the old label, press Ctrl+Shift+R once.
5. Ask: `Where is the official student portal?` It should immediately show the official portal page under "Saved college page", without a model lookup.

For a fresh installation use `commecs-assistant-stable.zip`, copy your existing `.env` into it, and run the launcher.

## Validation

76 automated tests pass; backend type checking and production build pass. Tests explicitly force the provider offline and run all 12 guide questions in follow-up conversations with English/Detailed preferences. None calls the provider. Negative tests ensure personal-record requests do not accidentally become portal navigation answers.

To update saved guide excerpts after a reviewed knowledge refresh, run `npm run guide:build`, then rebuild. Excerpts are a snapshot; follow their source links for the latest policies. No live provider calls or reindexing were required for this fix.

## Local presentation repair — 2026-09-29

- Presentation startup keeps the visible CMD window, builds the frontend and server, and leaves opening localhost:3000 to the presenter.
- The server now runs compiled JavaScript using Node, rather than loading TypeScript through tsx on every presentation start. Development commands remain available.
- `npm run build:server` type-checks and emits the backend. `npm start` runs that output. After editing server code, rebuild before restarting.
- Provider failures now include a safe model/status/reason diagnostic. Raw provider messages, credentials and conversation text are not logged by this diagnostic.
- `npm run check:live` checks the real HTTP chat endpoint and a follow-up; a bank answer, cached answer, fallback, incomplete answer or missing sources cannot count as success. Run against a fresh server to avoid cache results. This uses the existing live API quota.
- `npm run test:runtime` checks transient failover, partial-stream handling, cancellation and diagnostic privacy.
- Tested successfully: compiled backend, live Urdu-faculty question, live PhD follow-up, and reviewed programs answer. The complete existing Vitest suite could not run in the assistant sandbox because the native build tool was denied directory access.
- Close the old presentation CMD window and relaunch START-PRESENTATION to load these changes. Keep the new window open.

- Comparison requests now prefer the successfully tested gemini-3.1-flash-lite model with LOW thinking, before the heavier fallback models. Previous defaults timed out or returned 503 during testing. Environment overrides remain available. Live-provider availability can still vary.

- Retest passed after model-order change: comparison returned a complete sourced live answer. Temporary test servers were stopped; restart the presentation launcher to activate the new backend.

## Faculty retrieval completeness — 2026-09-29

Ammar Bin Ahsan was present in the saved faculty page, but generated answers omitted records. A sourced response alone was not proof that a list was complete.

The chat pipeline now retrieves structured appointments from a dated copy of the official Faculty page before answer-bank/cache lookup. Department and named-person questions preserve exact names and source labels. List responses render every matching record directly, with a count and citation. Qualification/HOD filters and department follow-ups are supported. Complex faculty questions receive the selected records as evidence for model synthesis. Department membership is never inferred from a person's degree. Directory hashes invalidate generated-answer cache entries when the source changes.

`npm run refresh:faculty` refreshes only the public faculty page, checks every card was parsed, and replaces the local directory atomically. It does not reindex or replace the remote File Search store. Run `npm run build:server` and restart to load a refresh. The presentation launcher performs the build automatically.

`npm run test:faculty` validates all 18 categories and 75 appointments against the stored records, exact Physics names including Ammar, follow-up handling, qualification/name selection, administrative-question boundaries, extraction failure and the chat route. The refreshed source was independently compared with the live rendered faculty webpage and matched all 75 records. A live generated comparison of Ammar and Hiba returned both published qualifications with a faculty-page citation.

Coverage is for this dated public directory, not a guarantee about unpublished appointments or every possible question. General college questions still use the existing File Search pipeline; unsupported facts must be acknowledged rather than invented.

## Presentation outage resilience — 2026-09-29

Provider 503 availability errors and 429 quota errors cannot be eliminated by changing prompts. The exact Urdu-teachers follow-up now uses structured local faculty records regardless of prior conversation. Unsupported provider requests retain bounded attempts.

If the provider fails before sending answer text, relevant saved source excerpts are shown with citations and an explicit statement that they are not newly generated AI answers. Faculty comparisons can fall back to the relevant directory records. General fallback searches only the 12 curated local guide sources and requires topic overlap; unrelated and personal-record requests do not receive arbitrary source text. This is partial saved evidence, not a claim that the question has been completely answered.

When matching backup evidence exists, a request that has not produced its first token in 15 seconds switches to that evidence. Once a live answer starts, the normal 55-second overall bound applies. Partial answers are never mixed with backup text. Local quota limits can return available source evidence rather than a bare 429 response. Provider content-block responses are not replaced with backup content.

START-PRESENTATION now runs quick offline backup checks after building. The server prints `Build: presentation-stable-20260929 | Faculty directory + saved-source fallback enabled`, and /api/health exposes the same build marker. Restart the old presentation process to load this build.

Validation: 30 repetitions of the exact Urdu follow-up, 503 and 429 simulations, faculty comparison backup, irrelevant/private request rejection, all 75 directory appointments, backend type-checking, and existing native runtime checks. `npm run test:presentation` also simulates a stalled upstream request without contacting the API. The full existing frontend/Vitest build remains subject to the previously observed assistant sandbox limitation; the user's normal launcher builds it locally.
