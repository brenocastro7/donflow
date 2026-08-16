FROM node:24.18.0-bookworm-slim AS build

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY apps/api apps/api
RUN npm exec --workspace=apps/api -- prisma generate
RUN npm run build --workspace=apps/api

FROM node:24.18.0-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY apps/api/prisma apps/api/prisma
COPY apps/api/src/config apps/api/src/config
RUN npm ci --omit=dev --workspace=apps/api
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
RUN chown -R node:node /app

ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["sh", "-c", "npm exec --workspace=apps/api -- prisma migrate deploy && node apps/api/dist/src/main.js"]
