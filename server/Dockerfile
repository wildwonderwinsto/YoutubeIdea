# server/Dockerfile
FROM node:18-alpine

# Install FFmpeg, Python, and system dependencies
RUN apk update && \
    apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    gcc \
    musl-dev \
    python3-dev

# Install Whisper and its dependencies
RUN pip3 install --break-system-packages --no-cache-dir \
    openai-whisper \
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
