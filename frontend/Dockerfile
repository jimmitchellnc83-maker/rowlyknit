# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies deterministically from the committed lockfile.
# @rollup/rollup-linux-x64-musl is already an optional dep in package-lock.json,
# so `npm ci` picks it up on Alpine automatically — no need to `rm` the lockfile
# or re-run `npm install`. That workaround was for an old npm bug with optional
# deps on Alpine that's since been fixed.
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build arguments
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build application.
# `NODE_OPTIONS=--max-old-space-size=1536` raises the V8 old-space ceiling
# from its default (~0.5–1 GB) so tsc + vite can fit the project's module
# graph on the 2 GB droplet. Tesseract.js and @zxing/library each pull in
# hundreds of type-declaration / bundle modules; without the bump, the
# build SIGABRTs during type-checking (see PR #106 post-mortem).
RUN NODE_OPTIONS=--max-old-space-size=1536 npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Create necessary directories and set permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx && \
    chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx && \
    chmod -R 755 /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
