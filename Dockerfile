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
ARG SERVICE
ENV SERVICE=${SERVICE} \
    NODE_ENV=production
ENV PATH="/app/node_modules/.bin:${PATH}"

CMD ["sh", "-c", "bun apps/${SERVICE}/src/index.ts"]
