# ============================================================
# NCC Digital Command & Cadet Management System - Backend
# Multi-stage production container for Node.js + Prisma
# ============================================================

# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Copy application source code
COPY tsconfig.json ./
COPY src ./src/

# Generate Prisma Client & compile TypeScript
RUN npx prisma generate
RUN npm run build

# Prune development dependencies
RUN npm prune --production

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5050

# Security: run as non-root user
USER node

# Copy production dependencies and compiled build
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/prisma ./prisma

EXPOSE 5050

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5050/api/health || exit 1

CMD ["node", "dist/server.js"]
