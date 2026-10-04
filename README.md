# Commecs College Assistant 2.1

## October 3 stability update

Vercel now receives responses through named GET/POST/OPTIONS Web handlers. This fixes the default-export warning and the 60-second timeout affecting health and chat. See [STABILITY-20261003.md](STABILITY-20261003.md) for deployment settings and validation.

For questions outside the exact answer bank, the API retrieves relevant information from 25 bundled official pages and 39 previously reviewed answers. Reviewed information still expires after 30 days; source and review dates remain visible. The default primary model is Gemini 3.5 Flash-Lite, followed by 3.1 Flash-Lite and 3.6 Flash. Model access and quotas depend on the API project.

The API buffers live answers until completion and evidence checks, then delivers the answer through SSE. Incomplete provider output is discarded before trying the next model. The SDK's automatic retries are disabled; the application makes at most three provider requests. Saved evidence is returned after 15 seconds if available; otherwise execution is bounded to 35 seconds, below Vercel's 60-second limit. Local answers and the guide require no provider quota. File Search is optional when bundled evidence is sufficient.

A college information assistant with a React/TypeScript interface, Hono streaming API, and Gemini File Search retrieval. This is a working application, not the old Phase 1 mock.

## Run on your presentation laptop

Requires Node.js 22 or newer and npm.

1. Open this folder in VS Code.
2. Copy your existing project's `.env` into this folder. Keep the existing `GEMINI_API_KEY` and `FILE_SEARCH_STORE_NAME`. Never place the key in a `VITE_` variable.
3. In the terminal run:

```powershell
npm ci
npm run build
npm start
```

Open http://localhost:3000. Keep the terminal open. Stop with Ctrl+C. The production server serves both the interface and API, so no second terminal or frontend proxy is needed. It binds to this computer only.

For editing, use `npm run dev:all` and open http://localhost:5173. `npm run preview` serves only frontend assets; it is not the presentation server.

The existing index is retained. You do not need to ingest or reindex to run this upgrade. No paid service or database is added.

## Features

- Event-driven loading text in English, Urdu and Roman Urdu. The API reports bundled retrieval, actual model requests/retries, completion/source-link checks, and saved/reviewed/cached response selection. The browser reports sending before SSE arrives. After eight seconds it retains the current phase and shows elapsed waiting time. These events describe application work, never Gemini's private reasoning or verification of every claim. Progress is ephemeral and excluded from saved conversations and model history.
- Responsive navy/brass interface, dark mode, Urdu rendering and keyboard navigation.
- Guided question starters and a searchable college guide with 12 official resources.
- English, Urdu, Roman Urdu and automatic language selection; concise/detailed responses.
- Streaming answers, real stop control, latest-answer retry, source cards and Markdown export.
- Conversation switching, deletion and optional browser persistence. Saving is off by default.
- Reviewed answers for exact matching common questions, a bounded response cache, and adaptive fast/deep model selection.
- Provider deadlines, quota cooldowns, at most three provider calls per question and at most three simultaneous live requests per process.
- Clear contact fallback when the provider is unavailable; incomplete replies are labeled and never cached.

## How an answer is produced

```text
Browser question + last four complete exchanges + preferences
  -> validate input / request limit / distress response
  -> fresh exact reviewed answer, if appropriate
  -> context + language + source-version cache
  -> fast or deep model ladder
  -> Gemini File Search against the existing college index
  -> streaming text + official sources + completion status
  -> cache only complete answers with sources
```

Simple factual questions use Flash-Lite first with minimal thinking. Comparisons, eligibility reasoning and calculations default to LOW thinking to conserve latency and free-tier capacity. Both model ladders are configurable. Incomplete outputs can move to the next model because live text is buffered; partial outputs are never mixed with a second model's answer. A thinking-level incompatibility can retry at LOW within the same three-call budget.

The model catalog is deliberately allowlisted. Configure ladders in `.env`; valid values are in `server/config/models.ts`. `npm run check:models` checks model visibility, not billing or remaining quota. Google lists free-tier access for the selected model families, but the project/account limits in AI Studio are authoritative. A billed API project can still incur charges; application routing cannot turn a paid key into a free key.

