FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json tsconfig.node.json ./
COPY shared/ shared/
COPY bot/ bot/
COPY dashboard/server/ dashboard/server/
COPY dashboard/web/ dashboard/web/
COPY scripts/ scripts/

RUN npm install --no-audit --no-fund --ignore-scripts \
  && npx tsc -p tsconfig.node.json \
  && npx vite build --config dashboard/web/vite.config.mjs \
  && npm ci --omit=dev --ignore-scripts

ENV NODE_ENV=production
CMD ["node", "dist-node/dashboard/server/src/index.js"]