FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY backend/package*.json backend/
RUN npm --prefix backend ci
COPY backend/tsconfig.json backend/
COPY backend/src/ backend/src/
RUN npm --prefix backend run build && npm --prefix backend prune --omit=dev

COPY browser/package*.json browser/
RUN npm --prefix browser ci
COPY browser/tsconfig.json browser/
COPY browser/src/ browser/src/
RUN npm --prefix browser run build

COPY demo/package*.json demo/
RUN npm --prefix demo ci --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0

COPY --from=build /app/backend/package.json backend/
COPY --from=build /app/backend/dist/ backend/dist/
COPY --from=build /app/backend/node_modules/ backend/node_modules/
COPY --from=build /app/browser/dist/ browser/dist/
COPY --from=build /app/demo/node_modules/ demo/node_modules/
COPY demo/index.html demo/server.mjs demo/

USER node
CMD ["node", "demo/server.mjs"]