Official references checked for this release:
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/file-search
- https://ai.google.dev/gemini-api/docs/rate-limits

## Validation commands

```powershell
npm run verify       # backend types, automated tests, production build
npm run answers:check
npm run check:models # read-only network call; no generation
npm run test:live    # one bounded File Search lookup; consumes provider quota
```

`test:live` succeeds only if a complete answer includes official source URLs. It logs status and sources, never credentials. Model listing can fail independently of generation.

## Knowledge maintenance

The current index is an existing snapshot, not a live web search. Some pages contain older academic sessions. Check the cited session/date before relying on fees, scholarships or deadlines.

- `npm run ingest:dry`: inspect WordPress ingestion without writing files.
- `npm run ingest`: update the local manifest and cleaned pages. This does not update the remote store.
- `npm run index:dry`: inspect indexing changes without creating a remote store.
- If intentionally refreshing, review the corpus first, then use `npm run index:knowledge -- --new-store --with-pdfs --confirm-indexing`. Indexing embeddings can incur costs. Do not run this just before the presentation.
- Only switch `FILE_SEARCH_STORE_NAME` after checking that the new store finished successfully. The old remote store is preserved. Back up `knowledge/.filesearch.json` before maintenance; it records the local index state.
- The inherited state uses legacy document display names. The indexer refuses to append changes to it; a new store avoids mixing old and new versions.
- Removed/excluded documents require a new store too. The indexer does not delete remote documents automatically.
- `answers:draft` produces unverified drafts only. A human must check facts, sources, language and session before publishing into `server/data/verified-answers.json`.
- Reviewed answers expire after 30 days or a newer indexed version. Do not simply change timestamps to make stale facts pass.
- The college guide is a curated link catalog in `src/data/collegeResources.json`; review it when college URLs change.

## Vercel

Use Vite framework settings (`npm run build`, output `dist`) and Node.js 22+. The included `api/index.ts` handles `/api/*`; `vercel.json` includes the reviewed bank and knowledge state in the server bundle. Set `GEMINI_API_KEY`, `FILE_SEARCH_STORE_NAME`, the desired model ladders and `ALLOWED_ORIGINS` in Vercel's server environment. Do not enable `VITE_USE_MOCK` for real demonstrations. Keep API keys out of frontend variables and source control.

The API allows 35 seconds overall; Vercel's function limit is 60 seconds. In-memory cache, cooldowns, request limits and capacity are per process, not a distributed production control. Before a large public rollout, add a shared gateway rate limit and monitoring.

## Trust and privacy

Messages go to the configured Gemini API for live requests. No raw conversations or IP addresses are logged by this application. Browser chat saving is opt-in; turning it off removes saved copies. Avoid entering credentials or personal student records. Feedback stays on the device and is not sent to an administrator.

Sources support review; they do not guarantee every sentence is correct. The interface explicitly flags replies without attached college sources. The assistant cannot submit applications, access private records or promise admission. The installable app shell and guide can load offline after an initial visit, but AI answers and external pages need internet.

## Main files

- `src/components`: interface, guide, messages, source cards and composer.
- `src/hooks/useChat.ts`: streaming lifecycle, cancellation and conversation context.
- `src/store/useChatStore.ts`: current conversation, preferences and optional local persistence.
- `shared/chat.ts`: shared request/event types and official URL validation.
- `server/app.ts`: HTTP validation, bank/cache/provider flow and fallback.
- `server/gemini.ts`: bounded model execution, grounding sources and completion handling.
- `server/config/models.ts`: allowlisted ladders and thinking levels.
- `server/start.ts`: single-process presentation server.
- `scripts` / `eval`: ingestion, indexing, model checks and quality evaluation.

## Presentation stability patch

All 12 exact College Guide prompts now have a provider-independent saved-page response, including in follow-up conversations. These are labeled Saved college page and cite the snapshot source. Regenerate excerpts after a reviewed knowledge update with `npm run guide:build`. See STABILITY-FIX.md.
