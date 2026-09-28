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
