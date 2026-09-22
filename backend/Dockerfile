FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache tzdata
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy backend dependencies
COPY backend/package.json backend/pnpm-lock.yaml ./backend/
WORKDIR /app/backend
RUN pnpm install --frozen-lockfile

# Copy sources and catalog data for schema build and seed compilation
WORKDIR /app
COPY data ./data
COPY sql ./sql
COPY backend ./backend

WORKDIR /app/backend
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm run prisma:sync
RUN pnpm run build

FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache tzdata
ENV NODE_ENV=production \
    TZ=Asia/Dhaka \
    PORT=4000

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY --from=builder /app/data ./data
COPY --from=builder /app/sql ./sql
COPY --from=builder /app/backend ./backend

WORKDIR /app/backend
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/admin/settings').then(r=>process.exit(r.status===401||r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
