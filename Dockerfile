# Build stage
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/

RUN npm ci

COPY . .

RUN npm run build

# Prune devDependencies
RUN npm prune --omit=dev

# Runtime stage
FROM node:22-slim

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/client/package.json ./client/
COPY --from=builder /app/client/bin ./client/bin
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/server/build ./server/build
COPY --from=builder /app/server/static ./server/static

ENV HOST=0.0.0.0
ENV CLIENT_PORT=6274
ENV SERVER_PORT=6277
ENV MCP_AUTO_OPEN_ENABLED=false

EXPOSE 6274 6277

CMD ["node", "client/bin/start.js"]
