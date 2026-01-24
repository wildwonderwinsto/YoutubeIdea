const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const isDevelopment = process.env.NODE_ENV !== 'production';

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
    const filename = req.query.filename || 'video';

    if (!videoUrl) {
        return res.status(400).json({ error: 'Missing video URL' });
    }

    if (isDevelopment) {
        console.log(`📥 Download request: ${videoUrl}`);
    }

    // Detect platform and get appropriate yt-dlp binary
    const platform = process.platform;
    let ytDlpBinary;
    
    if (platform === 'win32') {
        ytDlpBinary = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');
    } else if (platform === 'darwin') {
        ytDlpBinary = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp');
    } else {
        // Linux and other platforms
        ytDlpBinary = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp');
    }

    if (isDevelopment) {
        console.log(`Using yt-dlp binary at: ${ytDlpBinary} (platform: ${platform})`);
    }

    // Sanitize filename for use in Content-Disposition header
    const sanitizedFilename = filename
        .replace(/[^a-z0-9]/gi, '_')
        .substring(0, 100) // Limit length
        .toLowerCase() || 'video';
    const finalFilename = `${sanitizedFilename}.mp4`;

    // Set headers for file download
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"; filename*=UTF-8''${encodeURIComponent(finalFilename)}`);

    // Use format that prioritizes already-merged formats first
    // Format priority: 
    // 1. Best merged format (mp4/webm with video+audio)
    // 2. Best video+audio that can be merged
    // 3. Best single format
    // Note: When using stdout (-o -), yt-dlp can merge if ffmpeg is available
    const ytDlp = spawn(ytDlpBinary, [
        '-f', 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '--no-warnings',
        '--no-check-certificate',
        '--no-playlist',
        '--prefer-free-formats',
        '-o', '-', // Output to stdout
        videoUrl
    ]);

    // Handle errors before piping
    let hasError = false;
    let errorMessage = '';

    // Collect stderr for error messages
    ytDlp.stderr.on('data', (data) => {
        const errorText = data.toString();
        if (isDevelopment) {
            console.error(`yt-dlp stderr: ${errorText}`);
        }
        // Check for actual errors (not just warnings)
        if (errorText.toLowerCase().includes('error') || 
            errorText.toLowerCase().includes('unable') ||
            errorText.toLowerCase().includes('failed')) {
            hasError = true;
            errorMessage += errorText;
        }
    });

    // Pipe stdout to response
    ytDlp.stdout.pipe(res);

    // Handle stdout errors (yt-dlp sometimes outputs errors to stdout)
    ytDlp.stdout.on('error', (error) => {
        if (isDevelopment) {
            console.error('yt-dlp stdout error:', error);
        }
        if (!res.headersSent) {
            res.status(500).json({ error: 'Download stream error', details: error.message });
        }
    });

    // Handle process exit
    ytDlp.on('close', (code) => {
        if (code !== 0 || hasError) {
            if (isDevelopment) {
                console.error(`❌ yt-dlp exited with code ${code}${hasError ? ' (with errors)' : ''}`);
                if (errorMessage) {
                    console.error('Error details:', errorMessage);
                }
            }
            if (!res.headersSent) {
                try {
                    res.status(500).json({ 
                        error: 'Download failed', 
                        details: errorMessage || `yt-dlp exited with code ${code}` 
                    });
                } catch (e) {
                    // ignore - response may already be closed
                }
            } else {
                // Headers already sent, can't send error response
                // The stream will just end, which the client should handle
                res.end();
            }
        } else if (isDevelopment) {
            console.log('✅ Download complete');
        }
    });

    // Handle client disconnect
    req.on('close', () => {
        ytDlp.kill();
        if (isDevelopment) {
            console.log('🚫 Client disconnected, killed yt-dlp process');
        }
    });
});

app.listen(PORT, () => {
    if (isDevelopment) {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    }
});
