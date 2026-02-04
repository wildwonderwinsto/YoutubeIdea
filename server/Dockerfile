# server/Dockerfile
# Use a Debian-based slim image so PyTorch CPU wheels (manylinux) install cleanly
FROM node:18-bullseye-slim

# Install FFmpeg, Python, pip, and minimal build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-friendly PyTorch and a pinned Whisper version to avoid dependency resolution conflicts on Render
# Use a torch version that has prebuilt wheels across common Python versions
ENV CUDA_VISIBLE_DEVICES=""
RUN pip3 install --no-cache-dir \
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
