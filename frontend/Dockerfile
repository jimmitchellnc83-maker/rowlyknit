# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Upgrade npm to support lockfileVersion 3
# Use npm 10.x which is compatible with Node 18
RUN npm install -g npm@10

# Copy package files
COPY package*.json ./

# Install dependencies
# Work around npm bug with optional dependencies on Alpine
# Delete package-lock.json and do a fresh install with explicit rollup bindings
RUN rm -f package-lock.json && \
    npm install && \
    npm install @rollup/rollup-linux-x64-musl --save-optional && \
    npm cache clean --force

# Copy source code
COPY . .

# Build arguments
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build application
RUN npm run build

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
