# Answer quality and operational review

## What the application checks

Live output is buffered until completion, approved-source/link checks and numeric-support checks finish. Unsupported currency amounts or percentages trigger a bounded alternate attempt; rejected text is never shown or cached. Explicit arithmetic is allowed only when its inputs were supplied in evidence/user questions and the displayed result is correct. This does **not** establish that a number was applied to the right policy, verify every prose claim, or replace human review.

The prompt requires visible `College information` and `General guidance` sections when a response combines college facts with recommendations (localized for Urdu and Roman Urdu). A simple factual reply does not need extra sections. Benefits of clubs, career suggestions and personal recommendations must be presented as general guidance. An unlisted club is an unknown detail, not proof that it does not exist.

## Repeatable evaluation

`npm run eval:check` validates the 18-case suite's expected facts against **original public passages**, not the reviewed-answer bank. CI runs this without provider calls. Cases cover user-reported phone/club problems, program thresholds and exclusions, incomplete fee-policy answers, contextual follow-ups, topic resets, multilingual replies, uncertainty, private records and prompt injection.

To evaluate an already-running server, run:

```sh
npm run eval:quality -- --base=http://localhost:3000 --max=18 --out=eval/results/quality-review.json
```

Requests are paced at least 12 seconds apart. Each result saves the question, complete answer, source cards, timing, mode and a review form. Every fallback is reported separately as **not a model-quality pass**. Pattern checks flag missing conditions, irrelevant sources and unlabeled advice; they do not prove citation entailment or logical correctness. Reports are saved after each case, including failures.

The suite was authored and checked by Codex against the bundled snapshots on 5 October 2026. It is **not independently reviewed or college-approved**. Before claiming an accuracy percentage, have a knowledgeable reviewer complete the report's `humanReview` fields. Score each dimension 0 (wrong/unsupported), 1 (partly correct) or 2 (correct and complete):

- Correctness: thresholds, exclusions, dates and policy conditions applied to the actual question.
- Completeness: all requested parts answered; uncertainty stated only for unavailable details.
- Claim/citation support: each college claim supported by the cited passage, not merely the right URL.
- Advice quality: useful, relevant recommendations visibly distinguished from official facts.

Record reviewer/date/notes and disagreements. Count live/cached/reviewed answers, fallbacks, transport failures and unreviewed cases separately. Keep synthetic cases distinct from user-reported cases. Add new observed failures before changing prompts; retain the failing answer as a regression artifact. Run the same cases after a change and compare results without changing their expected facts to fit the model.

## Public-source refresh and review

`npm run knowledge:check` compares only the 25 approved public WordPress pages. It checks canonical readable content and modification dates, lists affected bank IDs and expired review dates, and writes a review report. It never updates original pages, the remote File Search index or `verifiedAt` timestamps. Unavailable checks are unknown, not successful freshness checks. PDFs and the separate faculty directory are outside this page audit; refresh/review them separately with the existing document/faculty workflows.

Use **Review public knowledge freshness** in GitHub Actions to run a manual comparison and download its report, including when review is required. No API key or model calls are needed. Locally, a full audit can update runtime status:

```sh
npm run knowledge:check -- --write-status
npm run knowledge:build
```

A changed page is quarantined only when the audit hash still matches the bundled snapshot. Retrieval, exact bank answers and local-guide answers then skip that stale evidence; bounded official website retrieval remains available. Refreshed content has a new hash and is not quarantined by an older comparison. A source card's `Saved source compared` date records a successful snapshot comparison, separately from page modification and answer review. It is not independent claim verification. Cache versions include the audit state.

For changed pages: review the diff and official page, refresh the approved snapshot through the existing ingestion process, review affected bank answers and source metadata, update review dates only after actual review, rebuild, run tests/evaluations, and update the remote index if used. Commit this work for review before deployment. Partial audits cannot overwrite full runtime status.

## Monitoring and shared traffic control

Each validated chat emits a `chat_finished` JSON log with request ID, outcome, bounded duration and a safe error category. It contains no question, history, raw IP, API key or provider error body. Aggregate these events in hosting logs across instances. `/api/metrics` requires a server-only `OPS_METRICS_TOKEN` of at least 32 random characters; otherwise it returns 404. Keep the token out of frontend variables. Its counters and last-200-request p95/fallback/error indicators are **process-local** and reset on restart; they are not a deployment-wide dashboard. Rejections before chat execution are outside these counters. A degradation signal needs at least five observations and indicates high fallback/error rates or latency, not an SLA.

The existing per-process limits always remain. To enable shared admission across Vercel instances, configure both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on the server. The optional REST integration follows the [official Upstash REST contract](https://upstash.com/docs/redis/features/restapi). One atomic Lua command checks rolling actor limits (6/minute, 30/hour), a global live-request budget (`LIVE_REQUESTS_PER_HOUR`, default 30), and three global live slots. Slots expire after 45 seconds if release fails. Actor keys use HMAC identifiers and expire after approximately one hour; raw addresses and prompts are not stored. The token is also the HMAC secret: rotating it resets actor identities. Use separate namespaces/credentials for production and preview; default namespaces distinguish these environments.

Configured backend failures/misconfiguration fail closed for live calls and retain saved-source/guide availability. Each live request may make up to three provider attempts; the global request budget is **not** the provider's token quota. Local, cached and reviewed responses do not spend the shared live budget. REST contract/admission tests simulate a shared backend; they are not a real Redis concurrency audit. Validate actual Redis admission, expiry and release in a staging namespace before increasing traffic. `/api/health` reports whether traffic control is `per-process`, `shared-redis` or `shared-misconfigured`; do not claim shared protection is active without configuration.
