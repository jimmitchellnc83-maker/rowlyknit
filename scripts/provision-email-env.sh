#!/bin/bash

# Provisions email-related env keys in backend/.env from secrets passed
# in via the deploy workflow. Runs on the production droplet, before
# `docker compose up -d` re-reads the env_file.
#
# Required env (passed in by .github/workflows/deploy-production.yml):
#   RESEND_API_KEY — Resend API token. Maps to backend EMAIL_API_KEY.
#                    The script ABORTS if this is empty — a silent
#                    fallback to noop would let signup / password reset
#                    appear successful while no email leaves the box.
#
# Effect: rewrites backend/.env so the canonical email config is:
#   EMAIL_PROVIDER=resend
#   EMAIL_API_KEY=<RESEND_API_KEY>
#   FROM_EMAIL=noreply@rowlyknit.com
#   APP_URL=https://rowlyknit.com
# and any prior ALLOW_NOOP_EMAIL_IN_PRODUCTION override is removed so
# the backend's loud-fail on missing-key actually fires when it should.
#
# The secret value is never echoed, logged, or persisted in any file
# other than backend/.env itself. The temp file lives next to .env on
# the same filesystem so the final mv is atomic. The trap clears the
# temp on any exit path including errors.

set -euo pipefail

ENV_FILE="${ENV_FILE:-backend/.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found — cannot provision email env" >&2
  exit 1
fi

if [ -z "${RESEND_API_KEY:-}" ]; then
  cat >&2 <<'EOF'
ERROR: RESEND_API_KEY is empty.
       The backend will refuse to boot with EMAIL_PROVIDER=resend and no key,
       so the deploy is aborting now rather than letting it silently fall
       back to a no-op adapter at startup.

       To fix: add RESEND_API_KEY to GitHub repo secrets under the
       "production" environment:
         https://github.com/jimmitchellnc83-maker/rowlyknit/settings/environments
EOF
  exit 1
fi

TMP_ENV="${ENV_FILE}.deploy.$$"
trap 'rm -f "$TMP_ENV"' EXIT

# Strip the entire managed section we wrote on a previous deploy
# (everything from the marker comment to EOF), plus any stray copies
# of the keys we own that may live inline above the marker (e.g. the
# original hand-edited config from before this script existed). The
# awk one-shot makes the rewrite idempotent: rerunning is a no-op on
# the resulting file shape.
# Suppress the trailing blank-line we previously prepended to the
# managed block (otherwise re-runs accumulate one blank line each
# pass, since awk truncates at the marker, leaving the blank above it).
awk '
  /^# === Email provider \(managed by scripts\/provision-email-env\.sh\) ===$/{exit}
  /^[[:space:]]*(EMAIL_PROVIDER|EMAIL_API_KEY|FROM_EMAIL|APP_URL|ALLOW_NOOP_EMAIL_IN_PRODUCTION)=/{next}
  {print}
' "$ENV_FILE" | awk '
  # Trim trailing blank lines so the appended block always starts at
  # the same offset regardless of how many times this script has run.
  /^[[:space:]]*$/{ blanks++; next }
  { while (blanks-- > 0) print ""; blanks = 0; print }
' > "$TMP_ENV"

# Append canonical values. printf avoids any echo-flag interpretation
# of the secret. We do NOT log the value.
{
  echo ""
  echo "# === Email provider (managed by scripts/provision-email-env.sh) ==="
  echo "# Re-written on every deploy from the RESEND_API_KEY GitHub secret."
  echo "# Edits made by hand on the droplet will be overwritten next deploy."
  echo "EMAIL_PROVIDER=resend"
  printf 'EMAIL_API_KEY=%s\n' "$RESEND_API_KEY"
  echo "FROM_EMAIL=noreply@rowlyknit.com"
  echo "APP_URL=https://rowlyknit.com"
} >> "$TMP_ENV"

# Tighten perms while we're here — the previous 0755 was overly broad
# for a file containing JWT and DB secrets. Owner read/write only.
# `chown --reference` is GNU coreutils (Linux/droplet); it's missing on
# BSD chown (macOS local dry-run). Best-effort — if it fails the file
# stays owned by whoever ran the script (root on the droplet anyway).
chown --reference="$ENV_FILE" "$TMP_ENV" 2>/dev/null || true
chmod 600 "$TMP_ENV"

mv "$TMP_ENV" "$ENV_FILE"
trap - EXIT

echo "✅ email env provisioned (provider=resend, FROM_EMAIL=noreply@rowlyknit.com, APP_URL=https://rowlyknit.com)"
