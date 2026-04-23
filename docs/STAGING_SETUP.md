# Staging environment setup

First-time provisioning for the `staging.rowlyknit.com` droplet. Follow
top-to-bottom. Expected total time: ~30–45 min.

## Architecture

```
feature branch ──► PR to main ──► merge ──► ⛅ prod (rowlyknit.com)
                                            │
                                            ╰─ `git push` to staging branch
                                               ──► ⛅ staging (staging.rowlyknit.com)
```

- **Two droplets**: same config, different DBs, different env.
- **One repo, two branches**: `main` → prod, `staging` → staging.
- **Auto-deploy**: GitHub Action on push to `staging` SSHes + pulls + rebuilds.
  Prod deploys stay manual for now (we can wire prod on the same pattern later).

## What you provision

### 1. New DigitalOcean droplet

- **Plan**: same as prod (Basic, 2 GB / 1 vCPU, ~$12/mo). Frontend build
  needs 1.5 GB heap — 1 GB droplets will OOM.
- **Region**: same as prod.
- **Image**: Ubuntu 24.04 LTS.
- **Authentication**: paste your SSH public key.

Record the IP address.

### 2. DNS records (at your registrar)

Point these at the new droplet IP:

- `staging.rowlyknit.com` A → `<new IP>`
- `api-staging.rowlyknit.com` A → `<new IP>`

TTL 300. Propagation is usually a few minutes.

### 3. SSH config on your local machine

Add to `~/.ssh/config`:

```
Host rowly-staging
  HostName <new IP>
  User root
  IdentityFile ~/.ssh/<your-key>
```

Verify: `ssh rowly-staging 'uptime'` returns something.

## Set up the droplet

SSH in and run the existing bootstrap scripts. These are in
`deployment/scripts/` and work identically for staging.

```bash
ssh rowly-staging

# Run the same bootstrap as prod.
curl -sSL https://raw.githubusercontent.com/jimmitchellnc83-maker/rowlyknit/staging/deployment/scripts/server-setup.sh | sudo bash
# ^^ or scp deployment/scripts/server-setup.sh across and run it manually if
# the repo is private and the raw URL needs auth.

# Clone the repo.
mkdir -p /home/user
cd /home/user
git clone git@github.com:jimmitchellnc83-maker/rowlyknit.git
# ^^ requires the droplet's SSH deploy key to be added to the repo's
# Settings → Deploy keys page with read access.
cd rowlyknit
git checkout staging
```

### Create the staging `.env`

```bash
cd /home/user/rowlyknit/backend
cp .env.example .env
```

Edit `.env`. **Generate fresh secrets — do NOT reuse prod's.**

- `JWT_SECRET` — new 64-char random
- `CSRF_SECRET` — new 64-char random
- `SESSION_SECRET` — new 64-char random
- `DB_NAME` — `rowly_staging`
- `DB_USER` — `rowly_staging_user`
- `DB_PASSWORD` — new random
- `REDIS_PASSWORD` — new random
- `NODE_ENV=staging`
- `ALLOWED_ORIGINS=https://staging.rowlyknit.com`
- Ravelry OAuth — create a new Ravelry OAuth app with staging callback URL,
  OR point at prod's Ravelry credentials if you're fine with shared integration
  testing.

### Point nginx at the staging conf

```bash
cp deployment/nginx/conf.d/rowlyknit-staging.conf /etc/nginx/conf.d/
# (and disable the prod rowlyknit.conf — or don't, nginx will just serve the
#  server_name that matches the incoming Host header)
```

### Issue SSL certs

```bash
certbot --nginx \
  -d staging.rowlyknit.com \
  -d api-staging.rowlyknit.com
```

### First deploy

```bash
cd /home/user/rowlyknit
docker compose up -d postgres redis
sleep 5
docker compose exec -T postgres psql -U postgres -c "CREATE USER rowly_staging_user WITH PASSWORD '<same as DB_PASSWORD>';"
docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE rowly_staging OWNER rowly_staging_user;"
docker compose build backend frontend
docker compose up -d
docker compose exec -T backend npm run migrate
```

Verify: `curl https://staging.rowlyknit.com/health` returns 200.

## Wire the GitHub Action

At https://github.com/jimmitchellnc83-maker/rowlyknit/settings/secrets/actions add these repository secrets:

- `STAGING_SSH_HOST` — the droplet IP
- `STAGING_SSH_USER` — `root` (or whatever user you'd SSH as)
- `STAGING_SSH_KEY` — the **private** key that can SSH into the droplet.
  Must be PEM-formatted. Generate a new key pair specifically for CI:

  ```bash
  ssh-keygen -t ed25519 -f deploy_key_staging -N ''
  # Add deploy_key_staging.pub to /root/.ssh/authorized_keys on the droplet
  # Paste the contents of deploy_key_staging into the STAGING_SSH_KEY secret.
  ```

- `STAGING_SSH_PORT` — optional, defaults to 22.

Also add an environment named `staging` at Settings → Environments. Attach the
action's `environment: staging` to it so deploys show up in the Deployments
view. Optional: require manual approval before production-level promotions
get trickier later.

## Test the flow

```bash
# From your local machine.
git checkout staging
echo "/* touch */" >> frontend/src/App.tsx
git commit -am "chore: staging smoke test"
git push origin staging
```

Watch at https://github.com/jimmitchellnc83-maker/rowlyknit/actions — the
`Deploy to Staging` workflow should run and succeed in ~5–8 minutes. Revert
the smoke commit:

```bash
git reset --hard HEAD^
git push --force-with-lease origin staging
```

## Day-to-day

- **Feature work**: same as today — branch from `main`, PR to `main`.
- **When you want to smoke-test before prod**: merge the branch into `staging`
  OR `git push origin branch-name:staging --force-with-lease`. The Action
  redeploys staging automatically.
- **After staging looks good**: merge the PR into `main`. (Prod deploy still
  manual via SSH until we wire the prod equivalent.)

## Resetting staging to match prod

If staging gets messy:

```bash
git fetch origin main
git checkout staging
git reset --hard origin/main
git push --force-with-lease origin staging
```

The next push triggers the Action and staging matches prod exactly.

## Staging database refresh

Periodically you'll want staging to have a representative DB. Snapshot prod
and restore to staging:

```bash
# On prod
docker compose exec postgres pg_dump -U rowly_user rowly_production > /tmp/prod.sql
scp rowly:/tmp/prod.sql /tmp/prod.sql

# On staging droplet
scp /tmp/prod.sql rowly-staging:/tmp/prod.sql
ssh rowly-staging 'docker compose exec -T postgres psql -U postgres rowly_staging < /tmp/prod.sql'
```

Don't copy user emails/hashes if you share the droplet with other testers —
run a sanitize step first to wipe PII.
