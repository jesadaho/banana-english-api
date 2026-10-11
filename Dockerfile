# Build stage
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

# Lockfile + npm ci: reproducible, faster installs, and a cache key that only changes with dependencies.
# prisma/ must exist before install (no postinstall — generate runs explicitly below).
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build
RUN test -f dist/main.js

# Keep only runtime dependencies, then regenerate the Prisma client so it is
# guaranteed to sit in the node_modules the runtime image copies.
RUN npm prune --omit=dev && npx prisma generate

# Production stage — reuses the builder's node_modules instead of installing a second time.
FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
COPY prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY scripts/start.sh ./scripts/start.sh
RUN chmod +x ./scripts/start.sh

EXPOSE 8000

CMD ["./scripts/start.sh"]
