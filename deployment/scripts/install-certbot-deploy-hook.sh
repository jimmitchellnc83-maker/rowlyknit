#!/bin/bash
# One-time installer for the certbot deploy-hook on the Rowly prod
# droplet. Symlinks the script in deployment/scripts/ into the
# certbot deploy-hooks directory so it runs after every successful
# renewal.
#
# Idempotent — safe to re-run.

set -euo pipefail

REPO_DIR="/root/rowlyknit"
HOOK_SRC="${REPO_DIR}/deployment/scripts/certbot-deploy-hook.sh"
HOOK_DST="/etc/letsencrypt/renewal-hooks/deploy/rowly.sh"

if [ "$EUID" -ne 0 ]; then
    echo "ERROR: must run as root (or via sudo)" >&2
    exit 1
fi

if [ ! -f "${HOOK_SRC}" ]; then
    echo "ERROR: source script ${HOOK_SRC} not found — pull latest main first" >&2
    exit 1
fi

chmod +x "${HOOK_SRC}"
mkdir -p "$(dirname "${HOOK_DST}")"
ln -sf "${HOOK_SRC}" "${HOOK_DST}"

echo "Installed: ${HOOK_DST} -> ${HOOK_SRC}"
echo
echo "Verify by running a dry-run renewal (won't actually renew):"
echo "  certbot renew --dry-run"
echo
echo "Or trigger the hook directly against current live certs:"
echo "  ${HOOK_SRC}"
