FROM node:22-bookworm-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/browser-state/package.json packages/browser-state/package.json
COPY packages/case-content/package.json packages/case-content/package.json
COPY packages/content-tools/package.json packages/content-tools/package.json
COPY packages/game-engine/package.json packages/game-engine/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @whereabouts/web build

FROM node:22-bookworm-slim AS runtime

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV="production"
ENV PORT="3000"

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/browser-state/package.json packages/browser-state/package.json
COPY packages/case-content/package.json packages/case-content/package.json
COPY packages/game-engine/package.json packages/game-engine/package.json

RUN pnpm install --prod --frozen-lockfile --filter @whereabouts/web...

COPY --from=build /app/apps/web/dist apps/web/dist

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["./node_modules/.bin/srvx", "serve", "--prod", "--dir=.", "--host", "0.0.0.0", "--port", "3000", "--static=dist/client", "--entry=dist/server/server.js"]
