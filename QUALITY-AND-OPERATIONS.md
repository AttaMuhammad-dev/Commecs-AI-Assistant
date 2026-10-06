# Answer quality and operational review

## What the application checks

Live output is buffered until completion, approved-source/link checks and numeric-support checks finish. Unsupported currency amounts or percentages trigger a bounded alternate attempt; rejected text is never shown or cached. Explicit arithmetic is allowed only when its inputs were supplied in evidence/user questions and the displayed result is correct. This does **not** establish that a number was applied to the right policy, verify every prose claim, or replace human review.

The prompt requires visible `College information` and `General guidance` sections when a response combines college facts with recommendations (localized for Urdu and Roman Urdu). A simple factual reply does not need extra sections. Benefits of clubs, career suggestions and personal recommendations must be presented as general guidance. An unlisted club is an unknown detail, not proof that it does not exist.

Short follow-ups repeat the central applicable rule before expanding it. A narrow buffered completeness guard derives a late-payment penalty from supplied original policy text and rejects an inherited late-payment reply that omits that amount. It does not hardcode the amount or resolve conflicting policies. Saved fallbacks reselect bounded passages using the actual question terms, avoiding broad facility dumps for a missing library-hours detail.

High-confidence requests for individual records or private credentials/instructions receive a localized application notice before retrieval/model calls. General result announcements, attendance policies and supplied eligibility criteria remain normal questions. Notices carry typed metadata, do not receive unrelated source warnings or follow-ups, and are excluded from model history. These patterns supplement document exclusion and the system prompt; they are not a comprehensive privacy classifier or authentication mechanism.

## Repeatable evaluation

`npm run eval:check` validates the 18-case suite's expected facts against **original public passages**, not the reviewed-answer bank. CI runs this without provider calls. Cases cover user-reported phone/club problems, program thresholds and exclusions, incomplete fee-policy answers, contextual follow-ups, topic resets, multilingual replies, uncertainty, private records and prompt injection.

To evaluate an already-running server, run:

```sh
npm run eval:quality -- --base=http://localhost:3000 --max=18 --out=eval/results/quality-review.json
```

Requests are paced at least 12 seconds apart. Each result saves the question, complete answer, source cards, timing, mode and a review form. Every fallback is reported separately as **not a model-quality pass**. Pattern checks flag missing conditions, irrelevant sources and unlabeled advice; they do not prove citation entailment or logical correctness. Reports are saved after each case, including failures.

Accepted alternative citations have their own original-source anchors. For example, the 65% Science threshold is stated in both Eligibility and Instructions for Admission; either may support that fact. Application notices are recorded as `guarded`, separately from model answers and fallbacks. A guard pass is not evidence that the model itself refused a prompt.

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

## Current programs, faculty and class timetable

Current program listings follow the four admissions/eligibility groups: Commerce, Pre-Engineering, Pre-Medical and Computer Science. The owner confirmed Humanities is no longer offered. Historical About, CAT, brochure and archive mentions remain preserved as original evidence, but cannot override current offerings. The saved program answer and provider prompt follow this precedence; history questions can still discuss older offerings. General program advice remains model synthesis grounded in these groups.

Faculty requests read the rendered public directory with an eight-second deadline, coverage/layout checks and a five-minute successful-read cache. WordPress page REST content can contain obsolete Elementor cards and is deliberately not used for this refresh. The October 6 comparison removed Muhammad Jawwad and M. Sayem Hanif from the displayed roster; Maths includes M. Hashim. Absence from a directory does not establish employment status or identify a successor. Failed fetches retain an explicitly dated saved roster. `npm run refresh:faculty` updates the bundled snapshot through the same rendered source; rebuild and review the diff before deployment.

The public class timetable linked by the 24 August 2026 notice is session 2026–27. Its five visually inspected pages supply 130 section/day rows and 1,092 period cells. Friday has six periods; other published weekdays have nine. Original subject, room and teacher codes are retained. Section labels/secondary locations can vary across days; no initials are guessed into teacher names and no missing weekday/session is inferred. Generic requests ask for year/group/section. Relative dates use Asia/Karachi.

