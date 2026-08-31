# --- dev stage ---------------------------------------------------------------
# Used by docker-compose for local work, so nothing needs installing on the host.
FROM node:22-alpine AS dev

WORKDIR /app
ENV NODE_ENV=development

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

CMD ["npm", "run", "dev"]

# --- build stage -------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copied separately so a source-only change reuses the cached install layer.
# The glob makes the lockfile optional: a clean checkout still builds, and the
# reproducible `npm ci` path is used automatically once a lockfile exists.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies so they are never copied into the runtime image.
RUN npm prune --omit=dev

# --- runtime stage -----------------------------------------------------------
FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# The image ships with an unprivileged `node` user; use it.
USER node

# Read by the app from process.env.PORT, so Cloud Run / Render / Fly can
# override it without a rebuild.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]
