# syntax=docker/dockerfile:1

# Same base image in every stage so the Prisma engine generated in
# "builder" is guaranteed binary-compatible with the "runner" it ships in.
ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# `next build --output standalone` only traces modules the Next.js server
# itself imports at runtime. The Prisma CLI (needed by the entrypoint's
# `prisma db push`) and nodemailer (loaded via a webpack-ignored dynamic
# import in lib/email.ts) are never picked up by that trace, so they're
# copied in explicitly.
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=builder /app/node_modules/nodemailer ./node_modules/nodemailer

# Fails the build loudly here instead of failing a real password-reset or
# automation-alert email in production.
RUN node -e "require('./node_modules/nodemailer')"

COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./docker/entrypoint.sh"]
