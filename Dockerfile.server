FROM oven/bun:1.3.13-alpine

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile \
  && bun run --filter @spotify-roadtrip/server build

ENV NODE_ENV=production

CMD ["sh", "-c", "bun run db:migrate && bun run --filter @spotify-roadtrip/server start"]
