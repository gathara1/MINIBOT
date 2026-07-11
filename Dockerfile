FROM node:20-slim

# Install system deps for Baileys, ffmpeg, canvas, sharp
RUN apt-get update && apt-get install -y \
    git \
    ffmpeg \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Use npm install if no package-lock.json exists
RUN npm install --omit=dev

COPY . .

# Create session folder
RUN mkdir -p sessions

EXPOSE 3000

ENV NODE_OPTIONS="--max-old-space-size=512 --expose-gc"

CMD ["node", "index.js"]
