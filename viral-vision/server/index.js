const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'ViralVision Downloader Server is Running 🚀' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'viral-vision-downloader' });
});

// Download endpoint
app.get('/download', async (req, res) => {
    const videoUrl = req.query.url;

    if (!videoUrl) {
        return res.status(400).json({ error: 'Missing video URL' });
    }

    console.log(`📥 Download request: ${videoUrl}`);

    // Set headers for file download
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');

    // Use local binary from youtube-dl-exec package to avoid global install requirement
    const ytDlpPath = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');
    console.log(`Using yt-dlp binary at: ${ytDlpPath}`);

    const ytDlp = spawn(ytDlpPath, [
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--no-warnings',
        '--no-check-certificate',
        '-o', '-', // Output to stdout
        videoUrl
    ]);

    // Pipe stdout to response
    ytDlp.stdout.pipe(res);

    // Log errors
    ytDlp.stderr.on('data', (data) => {
        console.error(`yt-dlp: ${data.toString()}`);
    });

    // Handle process exit
    ytDlp.on('close', (code) => {
        if (code !== 0) {
            console.error(`❌ yt-dlp exited with code ${code}`);
            if (!res.headersSent) {
                // If the stream hasn't started, we can send a 500.
                // If it has, the connection will just close, which is expected.
                try {
                    res.status(500).json({ error: 'Download failed' });
                } catch (e) {
                    // ignore
                }
            }
        } else {
            console.log('✅ Download complete');
        }
    });

    // Handle client disconnect
    req.on('close', () => {
        ytDlp.kill();
        console.log('🚫 Client disconnected, killed yt-dlp process');
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
