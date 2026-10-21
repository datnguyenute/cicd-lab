# syntax=docker/dockerfile:1
# Multi-stage build: image cuối chỉ chứa code đã build + dependency production

# ---- base: OS + openssl (Prisma engine cần) ----
# Node version PHẢI khớp với máy dev và CI (xem .nvmrc) — lệch npm major là `npm ci` fail
FROM node:24-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- deps: cài toàn bộ dependency (tách riêng để tận dụng cache layer) ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile TypeScript, generate Prisma client, bỏ devDependencies ----
FROM deps AS build
COPY . .
RUN npx prisma generate \
 && npm run build \
 && npm prune --omit=dev

# ---- runner: image chạy thật trên Cloud Run ----
FROM base AS runner
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    PORT=8080
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
# Không chạy bằng root
USER node
EXPOSE 8080
CMD ["node", "dist/main"]
