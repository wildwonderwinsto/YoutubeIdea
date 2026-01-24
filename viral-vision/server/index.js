const express = require('express');
const cors = require('cors');
const { exec } = require('youtube-dl-exec');
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

    console.log(`Received download request for: ${videoUrl}`);

    try {
        // Just get the info first to get the title
        // We use a promise here to get metadata
        // Note: exec returns a promise that resolves with the output

        // This is a direct stream pipe. 
        // We set headers for attachment.
        res.header('Content-Disposition', 'attachment; filename="video.mp4"');
        res.header('Content-Type', 'video/mp4');

        // Execute yt-dlp to stream data to stdout
        // We use the 'exec' function from youtube-dl-exec which spawns the process
        // streaming stdout to our response

        // Execute yt-dlp to stream data to stdout
        // We use the 'exec' function from youtube-dl-exec which spawns the process
        // streaming stdout to our response

        const subprocess = exec(videoUrl, {
            output: '-',
            format: 'best[ext=mp4]/best', // Force single file to avoid ffmpeg merge requirement
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
        }, { stdio: ['ignore', 'pipe', 'pipe'] }); // Capture stderr for debugging

        // Pipe the subprocess stdout to the response
        subprocess.stdout.pipe(res);

        subprocess.stdout.on('end', () => {
            console.log('Download stream ended');
        });

        subprocess.stderr?.on('data', (data) => {
            console.error(`yt-dlp stderr: ${data}`);
        });

    } catch (error) {
        console.error('Download error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed', details: error.message });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
