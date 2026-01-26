# server/Dockerfile
FROM node:18-alpine

# Install FFmpeg and Python (required for yt-dlp)
RUN apk update && \
    apk add --no-cache ffmpeg python3 py3-pip

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy app source
COPY . .

# Expose port (Render assigns port dynamically via PORT env var)
EXPOSE 3000

# Start command
CMD ["npm", "start"]
