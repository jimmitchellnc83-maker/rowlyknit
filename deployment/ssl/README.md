# SSL Certificates for Rowly Production

This directory contains SSL certificates for the Rowly application.

## Current Setup: Self-Signed Certificates

For development and testing, self-signed SSL certificates have been generated.

### Regenerating Self-Signed Certificates

If you need to regenerate the self-signed certificates, run:

```bash
cd /home/user/rowlyknit/deployment/ssl

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/C=US/ST=State/L=City/O=Rowly/CN=rowlyknit.com" \
  -addext "subjectAltName=DNS:rowlyknit.com,DNS:www.rowlyknit.com,DNS:api.rowlyknit.com"
```

## Production Setup: Let's Encrypt (Recommended)

For production, you should use Let's Encrypt certificates:

### Prerequisites
- Domain names (rowlyknit.com, api.rowlyknit.com) must point to your server's IP
- Ports 80 and 443 must be open and accessible
- Certbot must be installed

### Install Certbot

```bash
sudo apt update
sudo apt install certbot
```

### Option 1: Using Certbot Standalone

Stop nginx first, then run:

```bash
sudo certbot certonly --standalone \
  -d rowlyknit.com \
  -d www.rowlyknit.com \
  -d api.rowlyknit.com \
  --email your-email@example.com \
  --agree-tos
```

Then copy certificates to this directory:

```bash
sudo cp /etc/letsencrypt/live/rowlyknit.com/fullchain.pem ./
sudo cp /etc/letsencrypt/live/rowlyknit.com/privkey.pem ./
sudo chown $(whoami):$(whoami) *.pem
```

### Option 2: Using Certbot with Nginx

Update the nginx configuration to temporarily use HTTP-only, then:

```bash
sudo certbot --nginx \
  -d rowlyknit.com \
  -d www.rowlyknit.com \
  -d api.rowlyknit.com \
  --email your-email@example.com \
  --agree-tos
```

### Auto-Renewal

Set up automatic renewal:

```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab (runs daily)
echo "0 0 * * * root certbot renew --quiet --post-hook 'cd /home/user/rowlyknit && docker compose restart nginx'" | sudo tee -a /etc/crontab
```

## Current Nginx Configuration

The nginx configuration expects certificates at:
- `/etc/nginx/ssl/fullchain.pem` (inside container)
- `/etc/nginx/ssl/privkey.pem` (inside container)

These map to:
- `./deployment/ssl/fullchain.pem` (on host)
- `./deployment/ssl/privkey.pem` (on host)

## Security Notes

- The `.gitignore` file is configured to ignore `*.pem` files to prevent accidentally committing private keys
- Never commit SSL private keys to version control
- Ensure proper file permissions: `chmod 644 fullchain.pem && chmod 600 privkey.pem`
- Use strong, production-grade certificates (Let's Encrypt) for production environments
