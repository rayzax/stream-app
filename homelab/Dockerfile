# Homelab proxy image — the same @stream/proxy module Cloud Run uses, run as
# its own small standalone server behind a Cloudflare Tunnel / Tailscale
# Funnel sidecar (see docker-compose.yml in this directory).
# Build from the REPO ROOT: docker build -f homelab/Dockerfile -t stream-homelab-proxy .

FROM node:22-slim AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/stream-proxy/package.json packages/stream-proxy/package.json
RUN npm ci

COPY packages/stream-proxy packages/stream-proxy
RUN npm run build -w @stream/proxy
RUN npm prune --omit=dev

FROM node:22-slim
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/stream-proxy/dist ./packages/stream-proxy/dist
COPY --from=build /repo/packages/stream-proxy/package.json ./packages/stream-proxy/package.json

EXPOSE 8181
CMD ["node", "packages/stream-proxy/dist/standalone.js"]
