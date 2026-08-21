FROM node:22-alpine

# ffmpeg is required for audio playback (music system). The bundled
# ffmpeg-static binary is NOT downloaded because npm installs run with
# --ignore-scripts, so install the system package instead.
# yt-dlp is used for YouTube/URL playback — far more reliable against
# YouTube's bot-detection than the JS extractors.
RUN apk add --no-cache ffmpeg yt-dlp

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
  && npm ci --omit=dev --ignore-scripts

ENV NODE_ENV=production
CMD ["node", "dist-node/bot/src/index.js"]