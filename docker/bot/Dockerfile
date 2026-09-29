# bookworm-slim (glibc) — native addons (sharp, ffmpeg-static) ship glibc prebuilds.
FROM node:22-bookworm-slim

# ffmpeg is required for audio playback (music system) — the bundled
# ffmpeg-static binary is downloaded during npm ci (postinstall), so no
# system package needed here.
# yt-dlp is used for YouTube/URL playback — far more reliable against
# YouTube's bot-detection than the JS extractors.
# python3/make/g++ let native addons fall back to a source build
# if a prebuilt binary download ever fails.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ curl ca-certificates fonts-liberation fontconfig \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
       -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json tsconfig.node.json ./
COPY shared/ shared/
COPY bot/ bot/
COPY dashboard/server/ dashboard/server/
COPY dashboard/web/ dashboard/web/
COPY scripts/ scripts/
COPY emojis/ emojis/

# npm install (all deps) lets npx tsc find TypeScript and ensures native
# addons (sharp, ffmpeg-static) download their binaries.
# npm ci --omit=dev replaces with a clean production install (scripts still
# run so platform binaries are fetched).  sharp is reinstalled explicitly
# because --omit=dev can strip its prebuilt binaries.  npm rebuild is a
# safety net for any remaining native addons.
RUN npm install --no-audit --no-fund \
  && npx tsc -p tsconfig.node.json \
  && npm ci --omit=dev \
  && npm install sharp --no-audit --no-fund --omit=dev \
  && npm rebuild

ENV NODE_ENV=production
CMD ["node", "dist-node/bot/src/index.js"]
