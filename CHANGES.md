# What changed

## Recovered and completed from the interrupted upgrade

The frontend now has responsive conversation navigation, optional local history, guided starters, stop/regenerate controls, source cards, contact fallback, language and answer-length selection, Markdown export and self-hosted fonts.

The backend now retains complete follow-up exchanges, shares typed events with the client, distinguishes completed/truncated/interrupted replies, and caches only complete sourced responses. Model fallback is bounded by time and attempt count. Thinking levels are clamped per model, exhausted models cool down, and unknown models are excluded. Grounding instructions distinguish source sessions, calculations, private records and published achievements.

Maintenance fixes include a real ingestion dry run, correct evaluation scoring, stale-answer detection, preserved draft answers and guarded legacy index updates. A missing Vercel API entry point and bundle configuration were added.

## Added in this completion pass

- Searchable, keyboard-accessible college guide with 12 official resources and guided question handoff.
- Single-process production server and Windows launcher for the presentation.
- Recoverable connection status with an eight-second health-check deadline.
- Explicit notice when a completed response contains no attached official source.
- Three simultaneous live requests per process to reduce quota bursts.
- Sixty-five-second client deadline so a stalled HTTP stream cannot lock the composer forever.
- Offline retry preserves the existing answer instead of deleting it.
- PWA navigation excludes API URLs from the cached app-shell fallback.
- Shared mock response types and explicit completion markers.
- Six API/capacity integration tests, raising the suite to 62 tests.
- Current setup, architecture, maintenance, deployment and presentation documentation.

## Files and installation

Use the full `commecs-assistant` folder for the easiest setup. Copy only your existing `.env` into it, install dependencies and use the launcher or README commands.

Alternatively, back up your Desktop project, then copy the `changed-files` contents over the corresponding paths. Keep your original `.env`, knowledge store configuration and credentials. Run `npm ci` and `npm run verify` after applying. `CHANGED-FILES.txt` lists every added or changed file. No file deletions are required.
