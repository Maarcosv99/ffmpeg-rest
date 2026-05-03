FROM oven/bun:1 AS base
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json bun.lock* ./
COPY apps ./apps
COPY packages ./packages
RUN bun install --frozen-lockfile --production=false

FROM deps AS runtime
ENV NODE_ENV=production

# Each Railway service overrides this via startCommand in apps/<svc>/railway.json:
#   bun apps/api/src/index.ts
#   bun apps/worker/src/index.ts
CMD ["bun", "apps/api/src/index.ts"]
