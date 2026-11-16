# Builds the whole monorepo (build context = repo root) into a single image:
# backend (apps/api) + built frontend (apps/web/dist) + shared stream-proxy
# package. This is the image deployed to Cloud Run (STREAM_MODE=cloudrun).
# For the homelab proxy's own image, see homelab/Dockerfile.

FROM node:22-slim AS build
WORKDIR /repo

# Install deps first (cache-friendly): copy only package manifests.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/stream-proxy/package.json packages/stream-proxy/package.json
RUN npm ci

# Now bring in the actual source and build each workspace in dependency order:
# stream-proxy (library) -> stream-api (depends on its types) -> stream-web (independent).
COPY . .
RUN npm run build -w @stream/proxy && \
    npm run build -w stream-api && \
    npm run build -w stream-web

# Drop devDependencies but keep workspace symlinks intact.
RUN npm prune --omit=dev

FROM node:22-slim
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/web/dist ./apps/web/dist
COPY --from=build /repo/packages/stream-proxy/dist ./packages/stream-proxy/dist
COPY --from=build /repo/packages/stream-proxy/package.json ./packages/stream-proxy/package.json

EXPOSE 8080
CMD ["node", "apps/api/dist/index.js"]
