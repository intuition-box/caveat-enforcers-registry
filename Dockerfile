FROM node:22-slim

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install --global pnpm@11.1.2 \
  && pnpm install --frozen-lockfile

COPY . .
RUN pnpm check

ENV HOST=0.0.0.0
ENV PORT=8787
CMD ["pnpm", "server"]
