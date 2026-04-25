#!/bin/bash
# Certbot deploy-hook for the Rowly production droplet.
#
# Triggered automatically by certbot AFTER a successful certificate
# renewal. Copies the renewed cert + key into the path the rowly nginx
# docker container reads, then reloads nginx in-place so existing
# connections keep flowing.
#
# Install with `install-certbot-deploy-hook.sh` (one-time, on prod).
# Test with `certbot renew --force-renewal --dry-run` (does not actually
# renew, but exercises the hook chain).
#
# Caveats:
#   - This is the prod-only path. If the renewal authenticator can't
#     complete the challenge in the first place, this hook never fires.
#     The current renewal config uses authenticator=standalone which
#     conflicts with the docker nginx on port 80 — see
#     deployment/scripts/README-certbot.md for the full picture.

set -euo pipefail

DOMAIN="${RENEWED_DOMAINS:-rowlyknit.com}"
SSL_DIR="/root/rowlyknit/deployment/ssl"
COMPOSE_DIR="/root/rowlyknit"
LIVE_DIR="${RENEWED_LINEAGE:-/etc/letsencrypt/live/${DOMAIN}}"

# When run by certbot, $RENEWED_LINEAGE points at the lineage that just
# renewed (handles the rowlyknit.com vs rowlyknit.com-0001 case
# automatically). When run manually for a smoke test, fall back to the
# default symlinked lineage.

log() {
    echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] certbot-deploy-hook: $*"
    logger -t certbot-deploy-hook "$*"
}

if [ ! -f "${LIVE_DIR}/fullchain.pem" ] || [ ! -f "${LIVE_DIR}/privkey.pem" ]; then
    log "ERROR: cert files not found in ${LIVE_DIR}"
    exit 1
fi

# Snapshot the previous cert in case we need to roll back manually.
TS=$(date -u +%s)
if [ -f "${SSL_DIR}/fullchain.pem" ]; then
    cp "${SSL_DIR}/fullchain.pem" "${SSL_DIR}/fullchain.pem.replaced-${TS}"
    cp "${SSL_DIR}/privkey.pem"   "${SSL_DIR}/privkey.pem.replaced-${TS}"
fi

cp "${LIVE_DIR}/fullchain.pem" "${SSL_DIR}/fullchain.pem"
cp "${LIVE_DIR}/privkey.pem"   "${SSL_DIR}/privkey.pem"
chmod 644 "${SSL_DIR}/fullchain.pem"
chmod 600 "${SSL_DIR}/privkey.pem"

log "copied renewed cert for ${DOMAIN} into ${SSL_DIR}"

# Validate config inside the running nginx container before reloading.
cd "${COMPOSE_DIR}"
if ! docker compose exec -T nginx nginx -t >/dev/null 2>&1; then
    log "ERROR: nginx -t FAILED after cert copy; not reloading"
    exit 1
fi

docker compose exec -T nginx nginx -s reload
log "nginx reloaded"
