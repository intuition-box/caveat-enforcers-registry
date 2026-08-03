FROM node:22-slim

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm check

ENV HOST=0.0.0.0
ENV PORT=8787
CMD ["pnpm", "server"]
