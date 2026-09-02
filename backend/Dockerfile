# Multi-stage Dockerfile para Backend TypeScript
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

# Stage 2: Producción
FROM node:18-alpine AS runner

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV DATA_DIR=/usr/src/app/data

CMD ["node", "dist/server.js"]
