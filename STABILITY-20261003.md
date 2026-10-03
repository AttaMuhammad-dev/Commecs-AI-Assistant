# Commecs stability fix — October 3, 2026

## Failure and correction

The deployed `api/index.ts` default-exported Hono's Web handler. Vercel interpreted it as a legacy `(req, res)` handler and ignored its returned `Response`. Even `/api/health`, which needs no AI request, timed out. Named GET, POST and OPTIONS exports now return the Web response and SSE body correctly. Request cancellation is enabled.

Provider failures are bounded: 10 seconds per attempt, at most three actual provider requests, 30 seconds for generation and 35 seconds for the API. Google SDK defaults to five attempts; its retries are explicitly disabled so 429s reach the application's quota cooldown logic. An SSE heartbeat keeps the connection active. The client can still stop a request.

Live output is buffered until a complete STOP response with official evidence exists. Incomplete answers and answers without attached college evidence are discarded, then the next model is tried. No partial answer or service fallback is cached. If relevant saved evidence exists, it is delivered after 15 seconds instead of waiting for the full deadline. Missing evidence yields a clear admissions contact fallback.

## Accuracy and availability

- Bundled retrieval covers 25 selected public college pages and 39 previously reviewed answers, including fees. Applicant/interview/result lists and blogs are excluded.
- English, Roman Urdu and Urdu topic aliases and short follow-up context improve retrieval outside the exact bank.
- Reviewed records expire after 30 days. No verification dates were changed. Rebuild bundled evidence after a reviewed knowledge update with `npm run knowledge:build` or `npm run guide:build`.
- Responses distinguish source dates from review dates. Linked PDFs are not treated as extracted PDF contents. Missing details and conflicting sources must be acknowledged.
- Existing File Search remains available for questions without bundled evidence. No store recreation, paid indexing, new provider or billing change is required.
- Source presence and deterministic checks reduce errors; they do not prove every generated sentence is correct.

## Vercel environment

Keep the existing server-only `GEMINI_API_KEY`. Retain `FILE_SEARCH_STORE_NAME` for wider remote retrieval. No `VITE_` secret is needed.

```dotenv
MODEL_LADDER_FAST=gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.6-flash
MODEL_LADDER_DEEP=gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.6-flash
FAST_THINKING=MINIMAL
DEEP_THINKING=LOW
FILE_SEARCH_MODE=auto
CACHE_ENABLED=true
ALLOWED_ORIGINS=https://commecs-ai-assistant.vercel.app,http://localhost:5173,http://localhost:3000
VITE_USE_MOCK=false
```

Invalid model overrides now fall back to the supported defaults. Valid existing overrides are preserved, so update the environment to use the primary model above. The default deployment settings remain Vite, `npm run build`, output `dist`, Node.js 22+.

After deployment, `/api/health` must immediately return `ok: true` and `build: stable-20261003`. Test a guide question, an unfamiliar fee-policy question, a follow-up and an unsupported campus question. A free-tier outage should produce saved dated information or a contact fallback, rather than an invocation timeout.

## Validation

`npm run verify` checks server/frontend types, automated regressions and the production build. Regression coverage includes the Vercel Web handler, interrupted provider failover, no unsourced claim delivery, invalid model settings, quota limits, retrieval, conversation context and cancellation. `npm run test:presentation` simulates repeated questions, 503/429 failures and a stalled provider without making API requests. `npm run answers:check` validates the existing reviewed bank.

Validation completed: 91 automated tests passed; production frontend and server builds passed; all 39 reviewed answers passed validation. Presentation simulations returned saved evidence for a stalled provider within 18 seconds and answered 30 repeated faculty follow-ups in 36 ms.

The existing API key successfully listed all three default models. A live fee-policy lookup completed on `gemini-3.6-flash` after the first two models hit their attempt deadlines (23.7 seconds overall). Earlier generation requests encountered connection resets. This proves one live sourced completion and bounded failover, not broad generated-answer accuracy or unlimited free-tier availability. Google's account quota remains authoritative.

Official references: [Vercel function signatures](https://vercel.com/docs/functions/functions-api-reference), [Gemini models](https://ai.google.dev/gemini-api/docs/models), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [File Search model support](https://ai.google.dev/gemini-api/docs/file-search).
