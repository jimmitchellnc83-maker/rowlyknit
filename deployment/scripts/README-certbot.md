# Certbot deploy-hook — Rowly prod

When Let's Encrypt renews `rowlyknit.com`, the renewed cert lands in
`/etc/letsencrypt/live/rowlyknit.com/`. The rowly nginx docker
container reads from `/root/rowlyknit/deployment/ssl/` (mounted
read-only into the container at `/etc/nginx/ssl`). Without a deploy
hook, renewals don't propagate — the container keeps serving the old
cert until someone manually copies + reloads.

## What this directory ships

- `certbot-deploy-hook.sh` — copies the renewed cert into
  `deployment/ssl/`, validates the config, and reloads nginx in the
  docker stack. Snapshots the previous cert with a `.replaced-<ts>`
  suffix so a manual roll-back is one `cp` away.
- `install-certbot-deploy-hook.sh` — symlinks the hook into
  `/etc/letsencrypt/renewal-hooks/deploy/rowly.sh`. Idempotent.

## Install (one-time, on prod)

```bash
ssh rowly
cd /root/rowlyknit
git pull
sudo ./deployment/scripts/install-certbot-deploy-hook.sh
```

Verify:

```bash
# Dry-run renewal — does not issue a new cert, but exercises the hook
sudo certbot renew --dry-run

# Or run the hook directly against the current live cert
sudo /root/rowlyknit/deployment/scripts/certbot-deploy-hook.sh
```

## Known gap — automated renewal currently can't complete

The renewal config in `/etc/letsencrypt/renewal/rowlyknit.com.conf`
specifies `authenticator = standalone`, which needs to bind port 80
during validation. The rowly nginx container already owns ports 80 + 443,
so standalone always fails — explaining why the cert hasn't auto-renewed
since it was issued.

The nginx config has a webroot challenge route already wired:

```
location /.well-known/acme-challenge/ {
    root /var/www/certbot;
}
```

…but `/var/www/certbot` is **not** mounted into the docker nginx
container. To make automated renewal work end-to-end, three things
need to change together:

1. Mount `/var/www/certbot` into the nginx container in
   `docker-compose.yml`
2. Switch `authenticator = standalone` → `authenticator = webroot` in
   `/etc/letsencrypt/renewal/rowlyknit.com.conf` and add
   `webroot_path = /var/www/certbot`
3. Confirm certbot can write to `/var/www/certbot` (create the
   directory if needed, owned by `www-data` or run certbot as root)

Tracked separately — the deploy-hook in this directory is useful
either way (manual renewals propagate too).
