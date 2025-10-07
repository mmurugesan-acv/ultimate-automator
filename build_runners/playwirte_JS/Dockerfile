FROM mcr.microsoft.com/playwright:v1.55.1-jammy

RUN apt-get update && apt-get install -y \
    xvfb \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN npm install

CMD ["bash", "-c", "Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset & node server.js"]
