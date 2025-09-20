FROM node:20-alpine

# tzdata pour Europe/Paris (cron interne respecte le TZ)
RUN apk add --no-cache tzdata && \
    addgroup -S app && adduser -S app -G app

WORKDIR /app

# Dépendances minimalistes
COPY app/package.json ./
RUN npm ci --omit=dev

# Code
COPY app/ ./

USER app

ENV NODE_ENV=production
CMD ["node", "/app/index.js"]
