# server/Dockerfile
# Use Debian Bookworm slim image for Python 3.11 support (yt-dlp requires 3.10+)
FROM node:18-bookworm-slim

# Install FFmpeg, Python, pip, and minimal build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3.11 \
    python3.11-venv \
    python3-pip \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Update default python3 to use python3.11 (required for yt-dlp)
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

# Install standalone yt-dlp binary (the zipapp requires Python 3.10+)
RUN curl -L -o /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

# Install CPU-friendly PyTorch and a pinned Whisper version to avoid dependency resolution conflicts on Render
# Use a torch version that has prebuilt wheels across common Python versions
ENV CUDA_VISIBLE_DEVICES=""
RUN python3.11 -m pip install --no-cache-dir \
    torch==2.0.1 \
    openai-whisper==20231117 \
    numpy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install --production

# Copy app source
COPY . .

# Expose port (Render assigns port dynamically via PORT env var)
EXPOSE 3000

# Start command
CMD ["npm", "start"]
