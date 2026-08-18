FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/database/package*.json ./packages/database/
COPY packages/types/package*.json ./packages/types/

RUN npm install

COPY . .

RUN npm run build --workspace=packages/types
RUN npm run build --workspace=packages/database
RUN npm run build --workspace=apps/api

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app ./

RUN chmod +x /app/apps/api/docker-entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["/bin/sh", "/app/apps/api/docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/server.js"]
