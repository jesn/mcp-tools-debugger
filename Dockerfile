# Build stage - install dependencies
FROM --platform=$BUILDPLATFORM node:22-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/

RUN npm ci

# Build stage - compile
FROM node:22-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/client/node_modules ./client/node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY . .

RUN npm run build

# Prune devDependencies
RUN npm prune --workspace=client --workspace=server --omit=dev && \
    npm prune --omit=dev

# Runtime stage
FROM node:22-slim

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/client/package.json ./client/
COPY --from=builder /app/client/node_modules ./client/node_modules
COPY --from=builder /app/client/bin ./client/bin
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/build ./server/build
COPY --from=builder /app/server/static ./server/static

ENV HOST=0.0.0.0
ENV CLIENT_PORT=6274
ENV SERVER_PORT=6277
ENV MCP_AUTO_OPEN_ENABLED=false

EXPOSE 6274 6277

CMD ["node", "client/bin/start.js"]
