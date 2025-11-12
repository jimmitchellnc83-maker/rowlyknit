# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Upgrade npm to support lockfileVersion 3
RUN npm install -g npm@latest

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY knexfile.ts ./

# Install dependencies (including TypeScript)
RUN npm install && \
    npm cache clean --force

# Copy source code
COPY src ./src
COPY migrations ./migrations
COPY seeds ./seeds

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Upgrade npm to support lockfileVersion 3
RUN npm install -g npm@latest

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --omit=dev && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations

# Create necessary directories
RUN mkdir -p /app/uploads /backups /var/log/rowly && \
    chown -R nodejs:nodejs /app /backups /var/log/rowly

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 5000 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/server.js"]
