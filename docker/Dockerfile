FROM node:20-alpine
RUN apk add --no-cache tzdata && addgroup -S app && adduser -S app -G app
WORKDIR /app

# Copie le manifest (et lock s’il existe)
COPY app/package.json ./
# Si un lockfile existe, on l’utilise ; sinon on tombe sur npm install
# (npm ci échoue sans package-lock.json)
RUN npm install --omit=dev

COPY app/ ./

USER app
ENV NODE_ENV=production
CMD ["node", "/app/index.js"]