Rendered faculty and timetable reads share a three-request per-process concurrency cap; excess requests use saved information. It is not a distributed website-fetch quota. The normal model traffic gates remain separate.

Before showing saved periods, the runtime checks the public news index, its first matching class-timetable notice and the linked PDF bytes against the bundled SHA-256. The complete lookup is capped at eight seconds with no redirects and a five-minute successful cache. A changed URL **or changed bytes at the same URL** suppresses the older periods and gives the new public document link pending extraction/review. Failed checks say currentness is unknown and label the saved timetable. This checks the visible news index, not every archive or private schedule. No Gemini call is needed for roster or timetable answers.

`npm run knowledge:current` writes a read-only comparison report for rendered faculty, the timetable notice/PDF hash and the four known program names in admissions text. It does not auto-approve new programs, edit original source text, replace snapshots or update human review dates. It is also available through the manual knowledge-review workflow. A changed timetable needs PDF layout inspection, extraction and regression checks; never feed flattened ambiguous table text as authoritative periods. See `scripts/extractTimetable.py` for the guarded extraction of this reviewed layout.

General bounded website retrieval now reads rendered approved public pages, including the four public program pages, instead of calling a possibly stale page REST endpoint. It still fetches at most two pages per synthesis request with an eight-second deadline, excludes applicant/result lists, and does not send user questions or names to a website search. It cannot truthfully claim to know every public page/document, private portal or unpublished update. New public document layouts and changed offerings require review; unavailable lookup is not evidence that a facility or course does not exist.

## Monitoring and shared traffic control

`/api/health.publicSources` records the latest bounded read of faculty, news, timetable notice and timetable document on the current process. Failed reads distinguish HTTP status, network/certificate, size, cancellation and capacity categories; arbitrary exception text, upstream bodies and request data are excluded. An empty entry is not a successful check. A successful read is not proof of parsing or claim accuracy, and these process-local entries are not a deployment-wide availability monitor. Check this on the deployed build: local network success does not establish that the hosting network can reach the college site. TLS verification is never disabled to work around a failed refresh.

Each validated chat emits a `chat_finished` JSON log with request ID, outcome, bounded duration and a safe error category. It contains no question, history, raw IP, API key or provider error body. Aggregate these events in hosting logs across instances. `/api/metrics` requires a server-only `OPS_METRICS_TOKEN` of at least 32 random characters; otherwise it returns 404. Keep the token out of frontend variables. Its counters and last-200-request p95/fallback/error indicators are **process-local** and reset on restart; they are not a deployment-wide dashboard. Rejections before chat execution are outside these counters. A degradation signal needs at least five observations and indicates high fallback/error rates or latency, not an SLA.

The existing per-process limits always remain. To enable shared admission across Vercel instances, configure both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on the server. The optional REST integration follows the [official Upstash REST contract](https://upstash.com/docs/redis/features/restapi). One atomic Lua command checks rolling actor limits (6/minute, 30/hour), a global live-request budget (`LIVE_REQUESTS_PER_HOUR`, default 30), and three global live slots. Slots expire after 45 seconds if release fails. Actor keys use HMAC identifiers and expire after approximately one hour; raw addresses and prompts are not stored. The token is also the HMAC secret: rotating it resets actor identities. Use separate namespaces/credentials for production and preview; default namespaces distinguish these environments.

Configured backend failures/misconfiguration fail closed for live calls and retain saved-source/guide availability. Each live request may make up to three provider attempts; the global request budget is **not** the provider's token quota. Local, cached and reviewed responses do not spend the shared live budget. REST contract/admission tests simulate a shared backend; they are not a real Redis concurrency audit. Validate actual Redis admission, expiry and release in a staging namespace before increasing traffic. `/api/health` reports whether traffic control is `per-process`, `shared-redis` or `shared-misconfigured`; do not claim shared protection is active without configuration.
