# Feature Validation Checklist

Use this smoke script to quickly verify the core features that were previously flagged as broken (magic markers, notes, exports, project types, and the symbol library) without mutating existing data.

## Prerequisites
- API server running and reachable (default: `http://localhost:5000`).
- `jq` installed locally for response parsing.
- Valid account credentials: set `LOGIN_EMAIL` and `LOGIN_PASSWORD` env vars.

## Run the smoke checks
```bash
API_URL="https://rowlyknit.com" \
LOGIN_EMAIL="you@example.com" \
LOGIN_PASSWORD="..." \
./scripts/feature-smoke.sh
```

The script will:
1. Log in and capture the JWT token.
2. Grab the first available project.
3. List allowed project types from `/api/projects/types`.
4. List magic markers for the project and show the first entry.
5. List audio notes with linked pattern names and transcripts where available.
6. Fetch the chart symbol library and show a sample entry (name/category/description).
7. Confirm pattern export availability with a HEAD request (avoids downloading full PDFs).

## Interpreting results
- **Non-zero exit code**: Authentication failed or required data (project/pattern) is missing.
- **Counts of zero**: Feature data exists but no records are present for the current user; create sample data and re-run to exercise responses.
- **HTTP errors**: Indicates routing/auth/CSRF issues that need attention before release.

## Why this helps
These calls exercise the same endpoints tied to the previously broken areas without destructive changes. They provide a repeatable, evidence-driven baseline for QA before deployment.
