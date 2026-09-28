# Release validation — 29 September 2026

## Completed

- Recovered the interrupted upgrade from the prior working folder and compared it against the Desktop project.
- Backend type checking passed.
- All 62 automated tests passed across 13 files.
- Production frontend build and PWA generation passed.
- Added API-level checks for invalid/oversized requests, reviewed-bank responses, quota fallback contact cards, complete-only caching and bounded concurrency.
- Existing tests cover sanitization, adaptive routing, Urdu queries, provider cancellation/fallback, partial streams, byte-split SSE, knowledge cleaning, bank matching and evaluation scoring.
- Browser checks passed for guided questions, guide search, reviewed answer rendering, expanded official sources, dark/light theme switching, new conversations and cancellation with retry recovery.
- Visually checked 1440×900 desktop, 768×1024 tablet, 390×844 mobile and 360×800 narrow mobile layouts. Browser console had no errors during the observed checks.
- One real File Search request succeeded with STOP on gemini-3.6-flash and two official sources: the fee payment policy and the 2026–27 fee structure PDF. Total elapsed time was 42.1 seconds, including fallback attempts.
- No live knowledge ingestion, remote reindexing, billing changes or deployment was performed.

## Limits of this verification

A successful lookup does not establish accuracy for every question. A comprehensive live evaluation was not run to conserve free-tier requests. Model listing failed on this connection, although the generation test succeeded. Model availability, quotas and response times can vary. The supplied reviewed bank was retained; its entire factual content was not reapproved in this run. Old academic sessions remain in some source documents.

The health endpoint confirms server configuration, not an active provider probe. In-memory cache, capacity, quota cooldowns and request limits are local to each server instance. Vercel deployment has not been exercised. The PWA build passed; a full offline browser/network test was not performed.

The full source package excludes credentials, node_modules, generated builds, temporary diagnostics and deployment metadata. The original Desktop project remains unchanged. The changed-files bundle is relative to that original project, not relative to the previous working copy.

Final maintenance checks: index:dry reports no changes to upload. Duplicate normalized bank question variants were removed while preserving the first-match behavior, all answer text and review dates.

Stability patch: 76 tests now pass across 14 test files. All 12 guide prompts were tested with the provider forced offline; none called Gemini. Backend type checks and production build passed.
