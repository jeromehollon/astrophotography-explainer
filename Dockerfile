# Multi-stage build (SPEC §4.7): build the SPA, then a slim runtime that serves
# dist/ and GET /api/roi with data/derived/runtime baked in at /data.
#   docker build -t stacking-explainer .
#   docker run -p 8080:8080 stacking-explainer
# data/derived/runtime must exist (bash tools/precompute/run_stage_c.sh) before building.

FROM node:22 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json ./
COPY public ./public
COPY src ./src
COPY assets ./assets
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production ASTRO_DATA=/data PORT=8080
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY data/derived/runtime /data
EXPOSE 8080
CMD ["node", "server/index.js"]
